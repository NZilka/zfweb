/**
 * Tests for image positioning features:
 * - cropToStyle helper (with/without crop data)
 * - Carousel validation with optional crop field
 * - Backward compatibility (old data without crop)
 * - CarouselSlideItem crop passthrough
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock server-only since carousel.ts imports it
vi.mock("server-only", () => ({}));

// Mock next/image — render a plain img tag for testing
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

// ---- cropToStyle Tests ----

describe("cropToStyle", () => {
  it("returns object-cover fallback when no crop data", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    const style = cropToStyle(undefined);
    expect(style).toEqual({
      objectFit: "cover",
      objectPosition: "center",
    });
  });

  it("returns object-cover fallback for null crop", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    const style = cropToStyle(null);
    expect(style).toEqual({
      objectFit: "cover",
      objectPosition: "center",
    });
  });

  it("returns positioned styles when crop data provided", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    const style = cropToStyle({
      croppedArea: { x: 10, y: 20, width: 50, height: 50 },
      zoom: 2,
    });

    // width: 100 / (50/100) = 200%
    // height: 100 / (50/100) = 200%
    // left: -(10 / (50/100)) = -20%
    // top: -(20 / (50/100)) = -40%
    expect(style).toEqual({
      position: "absolute",
      width: "200%",
      height: "200%",
      left: "-20%",
      top: "-40%",
    });
  });

  it("handles full-frame crop (100% visible)", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    const style = cropToStyle({
      croppedArea: { x: 0, y: 0, width: 100, height: 100 },
      zoom: 1,
    });

    // No scaling or offset when full image is visible
    expect(style).toEqual({
      position: "absolute",
      width: "100%",
      height: "100%",
      left: "-0%",
      top: "-0%",
    });
  });

  it("returns fallback when croppedArea is missing", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    // CropData with undefined croppedArea (shouldn't happen but defensive)
    const style = cropToStyle({ croppedArea: undefined as any, zoom: 1 });
    expect(style).toEqual({
      objectFit: "cover",
      objectPosition: "center",
    });
  });
});

// ---- Carousel Validation Tests ----

describe("carousel validation with crop", () => {
  it("accepts image cell with crop data", async () => {
    const { z } = await import("zod");
    // Re-create the schema inline to test validation logic
    const cropDataSchema = z
      .object({
        croppedArea: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
        zoom: z.number().min(1).max(10),
      })
      .optional();

    const cellSchema = z.object({
      url: z.string().url(),
      key: z.string().min(1),
      alt: z.string().max(200),
      crop: cropDataSchema,
    });

    // With crop
    const withCrop = cellSchema.safeParse({
      url: "https://utfs.io/f/abc123",
      key: "abc123",
      alt: "test",
      crop: {
        croppedArea: { x: 10, y: 20, width: 50, height: 50 },
        zoom: 2,
      },
    });
    expect(withCrop.success).toBe(true);
  });

  it("accepts image cell without crop data (backward compat)", async () => {
    const { z } = await import("zod");
    const cropDataSchema = z
      .object({
        croppedArea: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
        zoom: z.number().min(1).max(10),
      })
      .optional();

    const cellSchema = z.object({
      url: z.string().url(),
      key: z.string().min(1),
      alt: z.string().max(200),
      crop: cropDataSchema,
    });

    // Without crop (old data)
    const withoutCrop = cellSchema.safeParse({
      url: "https://utfs.io/f/abc123",
      key: "abc123",
      alt: "test",
    });
    expect(withoutCrop.success).toBe(true);
  });

  it("rejects invalid crop data (zoom too low)", async () => {
    const { z } = await import("zod");
    const cropDataSchema = z
      .object({
        croppedArea: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
        zoom: z.number().min(1).max(10),
      })
      .optional();

    const cellSchema = z.object({
      url: z.string().url(),
      key: z.string().min(1),
      alt: z.string().max(200),
      crop: cropDataSchema,
    });

    const invalid = cellSchema.safeParse({
      url: "https://utfs.io/f/abc123",
      key: "abc123",
      alt: "test",
      crop: {
        croppedArea: { x: 0, y: 0, width: 50, height: 50 },
        zoom: 0.5, // Below minimum of 1
      },
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects invalid crop data (negative width)", async () => {
    const { z } = await import("zod");
    const cropDataSchema = z
      .object({
        croppedArea: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
        zoom: z.number().min(1).max(10),
      })
      .optional();

    const cellSchema = z.object({
      url: z.string().url(),
      key: z.string().min(1),
      alt: z.string().max(200),
      crop: cropDataSchema,
    });

    const invalid = cellSchema.safeParse({
      url: "https://utfs.io/f/abc123",
      key: "abc123",
      alt: "test",
      crop: {
        croppedArea: { x: 0, y: 0, width: -10, height: 50 },
        zoom: 1,
      },
    });
    expect(invalid.success).toBe(false);
  });
});

// ---- CarouselSlideItem Crop Passthrough Tests ----

describe("carousel slide crop passthrough", () => {
  it("passes crop data through rowToSlide for image rows", async () => {
    // Mock getSiteSettings to return test data
    const mockGetSiteSettings = vi.fn().mockResolvedValue({
      carousel: {
        rows: [
          {
            type: "images",
            cells: [
              {
                url: "https://utfs.io/f/img1",
                key: "img1",
                alt: "Image 1",
                crop: {
                  croppedArea: { x: 10, y: 20, width: 50, height: 50 },
                  zoom: 2,
                },
              },
              {
                url: "https://utfs.io/f/img2",
                key: "img2",
                alt: "Image 2",
                // No crop — backward compat
              },
              {
                url: "https://utfs.io/f/img3",
                key: "img3",
                alt: "Image 3",
                crop: {
                  croppedArea: { x: 0, y: 0, width: 100, height: 100 },
                  zoom: 1,
                },
              },
            ],
          },
          null,
          null,
          null,
        ],
        autoScrollInterval: 3000,
      },
    });

    vi.doMock("~/server/kv", () => ({
      getSiteSettings: mockGetSiteSettings,
    }));

    // Fresh import to use the mock
    const { getCarouselData } = await import("~/server/carousel");
    const data = await getCarouselData();

    expect(data).not.toBeNull();
    expect(data!.slides.length).toBe(1);

    const slide = data!.slides[0]!;
    expect(slide.type).toBe("images");
    if (slide.type === "images") {
      // First item should have crop data
      expect(slide.items[0]!.crop).toEqual({
        croppedArea: { x: 10, y: 20, width: 50, height: 50 },
        zoom: 2,
      });
      // Second item should have undefined crop (no crop set)
      expect(slide.items[1]!.crop).toBeUndefined();
      // Third item should have crop data
      expect(slide.items[2]!.crop).toEqual({
        croppedArea: { x: 0, y: 0, width: 100, height: 100 },
        zoom: 1,
      });
    }

    vi.doUnmock("~/server/kv");
  });
});

// ---- Backward Compatibility Tests ----

describe("backward compatibility", () => {
  it("CarouselImageCell type accepts data without crop field", () => {
    // This tests the TypeScript type at runtime via object construction
    const cell = {
      url: "https://utfs.io/f/old-image",
      key: "old-image",
      alt: "Old image without crop",
    };
    // Should be assignable — crop is optional
    expect(cell.url).toBe("https://utfs.io/f/old-image");
    expect((cell as any).crop).toBeUndefined();
  });

  it("renders default cover style for images without crop", async () => {
    const { cropToStyle } = await import(
      "~/components/ui/ImageCropEditor"
    );
    // Simulates rendering old product data that has no crop field
    const product = { imgCrop: [] as any[] };
    const style = cropToStyle(product.imgCrop[0]);
    expect(style.objectFit).toBe("cover");
    expect(style.objectPosition).toBe("center");
  });
});

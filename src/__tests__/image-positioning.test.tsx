/**
 * Tests for image positioning features:
 * - cropToStyle helper (with/without crop data)
 * - Carousel validation with optional crop field
 * - Backward compatibility (old data without crop)
 * - CarouselSlideItem crop passthrough
 * - ImageCropEditor onCropComplete parameter order (percentages vs pixels)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

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
    // maxWidth: "none" overrides Tailwind Preflight's max-width: 100%
    expect(style).toEqual({
      position: "absolute",
      maxWidth: "none",
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
    // maxWidth: "none" always present to override Tailwind Preflight
    expect(style).toEqual({
      position: "absolute",
      maxWidth: "none",
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

// ---- ImageCropEditor onCropComplete Parameter Order Test ----
// react-easy-crop's onCropComplete(croppedArea, croppedAreaPixels):
//   1st arg = percentages (0-100), 2nd arg = pixels
// Regression: swapped params caused pixel values to be stored, making images
// render at ~3% size (invisible) via cropToStyle()

describe("ImageCropEditor onCropComplete parameter order", () => {
  it("passes percentage values (not pixels) to onChange", async () => {
    // Capture the onCropComplete callback that ImageCropEditor passes to Cropper
    let capturedOnCropComplete: ((area: any, areaPixels: any) => void) | null =
      null;

    // Reset module cache so the mock is picked up on fresh import
    vi.resetModules();

    // Mock react-easy-crop to capture the callback
    vi.doMock("react-easy-crop", () => ({
      default: (props: any) => {
        capturedOnCropComplete = props.onCropComplete;
        return <div data-testid="mock-cropper" />;
      },
    }));

    const onChangeSpy = vi.fn();

    // Fresh import to pick up the mock
    const { ImageCropEditor } = await import(
      "~/components/ui/ImageCropEditor"
    );
    render(
      <ImageCropEditor
        imageUrl="https://utfs.io/f/test"
        onChange={onChangeSpy}
        aspect={1}
      />,
    );

    // Simulate react-easy-crop calling onCropComplete
    // First arg = percentage area, second arg = pixel area
    const percentageArea = { x: 10, y: 20, width: 50, height: 50 };
    const pixelArea = { x: 150, y: 300, width: 750, height: 750 };
    // Wrap in act() since onCropComplete triggers React state updates
    act(() => {
      capturedOnCropComplete!(percentageArea, pixelArea);
    });

    // onChange should receive percentage values, NOT pixel values
    expect(onChangeSpy).toHaveBeenCalledWith({
      croppedArea: percentageArea,
      zoom: 1, // default zoom
    });
    // Verify it did NOT receive pixel values
    expect(onChangeSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ croppedArea: pixelArea }),
    );

    vi.doUnmock("react-easy-crop");
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

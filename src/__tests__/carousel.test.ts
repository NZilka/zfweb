/**
 * Unit tests for carousel server-side logic
 * Tests getCarouselData with row-based carousel model (no auto-generation)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (it throws in non-server environments)
vi.mock("server-only", () => ({}));

// Mock kv module — provides getSiteSettings for carousel config
vi.mock("~/server/kv", () => ({
  getSiteSettings: vi.fn(),
}));

// Import after mocking
import { getCarouselData } from "~/server/carousel";
import { getSiteSettings } from "~/server/kv";

// Helper to create mock site settings with carousel overrides
const mockSettings = (carouselOverrides = {}) => ({
  maintenanceMode: {
    enabled: false,
    message: null,
    imageUrl: null,
    imageKey: null,
  },
  announcementBanner: { enabled: false, text: null, scrolling: false },
  logo: {
    large: { url: null, key: null },
    small: { url: null, key: null },
  },
  carousel: {
    rows: [null, null, null, null],
    autoScrollInterval: 3000,
    ...carouselOverrides,
  },
  updatedAt: Date.now(),
});

// Helper to create a complete images row (all 3 cells filled)
const makeImageRow = (prefix: string) => ({
  type: "images" as const,
  cells: [
    { url: `https://utfs.io/f/${prefix}1.png`, key: `${prefix}1`, alt: `Alt ${prefix}1` },
    { url: `https://utfs.io/f/${prefix}2.png`, key: `${prefix}2`, alt: `Alt ${prefix}2` },
    { url: `https://utfs.io/f/${prefix}3.png`, key: `${prefix}3`, alt: `Alt ${prefix}3` },
  ],
});

// Helper to create a video row
const makeVideoRow = (prefix: string, posY = 50) => ({
  type: "video" as const,
  url: `https://utfs.io/f/${prefix}.mp4`,
  key: `${prefix}`,
  videoPositionY: posY,
});

describe("carousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("no complete rows", () => {
    it("returns null when all rows are null", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());

      const data = await getCarouselData();

      expect(data).toBeNull();
    });

    it("returns null for incomplete image rows (1-2 cells filled)", async () => {
      // Row with only 2 of 3 cells filled — incomplete
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [
            {
              type: "images",
              cells: [
                { url: "https://utfs.io/f/a.png", key: "a", alt: "A" },
                { url: "https://utfs.io/f/b.png", key: "b", alt: "B" },
                null, // Missing third cell
              ],
            },
            null,
            null,
            null,
          ],
        })
      );

      const data = await getCarouselData();

      expect(data).toBeNull();
    });
  });

  describe("single complete row", () => {
    it("builds static carousel from 1 complete image row (no auto-scroll)", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [makeImageRow("img"), null, null, null],
          autoScrollInterval: 5000,
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
      expect(data!.slides[0]!.type).toBe("images");
      // Single slide = no auto-scroll
      expect(data!.autoScroll).toBe(false);
      expect(data!.autoScrollInterval).toBe(5000);
    });

    it("builds static carousel from 1 video row (always complete)", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [makeVideoRow("vid"), null, null, null],
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
      expect(data!.slides[0]!.type).toBe("video");
      expect(data!.autoScroll).toBe(false);
    });
  });

  describe("multiple complete rows", () => {
    it("builds scrolling carousel from 2+ complete rows", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [makeImageRow("a"), makeImageRow("b"), null, null],
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(2);
      // Multiple slides = auto-scroll enabled
      expect(data!.autoScroll).toBe(true);
    });

    it("handles mixed image and video rows", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [
            makeImageRow("img"),
            makeVideoRow("vid", 75),
            null,
            makeImageRow("img2"),
          ],
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(3);
      expect(data!.slides[0]!.type).toBe("images");
      expect(data!.slides[1]!.type).toBe("video");
      expect(data!.slides[2]!.type).toBe("images");
      expect(data!.autoScroll).toBe(true);
    });
  });

  describe("slide data", () => {
    it("image slide contains 3 items with url and alt", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [makeImageRow("test"), null, null, null],
        })
      );

      const data = await getCarouselData();
      const slide = data!.slides[0]!;

      expect(slide.type).toBe("images");
      if (slide.type === "images") {
        expect(slide.items).toHaveLength(3);
        expect(slide.items[0]!.url).toBe("https://utfs.io/f/test1.png");
        expect(slide.items[0]!.alt).toBe("Alt test1");
      }
    });

    it("video slide contains url and videoPositionY", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [makeVideoRow("myvid", 30), null, null, null],
        })
      );

      const data = await getCarouselData();
      const slide = data!.slides[0]!;

      expect(slide.type).toBe("video");
      if (slide.type === "video") {
        expect(slide.url).toBe("https://utfs.io/f/myvid.mp4");
        expect(slide.videoPositionY).toBe(30);
      }
    });

    it("skips incomplete rows between complete rows", async () => {
      // Row 0: complete images, Row 1: incomplete, Row 2: video, Row 3: null
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          rows: [
            makeImageRow("a"),
            {
              type: "images",
              cells: [
                { url: "https://utfs.io/f/x.png", key: "x", alt: "X" },
                null,
                null,
              ],
            },
            makeVideoRow("v"),
            null,
          ],
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      // Only 2 complete rows (row 0 images + row 2 video), row 1 skipped
      expect(data!.slides).toHaveLength(2);
      expect(data!.slides[0]!.type).toBe("images");
      expect(data!.slides[1]!.type).toBe("video");
    });
  });
});

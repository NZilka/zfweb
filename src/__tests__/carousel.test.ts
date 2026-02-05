/**
 * Unit tests for carousel server-side logic
 * Tests getCarouselData with custom carousel and auto-generation from products
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (it throws in non-server environments)
vi.mock("server-only", () => ({}));

// Mock kv module — provides getSiteSettings for carousel config
vi.mock("~/server/kv", () => ({
  getSiteSettings: vi.fn(),
}));

// Mock queries module — provides getProducts for auto-generation
vi.mock("~/server/queries", () => ({
  getProducts: vi.fn(),
}));

// Import after mocking
import { getCarouselData } from "~/server/carousel";
import { getSiteSettings } from "~/server/kv";
import { getProducts } from "~/server/queries";

// Helper to create mock site settings
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
    enabled: false,
    items: [],
    autoScrollInterval: 3000,
    ...carouselOverrides,
  },
  updatedAt: Date.now(),
});

// Helper to create a mock product
const mockProduct = (
  id: number,
  status = "active",
  imgUrl: string[] = [`https://utfs.io/f/img${id}.png`]
) => ({
  id,
  title: `Product ${id}`,
  description: "desc",
  price: "10.00",
  imgUrl,
  imgKey: [`key${id}`],
  inventory: 10,
  sku: null,
  category_id: null,
  status,
  on_sale: false,
  handle: `product-${id}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("carousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("custom carousel", () => {
    it("uses custom items when carousel is enabled", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          enabled: true,
          items: [
            { type: "image", url: "https://utfs.io/f/a.png", key: "a", order: 0 },
            { type: "image", url: "https://utfs.io/f/b.png", key: "b", order: 1 },
            { type: "video", url: "https://utfs.io/f/c.mp4", key: "c", order: 2 },
          ],
          autoScrollInterval: 5000,
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
      expect(data!.slides[0]!.items).toHaveLength(3);
      // Single slide should not auto-scroll
      expect(data!.autoScroll).toBe(false);
      expect(data!.autoScrollInterval).toBe(5000);
    });

    it("groups custom items into slides of 3", async () => {
      // 6 items = 2 slides of 3
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          enabled: true,
          items: Array.from({ length: 6 }, (_, i) => ({
            type: "image",
            url: `https://utfs.io/f/img${i}.png`,
            key: `key${i}`,
            order: i,
          })),
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(2);
      expect(data!.slides[0]!.items).toHaveLength(3);
      expect(data!.slides[1]!.items).toHaveLength(3);
      // Multiple slides should auto-scroll
      expect(data!.autoScroll).toBe(true);
    });

    it("drops incomplete groups (less than 3 remaining)", async () => {
      // 5 items = 1 complete slide of 3, 2 leftover dropped
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          enabled: true,
          items: Array.from({ length: 5 }, (_, i) => ({
            type: "image",
            url: `https://utfs.io/f/img${i}.png`,
            key: `key${i}`,
            order: i,
          })),
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
    });

    it("returns null when custom carousel has fewer than 3 items", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          enabled: true,
          items: [
            { type: "image", url: "https://utfs.io/f/a.png", key: "a", order: 0 },
            { type: "image", url: "https://utfs.io/f/b.png", key: "b", order: 1 },
          ],
        })
      );

      const data = await getCarouselData();

      expect(data).toBeNull();
    });

    it("preserves video items in slides", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(
        mockSettings({
          enabled: true,
          items: [
            { type: "video", url: "https://utfs.io/f/v1.mp4", key: "v1", order: 0 },
            { type: "image", url: "https://utfs.io/f/i1.png", key: "i1", order: 1 },
            { type: "video", url: "https://utfs.io/f/v2.mp4", key: "v2", order: 2 },
          ],
        })
      );

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      expect(data!.slides[0]!.items[0]!.type).toBe("video");
      expect(data!.slides[0]!.items[1]!.type).toBe("image");
      expect(data!.slides[0]!.items[2]!.type).toBe("video");
    });
  });

  describe("auto-generation from products", () => {
    it("returns null for fewer than 3 active products", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1),
        mockProduct(2),
      ]);

      const data = await getCarouselData();

      expect(data).toBeNull();
    });

    it("creates static carousel for 3-5 products (1 slide)", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1),
        mockProduct(2),
        mockProduct(3),
        mockProduct(4),
      ]);

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      // 4 products = 1 complete slide of 3, 1 leftover dropped
      expect(data!.slides).toHaveLength(1);
      expect(data!.autoScroll).toBe(false);
    });

    it("creates scrolling carousel for 6+ products", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1),
        mockProduct(2),
        mockProduct(3),
        mockProduct(4),
        mockProduct(5),
        mockProduct(6),
      ]);

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      // 6 products = 2 slides of 3
      expect(data!.slides).toHaveLength(2);
      expect(data!.autoScroll).toBe(true);
    });

    it("excludes non-active products", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1, "active"),
        mockProduct(2, "hidden"),
        mockProduct(3, "sold_out"),
        mockProduct(4, "active"),
        mockProduct(5, "active"),
      ]);

      const data = await getCarouselData();

      // Only 3 active products = 1 slide
      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
      expect(data!.slides[0]!.items).toHaveLength(3);
    });

    it("excludes products without images", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1, "active", ["https://utfs.io/f/img1.png"]),
        mockProduct(2, "active", []), // No images
        mockProduct(3, "active", ["https://utfs.io/f/img3.png"]),
        mockProduct(4, "active", ["https://utfs.io/f/img4.png"]),
      ]);

      const data = await getCarouselData();

      // 3 eligible products (one has no images) = 1 slide
      expect(data).not.toBeNull();
      expect(data!.slides).toHaveLength(1);
    });

    it("uses first image of each product", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1, "active", ["https://utfs.io/f/first.png", "https://utfs.io/f/second.png"]),
        mockProduct(2, "active", ["https://utfs.io/f/img2.png"]),
        mockProduct(3, "active", ["https://utfs.io/f/img3.png"]),
      ]);

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      // Should use the first image URL
      expect(data!.slides[0]!.items[0]!.url).toBe("https://utfs.io/f/first.png");
    });

    it("all auto-generated items are typed as image", async () => {
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings());
      vi.mocked(getProducts).mockResolvedValue([
        mockProduct(1),
        mockProduct(2),
        mockProduct(3),
      ]);

      const data = await getCarouselData();

      expect(data).not.toBeNull();
      for (const item of data!.slides[0]!.items) {
        expect(item.type).toBe("image");
      }
    });
  });
});

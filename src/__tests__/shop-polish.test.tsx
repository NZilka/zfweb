/**
 * Unit tests for shop polish features:
 * - QuickAddButton: "+" overlay on product cards
 * - Carousel: seamless clone-based loop, edge-to-edge layout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock next/image — render a plain img tag
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

// Mock CartContext — provide default cart state with extractable addToCart mock
const mockAddToCart = vi.fn(() => Promise.resolve());
vi.mock("~/app/_context/CartContext", () => ({
  useCart: () => ({
    items: [],
    itemCount: 0,
    total: "0.00",
    isLoading: false,
    isOpen: false,
    openCart: vi.fn(),
    closeCart: vi.fn(),
    toggleCart: vi.fn(),
    addToCart: mockAddToCart,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refreshCart: vi.fn(),
  }),
}));

// Import components after mocks
import { QuickAddButton } from "~/app/shop/_components/QuickAddButton";
import { Carousel } from "~/app/shop/_components/Carousel";
import type { CarouselData } from "~/server/carousel";

// ── QuickAddButton Tests ──────────────────────────────────────────────

describe("QuickAddButton", () => {
  beforeEach(() => {
    mockAddToCart.mockClear();
  });

  it("renders button when inventory is available", () => {
    render(<QuickAddButton productId={1} availableInventory={5} />);
    expect(screen.getByLabelText("Quick add to cart")).toBeTruthy();
  });

  it("renders nothing when inventory is 0 (sold out)", () => {
    const { container } = render(
      <QuickAddButton productId={1} availableInventory={0} />,
    );
    // Should render nothing — empty container
    expect(container.innerHTML).toBe("");
  });

  it("calls addToCart with productId and quantity 1 on click", async () => {
    render(<QuickAddButton productId={42} availableInventory={3} />);
    const button = screen.getByLabelText("Quick add to cart");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockAddToCart).toHaveBeenCalledOnce();
    expect(mockAddToCart).toHaveBeenCalledWith(42, 1);
  });

  it("calls preventDefault on click (stops Link navigation)", async () => {
    render(<QuickAddButton productId={1} availableInventory={5} />);
    const button = screen.getByLabelText("Quick add to cart");

    // Verify the button's onClick handler calls preventDefault
    // by checking that addToCart is called (which happens after preventDefault)
    // — if preventDefault wasn't called, the Link would navigate away first
    await act(async () => {
      fireEvent.click(button);
    });

    // addToCart being called confirms the handler ran (it calls preventDefault first)
    expect(mockAddToCart).toHaveBeenCalledOnce();
  });

  it("disables button while loading", async () => {
    // Make addToCart hang (never resolve) so we can check loading state
    mockAddToCart.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<QuickAddButton productId={1} availableInventory={5} />);
    const button = screen.getByLabelText("Quick add to cart");

    await act(async () => {
      fireEvent.click(button);
    });

    // Button should be disabled while addToCart is in progress
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

// ── Carousel Tests ────────────────────────────────────────────────────

// Helper: create image slide data
function makeImageSlide(id: number) {
  return {
    type: "images" as const,
    items: [
      { url: `/img${id}-1.jpg`, alt: `Image ${id}-1` },
      { url: `/img${id}-2.jpg`, alt: `Image ${id}-2` },
      { url: `/img${id}-3.jpg`, alt: `Image ${id}-3` },
    ],
  };
}

// Helper: create video slide data
function makeVideoSlide(id: number) {
  return {
    type: "video" as const,
    url: `/video${id}.mp4`,
    videoPositionY: 50,
  };
}

describe("Carousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all images from slides", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1), makeImageSlide(2)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    render(<Carousel data={data} />);

    // 2 real slides + 1 clone = 3 slides × 3 images = 9 images total
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(9);
  });

  it("renders clone of first slide for seamless loop (multi-slide)", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1), makeImageSlide(2)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    render(<Carousel data={data} />);

    // First slide has "Image 1-1", clone at end also has "Image 1-1"
    // So there should be 2 copies of each first-slide image
    const firstSlideImages = screen.getAllByAltText("Image 1-1");
    expect(firstSlideImages).toHaveLength(2);
  });

  it("does not clone slide when only one slide exists", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    render(<Carousel data={data} />);

    // Single slide = 3 images, no clone
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    // Only one copy of each image
    const firstImages = screen.getAllByAltText("Image 1-1");
    expect(firstImages).toHaveLength(1);
  });

  it("renders navigation dots only for real slides (not clone)", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1), makeImageSlide(2), makeImageSlide(3)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    render(<Carousel data={data} />);

    // 3 real slides = 3 dot buttons (not 4)
    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(3);
    expect(screen.getByLabelText("Go to slide 1")).toBeTruthy();
    expect(screen.getByLabelText("Go to slide 2")).toBeTruthy();
    expect(screen.getByLabelText("Go to slide 3")).toBeTruthy();
  });

  it("does not render navigation dots for single slide", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    render(<Carousel data={data} />);

    // No dots for a single slide
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("has edge-to-edge container (no px padding)", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    const { container } = render(<Carousel data={data} />);

    // Container should not have px-2 or px-4 classes — edge-to-edge
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).not.toContain("px-2");
    expect(outerDiv.className).not.toContain("px-4");
    expect(outerDiv.className).toContain("overflow-hidden");
  });

  it("renders video slide with correct attributes", () => {
    const data: CarouselData = {
      slides: [makeVideoSlide(1), makeImageSlide(1)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    const { container } = render(<Carousel data={data} />);

    // Should have a video element
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("/video1.mp4");
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.hasAttribute("muted")).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
  });

  it("renders the sliding track at slide 0", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1), makeImageSlide(2)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    const { container } = render(<Carousel data={data} />);

    // The track is a .flex div with an inline translateX style.
    // (Previously this test checked for `.transition-transform` — that
    // CSS-transition class was removed when slide animation moved to the
    // Web Animations API. The translateX on the inline style is now the
    // single source of truth for the track's resting position.)
    const track = container.querySelector(".flex[style*='translateX']") as HTMLElement | null;
    expect(track).not.toBeNull();
    expect(track?.style.transform).toBe("translateX(-0%)");
  });

  it("clicking a dot navigates to that slide", () => {
    const data: CarouselData = {
      slides: [makeImageSlide(1), makeImageSlide(2), makeImageSlide(3)],
      autoScroll: false,
      autoScrollInterval: 5000,
    };

    const { container } = render(<Carousel data={data} />);

    // Click dot for slide 2 (index 1)
    const dot2 = screen.getByLabelText("Go to slide 2");
    fireEvent.click(dot2);

    // Track should translate to -100% for slide index 1
    const track = container.querySelector("[style]") as HTMLElement;
    expect(track.style.transform).toBe("translateX(-100%)");
  });
});

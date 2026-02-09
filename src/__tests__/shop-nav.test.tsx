import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock server-only — required for modules that import it
vi.mock("server-only", () => ({}));

// Mock next/image — render a plain img tag
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

// Mock next/link — render a plain anchor tag
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock next/navigation — provide router stubs
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock Clerk — render children directly for signed-in/out states
vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: any) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: any) => (
    <div data-testid="signed-out">{children}</div>
  ),
  SignInButton: ({ children }: any) => (
    <div data-testid="sign-in-button">{children}</div>
  ),
  UserButton: () => <div data-testid="user-button" />,
}));

// Mock CartContext — provide default cart state
const mockToggleCart = vi.fn();
vi.mock("~/app/_context/CartContext", () => ({
  useCart: () => ({
    items: [],
    itemCount: 0,
    total: "0.00",
    isLoading: false,
    isOpen: false,
    openCart: vi.fn(),
    closeCart: vi.fn(),
    toggleCart: mockToggleCart,
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    refreshCart: vi.fn(),
  }),
}));

// Import components under test after mocks
import { AnnouncementBar } from "~/app/shop/_components/AnnouncementBar";
import { ShopNavClient } from "~/app/shop/_components/ShopNavClient";
import { MobileMenuDrawer } from "~/app/shop/_components/MobileMenuDrawer";
import { CartButton } from "~/app/shop/_components/CartButton";

// Test categories fixture
const MOCK_CATEGORIES = [
  { id: 1, name: "Rings" },
  { id: 2, name: "Pendants" },
  { id: 3, name: "Tools" },
];

describe("AnnouncementBar", () => {
  it("renders nothing when disabled", () => {
    const { container } = render(
      <AnnouncementBar
        announcementBanner={{ enabled: false, text: "Sale!", scrolling: false }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when text is null", () => {
    const { container } = render(
      <AnnouncementBar
        announcementBanner={{ enabled: true, text: null, scrolling: false }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders static text when scrolling is false", () => {
    render(
      <AnnouncementBar
        announcementBanner={{
          enabled: true,
          text: "Free shipping on orders over $50",
          scrolling: false,
        }}
      />,
    );
    expect(
      screen.getByText("Free shipping on orders over $50"),
    ).toBeDefined();
  });

  it("renders with marquee class when scrolling is true", () => {
    const { container } = render(
      <AnnouncementBar
        announcementBanner={{
          enabled: true,
          text: "Summer sale!",
          scrolling: true,
        }}
      />,
    );
    // Should have the animate-marquee class on the scrolling span
    const marqueeSpan = container.querySelector(".animate-marquee");
    expect(marqueeSpan).not.toBeNull();
  });
});

describe("MobileMenuDrawer", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it("renders Products link when open", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    // "Products" replaces old "All Products"
    expect(screen.getByText("Products")).toBeDefined();
  });

  it("renders Categories button for collapsible section", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    // Categories is a button (collapsible toggle), not a link
    expect(screen.getByText("Categories")).toBeDefined();
  });

  it("shows category links when Categories is expanded", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    // Click Categories to expand
    const categoriesButton = screen.getByText("Categories");
    fireEvent.click(categoriesButton);
    // Category names should now be visible
    expect(screen.getByText("Rings")).toBeDefined();
    expect(screen.getByText("Pendants")).toBeDefined();
    expect(screen.getByText("Tools")).toBeDefined();
  });

  it("hides category links by default (collapsed)", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    // Categories should be collapsed by default — individual category names not rendered
    expect(screen.queryByText("Rings")).toBeNull();
  });

  it("shows About link when aboutEnabled is true", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={true}
      />,
    );
    expect(screen.getByText("About")).toBeDefined();
  });

  it("hides About link when aboutEnabled is false", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    expect(screen.queryByText("About")).toBeNull();
  });

  it("calls onClose when X button is clicked", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    const closeButton = screen.getByLabelText("Close menu");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has translate class when closed", () => {
    const { container } = render(
      <MobileMenuDrawer
        isOpen={false}
        onClose={onClose}
        categories={MOCK_CATEGORIES}
        aboutEnabled={false}
      />,
    );
    // The drawer panel should have -translate-x-full when closed
    const panel = container.querySelector(".-translate-x-full");
    expect(panel).not.toBeNull();
  });
});

describe("ShopNavClient", () => {
  it("renders hamburger button", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    expect(screen.getByLabelText("Open menu")).toBeDefined();
  });

  it("renders logo images", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    // Should have two logo images (mobile centered + desktop left)
    const logos = screen.getAllByAltText("Zilka Forgewerks Logo");
    expect(logos.length).toBe(2);
  });

  it("renders Products link instead of All", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    // "Products" appears in both desktop nav and mobile drawer
    const productsLinks = screen.getAllByText("Products");
    expect(productsLinks.length).toBeGreaterThanOrEqual(1);
    // "All" should no longer appear anywhere
    expect(screen.queryByText("All")).toBeNull();
  });

  it("renders Categories button for dropdown", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    // Categories appears in both desktop nav (button) and mobile drawer (collapsible)
    const categoriesElements = screen.getAllByText("Categories");
    expect(categoriesElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders category names in dropdown", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    // Category names are in the dropdown (rendered but hidden via CSS)
    expect(screen.getByText("Rings")).toBeDefined();
    expect(screen.getByText("Pendants")).toBeDefined();
    expect(screen.getByText("Tools")).toBeDefined();
  });

  it("shows About link when aboutEnabled is true", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={true}
      />,
    );
    // About link appears in both desktop nav and mobile drawer
    const aboutLinks = screen.getAllByText("About");
    expect(aboutLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("hides About link when aboutEnabled is false", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    // About link should not appear in desktop nav or mobile drawer when disabled
    expect(screen.queryAllByText("About")).toHaveLength(0);
  });

  it("renders search button", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    expect(screen.getByLabelText("Search")).toBeDefined();
  });

  it("opens mobile menu when hamburger is clicked", () => {
    render(
      <ShopNavClient
        categories={MOCK_CATEGORIES}
        logoUrl="/logo.png"
        aboutEnabled={false}
      />,
    );
    const hamburger = screen.getByLabelText("Open menu");
    fireEvent.click(hamburger);
    // After click, the menu drawer should show "Products" link (replaces "All Products")
    // Products appears in both desktop and mobile, so check for at least 2 instances
    const productsLinks = screen.getAllByText("Products");
    expect(productsLinks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("CartButton", () => {
  it("renders cart icon", () => {
    render(<CartButton />);
    expect(screen.getByLabelText("Cart with 0 items")).toBeDefined();
  });

  it("calls toggleCart when clicked", () => {
    render(<CartButton />);
    const button = screen.getByLabelText("Cart with 0 items");
    fireEvent.click(button);
    expect(mockToggleCart).toHaveBeenCalledOnce();
  });

  it("does not render badge when count is 0", () => {
    const { container } = render(<CartButton />);
    // No badge span should be present — badge only shows when itemCount > 0
    const badge = container.querySelector("span");
    expect(badge).toBeNull();
  });
});

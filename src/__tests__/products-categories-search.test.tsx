/**
 * Tests for products-categories-search features:
 * - Product sort order server action
 * - SearchOverlay component behavior
 * - MobileMenuDrawer instant close
 * - AdminNavContext instant close
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock next/navigation — provides mock router and pathname
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin",
}));

// Mock next/image — render a plain img tag
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

// Mock server-only since queries.ts imports it
vi.mock("server-only", () => ({}));

// Mock Clerk — provide basic signed-out state
vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: any) => null,
  SignedOut: ({ children }: any) => <>{children}</>,
  SignInButton: ({ children }: any) => <>{children}</>,
}));

// Mock Clerk server auth for product-actions
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

// Mock db for product-actions
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
vi.mock("~/server/db", () => ({
  db: {
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

// Mock schema for product-actions
vi.mock("~/server/db/schema", () => ({
  product: { id: "id" },
}));

// Mock drizzle-orm for product-actions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args) => args),
  ilike: vi.fn((a, b) => ({ field: a, pattern: b })),
  or: vi.fn((...args) => args),
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ---- Tests ----

describe("SearchOverlay", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders input and close button when open", async () => {
    // Dynamic import to avoid hoisting issues with mocks
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();

    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    // Should show search input
    const input = screen.getByPlaceholderText("Search products...");
    expect(input).toBeDefined();

    // Should show close button
    const closeBtn = screen.getByLabelText("Close search");
    expect(closeBtn).toBeDefined();
  });

  it("does not render when closed", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const { container } = render(
      <SearchOverlay isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("calls onClose when close button is clicked", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();
    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close search"));
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to /shop?q=term on form submit", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();
    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Search products...");
    fireEvent.change(input, { target: { value: "silver ring" } });
    fireEvent.submit(input.closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/shop?q=silver%20ring");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not navigate on empty search", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();
    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Search products...");
    fireEvent.submit(input.closest("form")!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("closes on Escape key", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();
    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AdminNavContext — instantClose", () => {
  it("provides instantClose that sets isInstantClose and closes nav", async () => {
    const { AdminNavProvider, useAdminNav } = await import(
      "../app/admin/_components/AdminNavContext"
    );

    // Test component to access context
    let contextValue: any;
    function TestConsumer() {
      contextValue = useAdminNav();
      return (
        <div>
          <span data-testid="open">{String(contextValue.isOpen)}</span>
          <span data-testid="instant">
            {String(contextValue.isInstantClose)}
          </span>
        </div>
      );
    }

    render(
      <AdminNavProvider>
        <TestConsumer />
      </AdminNavProvider>,
    );

    // Initially closed, not instant
    expect(screen.getByTestId("open").textContent).toBe("false");
    expect(screen.getByTestId("instant").textContent).toBe("false");

    // Open the nav
    act(() => contextValue.toggleOpen());

    // Now call instantClose — should set isOpen=false and isInstantClose=true
    act(() => contextValue.instantClose());
    expect(screen.getByTestId("open").textContent).toBe("false");
    expect(screen.getByTestId("instant").textContent).toBe("true");
  });

  it("resets isInstantClose when toggleOpen is called", async () => {
    const { AdminNavProvider, useAdminNav } = await import(
      "../app/admin/_components/AdminNavContext"
    );

    let contextValue: any;
    function TestConsumer() {
      contextValue = useAdminNav();
      return (
        <span data-testid="instant">
          {String(contextValue.isInstantClose)}
        </span>
      );
    }

    render(
      <AdminNavProvider>
        <TestConsumer />
      </AdminNavProvider>,
    );

    // Trigger instant close then re-open — act() wraps state updates
    act(() => contextValue.instantClose());
    expect(screen.getByTestId("instant").textContent).toBe("true");

    act(() => contextValue.toggleOpen());
    expect(screen.getByTestId("instant").textContent).toBe("false");
  });
});

describe("MobileMenuDrawer — instant close", () => {
  it("uses handleNavClose on Products link", async () => {
    const { MobileMenuDrawer } = await import(
      "../app/shop/_components/MobileMenuDrawer"
    );
    const onClose = vi.fn();
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={[{ id: 1, name: "Rings" }]}
        aboutEnabled={true}
      />,
    );

    // Click Products link — should call onClose
    const productsLink = screen.getByText("Products");
    fireEvent.click(productsLink);
    expect(onClose).toHaveBeenCalled();
  });

  it("uses handleNavClose on About link", async () => {
    const { MobileMenuDrawer } = await import(
      "../app/shop/_components/MobileMenuDrawer"
    );
    const onClose = vi.fn();
    render(
      <MobileMenuDrawer
        isOpen={true}
        onClose={onClose}
        categories={[]}
        aboutEnabled={true}
      />,
    );

    // Click About link — should call onClose
    const aboutLink = screen.getByText("About");
    fireEvent.click(aboutLink);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("updateProductSortOrder", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("updates sort_order for each product ID", async () => {
    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );
    await updateProductSortOrder([3, 1, 2]);

    // Should call update 3 times — once per product
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

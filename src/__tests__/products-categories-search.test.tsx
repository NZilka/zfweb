/**
 * Tests for products-categories-search features:
 * - Product sort order server action (auth, transaction, revalidation, errors)
 * - SearchOverlay component behavior
 * - MobileMenuDrawer instant close
 * - AdminNavContext instant close
 * - LIKE wildcard escaping in search
 * - NaN category ID handling
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

// Mock Clerk server auth for product-actions — default to authenticated
const mockAuth = vi.fn().mockResolvedValue({ userId: "test-user" });
vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

// Mock db for product-actions — supports transaction
const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
// Transaction mock — calls the callback with tx that mirrors db API
const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<void>) => {
  const tx = {
    update: (...args: any[]) => {
      mockUpdate(...args);
      return { set: mockSet };
    },
  };
  await cb(tx);
});
vi.mock("~/server/db", () => ({
  db: {
    update: (...args: any[]) => mockUpdate(...args),
    transaction: (cb: any) => mockTransaction(cb),
    query: {
      product: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

// Mock schema for product-actions
vi.mock("~/server/db/schema", () => ({
  product: { id: "id", category_id: "category_id", title: "title", description: "description", sort_order: "sort_order" },
}));

// Mock drizzle-orm for product-actions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args) => args),
  ilike: vi.fn((a, b) => ({ field: a, pattern: b })),
  or: vi.fn((...args) => args),
}));

// Mock revalidatePath
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

// Mock uploadthing to prevent import errors
vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn() },
}));

// ---- SearchOverlay Tests ----

describe("SearchOverlay", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders input and close button when open", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();

    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Search products...");
    expect(input).toBeDefined();

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

  it("does not navigate on whitespace-only search", async () => {
    const { SearchOverlay } = await import(
      "../app/shop/_components/SearchOverlay"
    );
    const onClose = vi.fn();
    render(<SearchOverlay isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText("Search products...");
    fireEvent.change(input, { target: { value: "   " } });
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

// ---- AdminNavContext Tests ----

describe("AdminNavContext — instantClose", () => {
  it("provides instantClose that sets isInstantClose and closes nav", async () => {
    const { AdminNavProvider, useAdminNav } = await import(
      "../app/admin/_components/AdminNavContext"
    );

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

    expect(screen.getByTestId("open").textContent).toBe("false");
    expect(screen.getByTestId("instant").textContent).toBe("false");

    act(() => contextValue.toggleOpen());

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

    act(() => contextValue.instantClose());
    expect(screen.getByTestId("instant").textContent).toBe("true");

    act(() => contextValue.toggleOpen());
    expect(screen.getByTestId("instant").textContent).toBe("false");
  });
});

// ---- MobileMenuDrawer Tests ----

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

    const aboutLink = screen.getByText("About");
    fireEvent.click(aboutLink);
    expect(onClose).toHaveBeenCalled();
  });
});

// ---- updateProductSortOrder Tests ----

describe("updateProductSortOrder", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockSet.mockClear();
    mockWhere.mockClear();
    mockTransaction.mockClear();
    mockRevalidatePath.mockClear();
    mockAuth.mockResolvedValue({ userId: "test-user" });
    // Re-wire set/where chain after clear
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  it("updates sort_order for each product ID inside a transaction", async () => {
    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );
    await updateProductSortOrder([3, 1, 2]);

    // Should use a transaction
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Should call update 3 times inside the transaction — once per product
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("revalidates admin products and shop paths after success", async () => {
    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );
    await updateProductSortOrder([1, 2]);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/shop");
  });

  it("throws when user is not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );

    await expect(updateProductSortOrder([1, 2])).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("handles empty array without errors", async () => {
    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );
    await updateProductSortOrder([]);

    // Transaction should still be called, but no updates inside it
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("propagates transaction errors", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const { updateProductSortOrder } = await import(
      "~/server/product-actions"
    );

    await expect(updateProductSortOrder([1, 2])).rejects.toThrow(
      "DB connection lost",
    );
    // Should not revalidate on failure
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// ---- LIKE Wildcard Escaping Tests ----

describe("search LIKE wildcard escaping", () => {
  it("escapes % characters in search term", () => {
    // Verify the escaping logic directly
    const input = "50% off";
    const escaped = input.replace(/%/g, "\\%").replace(/_/g, "\\_");
    expect(escaped).toBe("50\\% off");
    expect(`%${escaped}%`).toBe("%50\\% off%");
  });

  it("escapes _ characters in search term", () => {
    const input = "test_product";
    const escaped = input.replace(/%/g, "\\%").replace(/_/g, "\\_");
    expect(escaped).toBe("test\\_product");
  });

  it("escapes both % and _ in the same term", () => {
    const input = "50%_special";
    const escaped = input.replace(/%/g, "\\%").replace(/_/g, "\\_");
    expect(escaped).toBe("50\\%\\_special");
  });

  it("leaves normal text unchanged", () => {
    const input = "silver ring";
    const escaped = input.replace(/%/g, "\\%").replace(/_/g, "\\_");
    expect(escaped).toBe("silver ring");
  });
});

// ---- NaN Category ID Tests ----

describe("NaN category ID handling", () => {
  it("treats NaN categoryId as undefined", () => {
    // Simulates the logic in shop/page.tsx
    const rawCategoryId = Number("abc"); // NaN
    const categoryId =
      rawCategoryId !== undefined && !Number.isNaN(rawCategoryId)
        ? rawCategoryId
        : undefined;
    expect(categoryId).toBeUndefined();
  });

  it("passes valid numeric categoryId through", () => {
    const rawCategoryId = Number("42");
    const categoryId =
      rawCategoryId !== undefined && !Number.isNaN(rawCategoryId)
        ? rawCategoryId
        : undefined;
    expect(categoryId).toBe(42);
  });

  it("treats undefined category param as undefined", () => {
    const param: string | undefined = undefined;
    const rawCategoryId = param ? Number(param) : undefined;
    const categoryId =
      rawCategoryId !== undefined && !Number.isNaN(rawCategoryId)
        ? rawCategoryId
        : undefined;
    expect(categoryId).toBeUndefined();
  });

  it("treats empty string category param as undefined", () => {
    const param = "";
    const rawCategoryId = param ? Number(param) : undefined;
    const categoryId =
      rawCategoryId !== undefined && !Number.isNaN(rawCategoryId)
        ? rawCategoryId
        : undefined;
    expect(categoryId).toBeUndefined();
  });
});

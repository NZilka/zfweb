/**
 * Unit tests for AdminNav component and navigation logic
 * Tests route matching, nav rendering, and active state behavior
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock Next.js navigation
const mockPush = vi.fn();
let mockPathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Import after mocking
import { AdminNav } from "~/app/admin/_components/AdminNav";
import { AdminNavProvider } from "~/app/admin/_components/AdminNavContext";

// Wrapper component with context provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AdminNavProvider>{children}</AdminNavProvider>;
}

// Helper to render AdminNav with provider
function renderAdminNav() {
  return render(
    <TestWrapper>
      <AdminNav />
    </TestWrapper>
  );
}

describe("AdminNav", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockPush.mockClear();
    mockPathname = "/admin";
  });

  describe("Navigation items rendering", () => {
    it("renders all seven navigation items in drawer", () => {
      renderAdminNav();

      // Drawer sidebar shows all labels including About
      expect(screen.getByText("Dashboard")).toBeTruthy();
      expect(screen.getByText("Orders")).toBeTruthy();
      expect(screen.getByText("Products")).toBeTruthy();
      expect(screen.getByText("Discounts")).toBeTruthy();
      expect(screen.getByText("Shipping")).toBeTruthy();
      expect(screen.getByText("About")).toBeTruthy();
      expect(screen.getByText("Settings")).toBeTruthy();
    });

    it("renders navigation as buttons with close button", () => {
      renderAdminNav();

      // 7 nav items + 1 close button = 8 buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(8);
    });

    it("renders close button with correct aria-label", () => {
      renderAdminNav();

      const closeButton = screen.getByLabelText("Close menu");
      expect(closeButton).toBeTruthy();
    });
  });

  describe("Active state from pathname", () => {
    it("marks Dashboard as active for /admin path", () => {
      mockPathname = "/admin";
      renderAdminNav();

      // Find Dashboard button and check aria-current attribute
      const dashboardButton = screen.getByText("Dashboard").closest("button");
      expect(dashboardButton?.getAttribute("aria-current")).toBe("page");
    });

    it("marks Orders as active for /admin/orders path", () => {
      mockPathname = "/admin/orders";
      renderAdminNav();

      const ordersButton = screen.getByText("Orders").closest("button");
      expect(ordersButton?.getAttribute("aria-current")).toBe("page");

      // Dashboard should not be active
      const dashboardButton = screen.getByText("Dashboard").closest("button");
      expect(dashboardButton?.getAttribute("aria-current")).toBeNull();
    });

    it("marks Products as active for /admin/products path", () => {
      mockPathname = "/admin/products";
      renderAdminNav();

      const productsButton = screen.getByText("Products").closest("button");
      expect(productsButton?.getAttribute("aria-current")).toBe("page");
    });

    it("marks Products as active for nested product paths", () => {
      // Should also work for /admin/products/123
      mockPathname = "/admin/products/123";
      renderAdminNav();

      const productsButton = screen.getByText("Products").closest("button");
      expect(productsButton?.getAttribute("aria-current")).toBe("page");
    });

    it("marks Discounts as active for /admin/discounts path", () => {
      mockPathname = "/admin/discounts";
      renderAdminNav();

      const discountsButton = screen.getByText("Discounts").closest("button");
      expect(discountsButton?.getAttribute("aria-current")).toBe("page");
    });

    it("marks Shipping as active for /admin/shipping path", () => {
      mockPathname = "/admin/shipping";
      renderAdminNav();

      const shippingButton = screen.getByText("Shipping").closest("button");
      expect(shippingButton?.getAttribute("aria-current")).toBe("page");
    });

    it("marks About as active for /admin/about path", () => {
      mockPathname = "/admin/about";
      renderAdminNav();

      const aboutButton = screen.getByText("About").closest("button");
      expect(aboutButton?.getAttribute("aria-current")).toBe("page");
    });

    it("defaults to Dashboard for unknown paths", () => {
      mockPathname = "/admin/unknown";
      renderAdminNav();

      // Since /admin/unknown doesn't match any specific route,
      // it should default to dashboard
      const dashboardButton = screen.getByText("Dashboard").closest("button");
      expect(dashboardButton?.getAttribute("aria-current")).toBe("page");
    });
  });

  describe("Navigation click behavior", () => {
    it("navigates to /admin when Dashboard is clicked", () => {
      mockPathname = "/admin/orders"; // Start on different page
      renderAdminNav();

      // Click Dashboard button in bottom nav
      const dashboardButton = screen.getByText("Dashboard").closest("button");
      fireEvent.click(dashboardButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin");
    });

    it("navigates to /admin/orders when Orders is clicked", () => {
      renderAdminNav();

      const ordersButton = screen.getByText("Orders").closest("button");
      fireEvent.click(ordersButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin/orders");
    });

    it("navigates to /admin/products when Products is clicked", () => {
      renderAdminNav();

      const productsButton = screen.getByText("Products").closest("button");
      fireEvent.click(productsButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin/products");
    });

    it("navigates to /admin/discounts when Discounts is clicked", () => {
      renderAdminNav();

      const discountsButton = screen.getByText("Discounts").closest("button");
      fireEvent.click(discountsButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin/discounts");
    });

    it("navigates to /admin/shipping when Shipping is clicked", () => {
      renderAdminNav();

      const shippingButton = screen.getByText("Shipping").closest("button");
      fireEvent.click(shippingButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin/shipping");
    });

    it("navigates to /admin/about when About is clicked", () => {
      renderAdminNav();

      const aboutButton = screen.getByText("About").closest("button");
      fireEvent.click(aboutButton!);

      expect(mockPush).toHaveBeenCalledWith("/admin/about");
    });
  });
});

describe("AdminNavContext", () => {
  it("throws error when useAdminNav is used outside provider", () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<AdminNav />);
    }).toThrow("useAdminNav must be used within AdminNavProvider");

    consoleSpy.mockRestore();
  });
});

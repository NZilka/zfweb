/**
 * Tests for the /api/checkout/test-place-order route.
 * Verifies both gates (env + KV toggle), success and failure outcomes, and
 * that createOrderFromPayment is called with isTest=true on success.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable env mock so each test can control TEST_MODE_ALLOWED
vi.mock("~/env", () => ({
  env: { TEST_MODE_ALLOWED: true },
}));

// Mock getSiteSettings — each test configures testMode via the resolved value
vi.mock("~/server/kv", () => ({
  getSiteSettings: vi.fn(),
}));

// Mock createOrderFromPayment so we can assert calls without touching the DB
vi.mock("~/server/order-actions", () => ({
  createOrderFromPayment: vi.fn(() => Promise.resolve({ id: 42 })),
}));

// Cart helpers
vi.mock("~/server/cart-actions", () => ({
  getCartItems: vi.fn(() => Promise.resolve([{ id: 1, quantity: 1 }])),
  getCartSummary: vi.fn(() =>
    Promise.resolve({ total: "25.00", itemCount: 1 }),
  ),
}));

// Discount helpers — default to "no discount"
vi.mock("~/server/discount-actions", () => ({
  validateDiscountCode: vi.fn(),
}));

vi.mock("~/lib/discount-utils", () => ({
  calculateDiscountedTotal: vi.fn(),
}));

// Mock next/headers cookies — returns a cart_session cookie by default
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) =>
        name === "cart_session" ? { value: "sess_test_xyz" } : undefined,
      ),
    }),
  ),
}));

import { POST } from "~/app/api/checkout/test-place-order/route";
import { env } from "~/env";
import { getSiteSettings } from "~/server/kv";
import { createOrderFromPayment } from "~/server/order-actions";
import { validateDiscountCode } from "~/server/discount-actions";
import { calculateDiscountedTotal } from "~/lib/discount-utils";

// Minimum valid request body — reused across happy-path tests
const validBody = {
  customerInfo: {
    email: "buyer@example.com",
    firstName: "Test",
    lastName: "Buyer",
    address1: "1 Test Lane",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    country: "US",
  },
  isGift: false,
};

// Helper to build a Request object; cast to NextRequest-compatible
const makeReq = (body: unknown) =>
  new Request("http://localhost/api/checkout/test-place-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Baseline settings with testMode enabled and outcome=success
const enabledSuccessSettings = {
  testMode: { enabled: true, outcome: "success" as const },
};

describe("POST /api/checkout/test-place-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to "allowed" before every test
    (env as unknown as { TEST_MODE_ALLOWED: boolean }).TEST_MODE_ALLOWED = true;
    // Default: test mode enabled + success outcome
    vi.mocked(getSiteSettings).mockResolvedValue(
      enabledSuccessSettings as never,
    );
  });

  it("returns 403 when TEST_MODE_ALLOWED env is false", async () => {
    (env as unknown as { TEST_MODE_ALLOWED: boolean }).TEST_MODE_ALLOWED = false;

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
    // No order creation should occur when gate rejects
    expect(createOrderFromPayment).not.toHaveBeenCalled();
  });

  it("returns 403 when settings.testMode.enabled is false", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      testMode: { enabled: false, outcome: "success" },
    } as never);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
    expect(createOrderFromPayment).not.toHaveBeenCalled();
  });

  it("returns 400 when request body is invalid (missing customerInfo)", async () => {
    const res = await POST(makeReq({ isGift: false }));
    expect(res.status).toBe(400);
    expect(createOrderFromPayment).not.toHaveBeenCalled();
  });

  it("returns 402 and does NOT create order when outcome=failure", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      testMode: { enabled: true, outcome: "failure" },
    } as never);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.message).toMatch(/failure/i);
    // Critical: failure path must not touch the DB
    expect(createOrderFromPayment).not.toHaveBeenCalled();
  });

  it("calls createOrderFromPayment with isTest=true on success outcome", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);

    expect(createOrderFromPayment).toHaveBeenCalledTimes(1);
    const args = vi.mocked(createOrderFromPayment).mock.calls[0];
    // Second arg is the options object with isTest flag
    expect(args?.[1]).toEqual({ isTest: true });
  });

  it("generates a synthetic pi_test_ payment intent id and returns it", async () => {
    const res = await POST(makeReq(validBody));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.paymentIntentId).toMatch(/^pi_test_/);
    expect(json.orderId).toBe(42);

    // The same ID must be passed into createOrderFromPayment on the synthetic PI
    const args = vi.mocked(createOrderFromPayment).mock.calls[0];
    const syntheticPI = args?.[0] as { id: string };
    expect(syntheticPI.id).toBe(json.paymentIntentId);
  });

  it("passes customer info through metadata to createOrderFromPayment", async () => {
    await POST(makeReq(validBody));

    const args = vi.mocked(createOrderFromPayment).mock.calls[0];
    const pi = args?.[0] as { metadata: Record<string, string> };
    expect(pi.metadata.customerEmail).toBe("buyer@example.com");
    expect(pi.metadata.customerName).toBe("Test Buyer");
    expect(pi.metadata.cartSessionToken).toBe("sess_test_xyz");
    // Address is JSON-serialized just like the real route does
    // Non-null assertion: noUncheckedIndexedAccess makes Record lookup return T | undefined
    const address = JSON.parse(pi.metadata.shippingAddress!);
    expect(address.city).toBe("Austin");
  });

  it("applies valid discount code without incrementing usage counter", async () => {
    // Mock a valid discount response
    vi.mocked(validateDiscountCode).mockResolvedValue({
      valid: true,
      discount: {
        id: 99,
        code: "TESTCODE",
        discount: "10.00",
        discountType: "percent",
        free_shipping: false,
        active: true,
      },
    } as never);
    vi.mocked(calculateDiscountedTotal).mockReturnValue({
      finalTotal: 22.5,
      discountAmount: 2.5,
    });

    const res = await POST(
      makeReq({ ...validBody, discountCode: "TESTCODE" }),
    );
    expect(res.status).toBe(200);

    // Discount metadata should flow through; usage counter not incremented
    // (test orders must not affect real discount stats — no mock for
    // incrementDiscountUsage because it shouldn't be imported here at all)
    const args = vi.mocked(createOrderFromPayment).mock.calls[0];
    const pi = args?.[0] as { metadata: Record<string, string> };
    expect(pi.metadata.discountCode).toBe("TESTCODE");
    expect(pi.metadata.discountAmount).toBe("2.5");
  });

  it("returns 400 when discount code is invalid", async () => {
    vi.mocked(validateDiscountCode).mockResolvedValue({
      valid: false,
      error: "Code expired",
    } as never);

    const res = await POST(
      makeReq({ ...validBody, discountCode: "EXPIRED" }),
    );
    expect(res.status).toBe(400);
    expect(createOrderFromPayment).not.toHaveBeenCalled();
  });
});

/**
 * Stripe webhook idempotency: a payment_intent.succeeded event for an order
 * that already exists must be acknowledged (200) without creating a second
 * order, incrementing discount usage, or touching the cart.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  existingOrderId: null as number | null,
  createOrderFromPayment: vi.fn(),
  incrementDiscountUsage: vi.fn(),
  syncOrderStateToKV: vi.fn(),
  syncPaymentStateByPaymentIntent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => "t=1,v1=sig" })),
}));
vi.mock("~/server/stripe", () => ({
  constructWebhookEvent: vi.fn(() => ({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_123" } },
  })),
  retrievePaymentIntent: vi.fn(async () => ({
    id: "pi_123",
    amount: 5000,
    customer: "cus_1",
    metadata: { discountId: "9" },
  })),
}));
vi.mock("~/server/order-actions", () => ({
  createOrderFromPayment: mocks.createOrderFromPayment,
  findOrderIdByPaymentIntent: vi.fn(async () => mocks.existingOrderId),
}));
vi.mock("~/server/discount-usage", () => ({
  incrementDiscountUsage: mocks.incrementDiscountUsage,
}));
vi.mock("~/server/stripe-sync", () => ({
  syncOrderStateToKV: mocks.syncOrderStateToKV,
  syncPaymentStateByPaymentIntent: mocks.syncPaymentStateByPaymentIntent,
}));

import { POST } from "~/app/api/stripe/webhook/route";

const request = () =>
  new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: "{}",
  });

beforeEach(() => {
  mocks.existingOrderId = null;
  mocks.createOrderFromPayment.mockReset();
  mocks.createOrderFromPayment.mockResolvedValue({
    id: 1,
    status: "paid",
    total: "50.00",
    products: [1],
  });
  mocks.incrementDiscountUsage.mockReset();
  mocks.syncOrderStateToKV.mockReset();
  mocks.syncPaymentStateByPaymentIntent.mockReset();
});

describe("POST /api/stripe/webhook — payment_intent.succeeded", () => {
  it("creates the order on first delivery", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mocks.createOrderFromPayment).toHaveBeenCalledTimes(1);
    expect(mocks.incrementDiscountUsage).toHaveBeenCalledWith(9);
  });

  it("acknowledges a redelivery without side effects when the order exists", async () => {
    mocks.existingOrderId = 42;
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mocks.createOrderFromPayment).not.toHaveBeenCalled();
    expect(mocks.incrementDiscountUsage).not.toHaveBeenCalled();
    expect(mocks.syncOrderStateToKV).not.toHaveBeenCalled();
  });
});

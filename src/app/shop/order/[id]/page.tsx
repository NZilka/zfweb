import { notFound } from "next/navigation";

// DEPRECATED: This route is disabled for security reasons.
// Use /shop/order/confirmation/[payment_intent] instead.
// Order lookup by sequential ID allows IDOR attacks.
export default async function OrderPage() {
  // Always return 404 - orders should only be accessed via payment_intent
  notFound();
}

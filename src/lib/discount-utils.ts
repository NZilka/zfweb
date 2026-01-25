/**
 * Discount calculation utilities
 * Pure functions for discount math - separated from server actions
 */

/**
 * Calculate discounted total given subtotal, discount value, and type
 * Handles both percent and fixed discounts, caps at subtotal
 */
export function calculateDiscountedTotal(
  subtotal: number,
  discountValue: number,
  discountType: "percent" | "fixed"
): { discountAmount: number; finalTotal: number } {
  let discountAmount: number;

  if (discountType === "percent") {
    // Percent discount: value is percentage (e.g., 10 = 10%)
    discountAmount = subtotal * (discountValue / 100);
  } else {
    // Fixed discount: value is dollar amount
    discountAmount = discountValue;
  }

  // Don't allow discount to exceed subtotal (no negative totals)
  discountAmount = Math.min(discountAmount, subtotal);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Round to 2 decimal places for currency
  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

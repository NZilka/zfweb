/**
 * Discount usage bookkeeping for the payment webhook.
 *
 * Lives in its own `server-only` module (moved out of discount-actions.ts)
 * because every export of a `"use server"` file is a public endpoint, and
 * incrementing a code's usage counter must only happen from the webhook.
 * Phase 1 of docs/LAUNCH_PLAN.md replaces custom discounts with Stripe
 * promotion codes, at which point this file goes away.
 */
import "server-only";

import { db } from "~/server/db";
import { discount } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

// Increment the usage counter for a discount after a successful payment.
// Non-critical: failures are logged, never thrown, so a counter glitch can
// not fail the order.
export async function incrementDiscountUsage(discountId: number) {
  try {
    await db
      .update(discount)
      .set({ numberOfUses: sql`${discount.numberOfUses} + 1` })
      .where(eq(discount.id, discountId));
  } catch (error) {
    console.error("Error incrementing discount usage:", error);
  }
}

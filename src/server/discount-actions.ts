/**
 * Server actions for discount code management
 * CRUD operations for the admin discounts tab
 */
"use server";

import { db } from "~/server/db";
import { discount } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Discount input type for create/update
export interface DiscountInput {
  code: string;
  name: string;
  description: string;
  discount: number;
  discountType: "percent" | "fixed";
  freeShipping: boolean;
  active: boolean;
  maxUses?: number | null;
  expiresAt?: Date | null;
}

// Discount type from database
export interface DiscountData {
  id: number;
  code: string;
  name: string;
  description: string;
  discount: string;
  discountType: string;
  freeShipping: boolean;
  active: boolean | null;
  numberOfUses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * Get all discounts
 */
export async function getDiscounts(): Promise<DiscountData[]> {
  const discounts = await db
    .select()
    .from(discount)
    .orderBy(discount.createdAt);

  return discounts.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    discount: d.discount,
    discountType: d.discount_type,
    freeShipping: d.free_shipping,
    active: d.active,
    numberOfUses: d.numberOfUses,
    maxUses: d.max_uses,
    expiresAt: d.expires_at,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

/**
 * Create a new discount code
 */
export async function createDiscount(
  input: DiscountInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if code already exists
    const existing = await db
      .select({ id: discount.id })
      .from(discount)
      .where(eq(discount.code, input.code.toUpperCase()));

    if (existing.length > 0) {
      return { success: false, error: "Discount code already exists" };
    }

    await db.insert(discount).values({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description,
      discount: String(input.discount),
      discount_type: input.discountType,
      free_shipping: input.freeShipping,
      active: input.active,
      numberOfUses: 0,
      max_uses: input.maxUses ?? null,
      expires_at: input.expiresAt ?? null,
    });

    revalidatePath("/admin/discounts");
    return { success: true };
  } catch (error) {
    console.error("Error creating discount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create discount",
    };
  }
}

/**
 * Update an existing discount code
 */
export async function updateDiscount(
  id: number,
  input: DiscountInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if code exists on another discount
    const existing = await db
      .select({ id: discount.id })
      .from(discount)
      .where(eq(discount.code, input.code.toUpperCase()));

    if (existing.length > 0 && existing[0]?.id !== id) {
      return { success: false, error: "Discount code already exists" };
    }

    await db
      .update(discount)
      .set({
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description,
        discount: String(input.discount),
        discount_type: input.discountType,
        free_shipping: input.freeShipping,
        active: input.active,
        max_uses: input.maxUses ?? null,
        expires_at: input.expiresAt ?? null,
      })
      .where(eq(discount.id, id));

    revalidatePath("/admin/discounts");
    return { success: true };
  } catch (error) {
    console.error("Error updating discount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update discount",
    };
  }
}

/**
 * Delete a discount code
 */
export async function deleteDiscount(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(discount).where(eq(discount.id, id));
    revalidatePath("/admin/discounts");
    return { success: true };
  } catch (error) {
    console.error("Error deleting discount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete discount",
    };
  }
}

/**
 * Toggle discount active status
 */
export async function toggleDiscountActive(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await db
      .select({ active: discount.active })
      .from(discount)
      .where(eq(discount.id, id));

    if (current.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    await db
      .update(discount)
      .set({ active: !current[0]!.active })
      .where(eq(discount.id, id));

    revalidatePath("/admin/discounts");
    return { success: true };
  } catch (error) {
    console.error("Error toggling discount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle discount",
    };
  }
}

// Validated discount result
export interface ValidatedDiscount {
  id: number;
  code: string;
  name: string;
  discount: number;
  discountType: "percent" | "fixed";
  freeShipping: boolean;
}

/**
 * Validate a discount code for checkout
 * Checks: exists, active, not expired, usage limit not reached
 */
export async function validateDiscountCode(
  code: string
): Promise<{ valid: boolean; error?: string; discount?: ValidatedDiscount }> {
  if (!code || !code.trim()) {
    return { valid: false, error: "No code provided" };
  }

  try {
    const result = await db
      .select()
      .from(discount)
      .where(eq(discount.code, code.toUpperCase()));

    if (result.length === 0) {
      return { valid: false, error: "Invalid discount code" };
    }

    const d = result[0]!;

    // Check if active
    if (!d.active) {
      return { valid: false, error: "This code is no longer active" };
    }

    // Check if expired
    if (d.expires_at && new Date(d.expires_at) < new Date()) {
      return { valid: false, error: "This code has expired" };
    }

    // Check usage limit
    if (d.max_uses && d.numberOfUses >= d.max_uses) {
      return { valid: false, error: "This code has reached its usage limit" };
    }

    return {
      valid: true,
      discount: {
        id: d.id,
        code: d.code,
        name: d.name,
        discount: parseFloat(d.discount),
        discountType: d.discount_type as "percent" | "fixed",
        freeShipping: d.free_shipping,
      },
    };
  } catch (error) {
    console.error("Error validating discount:", error);
    return { valid: false, error: "Failed to validate code" };
  }
}

/**
 * Increment usage counter for a discount code
 * Called after successful order completion
 */
export async function incrementDiscountUsage(discountId: number): Promise<void> {
  try {
    await db
      .update(discount)
      .set({
        numberOfUses: sql`${discount.numberOfUses} + 1`,
      })
      .where(eq(discount.id, discountId));
  } catch (error) {
    console.error("Error incrementing discount usage:", error);
    // Don't throw - this is a non-critical operation
  }
}

// Note: calculateDiscountedTotal is in ~/lib/discount-utils
// Moved there because "use server" files require all exports to be async

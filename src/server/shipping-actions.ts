"use server";

/**
 * Shipping Actions - Server actions for shipping zone and rate management
 * Provides CRUD operations for shipping configuration
 */

import { db } from "./db";
import {
  shipping_zone,
  shipping_zone_country,
  shipping_rate,
} from "./db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// === Types ===

// Shipping zone with its countries and rates
export interface ShippingZoneWithDetails {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  countries: string[]; // ISO country codes
  rates: ShippingRateData[];
  createdAt: Date;
}

// Shipping rate data
export interface ShippingRateData {
  id: number;
  zone_id: number;
  name: string;
  price_alone: string;
  price_with_others: string;
  delivery_estimate: string | null;
}

// === Validation Schemas ===

const shippingZoneSchema = z.object({
  name: z.string().min(1, "Zone name is required").max(256),
  description: z.string().max(1024).optional(),
  is_default: z.boolean().optional().default(false),
  countries: z.array(z.string().length(2)).optional().default([]),
});

const shippingRateSchema = z.object({
  zone_id: z.number().positive(),
  name: z.string().min(1, "Rate name is required").max(256),
  price_alone: z.number().nonnegative(),
  price_with_others: z.number().nonnegative(),
  delivery_estimate: z.string().max(256).optional(),
});

export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;
export type ShippingRateInput = z.infer<typeof shippingRateSchema>;

// === Query Functions ===

/**
 * Get all shipping zones with their countries and rates
 */
export async function getShippingZones(): Promise<ShippingZoneWithDetails[]> {
  // Fetch all zones
  const zones = await db.query.shipping_zone.findMany({
    orderBy: (model, { asc }) => asc(model.name),
  });

  // Fetch all countries and rates in parallel
  const [allCountries, allRates] = await Promise.all([
    db.query.shipping_zone_country.findMany(),
    db.query.shipping_rate.findMany({
      orderBy: (model, { asc }) => asc(model.name),
    }),
  ]);

  // Group countries and rates by zone_id
  const countriesByZone = new Map<number, string[]>();
  const ratesByZone = new Map<number, ShippingRateData[]>();

  for (const country of allCountries) {
    const existing = countriesByZone.get(country.zone_id) || [];
    existing.push(country.country_code);
    countriesByZone.set(country.zone_id, existing);
  }

  for (const rate of allRates) {
    const existing = ratesByZone.get(rate.zone_id) || [];
    existing.push({
      id: rate.id,
      zone_id: rate.zone_id,
      name: rate.name,
      price_alone: rate.price_alone,
      price_with_others: rate.price_with_others,
      delivery_estimate: rate.delivery_estimate,
    });
    ratesByZone.set(rate.zone_id, existing);
  }

  // Combine into full zone objects
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    description: zone.description,
    is_default: zone.is_default,
    countries: countriesByZone.get(zone.id) || [],
    rates: ratesByZone.get(zone.id) || [],
    createdAt: zone.createdAt,
  }));
}

/**
 * Get a single shipping zone by ID with its details
 */
export async function getShippingZoneById(
  id: number
): Promise<ShippingZoneWithDetails | null> {
  const zone = await db.query.shipping_zone.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });

  if (!zone) return null;

  const [countries, rates] = await Promise.all([
    db.query.shipping_zone_country.findMany({
      where: (model, { eq }) => eq(model.zone_id, id),
    }),
    db.query.shipping_rate.findMany({
      where: (model, { eq }) => eq(model.zone_id, id),
      orderBy: (model, { asc }) => asc(model.name),
    }),
  ]);

  return {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    is_default: zone.is_default,
    countries: countries.map((c) => c.country_code),
    rates: rates.map((r) => ({
      id: r.id,
      zone_id: r.zone_id,
      name: r.name,
      price_alone: r.price_alone,
      price_with_others: r.price_with_others,
      delivery_estimate: r.delivery_estimate,
    })),
    createdAt: zone.createdAt,
  };
}

// === Mutation Functions ===

/**
 * Create a new shipping zone
 */
export async function createShippingZone(
  input: ShippingZoneInput
): Promise<{ success: boolean; zone?: ShippingZoneWithDetails; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const validated = shippingZoneSchema.parse(input);

    // If this is being set as default, unset any existing default
    if (validated.is_default) {
      await db
        .update(shipping_zone)
        .set({ is_default: false })
        .where(eq(shipping_zone.is_default, true));
    }

    // Create the zone
    const [newZone] = await db
      .insert(shipping_zone)
      .values({
        name: validated.name,
        description: validated.description ?? null,
        is_default: validated.is_default,
      })
      .returning();

    if (!newZone) {
      return { success: false, error: "Failed to create zone" };
    }

    // Add countries if provided
    if (validated.countries.length > 0) {
      await db.insert(shipping_zone_country).values(
        validated.countries.map((code) => ({
          zone_id: newZone.id,
          country_code: code,
        }))
      );
    }

    const zone = await getShippingZoneById(newZone.id);
    return { success: true, zone: zone! };
  } catch (err: any) {
    console.error("Error creating shipping zone:", err);
    return { success: false, error: err.message ?? "Failed to create zone" };
  }
}

/**
 * Update an existing shipping zone
 */
export async function updateShippingZone(
  id: number,
  input: ShippingZoneInput
): Promise<{ success: boolean; zone?: ShippingZoneWithDetails; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const validated = shippingZoneSchema.parse(input);

    // Verify zone exists
    const existing = await db.query.shipping_zone.findFirst({
      where: (model, { eq }) => eq(model.id, id),
    });
    if (!existing) {
      return { success: false, error: "Zone not found" };
    }

    // If this is being set as default, unset any existing default
    if (validated.is_default && !existing.is_default) {
      await db
        .update(shipping_zone)
        .set({ is_default: false })
        .where(eq(shipping_zone.is_default, true));
    }

    // Update the zone
    await db
      .update(shipping_zone)
      .set({
        name: validated.name,
        description: validated.description ?? null,
        is_default: validated.is_default,
      })
      .where(eq(shipping_zone.id, id));

    // Update countries: delete existing and re-add
    await db
      .delete(shipping_zone_country)
      .where(eq(shipping_zone_country.zone_id, id));

    if (validated.countries.length > 0) {
      await db.insert(shipping_zone_country).values(
        validated.countries.map((code) => ({
          zone_id: id,
          country_code: code,
        }))
      );
    }

    const zone = await getShippingZoneById(id);
    return { success: true, zone: zone! };
  } catch (err: any) {
    console.error("Error updating shipping zone:", err);
    return { success: false, error: err.message ?? "Failed to update zone" };
  }
}

/**
 * Delete a shipping zone and all associated countries/rates
 */
export async function deleteShippingZone(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Verify zone exists
    const existing = await db.query.shipping_zone.findFirst({
      where: (model, { eq }) => eq(model.id, id),
    });
    if (!existing) {
      return { success: false, error: "Zone not found" };
    }

    // Delete zone (cascade will handle countries and rates)
    await db.delete(shipping_zone).where(eq(shipping_zone.id, id));

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting shipping zone:", err);
    return { success: false, error: err.message ?? "Failed to delete zone" };
  }
}

/**
 * Create a new shipping rate for a zone
 */
export async function createShippingRate(
  input: ShippingRateInput
): Promise<{ success: boolean; rate?: ShippingRateData; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const validated = shippingRateSchema.parse(input);

    // Verify zone exists
    const zone = await db.query.shipping_zone.findFirst({
      where: (model, { eq }) => eq(model.id, validated.zone_id),
    });
    if (!zone) {
      return { success: false, error: "Zone not found" };
    }

    // Create the rate
    const [newRate] = await db
      .insert(shipping_rate)
      .values({
        zone_id: validated.zone_id,
        name: validated.name,
        price_alone: String(validated.price_alone),
        price_with_others: String(validated.price_with_others),
        delivery_estimate: validated.delivery_estimate ?? null,
      })
      .returning();

    if (!newRate) {
      return { success: false, error: "Failed to create rate" };
    }

    return {
      success: true,
      rate: {
        id: newRate.id,
        zone_id: newRate.zone_id,
        name: newRate.name,
        price_alone: newRate.price_alone,
        price_with_others: newRate.price_with_others,
        delivery_estimate: newRate.delivery_estimate,
      },
    };
  } catch (err: any) {
    console.error("Error creating shipping rate:", err);
    return { success: false, error: err.message ?? "Failed to create rate" };
  }
}

/**
 * Update an existing shipping rate
 */
export async function updateShippingRate(
  id: number,
  input: Omit<ShippingRateInput, "zone_id">
): Promise<{ success: boolean; rate?: ShippingRateData; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Verify rate exists
    const existing = await db.query.shipping_rate.findFirst({
      where: (model, { eq }) => eq(model.id, id),
    });
    if (!existing) {
      return { success: false, error: "Rate not found" };
    }

    // Update the rate
    const [updatedRate] = await db
      .update(shipping_rate)
      .set({
        name: input.name,
        price_alone: String(input.price_alone),
        price_with_others: String(input.price_with_others),
        delivery_estimate: input.delivery_estimate ?? null,
      })
      .where(eq(shipping_rate.id, id))
      .returning();

    if (!updatedRate) {
      return { success: false, error: "Failed to update rate" };
    }

    return {
      success: true,
      rate: {
        id: updatedRate.id,
        zone_id: updatedRate.zone_id,
        name: updatedRate.name,
        price_alone: updatedRate.price_alone,
        price_with_others: updatedRate.price_with_others,
        delivery_estimate: updatedRate.delivery_estimate,
      },
    };
  } catch (err: any) {
    console.error("Error updating shipping rate:", err);
    return { success: false, error: err.message ?? "Failed to update rate" };
  }
}

/**
 * Delete a shipping rate
 */
export async function deleteShippingRate(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Verify rate exists
    const existing = await db.query.shipping_rate.findFirst({
      where: (model, { eq }) => eq(model.id, id),
    });
    if (!existing) {
      return { success: false, error: "Rate not found" };
    }

    await db.delete(shipping_rate).where(eq(shipping_rate.id, id));

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting shipping rate:", err);
    return { success: false, error: err.message ?? "Failed to delete rate" };
  }
}

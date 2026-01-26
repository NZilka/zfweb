/**
 * ShippingEditor - Displays shipping zones and rates in product modal
 * Shows available shipping options for the product with pricing
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  getShippingZones,
  type ShippingZoneWithDetails,
} from "~/server/shipping-actions";

/**
 * Displays shipping zones and rates for a product
 * Links to shipping settings page for management
 */
export function ShippingEditor() {
  const [zones, setZones] = useState<ShippingZoneWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch shipping zones on mount
  useEffect(() => {
    async function fetchZones() {
      try {
        const data = await getShippingZones();
        setZones(data);
      } catch (err) {
        console.error("Failed to fetch shipping zones:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchZones();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-gray-500">
          <Package className="h-4 w-4" />
          <span className="text-sm">No shipping zones configured</span>
        </div>
        <Link
          href="/admin/shipping"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          Set up shipping options
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shipping zones list */}
      <div className="space-y-3">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            {/* Zone header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{zone.name}</span>
                {zone.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>
              {/* Country count */}
              <span className="text-xs text-gray-500">
                {zone.countries.length === 0
                  ? "All countries"
                  : `${zone.countries.length} ${
                      zone.countries.length === 1 ? "country" : "countries"
                    }`}
              </span>
            </div>

            {/* Rates for this zone */}
            {zone.rates.length > 0 ? (
              <div className="space-y-1">
                {zone.rates.map((rate) => (
                  <div
                    key={rate.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">{rate.name}</span>
                    <div className="flex items-center gap-3">
                      {/* Price alone */}
                      <span className="text-gray-900">
                        ${rate.price_alone}
                      </span>
                      {/* Price with others (if different) */}
                      {rate.price_alone !== rate.price_with_others && (
                        <span className="text-xs text-gray-500">
                          (${rate.price_with_others} w/ others)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No rates configured</p>
            )}
          </div>
        ))}
      </div>

      {/* Link to manage shipping */}
      <Link
        href="/admin/shipping"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        Manage shipping options
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

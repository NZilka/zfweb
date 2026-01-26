/**
 * ShippingClient - Shipping zone and rate management interface
 * Handles list display, create/edit modals for zones and rates
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Globe, MapPin } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { toast } from "sonner";
import {
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
  type ShippingZoneWithDetails,
  type ShippingRateData,
} from "~/server/shipping-actions";

// Common country codes for quick selection
const COMMON_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
];

interface ShippingClientProps {
  zones: ShippingZoneWithDetails[];
}

export function ShippingClient({ zones: initialZones }: ShippingClientProps) {
  const router = useRouter();
  const [zones, setZones] = useState(initialZones);

  // Zone dialog state
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZoneWithDetails | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneIsDefault, setZoneIsDefault] = useState(false);
  const [zoneCountries, setZoneCountries] = useState<string[]>([]);

  // Rate dialog state
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRateData | null>(null);
  const [rateZoneId, setRateZoneId] = useState<number | null>(null);
  const [rateName, setRateName] = useState("");
  const [ratePriceAlone, setRatePriceAlone] = useState("");
  const [ratePriceWithOthers, setRatePriceWithOthers] = useState("");
  const [rateDeliveryEstimate, setRateDeliveryEstimate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open zone dialog for create
  const handleCreateZone = () => {
    setEditingZone(null);
    setZoneName("");
    setZoneDescription("");
    setZoneIsDefault(false);
    setZoneCountries([]);
    setIsZoneDialogOpen(true);
  };

  // Open zone dialog for edit
  const handleEditZone = (zone: ShippingZoneWithDetails) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneDescription(zone.description ?? "");
    setZoneIsDefault(zone.is_default);
    setZoneCountries(zone.countries);
    setIsZoneDialogOpen(true);
  };

  // Submit zone form
  const handleSubmitZone = async () => {
    if (!zoneName.trim()) {
      toast.error("Zone name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        name: zoneName.trim(),
        description: zoneDescription.trim() || undefined,
        is_default: zoneIsDefault,
        countries: zoneCountries,
      };

      if (editingZone) {
        const result = await updateShippingZone(editingZone.id, input);
        if (result.success) {
          toast.success("Zone updated");
          setIsZoneDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createShippingZone(input);
        if (result.success) {
          toast.success("Zone created");
          setIsZoneDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete zone
  const handleDeleteZone = async (zone: ShippingZoneWithDetails) => {
    if (!confirm(`Delete "${zone.name}" and all its rates?`)) return;

    const result = await deleteShippingZone(zone.id);
    if (result.success) {
      toast.success("Zone deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  // Toggle country in zone
  const toggleCountry = (code: string) => {
    setZoneCountries((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  // Open rate dialog for create
  const handleCreateRate = (zoneId: number) => {
    setEditingRate(null);
    setRateZoneId(zoneId);
    setRateName("");
    setRatePriceAlone("");
    setRatePriceWithOthers("");
    setRateDeliveryEstimate("");
    setIsRateDialogOpen(true);
  };

  // Open rate dialog for edit
  const handleEditRate = (rate: ShippingRateData) => {
    setEditingRate(rate);
    setRateZoneId(rate.zone_id);
    setRateName(rate.name);
    setRatePriceAlone(rate.price_alone);
    setRatePriceWithOthers(rate.price_with_others);
    setRateDeliveryEstimate(rate.delivery_estimate ?? "");
    setIsRateDialogOpen(true);
  };

  // Submit rate form
  const handleSubmitRate = async () => {
    if (!rateName.trim()) {
      toast.error("Rate name is required");
      return;
    }
    if (!ratePriceAlone || isNaN(parseFloat(ratePriceAlone))) {
      toast.error("Valid price is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const priceAlone = parseFloat(ratePriceAlone);
      const priceWithOthers = ratePriceWithOthers
        ? parseFloat(ratePriceWithOthers)
        : priceAlone;

      if (editingRate) {
        const result = await updateShippingRate(editingRate.id, {
          name: rateName.trim(),
          price_alone: priceAlone,
          price_with_others: priceWithOthers,
          delivery_estimate: rateDeliveryEstimate.trim() || undefined,
        });
        if (result.success) {
          toast.success("Rate updated");
          setIsRateDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else if (rateZoneId) {
        const result = await createShippingRate({
          zone_id: rateZoneId,
          name: rateName.trim(),
          price_alone: priceAlone,
          price_with_others: priceWithOthers,
          delivery_estimate: rateDeliveryEstimate.trim() || undefined,
        });
        if (result.success) {
          toast.success("Rate created");
          setIsRateDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete rate
  const handleDeleteRate = async (rate: ShippingRateData) => {
    if (!confirm(`Delete "${rate.name}"?`)) return;

    const result = await deleteShippingRate(rate.id);
    if (result.success) {
      toast.success("Rate deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shipping</h1>
        <Button onClick={handleCreateZone} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Zone
        </Button>
      </div>

      {/* Zones list */}
      {zones.length === 0 ? (
        <div className="rounded-lg border border-gray-300 bg-white p-8 text-center">
          <Globe className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No shipping zones configured</p>
          <p className="text-sm text-gray-400">
            Create zones to define shipping rates for different regions
          </p>
          <Button onClick={handleCreateZone} variant="outline" className="mt-4">
            Create your first zone
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="rounded-lg border border-gray-300 bg-white p-4"
            >
              {/* Zone header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                      {zone.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                    {zone.description && (
                      <p className="text-sm text-gray-500">{zone.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditZone(zone)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteZone(zone)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Countries */}
              <div className="mb-4">
                <span className="text-sm text-gray-500">
                  {zone.countries.length === 0
                    ? "Applies to all countries (default fallback)"
                    : `Countries: ${zone.countries.join(", ")}`}
                </span>
              </div>

              {/* Rates */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Shipping Rates
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateRate(zone.id)}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Rate
                  </Button>
                </div>

                {zone.rates.length === 0 ? (
                  <p className="text-sm text-gray-400">No rates configured</p>
                ) : (
                  <div className="space-y-2">
                    {zone.rates.map((rate) => (
                      <div
                        key={rate.id}
                        className="flex items-center justify-between rounded bg-gray-50 p-2"
                      >
                        <div>
                          <span className="font-medium text-gray-900">
                            {rate.name}
                          </span>
                          {rate.delivery_estimate && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({rate.delivery_estimate})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-gray-900">
                              ${rate.price_alone}
                            </span>
                            {rate.price_alone !== rate.price_with_others && (
                              <span className="ml-1 text-gray-500">
                                / ${rate.price_with_others} w/others
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRate(rate)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRate(rate)}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone Dialog */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Edit Zone" : "Create Zone"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Zone name */}
            <div>
              <Label htmlFor="zone-name">Zone Name</Label>
              <Input
                id="zone-name"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="e.g., United States, Europe"
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="zone-description">Description (optional)</Label>
              <Input
                id="zone-description"
                value={zoneDescription}
                onChange={(e) => setZoneDescription(e.target.value)}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>

            {/* Default zone */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="zone-default"
                checked={zoneIsDefault}
                onCheckedChange={(checked) => setZoneIsDefault(checked === true)}
              />
              <Label htmlFor="zone-default" className="cursor-pointer">
                Default zone (fallback for unlisted countries)
              </Label>
            </div>

            {/* Countries */}
            <div>
              <Label>Countries</Label>
              <p className="text-xs text-gray-500 mb-2">
                Leave empty for default zone that applies to all countries
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {COMMON_COUNTRIES.map((country) => (
                  <div key={country.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`country-${country.code}`}
                      checked={zoneCountries.includes(country.code)}
                      onCheckedChange={() => toggleCountry(country.code)}
                    />
                    <Label
                      htmlFor={`country-${country.code}`}
                      className="cursor-pointer text-sm"
                    >
                      {country.name} ({country.code})
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsZoneDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitZone} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingZone ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Rate" : "Create Rate"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Rate name */}
            <div>
              <Label htmlFor="rate-name">Rate Name</Label>
              <Input
                id="rate-name"
                value={rateName}
                onChange={(e) => setRateName(e.target.value)}
                placeholder="e.g., Standard Shipping, Express"
                className="mt-1"
              />
            </div>

            {/* Price alone */}
            <div>
              <Label htmlFor="rate-price-alone">Price (single item)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="rate-price-alone"
                  type="number"
                  step="0.01"
                  min="0"
                  value={ratePriceAlone}
                  onChange={(e) => setRatePriceAlone(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Price with others */}
            <div>
              <Label htmlFor="rate-price-others">
                Price (with other items)
              </Label>
              <p className="text-xs text-gray-500">
                Optional - for combined shipping discounts
              </p>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="rate-price-others"
                  type="number"
                  step="0.01"
                  min="0"
                  value={ratePriceWithOthers}
                  onChange={(e) => setRatePriceWithOthers(e.target.value)}
                  className="pl-7"
                  placeholder="Same as single item"
                />
              </div>
            </div>

            {/* Delivery estimate */}
            <div>
              <Label htmlFor="rate-delivery">Delivery Estimate (optional)</Label>
              <Input
                id="rate-delivery"
                value={rateDeliveryEstimate}
                onChange={(e) => setRateDeliveryEstimate(e.target.value)}
                placeholder="e.g., 3-5 business days"
                className="mt-1"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsRateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitRate} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingRate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

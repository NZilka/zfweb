/**
 * OrderStatusActions - Packed and Shipped checkboxes for order fulfillment
 * Updates order status with timestamps
 */
"use client";

import { useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { updateOrderFulfillment } from "~/server/admin-actions";
import type { OrderWithItems } from "~/server/admin-queries";

interface OrderStatusActionsProps {
  order: OrderWithItems;
}

export function OrderStatusActions({ order }: OrderStatusActionsProps) {
  // Local state for optimistic updates
  const [isPacked, setIsPacked] = useState(order.isPacked);
  const [isShipped, setIsShipped] = useState(order.isShipped);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle packed checkbox change
  const handlePackedChange = async (checked: boolean) => {
    setIsUpdating(true);
    setIsPacked(checked);

    const result = await updateOrderFulfillment(order.id, { isPacked: checked });

    if (!result.success) {
      // Revert on error
      setIsPacked(!checked);
      toast.error(result.error || "Failed to update packed status");
    } else {
      toast.success(checked ? "Order marked as packed" : "Order unpacked");
    }

    setIsUpdating(false);
  };

  // Handle shipped checkbox change
  const handleShippedChange = async (checked: boolean) => {
    setIsUpdating(true);
    setIsShipped(checked);

    const result = await updateOrderFulfillment(order.id, {
      isShipped: checked,
      // Include tracking number when marking shipped
      ...(checked && trackingNumber ? { trackingNumber } : {}),
    });

    if (!result.success) {
      // Revert on error
      setIsShipped(!checked);
      toast.error(result.error || "Failed to update shipped status");
    } else {
      toast.success(checked ? "Order marked as shipped" : "Order unshipped");
    }

    setIsUpdating(false);
  };

  // Handle tracking number blur (save when focus leaves)
  const handleTrackingBlur = async () => {
    if (trackingNumber !== (order.trackingNumber || "")) {
      setIsUpdating(true);

      const result = await updateOrderFulfillment(order.id, { trackingNumber });

      if (!result.success) {
        toast.error(result.error || "Failed to save tracking number");
      } else if (trackingNumber) {
        toast.success("Tracking number saved");
      }

      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Packed checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`packed-${order.id}`}
          checked={isPacked}
          onCheckedChange={handlePackedChange}
          disabled={isUpdating}
        />
        <Label htmlFor={`packed-${order.id}`} className="text-sm">
          Packed
          {order.packedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({new Date(order.packedAt).toLocaleDateString()})
            </span>
          )}
        </Label>
      </div>

      {/* Shipped checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`shipped-${order.id}`}
          checked={isShipped}
          onCheckedChange={handleShippedChange}
          disabled={isUpdating}
        />
        <Label htmlFor={`shipped-${order.id}`} className="text-sm">
          Shipped
          {order.shippedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({new Date(order.shippedAt).toLocaleDateString()})
            </span>
          )}
        </Label>
      </div>

      {/* Tracking number input - shown when shipped or has tracking */}
      {(isShipped || trackingNumber) && (
        <div className="ml-6">
          <Label htmlFor={`tracking-${order.id}`} className="text-xs text-muted-foreground">
            Tracking Number
          </Label>
          <Input
            id={`tracking-${order.id}`}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            onBlur={handleTrackingBlur}
            placeholder="Enter tracking number"
            className="mt-1 h-8 text-sm"
            disabled={isUpdating}
          />
        </div>
      )}
    </div>
  );
}

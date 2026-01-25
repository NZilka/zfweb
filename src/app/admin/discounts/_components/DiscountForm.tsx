/**
 * DiscountForm - Create/edit discount code form
 * Handles validation and submission
 */
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import {
  createDiscount,
  updateDiscount,
  type DiscountInput,
  type DiscountData,
} from "~/server/discount-actions";

interface DiscountFormProps {
  discount?: DiscountData;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DiscountForm({ discount, onSuccess, onCancel }: DiscountFormProps) {
  const isEditMode = !!discount;

  // Form state
  const [code, setCode] = useState(discount?.code ?? "");
  const [name, setName] = useState(discount?.name ?? "");
  const [description, setDescription] = useState(discount?.description ?? "");
  const [discountValue, setDiscountValue] = useState(discount?.discount ?? "0");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    (discount?.discountType as "percent" | "fixed") ?? "percent"
  );
  const [freeShipping, setFreeShipping] = useState(discount?.freeShipping ?? false);
  const [active, setActive] = useState(discount?.active ?? true);
  const [maxUses, setMaxUses] = useState(discount?.maxUses?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState(
    discount?.expiresAt ? discount.expiresAt.toISOString().split("T")[0] : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!code.trim()) {
      newErrors.code = "Code is required";
    } else if (!/^[A-Z0-9]+$/.test(code.toUpperCase())) {
      newErrors.code = "Code must be alphanumeric";
    }

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    const numValue = parseFloat(discountValue);
    if (isNaN(numValue) || numValue < 0) {
      newErrors.discount = "Invalid discount value";
    } else if (discountType === "percent" && numValue > 100) {
      newErrors.discount = "Percentage cannot exceed 100";
    }

    if (maxUses && (isNaN(parseInt(maxUses)) || parseInt(maxUses) < 1)) {
      newErrors.maxUses = "Must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    const input: DiscountInput = {
      code: code.toUpperCase(),
      name,
      description,
      discount: parseFloat(discountValue),
      discountType,
      freeShipping,
      active,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };

    try {
      const result = isEditMode
        ? await updateDiscount(discount.id, input)
        : await createDiscount(input);

      if (result.success) {
        toast.success(isEditMode ? "Discount updated" : "Discount created");
        onSuccess();
      } else {
        toast.error(result.error || "Failed to save discount");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Code */}
      <div>
        <Label htmlFor="code">Code *</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g., SUMMER20"
          className="mt-1"
        />
        {errors.code && <p className="mt-1 text-sm text-red-500">{errors.code}</p>}
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Summer Sale 20% Off"
          className="mt-1"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="mt-1"
        />
      </div>

      {/* Discount Value and Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="discountValue">Discount Value *</Label>
          <Input
            id="discountValue"
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="mt-1"
          />
          {errors.discount && <p className="mt-1 text-sm text-red-500">{errors.discount}</p>}
        </div>
        <div>
          <Label htmlFor="discountType">Type</Label>
          <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Max Uses and Expires At */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="maxUses">Max Uses (optional)</Label>
          <Input
            id="maxUses"
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
            className="mt-1"
          />
          {errors.maxUses && <p className="mt-1 text-sm text-red-500">{errors.maxUses}</p>}
        </div>
        <div>
          <Label htmlFor="expiresAt">Expires At (optional)</Label>
          <Input
            id="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex gap-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="freeShipping"
            checked={freeShipping}
            onCheckedChange={(checked) => setFreeShipping(checked === true)}
          />
          <Label htmlFor="freeShipping">Free Shipping</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="active"
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
          />
          <Label htmlFor="active">Active</Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditMode ? "Update Discount" : "Create Discount"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

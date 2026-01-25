/**
 * DiscountCodeInput - Discount code entry and validation for checkout
 * Validates codes client-side via server action before proceeding
 */
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { X, Tag, Check } from "lucide-react";
import { validateDiscountCode, type ValidatedDiscount } from "~/server/discount-actions";

interface DiscountCodeInputProps {
  onDiscountApplied: (discount: ValidatedDiscount | null) => void;
  appliedDiscount: ValidatedDiscount | null;
}

export function DiscountCodeInput({ onDiscountApplied, appliedDiscount }: DiscountCodeInputProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Apply discount code
  const handleApply = async () => {
    if (!code.trim()) {
      setError("Please enter a code");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateDiscountCode(code);

      if (result.valid && result.discount) {
        onDiscountApplied(result.discount);
        setCode("");
      } else {
        setError(result.error || "Invalid code");
      }
    } catch {
      setError("Failed to validate code");
    } finally {
      setIsValidating(false);
    }
  };

  // Remove applied discount
  const handleRemove = () => {
    onDiscountApplied(null);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  // If discount is already applied, show the applied discount
  if (appliedDiscount) {
    return (
      <div className="rounded-lg border bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-300">
              {appliedDiscount.code}
            </span>
            <Badge variant="secondary" className="text-xs">
              {appliedDiscount.discountType === "percent"
                ? `${appliedDiscount.discount}% off`
                : `$${appliedDiscount.discount} off`}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show input form
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Discount code"
            className="pl-9"
            disabled={isValidating}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={isValidating || !code.trim()}
        >
          {isValidating ? "..." : "Apply"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import {
  checkCartMergeConflict,
  resolveCartMergeConflict,
  linkSessionToUser,
} from "~/server/cart-actions";
import { useCart } from "~/app/_context/CartContext";

// Cart merge conflict data from server
interface CartConflict {
  guestItemCount: number;
  userItemCount: number;
  guestTotal: string;
  userTotal: string;
}

// Modal component that detects and handles cart merge conflicts
// Shown when authenticated user has items in both guest and saved carts
export function CartMergeModal() {
  const { isSignedIn, isLoaded } = useUser();
  const { refreshCart } = useCart();
  const [conflict, setConflict] = useState<CartConflict | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check for cart merge conflict when user signs in
  useEffect(() => {
    async function checkConflict() {
      if (!isLoaded || !isSignedIn || hasChecked) return;

      try {
        const conflictData = await checkCartMergeConflict();
        if (conflictData) {
          setConflict(conflictData);
        } else {
          // No conflict - just link the session if needed
          await linkSessionToUser();
        }
      } catch (error) {
        console.error("Failed to check cart merge:", error);
      } finally {
        setHasChecked(true);
      }
    }

    // `void`: intentionally fire-and-forget; checkConflict handles its own errors
    void checkConflict();
  }, [isSignedIn, isLoaded, hasChecked]);

  // Reset check when user signs out
  useEffect(() => {
    if (!isSignedIn && hasChecked) {
      setHasChecked(false);
      setConflict(null);
    }
  }, [isSignedIn, hasChecked]);

  // Handle user choice
  const handleChoice = async (keepGuest: boolean) => {
    setIsResolving(true);
    try {
      await resolveCartMergeConflict(keepGuest);
      await refreshCart();
      setConflict(null);
    } catch (error) {
      console.error("Failed to resolve cart conflict:", error);
    } finally {
      setIsResolving(false);
    }
  };

  // Don't render if no conflict
  if (!conflict) return null;

  return (
    // Modal overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Modal content */}
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold font-[family-name:var(--font-heading)]">Cart Conflict</h2>
        <p className="mb-6 text-gray-600">
          You have items in both your current cart and your saved cart. Which
          would you like to keep?
        </p>

        {/* Cart comparison */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* Current (guest) cart */}
          <div className="rounded-lg border p-4">
            <p className="font-medium">Current Cart</p>
            <p className="text-2xl font-bold">${conflict.guestTotal}</p>
            <p className="text-sm text-gray-500">
              {conflict.guestItemCount}{" "}
              {conflict.guestItemCount === 1 ? "item" : "items"}
            </p>
          </div>

          {/* Saved (user) cart */}
          <div className="rounded-lg border p-4">
            <p className="font-medium">Saved Cart</p>
            <p className="text-2xl font-bold">${conflict.userTotal}</p>
            <p className="text-sm text-gray-500">
              {conflict.userItemCount}{" "}
              {conflict.userItemCount === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={() => handleChoice(true)}
            disabled={isResolving}
          >
            Keep Current
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => handleChoice(false)}
            disabled={isResolving}
          >
            Keep Saved
          </Button>
        </div>

        {isResolving && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Updating cart...
          </p>
        )}
      </div>
    </div>
  );
}

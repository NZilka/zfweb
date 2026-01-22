"use client";

import { useState } from "react";
import { useUser, SignUpButton } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { UserPlus, Check } from "lucide-react";

// Props for the component
interface CreateAccountPromptProps {
  customerEmail: string;
}

// Prompt shown to guest users after checkout to create an account
// Benefits: order history, saved payment methods, faster checkout
export function CreateAccountPrompt({ customerEmail }: CreateAccountPromptProps) {
  const { isSignedIn, isLoaded } = useUser();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if user is already signed in or dismissed
  if (!isLoaded || isSignedIn || isDismissed) {
    return null;
  }

  return (
    <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-blue-100 p-2">
          <UserPlus className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900">Create an Account</h3>
          <p className="mt-1 text-sm text-blue-700">
            Save your order history, speed up future checkouts, and manage your
            payment methods.
          </p>

          {/* Benefits list */}
          <ul className="mt-3 space-y-1 text-sm text-blue-700">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              View all your orders in one place
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Faster checkout with saved payment methods
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Track order status and history
            </li>
          </ul>

          {/* Action buttons */}
          <div className="mt-4 flex gap-3">
            <SignUpButton
              mode="modal"
              forceRedirectUrl={window.location.href}
            >
              <Button size="sm">Create Account</Button>
            </SignUpButton>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
            >
              Maybe Later
            </Button>
          </div>

          <p className="mt-2 text-xs text-blue-600">
            We&apos;ll use {customerEmail} for your account.
          </p>
        </div>
      </div>
    </div>
  );
}

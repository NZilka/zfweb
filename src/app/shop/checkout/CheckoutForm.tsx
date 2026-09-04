"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe, isStripeConfigured } from "~/lib/stripe";
import { Button } from "~/components/ui/button";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import {
  COUNTRIES,
  getSubdivisionsForCountry,
  getSubdivisionLabel,
  getPostalCodeLabel,
} from "~/lib/countries";
import { z } from "zod";
import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
// PostHog event tracking for checkout analytics
import { trackCheckoutStarted } from "~/lib/posthog";
// Discount code input component
import { DiscountCodeInput } from "./DiscountCodeInput";
import type { ValidatedDiscount } from "~/server/discount-actions";
// Discount calculation utility
import { calculateDiscountedTotal } from "~/lib/discount-utils";

// Saved payment method type from API
type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

// Customer info validation schema
const customerInfoSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required").default("US"),
});

type CustomerInfo = z.infer<typeof customerInfoSchema>;

// Initial form state
const initialCustomerInfo: CustomerInfo = {
  email: "",
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "US",
};

// Props for CheckoutForm - receives subtotal for discount calculation.
// testModeActive/testModeOutcome come from the server page and control whether
// the form shows the real Stripe flow or the bypass "Simulate Payment" UI.
interface CheckoutFormProps {
  subtotal: number;
  testModeActive: boolean;
  testModeOutcome: "success" | "failure";
}

// Main checkout form component - wraps payment form with Stripe Elements
export default function CheckoutForm({
  subtotal,
  testModeActive,
  testModeOutcome,
}: CheckoutFormProps) {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(initialCustomerInfo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  // Saved payment methods state
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);

  // Save card checkbox state (only for new cards)
  const [saveCard, setSaveCard] = useState(false);

  // Discount code state
  const [appliedDiscount, setAppliedDiscount] = useState<ValidatedDiscount | null>(null);

  // Gift order state - hides prices on packing slip
  const [isGift, setIsGift] = useState(false);

  // Pre-fill email for signed-in users
  useEffect(() => {
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (isSignedIn && primaryEmail) {
      setCustomerInfo((prev) => ({
        ...prev,
        email: primaryEmail,
      }));
    }
  }, [isSignedIn, user]);

  // Fetch saved payment methods for signed-in users
  useEffect(() => {
    async function fetchSavedMethods() {
      if (!isSignedIn) return;

      setIsLoadingMethods(true);
      try {
        const response = await fetch("/api/checkout/payment-methods");
        if (response.ok) {
          const data = await response.json();
          setSavedMethods(data.paymentMethods || []);
        }
      } catch (error) {
        console.error("Failed to fetch saved payment methods:", error);
      } finally {
        setIsLoadingMethods(false);
      }
    }

    // `void`: intentionally fire-and-forget; fetchSavedMethods handles its own errors
    void fetchSavedMethods();
  }, [isSignedIn]);

  // Show configuration message if Stripe is not set up AND test mode is off.
  // In test mode we don't need Stripe configured — orders bypass it entirely.
  if (!isStripeConfigured() && !testModeActive) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
        <h2 className="mb-2 text-xl font-semibold font-[family-name:var(--font-heading)] text-yellow-800 dark:text-yellow-200">
          Checkout Not Available
        </h2>
        <p className="mb-4 text-yellow-700 dark:text-yellow-300">
          Payment processing is not configured yet. Please contact the store owner.
        </p>
        <Link href="/shop/cart">
          <Button variant="outline">Return to Cart</Button>
        </Link>
      </div>
    );
  }

  // Validate customer info before creating payment intent
  const validateAndCreateIntent = async () => {
    // Validate form
    const result = customerInfoSchema.safeParse(customerInfo);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsCreatingIntent(true);

    try {
      // Test mode path: bypass Stripe entirely. Call the test-place-order
      // endpoint which either creates a test order (outcome=success) or
      // returns a simulated failure (outcome=failure). No Stripe Elements are
      // rendered because test mode doesn't produce a valid clientSecret.
      if (testModeActive) {
        const response = await fetch("/api/checkout/test-place-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerInfo: result.data,
            ...(appliedDiscount && { discountCode: appliedDiscount.code }),
            isGift,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message ?? "Test payment failed");
        }

        const { paymentIntentId } = await response.json();
        // Jump straight to confirmation — no webhook delay since the order was
        // created synchronously by the route handler.
        router.push(`/shop/order/confirmation/${paymentIntentId}`);
        return;
      }

      // Real Stripe path: create payment intent on server
      const response = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerInfo: result.data,
          // Only save if using new card and checkbox is checked
          savePaymentMethod: selectedMethodId === null && saveCard,
          // Pass selected payment method ID if using saved card (omit if null)
          ...(selectedMethodId && { savedPaymentMethodId: selectedMethodId }),
          // Pass discount code if applied
          ...(appliedDiscount && { discountCode: appliedDiscount.code }),
          // Pass gift flag for packing slip
          isGift,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message ?? "Failed to create payment intent");
      }

      const { clientSecret } = await response.json();
      setClientSecret(clientSecret);
    } catch (error: any) {
      setErrors({ submit: error.message });
    } finally {
      setIsCreatingIntent(false);
    }
  };

  // Handle input change
  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Format card brand for display
  const formatBrand = (brand: string) => {
    const brands: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "American Express",
      discover: "Discover",
    };
    return brands[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  // If we have a client secret, show the Stripe payment form
  if (clientSecret) {
    return (
      <Elements
        stripe={getStripe()}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#000000",
            },
          },
        }}
      >
        <PaymentForm
          customerInfo={customerInfo}
          usingSavedMethod={selectedMethodId !== null}
        />
      </Elements>
    );
  }

  // Otherwise show customer info form
  return (
    <div className="space-y-6">
      {/* Test mode banner — makes it unmistakable that no real payment is happening.
          Visible to anyone on staging when an admin has toggled test mode on. */}
      {testModeActive && (
        <div className="rounded border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="font-semibold text-red-800 dark:text-red-200">
            TEST MODE ACTIVE
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Clicking &quot;Place Test Order&quot; will{" "}
            {testModeOutcome === "success"
              ? "create a test order in the database without charging any real card."
              : "simulate a payment failure — no order will be created."}
          </p>
        </div>
      )}

      <h2 className="text-xl font-semibold font-[family-name:var(--font-heading)]">Contact Information</h2>

      {/* Email */}
      <div>
        <label className="mb-1 block text-sm font-medium">Email *</label>
        <input
          type="email"
          value={customerInfo.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="you@example.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>

      <h2 className="text-xl font-semibold font-[family-name:var(--font-heading)]">Shipping Address</h2>

      {/* Name fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">First Name *</label>
          <input
            type="text"
            value={customerInfo.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Last Name *</label>
          <input
            type="text"
            value={customerInfo.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
        </div>
      </div>

      {/* Address fields */}
      <div>
        <label className="mb-1 block text-sm font-medium">Address *</label>
        <input
          type="text"
          value={customerInfo.address1}
          onChange={(e) => handleInputChange("address1", e.target.value)}
          className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="Street address"
        />
        {errors.address1 && <p className="mt-1 text-sm text-red-500">{errors.address1}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Address 2</label>
        <input
          type="text"
          value={customerInfo.address2}
          onChange={(e) => handleInputChange("address2", e.target.value)}
          className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="Apartment, suite, etc. (optional)"
        />
      </div>

      {/* Country - placed before state so state options update accordingly */}
      <div>
        <label className="mb-1 block text-sm font-medium">Country *</label>
        <Combobox
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          value={customerInfo.country}
          onChange={(value) => {
            // When country changes, reset state since subdivisions differ
            handleInputChange("country", value);
            if (value !== customerInfo.country) {
              handleInputChange("state", "");
            }
          }}
          placeholder="Select country..."
          aria-label="Country"
        />
        {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country}</p>}
      </div>

      {/* City, State/Province, ZIP/Postal Code */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">City *</label>
          <input
            type="text"
            value={customerInfo.city}
            onChange={(e) => handleInputChange("city", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
        </div>
        <div>
          {/* Label changes based on country (State vs Province) */}
          <label className="mb-1 block text-sm font-medium">
            {getSubdivisionLabel(customerInfo.country)} *
          </label>
          <Combobox
            options={getSubdivisionsForCountry(customerInfo.country).map((s) => ({
              value: s.code,
              label: s.name,
            }))}
            value={customerInfo.state}
            onChange={(value) => handleInputChange("state", value)}
            placeholder={`Select ${getSubdivisionLabel(customerInfo.country).toLowerCase()}...`}
            aria-label={getSubdivisionLabel(customerInfo.country)}
          />
          {errors.state && <p className="mt-1 text-sm text-red-500">{errors.state}</p>}
        </div>
        <div>
          {/* Label changes based on country (ZIP Code vs Postal Code) */}
          <label className="mb-1 block text-sm font-medium">
            {getPostalCodeLabel(customerInfo.country)} *
          </label>
          <input
            type="text"
            value={customerInfo.zipCode}
            onChange={(e) => handleInputChange("zipCode", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.zipCode && <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>}
        </div>
      </div>

      {/* Payment Method Selection (for signed-in users with saved cards).
          Hidden in test mode — saved cards are irrelevant when Stripe is bypassed. */}
      {!testModeActive && isSignedIn && (savedMethods.length > 0 || isLoadingMethods) && (
        <div>
          <h2 className="mb-3 text-xl font-semibold font-[family-name:var(--font-heading)]">Payment Method</h2>

          {isLoadingMethods ? (
            <p className="text-sm text-gray-500">Loading saved cards...</p>
          ) : (
            <div className="space-y-2">
              {/* Saved payment methods */}
              {savedMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                    selectedMethodId === method.id
                      ? "border-black bg-gray-50 dark:border-white dark:bg-gray-800"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={selectedMethodId === method.id}
                    onChange={() => setSelectedMethodId(method.id)}
                    className="h-4 w-4"
                  />
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {formatBrand(method.brand)} ending in {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires {method.expMonth}/{method.expYear}
                    </p>
                  </div>
                </label>
              ))}

              {/* Use new card option */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  selectedMethodId === null
                    ? "border-black bg-gray-50 dark:border-white dark:bg-gray-800"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethodId === null}
                  onChange={() => setSelectedMethodId(null)}
                  className="h-4 w-4"
                />
                <Plus className="h-5 w-5 text-gray-400" />
                <span className="font-medium">Use a new card</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Save card checkbox (only for signed-in users using new card).
          Hidden in test mode — no real card to save. */}
      {!testModeActive && isSignedIn && selectedMethodId === null && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm">Save this card for future purchases</span>
        </label>
      )}

      {/* Discount code input */}
      <div>
        <h2 className="mb-3 text-xl font-semibold font-[family-name:var(--font-heading)]">Discount Code</h2>
        <DiscountCodeInput
          onDiscountApplied={setAppliedDiscount}
          appliedDiscount={appliedDiscount}
        />
      </div>

      {/* Order totals - shows discount when applied */}
      {appliedDiscount && (
        <div className="rounded-lg border bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-gray-900 dark:text-gray-100">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Discount ({appliedDiscount.code})</span>
              <span>
                -$
                {calculateDiscountedTotal(
                  subtotal,
                  appliedDiscount.discount,
                  appliedDiscount.discountType
                ).discountAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold dark:border-gray-600">
              <span className="text-gray-900 dark:text-gray-100">Total</span>
              <span className="text-gray-900 dark:text-gray-100">
                $
                {calculateDiscountedTotal(
                  subtotal,
                  appliedDiscount.discount,
                  appliedDiscount.discountType
                ).finalTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Gift order checkbox - hides prices on packing slip for gift recipients */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={isGift}
          onChange={(e) => setIsGift(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm">This is a gift (don&apos;t include prices on packing slip)</span>
      </label>

      {/* Submit error */}
      {errors.submit && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      {/* Continue to payment / Place Test Order button.
          Button label reflects the mode so shoppers see exactly what will happen. */}
      <Button
        onClick={validateAndCreateIntent}
        disabled={isCreatingIntent}
        className="w-full"
        size="lg"
      >
        {isCreatingIntent
          ? "Processing..."
          : testModeActive
            ? `Place Test Order (${testModeOutcome})`
            : "Continue to Payment"}
      </Button>
    </div>
  );
}

// Inner payment form component - uses Stripe Elements context
function PaymentForm({
  customerInfo,
  usingSavedMethod,
}: {
  customerInfo: CustomerInfo;
  usingSavedMethod: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Confirm payment with Stripe
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/shop/checkout/success`,
        receipt_email: customerInfo.email,
      },
    });

    // This point will only be reached if there's an error
    // Otherwise, user is redirected to return_url
    if (stripeError) {
      setError(stripeError.message ?? "An error occurred during payment.");
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold font-[family-name:var(--font-heading)]">Payment</h2>

      {/* Customer info summary (readonly) */}
      <div className="rounded border bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="font-medium">
          {customerInfo.firstName} {customerInfo.lastName}
        </p>
        <p className="text-gray-600 dark:text-gray-400">{customerInfo.email}</p>
        <p className="text-gray-600 dark:text-gray-400">
          {customerInfo.address1}
          {customerInfo.address2 && `, ${customerInfo.address2}`}
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          {customerInfo.city}, {customerInfo.state} {customerInfo.zipCode}
        </p>
      </div>

      {/* Stripe Payment Element - handles both new and saved methods */}
      <PaymentElement />

      {/* Error display */}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pay button */}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripe, isStripeConfigured } from "~/lib/stripe";
import { Button } from "~/components/ui/button";
import { z } from "zod";
import Link from "next/link";

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

// Main checkout form component - wraps payment form with Stripe Elements
export default function CheckoutForm() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(initialCustomerInfo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  // Show configuration message if Stripe is not set up
  if (!isStripeConfigured()) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-center dark:border-yellow-800 dark:bg-yellow-900/20">
        <h2 className="mb-2 text-xl font-semibold text-yellow-800 dark:text-yellow-200">
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
      // Zod v4: Use issues array instead of errors
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
      // Create payment intent on server
      const response = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerInfo: result.data }),
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
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
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
        <PaymentForm customerInfo={customerInfo} />
      </Elements>
    );
  }

  // Otherwise show customer info form
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Contact Information</h2>

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

      <h2 className="text-xl font-semibold">Shipping Address</h2>

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

      {/* City, State, ZIP */}
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
          <label className="mb-1 block text-sm font-medium">State *</label>
          <input
            type="text"
            value={customerInfo.state}
            onChange={(e) => handleInputChange("state", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.state && <p className="mt-1 text-sm text-red-500">{errors.state}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">ZIP Code *</label>
          <input
            type="text"
            value={customerInfo.zipCode}
            onChange={(e) => handleInputChange("zipCode", e.target.value)}
            className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {errors.zipCode && <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>}
        </div>
      </div>

      {/* Country */}
      <div>
        <label className="mb-1 block text-sm font-medium">Country *</label>
        <select
          value={customerInfo.country}
          onChange={(e) => handleInputChange("country", e.target.value)}
          className="w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
        {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country}</p>}
      </div>

      {/* Submit error */}
      {errors.submit && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      {/* Continue to payment button */}
      <Button
        onClick={validateAndCreateIntent}
        disabled={isCreatingIntent}
        className="w-full"
        size="lg"
      >
        {isCreatingIntent ? "Processing..." : "Continue to Payment"}
      </Button>
    </div>
  );
}

// Inner payment form component - uses Stripe Elements context
function PaymentForm({ customerInfo }: { customerInfo: CustomerInfo }) {
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
      <h2 className="text-xl font-semibold">Payment</h2>

      {/* Customer info summary (readonly) */}
      <div className="rounded border bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="font-medium">{customerInfo.firstName} {customerInfo.lastName}</p>
        <p className="text-gray-600 dark:text-gray-400">{customerInfo.email}</p>
        <p className="text-gray-600 dark:text-gray-400">
          {customerInfo.address1}
          {customerInfo.address2 && `, ${customerInfo.address2}`}
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          {customerInfo.city}, {customerInfo.state} {customerInfo.zipCode}
        </p>
      </div>

      {/* Stripe Payment Element */}
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

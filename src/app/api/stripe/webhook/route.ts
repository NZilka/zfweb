import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { constructWebhookEvent, retrievePaymentIntent } from "~/server/stripe";
import { createOrderFromPayment } from "~/server/order-actions";
import {
  syncPaymentStateByPaymentIntent,
  syncOrderStateToKV,
} from "~/server/stripe-sync";
// Import discount usage increment for successful payments
import { incrementDiscountUsage } from "~/server/discount-actions";
import type Stripe from "stripe";

// Check if PaymentIntent payload is a snapshot (has full data) or thin (just ID)
// Snapshot payloads include metadata; thin payloads only have id and object type
function isSnapshotPayload(obj: { id: string; metadata?: Record<string, string> }): obj is Stripe.PaymentIntent {
  return obj.metadata !== undefined && Object.keys(obj).length > 2;
}

// Get PaymentIntent data - uses snapshot if available, otherwise fetches from API
// This handles both payload types while preferring fresh data for security
async function getPaymentIntent(
  obj: { id: string; metadata?: Record<string, string> },
  preferFresh: boolean = false
): Promise<Stripe.PaymentIntent> {
  // If we prefer fresh data or payload is thin, fetch from API
  if (preferFresh || !isSnapshotPayload(obj)) {
    console.log(`Fetching fresh PaymentIntent data for ${obj.id}`);
    return retrievePaymentIntent(obj.id);
  }
  // Use snapshot data (already validated by webhook signature)
  console.log(`Using snapshot PaymentIntent data for ${obj.id}`);
  return obj;
}

// POST /api/stripe/webhook
// Handles Stripe webhook events for payment processing
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { message: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { message: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  // Handle the event - supports both snapshot and thin payloads
  // For payment-critical events, we fetch fresh data to prevent replay attacks
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        // For payment success, always fetch fresh data for security
        const obj = event.data.object as { id: string; metadata?: Record<string, string> };
        const paymentIntent = await getPaymentIntent(obj, true);
        console.log("Payment succeeded:", paymentIntent.id);

        // Create order from successful payment
        const order = await createOrderFromPayment(paymentIntent);

        // Increment discount usage if a discount code was applied
        // discountId is stored in metadata during payment intent creation
        if (paymentIntent.metadata.discountId) {
          const discountId = parseInt(paymentIntent.metadata.discountId, 10);
          if (!isNaN(discountId)) {
            await incrementDiscountUsage(discountId);
            console.log(`Incremented usage for discount ID ${discountId}`);
          }
        }

        // Sync state to KV after order creation (per stripe-recommendations pattern)
        // Get customer ID from payment intent for sync
        const customerId =
          typeof paymentIntent.customer === "string"
            ? paymentIntent.customer
            : paymentIntent.customer?.id;

        if (customerId && order) {
          // Get item count from order products array
          const itemCount = Array.isArray(order.products) ? order.products.length : 0;

          // Sync order state to KV for quick lookups
          await syncOrderStateToKV(paymentIntent.id, order, itemCount, customerId);

          // Sync payment state to update lastOrderId
          await syncPaymentStateByPaymentIntent(paymentIntent.id);
        }
        break;
      }

      case "payment_intent.processing": {
        // Payment is processing (e.g., bank transfer pending)
        const obj = event.data.object as { id: string; metadata?: Record<string, string> };
        console.log("Payment processing:", obj.id);

        // Sync payment state to KV to reflect processing status
        await syncPaymentStateByPaymentIntent(obj.id);
        break;
      }

      case "payment_intent.payment_failed": {
        // For failures, snapshot data is fine for logging
        const obj = event.data.object as { id: string; metadata?: Record<string, string> };
        const paymentIntent = await getPaymentIntent(obj, false);
        console.log(
          "Payment failed:",
          paymentIntent.id,
          paymentIntent.last_payment_error?.message
        );

        // Sync payment state to KV to reflect failed status
        await syncPaymentStateByPaymentIntent(paymentIntent.id);
        break;
      }

      case "payment_intent.canceled": {
        // Payment was canceled
        const obj = event.data.object as { id: string };
        console.log("Payment canceled:", obj.id);

        // Sync payment state to KV to reflect canceled status
        await syncPaymentStateByPaymentIntent(obj.id);
        break;
      }

      default:
        // Unhandled event type - just acknowledge receipt
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook event:", error);
    return NextResponse.json(
      { message: `Webhook processing error: ${error.message}` },
      { status: 500 }
    );
  }
}

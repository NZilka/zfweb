import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { constructWebhookEvent, retrievePaymentIntent } from "~/server/stripe";
import { createOrderFromPayment } from "~/server/order-actions";
import type Stripe from "stripe";

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

  // Handle the event using thin payloads - fetch fresh data from Stripe API
  // This prevents issues with stale/replayed webhook data
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        // Extract ID from webhook payload, then fetch fresh data from API
        const { id } = event.data.object as { id: string };
        const paymentIntent = await retrievePaymentIntent(id);
        console.log("Payment succeeded:", paymentIntent.id);

        // Create order from successful payment using fresh data
        await createOrderFromPayment(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        // Extract ID and fetch fresh data for logging/notification
        const { id } = event.data.object as { id: string };
        const paymentIntent = await retrievePaymentIntent(id);
        console.log("Payment failed:", paymentIntent.id, paymentIntent.last_payment_error?.message);
        // Could notify customer, log error, etc.
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

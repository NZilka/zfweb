"use server";

import { db } from "~/server/db";
import {
  order,
  order_items,
  cart_item,
  shopping_session,
  product,
} from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

// Create an order from a successful Stripe payment
// Called by webhook handler when payment_intent.succeeded is received
export async function createOrderFromPayment(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;

  // Extract customer info from payment intent metadata
  const customerEmail = metadata.customerEmail ?? "";
  const customerName = metadata.customerName ?? "";
  const shippingAddress = metadata.shippingAddress ?? "{}";
  const cartSessionToken = metadata.cartSessionToken ?? "";
  // Gift flag stored as string in metadata, convert to boolean
  const isGift = metadata.isGift === "true";

  if (!cartSessionToken) {
    throw new Error("No cart session token in payment intent metadata");
  }

  // Find the shopping session
  const session = await db.query.shopping_session.findFirst({
    where: (model, { eq }) => eq(model.session_token, cartSessionToken),
  });

  if (!session) {
    throw new Error("Shopping session not found");
  }

  // Get cart items
  const cartItems = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, session.id),
  });

  if (cartItems.length === 0) {
    throw new Error("No items in cart");
  }

  // Calculate total from cart items (verify matches payment)
  let calculatedTotal = 0;
  const productIds: number[] = [];

  for (const item of cartItems) {
    const productData = await db.query.product.findFirst({
      where: (model, { eq }) => eq(model.id, item.product_id),
    });

    if (productData) {
      calculatedTotal += parseFloat(productData.price) * item.quantity;
      productIds.push(item.product_id);
    }
  }

  // Convert payment amount from cents to dollars for comparison
  const paymentAmount = paymentIntent.amount / 100;

  // Create the order
  const [newOrder] = await db
    .insert(order)
    .values({
      payment_intent_id: paymentIntent.id,
      status: "paid",
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_address: shippingAddress,
      products: productIds,
      total: calculatedTotal.toFixed(2),
      // Gift flag controls whether prices show on packing slip
      is_gift: isGift,
    })
    .returning();

  if (!newOrder) {
    throw new Error("Failed to create order");
  }

  // Create order items for detailed tracking
  for (const item of cartItems) {
    await db.insert(order_items).values({
      order_id: newOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
    });

    // Update product inventory
    await db
      .update(product)
      .set({
        inventory: sql`${product.inventory} - ${item.quantity}`,
      })
      .where(eq(product.id, item.product_id));
  }

  // Clear the cart after successful order
  await db.delete(cart_item).where(eq(cart_item.session_id, session.id));

  // Reset session total
  await db
    .update(shopping_session)
    .set({ total: "0" })
    .where(eq(shopping_session.id, session.id));

  console.log("Order created successfully:", newOrder.id);
  return newOrder;
}

// Get order by ID (for order confirmation page)
export async function getOrderById(orderId: number) {
  const orderData = await db.query.order.findFirst({
    where: (model, { eq }) => eq(model.id, orderId),
  });

  if (!orderData) {
    return null;
  }

  // Get order items with product details
  const items = await db.query.order_items.findMany({
    where: (model, { eq }) => eq(model.order_id, orderId),
  });

  const itemsWithProducts = [];
  for (const item of items) {
    const productData = await db.query.product.findFirst({
      where: (model, { eq }) => eq(model.id, item.product_id),
    });

    if (productData) {
      itemsWithProducts.push({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: productData.id,
          title: productData.title,
          price: productData.price,
          imgUrl: productData.imgUrl,
        },
      });
    }
  }

  return {
    ...orderData,
    items: itemsWithProducts,
    shippingAddress: JSON.parse(orderData.shipping_address),
  };
}

// Get order by payment intent ID (for redirect from Stripe)
export async function getOrderByPaymentIntent(paymentIntentId: string) {
  const orderData = await db.query.order.findFirst({
    where: (model, { eq }) => eq(model.payment_intent_id, paymentIntentId),
  });

  if (!orderData) {
    return null;
  }

  return getOrderById(orderData.id);
}

"use server";

import { db } from "~/server/db";
import { shopping_session, cart_item, product, customer } from "~/server/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

// Cookie name for session token
const SESSION_COOKIE = "cart_session";
// Session duration: 30 days in milliseconds
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Generate a random session token (64 hex characters)
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Calculate session expiry date (30 days from now)
function getExpiryDate(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

// Get total quantity of a product reserved in all active carts (non-expired sessions)
// Optionally exclude a specific session (for checking current user's available qty)
async function getReservedQuantity(productId: number, excludeSessionId?: number): Promise<number> {
  // Get all cart items for this product in non-expired sessions
  const activeSessions = await db.query.shopping_session.findMany({
    where: (model, { gt }) => gt(model.expires_at, new Date()),
  });

  const activeSessionIds = activeSessions
    .filter(s => excludeSessionId ? s.id !== excludeSessionId : true)
    .map(s => s.id);

  if (activeSessionIds.length === 0) return 0;

  const cartItems = await db.query.cart_item.findMany({
    where: (model, { eq, and, inArray }) =>
      and(
        eq(model.product_id, productId),
        inArray(model.session_id, activeSessionIds)
      ),
  });

  return cartItems.reduce((sum, item) => sum + item.quantity, 0);
}

// Get available inventory for a product (total - reserved in other carts)
export async function getAvailableInventory(productId: number, excludeSessionId?: number): Promise<number> {
  const productData = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, productId),
  });

  if (!productData) return 0;

  const reserved = await getReservedQuantity(productId, excludeSessionId);
  return Math.max(0, productData.inventory - reserved);
}

// Get or create a shopping session for the current user/guest
// Returns the session with its cart items
export async function getOrCreateSession() {
  const cookieStore = await cookies();
  let sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  // If we have a session token, try to find the existing session
  if (sessionToken) {
    const existingSession = await db.query.shopping_session.findFirst({
      where: (model, { eq, gt, and }) =>
        and(
          eq(model.session_token, sessionToken!),
          gt(model.expires_at, new Date()) // Not expired
        ),
    });

    if (existingSession) {
      // Extend session expiry on activity
      await db
        .update(shopping_session)
        .set({ expires_at: getExpiryDate() })
        .where(eq(shopping_session.id, existingSession.id));

      return existingSession;
    }
  }

  // Create new session
  sessionToken = generateSessionToken();
  const expiresAt = getExpiryDate();

  const [newSession] = await db
    .insert(shopping_session)
    .values({
      session_token: sessionToken,
      total: "0",
      expires_at: expiresAt,
    })
    .returning();

  // Set HTTP-only cookie with session token
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return newSession!;
}

// Cart item with product details for display
export interface CartItemWithProduct {
  id: number;
  quantity: number;
  product: {
    id: number;
    title: string;
    price: string;
    imgUrl: string[];
    inventory: number;
  };
}

// Get all cart items for the current session with product details
export async function getCartItems(): Promise<CartItemWithProduct[]> {
  const session = await getOrCreateSession();

  const items = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, session.id),
    orderBy: (model, { asc }) => asc(model.createdAt),
  });

  // Fetch product details for each item
  const itemsWithProducts: CartItemWithProduct[] = [];
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
          inventory: productData.inventory,
        },
      });
    }
  }

  return itemsWithProducts;
}

// Add item to cart (or increment quantity if already in cart)
// Checks available inventory (total - reserved in other carts)
export async function addToCart(productId: number, quantity: number = 1) {
  const session = await getOrCreateSession();

  // Check if product exists
  const productData = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, productId),
  });

  if (!productData) {
    throw new Error("Product not found");
  }

  // Check if item already in cart
  const existingItem = await db.query.cart_item.findFirst({
    where: (model, { eq, and }) =>
      and(eq(model.session_id, session.id), eq(model.product_id, productId)),
  });

  // Get available inventory (excludes items in OTHER carts, not ours)
  const availableInventory = await getAvailableInventory(productId, session.id);

  // Current quantity in our cart
  const currentQtyInCart = existingItem?.quantity ?? 0;

  // Check if we can add the requested quantity
  if (quantity > availableInventory) {
    if (availableInventory === 0) {
      throw new Error("This item is no longer available");
    }
    throw new Error(`Only ${availableInventory} available`);
  }

  if (existingItem) {
    // Update quantity - availableInventory already excludes our cart,
    // so it represents the max we can have total
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > availableInventory) {
      const canAdd = availableInventory - existingItem.quantity;
      throw new Error(canAdd > 0 ? `Only ${canAdd} more available` : "No more available");
    }

    await db
      .update(cart_item)
      .set({ quantity: newQuantity })
      .where(eq(cart_item.id, existingItem.id));
  } else {
    // Add new item
    await db.insert(cart_item).values({
      session_id: session.id,
      product_id: productId,
      quantity,
    });
  }

  // Recalculate cart total
  await recalculateCartTotal(session.id);

  return { success: true };
}

// Update cart item quantity
// Checks available inventory (total - reserved in other carts)
export async function updateCartItemQuantity(
  cartItemId: number,
  quantity: number
) {
  const session = await getOrCreateSession();

  // Verify item belongs to current session
  const item = await db.query.cart_item.findFirst({
    where: (model, { eq, and }) =>
      and(eq(model.id, cartItemId), eq(model.session_id, session.id)),
  });

  if (!item) {
    throw new Error("Cart item not found");
  }

  // Check product exists
  const productData = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, item.product_id),
  });

  if (!productData) {
    throw new Error("Product not found");
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or less
    await db.delete(cart_item).where(eq(cart_item.id, cartItemId));
  } else {
    // Get available inventory (excludes items in OTHER carts)
    const availableInventory = await getAvailableInventory(item.product_id, session.id);

    // Max we can have is: available + what we already have in cart
    const maxQuantity = availableInventory + item.quantity;

    if (quantity > maxQuantity) {
      throw new Error(`Only ${maxQuantity} available`);
    }

    // Update quantity
    await db
      .update(cart_item)
      .set({ quantity })
      .where(eq(cart_item.id, cartItemId));
  }

  // Recalculate cart total
  await recalculateCartTotal(session.id);

  return { success: true };
}

// Remove item from cart
export async function removeFromCart(cartItemId: number) {
  const session = await getOrCreateSession();

  // Verify item belongs to current session
  const item = await db.query.cart_item.findFirst({
    where: (model, { eq, and }) =>
      and(eq(model.id, cartItemId), eq(model.session_id, session.id)),
  });

  if (!item) {
    throw new Error("Cart item not found");
  }

  await db.delete(cart_item).where(eq(cart_item.id, cartItemId));

  // Recalculate cart total
  await recalculateCartTotal(session.id);

  return { success: true };
}

// Clear all items from cart
export async function clearCart() {
  const session = await getOrCreateSession();

  await db.delete(cart_item).where(eq(cart_item.session_id, session.id));

  // Reset cart total
  await db
    .update(shopping_session)
    .set({ total: "0" })
    .where(eq(shopping_session.id, session.id));

  return { success: true };
}

// Get cart summary (item count and total)
export async function getCartSummary() {
  const session = await getOrCreateSession();

  const items = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, session.id),
  });

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    itemCount,
    total: session.total,
  };
}

// Recalculate cart total based on current items
async function recalculateCartTotal(sessionId: number) {
  const items = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, sessionId),
  });

  let total = 0;
  for (const item of items) {
    const productData = await db.query.product.findFirst({
      where: (model, { eq }) => eq(model.id, item.product_id),
    });

    if (productData) {
      total += parseFloat(productData.price) * item.quantity;
    }
  }

  await db
    .update(shopping_session)
    .set({ total: total.toFixed(2) })
    .where(eq(shopping_session.id, sessionId));
}

// ============================================================
// Cart Merge Functions - Handle cart conflicts when user logs in
// ============================================================

// Get customer ID for authenticated user, creating if needed
async function getOrCreateCustomerId(clerkUserId: string): Promise<number | null> {
  // Check if customer exists
  const existingCustomer = await db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });

  if (existingCustomer) {
    return existingCustomer.id;
  }

  // Customer will be created during checkout with full details
  return null;
}

// Check if there's a cart merge conflict (both guest and user have items)
// Returns null if no conflict, or conflict details if both carts have items
export async function checkCartMergeConflict(): Promise<{
  guestItemCount: number;
  userItemCount: number;
  guestTotal: string;
  userTotal: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  // Get current guest session
  const guestSession = await db.query.shopping_session.findFirst({
    where: (model, { eq, gt, and, isNull }) =>
      and(
        eq(model.session_token, sessionToken),
        gt(model.expires_at, new Date()),
        isNull(model.user_id) // Not yet linked to user
      ),
  });

  if (!guestSession) return null;

  // Get guest cart items
  const guestItems = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, guestSession.id),
  });

  if (guestItems.length === 0) return null;

  // Check if user has an existing linked session with items
  const customerId = await getOrCreateCustomerId(userId);
  if (!customerId) return null;

  const userSession = await db.query.shopping_session.findFirst({
    where: (model, { eq, gt, and }) =>
      and(
        eq(model.user_id, customerId),
        gt(model.expires_at, new Date())
      ),
  });

  if (!userSession) return null;

  // Get user cart items
  const userItems = await db.query.cart_item.findMany({
    where: (model, { eq }) => eq(model.session_id, userSession.id),
  });

  if (userItems.length === 0) return null;

  // Both have items - there's a conflict
  const guestItemCount = guestItems.reduce((sum, item) => sum + item.quantity, 0);
  const userItemCount = userItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    guestItemCount,
    userItemCount,
    guestTotal: guestSession.total,
    userTotal: userSession.total,
  };
}

// Merge or replace carts based on user choice
// keepGuest: true = keep guest cart items, false = keep user's existing cart
export async function resolveCartMergeConflict(keepGuest: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) throw new Error("No session found");

  // Get guest session
  const guestSession = await db.query.shopping_session.findFirst({
    where: (model, { eq, gt, and }) =>
      and(
        eq(model.session_token, sessionToken),
        gt(model.expires_at, new Date())
      ),
  });

  if (!guestSession) throw new Error("Guest session not found");

  // Get or find customer
  const customerId = await getOrCreateCustomerId(userId);
  if (!customerId) {
    // No customer yet - just link the guest session to be handled later
    // For now, mark the session by keeping it as-is
    return;
  }

  // Get user's existing linked session
  const userSession = await db.query.shopping_session.findFirst({
    where: (model, { eq, gt, and, ne }) =>
      and(
        eq(model.user_id, customerId),
        gt(model.expires_at, new Date()),
        ne(model.id, guestSession.id) // Different from current
      ),
  });

  if (keepGuest) {
    // Keep guest cart - link it to user and clear user's old cart
    if (userSession) {
      // Delete old user cart items
      await db.delete(cart_item).where(eq(cart_item.session_id, userSession.id));
      // Delete old user session
      await db.delete(shopping_session).where(eq(shopping_session.id, userSession.id));
    }

    // Link guest session to user
    await db
      .update(shopping_session)
      .set({ user_id: customerId })
      .where(eq(shopping_session.id, guestSession.id));
  } else {
    // Keep user's cart - clear guest cart and switch to user session
    // Delete guest cart items
    await db.delete(cart_item).where(eq(cart_item.session_id, guestSession.id));
    // Delete guest session
    await db.delete(shopping_session).where(eq(shopping_session.id, guestSession.id));

    // Update cookie to point to user's session
    if (userSession) {
      cookieStore.set(SESSION_COOKIE, userSession.session_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: userSession.expires_at,
        path: "/",
      });
    }
  }
}

// Link current guest session to authenticated user (no conflict case)
// Called when user logs in and there's no existing user cart
export async function linkSessionToUser(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return;

  // Get current session
  const session = await db.query.shopping_session.findFirst({
    where: (model, { eq, gt, and }) =>
      and(
        eq(model.session_token, sessionToken),
        gt(model.expires_at, new Date())
      ),
  });

  if (!session || session.user_id) return; // Already linked or not found

  // Get customer ID
  const customerId = await getOrCreateCustomerId(userId);
  if (!customerId) return;

  // Link session to customer
  await db
    .update(shopping_session)
    .set({ user_id: customerId })
    .where(eq(shopping_session.id, session.id));
}

// Get the current session token (for cart merge detection)
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

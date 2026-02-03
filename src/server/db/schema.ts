// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { desc, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  PgArray,
  pgTableCreator,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `zfweb_${name}`);

export const product = createTable(
  "product",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    title: varchar("title", { length: 1024 }).notNull(),
    description: varchar("description", { length: 4096 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    imgUrl: text("img_url")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    imgKey: text("img_key")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    inventory: integer("inventory").notNull(),
    sku: varchar("sku", { length: 1024 }),
    category_id: integer("category_id").references(() => product_category.id),
    // Product visibility status: active (visible), sold_out (shown but not purchasable), hidden (not shown)
    status: varchar("status", { length: 32 }).notNull().default("active"),
    // Whether product is marked as on sale (for promotional display)
    on_sale: boolean("on_sale").notNull().default(false),
    // URL-friendly slug for product page (e.g., "silver-ring-set")
    url_handle: varchar("url_handle", { length: 256 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (example) => ({
    titleIndex: index("title_idx").on(example.title),
    // Index for URL handle lookups
    urlHandleIndex: index("url_handle_idx").on(example.url_handle),
  }),
);

// Order table - supports both guest and registered customer orders
export const order = createTable("order", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  // Optional user reference - null for guest orders
  user_id: integer("user_id").references(() => customer.id),
  // Stripe payment intent ID for reference
  payment_intent_id: varchar("payment_intent_id", { length: 256 }).notNull().unique(),
  // Order status tracking
  status: varchar("status", { length: 64 }).notNull().default("pending"),
  // Guest customer info (stored even for registered users for order history)
  customer_email: varchar("customer_email", { length: 256 }).notNull(),
  customer_name: varchar("customer_name", { length: 256 }).notNull(),
  // Shipping address as JSON string
  shipping_address: text("shipping_address").notNull(),
  // Legacy products array - keeping for backwards compatibility
  products: integer("products")
    .references(() => product.id)
    .array()
    .notNull()
    .$default(() => []),
  total: decimal("total").notNull(),

  // === Fulfillment workflow fields ===
  // Track whether order CSV has been downloaded for shipping label creation
  is_downloaded: boolean("is_downloaded").notNull().default(false),
  downloaded_at: timestamp("downloaded_at", { withTimezone: true }),
  // Track whether order has been physically packed
  is_packed: boolean("is_packed").notNull().default(false),
  packed_at: timestamp("packed_at", { withTimezone: true }),
  // Track whether order has been shipped with carrier
  is_shipped: boolean("is_shipped").notNull().default(false),
  shipped_at: timestamp("shipped_at", { withTimezone: true }),
  // Carrier tracking number for customer notification
  tracking_number: varchar("tracking_number", { length: 256 }),

  // Whether order is a gift (hides prices on packing slip)
  is_gift: boolean("is_gift").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const address = createTable("address", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  customer_id: integer("customer_id")
    .references(() => customer.id)
    .notNull(),
  add1: varchar("add1", { length: 256 }).notNull(),
  add2: varchar("add2", { length: 256 }).notNull(),
  add3: varchar("add3", { length: 256 }).notNull(),
  city: varchar("city", { length: 1024 }).notNull(),
  state: varchar("state", { length: 256 }).notNull(),
  zip: integer("zip").notNull(),
  postcode: varchar("postcode", { length: 256 }),
  province: varchar("province", { length: 256 }),
  country: varchar("country", { length: 256 }).notNull(),
  userId: varchar("user_id", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// Customer table - stores customer profiles for registered users
// Links to Clerk auth via clerk_user_id and to Stripe via stripe_customer_id
export const customer = createTable(
  "customer",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    // Clerk user ID - links to Clerk authentication (null for legacy/guest customers)
    clerk_user_id: varchar("clerk_user_id", { length: 256 }).unique(),
    // Stripe customer ID - links to Stripe for payments (null until first payment)
    stripe_customer_id: varchar("stripe_customer_id", { length: 256 }).unique(),
    firstName: varchar("first_name", { length: 256 }).notNull(),
    middleName: varchar("middle_name", { length: 256 }),
    last_name: varchar("last_name", { length: 256 }).notNull(),
    email: varchar("email", { length: 1024 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    // Whether this customer has a linked Clerk account
    isUser: boolean("is_user").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    // Index for looking up customers by email
    emailIndex: index("customer_email_idx").on(table.email),
    // Index for looking up customers by Clerk user ID
    clerkUserIdIndex: index("customer_clerk_user_id_idx").on(table.clerk_user_id),
  }),
);

export const discount = createTable("discount", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  // Unique customer-facing discount code (e.g., "SUMMER20")
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  description: varchar("description", { length: 1024 }).notNull(),
  discount: decimal("discount").notNull(),
  // Type of discount: "percent" for percentage off, "fixed" for dollar amount off
  discount_type: varchar("discount_type", { length: 16 }).notNull().default("percent"),
  free_shipping: boolean("free_shipping").notNull(),
  active: boolean("active").default(false),
  numberOfUses: integer("number_of_uses").notNull().default(0),
  // Maximum times this code can be used (null = unlimited)
  max_uses: integer("max_uses"),
  // Expiration date for the discount code (null = never expires)
  expires_at: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const product_category = createTable("product_category", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 256 }).notNull(),
  description: varchar("description", { length: 1024 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// Shopping session for cart persistence
// Supports both guest sessions (via session_token) and authenticated users (via user_id)
export const shopping_session = createTable("shopping_session", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  // Session token for guest identification (stored in HTTP-only cookie)
  session_token: varchar("session_token", { length: 64 }).notNull().unique(),
  // Optional user reference - null for guests, set when user logs in
  user_id: integer("user_id").references(() => customer.id),
  // Computed total (for quick access, recalculated on cart changes)
  total: decimal("total").notNull().default("0"),
  // Session expiry for cleanup of abandoned carts (30 days from last activity)
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const cart_item = createTable("cart_item", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  session_id: integer("session_id")
    .references(() => shopping_session.id)
    .notNull(),
  product_id: integer("product_id")
    .references(() => product.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const order_items = createTable("order_items", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  order_id: integer("order_id")
    .references(() => order.id)
    .notNull(),
  product_id: integer("product_id")
    .references(() => product.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// export const product_inventory = createTable("product_inventory", {
//   id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
//   quantity: integer("quantity").notNull(),
//   createdAt: timestamp("created_at", { withTimezone: true })
//     .default(sql`CURRENT_TIMESTAMP`)
//     .notNull(),
//   updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
//     () => new Date(),
//   ),
// });

// === Shipping System Tables ===

// Shipping zones group countries/regions with similar shipping rates
// Examples: "Domestic", "Europe", "International", "Everywhere Else"
export const shipping_zone = createTable("shipping_zone", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  // Display name for the zone (e.g., "United States", "Europe")
  name: varchar("name", { length: 256 }).notNull(),
  // Optional description for admin reference
  description: varchar("description", { length: 1024 }),
  // Whether this is the default "rest of world" zone
  is_default: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// Maps countries to shipping zones using ISO 3166-1 alpha-2 codes
// A country can only belong to one zone
export const shipping_zone_country = createTable(
  "shipping_zone_country",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    zone_id: integer("zone_id")
      .references(() => shipping_zone.id, { onDelete: "cascade" })
      .notNull(),
    // ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE")
    country_code: varchar("country_code", { length: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Ensure each country only appears once across all zones
    uniqueCountry: index("shipping_zone_country_unique").on(table.country_code),
  }),
);

// Shipping rates define pricing for a zone
// Each zone can have multiple rates (e.g., "Standard", "Express")
export const shipping_rate = createTable("shipping_rate", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  zone_id: integer("zone_id")
    .references(() => shipping_zone.id, { onDelete: "cascade" })
    .notNull(),
  // Rate name (e.g., "Standard Shipping", "Express")
  name: varchar("name", { length: 256 }).notNull(),
  // Price when this is the only item in the order
  price_alone: decimal("price_alone", { precision: 10, scale: 2 }).notNull(),
  // Price when shipped with other items (for combined shipping discounts)
  price_with_others: decimal("price_with_others", { precision: 10, scale: 2 }).notNull(),
  // Estimated delivery time for display (e.g., "3-5 business days")
  delivery_estimate: varchar("delivery_estimate", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

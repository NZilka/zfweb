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
    // inventory_id: integer("inventory_id")
    //   .references(() => product_inventory.id)
    //   .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (example) => ({
    titleIndex: index("title_idx").on(example.title),
  }),
);

export const order = createTable("order", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  user_id: integer("user_id")
    .references(() => customer.id)
    .notNull(),
  products: integer("products")
    .references(() => product.id)
    .array()
    .notNull()
    .$default(() => []),
  total: decimal("total").notNull(),
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

export const customer = createTable("customer", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  firstName: varchar("first_name", { length: 256 }).notNull(),
  middleName: varchar("middle_name", { length: 256 }).notNull(),
  last_name: varchar("last_name", { length: 256 }).notNull(),
  email: varchar("email", { length: 1024 }).notNull(),
  phone: integer("ph").notNull(),
  isUser: boolean("is_user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const discount = createTable("discount", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 256 }).notNull(),
  description: varchar("description", { length: 1024 }).notNull(),
  discount: decimal("discount").notNull(),
  free_shipping: boolean("free_shipping").notNull(),
  active: boolean("active").default(false),
  numberOfUses: integer("number_of_uses").notNull(),
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

export const shopping_session = createTable("shopping_session", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  user_id: integer("user_id")
    .references(() => customer.id)
    .notNull(),
  total: decimal("total").notNull(),
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

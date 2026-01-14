"use server";

import { db } from ".";
// ProductType moved to ProductContext
import { type ProductType } from "~/app/_context/ProductContext";

// import pool from "./client";
// import { ProductType } from "~/app/admin/_components/product_form";

// export async function addProduct(product: ProductType) {
//   const client = await pool.connect();
//   try {
//     const result = await client.query(
//       "INSERT INTO products (title, price, description, imgKey1, imgUrl1, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
//       [
//         product.title,
//         product.price,
//         product.description,
//         product.imgKey1,
//         product.imgUrl1,
//         product.inventory,
//       ],
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error("Error adding product:", error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

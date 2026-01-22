import Link from "next/link";
import { getProducts } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
import Image from "next/image";
import { AddToCartButton } from "./_components/AddToCartButton";

export const dynamic = "force-dynamic";

// Product listing component - fetches all products and displays them as cards
const Products = async () => {
  const products = await getProducts();

  // Fetch available inventory for all products in parallel
  // This accounts for items reserved in other users' carts
  const availableInventories = await Promise.all(
    products.map((p) => getAvailableInventory(p.id))
  );

  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      {products.map((product, index) => {
        const availableInventory = availableInventories[index] ?? 0;
        return (
          <div key={product.id}>
            <div className="relative max-w-sm">
              <Link href={`/shop/product/${product.id}`}>
                {/* Product image - falls back to placeholder if no image */}
                {product.imgUrl[0] ? (
                  <Image
                    src={product.imgUrl[0]}
                    style={{ objectFit: "contain" }}
                    width={250}
                    height={250}
                    alt={product.title}
                  />
                ) : (
                  <div className="flex h-[250px] w-[250px] items-center justify-center bg-gray-200 text-gray-400">
                    No Image
                  </div>
                )}
              </Link>
              <div className="flex flex-col items-center p-5">
                <Link href={`/shop/product/${product.id}`}>
                  <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {product.title}
                  </h1>
                </Link>
                <p className="mb-3 text-xl font-normal text-gray-700 dark:text-gray-400">
                  ${product.price}
                </p>
                {/* Add to Cart button - disabled if no available inventory */}
                <AddToCartButton
                  productId={product.id}
                  disabled={availableInventory === 0}
                  variant="card"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-4">
      <Products />
    </main>
  );
}

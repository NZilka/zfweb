import Link from "next/link";
import { getProducts } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
import { getCarouselData } from "~/server/carousel";
import Image from "next/image";
import { AddToCartButton } from "./_components/AddToCartButton";
import { Carousel } from "./_components/Carousel";

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
    <div className="flex max-w-[1200px] flex-wrap items-start justify-center gap-4">
      {products.map((product, index) => {
        const availableInventory = availableInventories[index] ?? 0;
        return (
          <div key={product.id}>
            <div className="relative max-w-sm">
              <Link href={`/shop/product/${product.id}`} className="group relative block overflow-hidden">
                {/* Product image with hover effect */}
                {product.imgUrl[0] ? (
                  product.imgUrl[1] ? (
                    // Multiple images: fade to 2nd image on hover
                    <>
                      <Image
                        src={product.imgUrl[0]}
                        style={{ objectFit: "contain" }}
                        width={375}
                        height={375}
                        alt={product.title}
                        className="transition-opacity duration-100 group-hover:opacity-0"
                      />
                      <Image
                        src={product.imgUrl[1]}
                        style={{ objectFit: "contain" }}
                        width={375}
                        height={375}
                        alt={product.title}
                        className="absolute inset-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                      />
                    </>
                  ) : (
                    // Single image: zoom to 125% on hover
                    <Image
                      src={product.imgUrl[0]}
                      style={{ objectFit: "contain" }}
                      width={375}
                      height={375}
                      alt={product.title}
                      className="transition-transform duration-300 group-hover:scale-125"
                    />
                  )
                ) : (
                  <div className="flex h-[375px] w-[375px] items-center justify-center bg-gray-200 text-gray-400">
                    No Image
                  </div>
                )}
              </Link>
              <div className="flex flex-col items-center p-5">
                <Link href={`/shop/product/${product.id}`}>
                  <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-400 dark:text-gray-400">
                    {product.title}
                  </h1>
                </Link>
                <p className="mb-3 text-xl font-normal text-gray-200 dark:text-gray-200">
                  ${product.price}
                </p>
                {/* Add to Cart button or Sold Out text */}
                {availableInventory === 0 ? (
                  <span className="inline-flex items-center px-3 py-2 text-base font-medium text-red-700">
                    Sold Out
                  </span>
                ) : (
                  <AddToCartButton
                    productId={product.id}
                    variant="card"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default async function HomePage() {
  // Fetch carousel data — returns null if not enough content
  const carouselData = await getCarouselData();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-4 pt-8">
      {/* Carousel above product grid — only rendered when data is available */}
      {carouselData && <Carousel data={carouselData} />}
      <Products />
    </main>
  );
}

import Link from "next/link";
import { getProducts } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
import { getCarouselData } from "~/server/carousel";
import Image from "next/image";
// QuickAddButton replaces AddToCartButton on product cards — small "+" overlay
import { QuickAddButton } from "./_components/QuickAddButton";
import { Carousel } from "./_components/Carousel";

export const dynamic = "force-dynamic";

// Product listing component - fetches all products and displays as NUIT-style cards
const Products = async () => {
  const products = await getProducts();

  // Fetch available inventory for all products in parallel
  // This accounts for items reserved in other users' carts
  const availableInventories = await Promise.all(
    products.map((p) => getAvailableInventory(p.id)),
  );

  return (
    <div className="flex max-w-[1200px] flex-wrap items-start justify-center gap-4">
      {products.map((product, index) => {
        const availableInventory = availableInventories[index] ?? 0;
        return (
          <div key={product.id}>
            <div className="relative max-w-sm">
              {/* Product image with hover effect + quick-add "+" overlay */}
              <Link
                href={`/shop/product/${product.id}`}
                className="group relative block overflow-hidden"
              >
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
                {/* Quick-add "+" button overlaid on bottom-right of image */}
                <QuickAddButton
                  productId={product.id}
                  availableInventory={availableInventory}
                />
              </Link>
              {/* Product info — Cormorant Garamond heading, Work Sans body */}
              <div className="flex flex-col items-center p-5">
                <Link href={`/shop/product/${product.id}`}>
                  <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white font-[family-name:var(--font-heading)]">
                    {product.title}
                  </h1>
                </Link>
                <p className="text-lg font-light text-[#e8e0d4] font-[family-name:var(--font-body)]">
                  ${product.price}
                </p>
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

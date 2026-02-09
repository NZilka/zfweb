import Link from "next/link";
import { getProducts, getPublicCategoryById } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
import { getCarouselData } from "~/server/carousel";
import Image from "next/image";
// QuickAddButton replaces AddToCartButton on product cards — small "+" overlay
import { QuickAddButton } from "./_components/QuickAddButton";
import { Carousel } from "./_components/Carousel";
import { cropToStyle } from "~/components/ui/ImageCropEditor";

export const dynamic = "force-dynamic";

// Product card grid — receives products + inventory as props (fetched in HomePage)
async function ProductGrid({
  products,
}: {
  products: Awaited<ReturnType<typeof getProducts>>;
}) {
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
              {/* Uses cropToStyle for positioned images, falls back to object-cover */}
              <Link
                href={`/shop/product/${product.id}`}
                className="group relative block overflow-hidden"
              >
                {product.imgUrl[0] ? (
                  product.imgUrl[1] ? (
                    // Multiple images: fade to 2nd image on hover
                    // Wrap in relative container for crop positioning
                    <div className="relative aspect-square w-[375px]">
                      <div className="absolute inset-0 overflow-hidden transition-opacity duration-100 group-hover:opacity-0">
                        {product.imgCrop?.[0] ? (
                          <Image
                            src={product.imgUrl[0]}
                            alt={product.title}
                            fill
                            style={cropToStyle(product.imgCrop[0])}
                          />
                        ) : (
                          <Image
                            src={product.imgUrl[0]}
                            alt={product.title}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                        {product.imgCrop?.[1] ? (
                          <Image
                            src={product.imgUrl[1]}
                            alt={product.title}
                            fill
                            style={cropToStyle(product.imgCrop[1])}
                          />
                        ) : (
                          <Image
                            src={product.imgUrl[1]}
                            alt={product.title}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    // Single image: zoom to 125% on hover
                    <div className="relative aspect-square w-[375px] overflow-hidden">
                      {product.imgCrop?.[0] ? (
                        <div className="transition-transform duration-300 group-hover:scale-125">
                          <div className="relative aspect-square w-[375px] overflow-hidden">
                            <Image
                              src={product.imgUrl[0]}
                              alt={product.title}
                              fill
                              style={cropToStyle(product.imgCrop[0])}
                            />
                          </div>
                        </div>
                      ) : (
                        <Image
                          src={product.imgUrl[0]}
                          alt={product.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-125"
                        />
                      )}
                    </div>
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
              {/* Product info — Buenard heading, Work Sans body */}
              <div className="flex flex-col items-center p-5">
                <Link href={`/shop/product/${product.id}`}>
                  {/* Buenard heading font for product names — bone white */}
                  <h1 className="mb-2 text-2xl tracking-tight text-[#e8e0d4] font-[family-name:var(--font-heading)]">
                    {product.title}
                  </h1>
                </Link>
                {/* Body font inherited from layout; 30% darker bone-white price */}
                <p className="text-lg font-light text-[#a29d94]">
                  ${product.price}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  // Parse category filter and search query from query string
  // Treat NaN (e.g. ?category=abc) as no filter rather than erroring
  const rawCategoryId = params.category ? Number(params.category) : undefined;
  const categoryId =
    rawCategoryId !== undefined && !Number.isNaN(rawCategoryId)
      ? rawCategoryId
      : undefined;
  const searchQuery = params.q?.trim() || undefined;

  // Fetch products (optionally filtered/searched) and carousel in parallel
  const [products, carouselData, category] = await Promise.all([
    getProducts({
      categoryId,
      search: searchQuery,
    }),
    getCarouselData(),
    // Only fetch category name when filtering by category
    categoryId ? getPublicCategoryById(categoryId) : Promise.resolve(null),
  ]);

  // Whether we're viewing filtered/searched results vs the full shop home
  const isFiltered = !!categoryId || !!searchQuery;

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-4 pt-8">
      {/* Carousel only on unfiltered shop home — hide when viewing category or search */}
      {!isFiltered && carouselData && <Carousel data={carouselData} />}

      {/* Show search results heading */}
      {searchQuery && (
        <div className="flex w-full max-w-[1200px] flex-col items-center gap-2 px-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#e8e0d4] font-[family-name:var(--font-heading)]">
            Results for &ldquo;{searchQuery}&rdquo;
          </h1>
          <Link
            href="/shop"
            className="text-sm text-[#e8e0d4] hover:text-white underline"
          >
            View all products
          </Link>
        </div>
      )}

      {/* Show category heading when filtering by category */}
      {categoryId && !searchQuery && (
        <div className="flex w-full max-w-[1200px] flex-col items-center gap-2 px-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#e8e0d4] font-[family-name:var(--font-heading)]">
            {category?.name ?? "Category"}
          </h1>
          <Link
            href="/shop"
            className="text-sm text-[#e8e0d4] hover:text-white underline"
          >
            View all products
          </Link>
        </div>
      )}

      <ProductGrid products={products} />
    </main>
  );
}

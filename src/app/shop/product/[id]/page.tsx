import { getPublicProductById } from "~/server/queries";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "~/app/shop/_components/AddToCartButton";
import { ImageGallery } from "~/app/shop/_components/ImageGallery";
// Client component for PostHog product view tracking
import { ProductViewTracker } from "~/app/shop/_components/ProductViewTracker";

// Product detail page - shows full product info with quantity selector
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  if (isNaN(productId)) {
    notFound();
  }

  const product = await getPublicProductById(productId);

  if (!product) {
    notFound();
  }

  // Availability is the product's own stock; non-active products are not
  // purchasable (cross-cart reservations were removed, see cart-actions.ts)
  const availableInventory =
    product.status === "active" ? Math.max(0, product.inventory) : 0;

  // Sold-out fires for either admin-set status or natural inventory exhaustion.
  // Drives the red strikethrough + "Sold out" label treatment on the price line.
  const isSoldOut = product.status === "sold_out" || availableInventory === 0;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 p-8">
      {/* Track product view for analytics (invisible component) */}
      <ProductViewTracker productId={product.id} categoryId={product.category_id ?? undefined} />
      <Link
        href="/shop"
        className="self-start text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Shop
      </Link>

      <div className="flex max-w-4xl flex-col gap-8 md:flex-row">
        {/* Product images section - interactive gallery with clickable thumbnails */}
        <div className="flex-1">
          <ImageGallery
            images={product.imgUrl}
            productTitle={product.title}
            imgCrop={product.imgCrop}
          />
        </div>

        {/* Product details section */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Buenard heading font for product title */}
          <h1 className="text-3xl font-bold font-[family-name:var(--font-heading)]">{product.title}</h1>
          {/* Sold-out: red strikethrough price + "Sold out" label inline.
              Matches the shop-grid treatment so customers see consistent
              cues whether they land on a product card or its detail page. */}
          {isSoldOut ? (
            <p className="flex items-center gap-2 text-2xl font-semibold text-red-500">
              <span className="line-through">${product.price}</span>
              <span>Sold out</span>
            </p>
          ) : (
            <p className="text-2xl font-semibold">${product.price}</p>
          )}
          <p className="text-gray-700">
            {product.description}
          </p>
          {/* Inventory count only shown when in stock — when sold-out the
              price line already says "Sold out", a duplicate label below
              would be redundant. */}
          {!isSoldOut && (
            <p className="text-sm text-gray-500">
              {availableInventory} in stock
            </p>
          )}
          {/* Add to Cart with quantity selector */}
          <div className="mt-4">
            <AddToCartButton
              productId={product.id}
              disabled={availableInventory === 0}
              variant="full"
              showQuantity={true}
              maxQuantity={availableInventory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

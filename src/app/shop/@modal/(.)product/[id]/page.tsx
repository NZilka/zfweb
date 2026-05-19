import { getPublicProductById } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
import { notFound } from "next/navigation";
import { ProductModal } from "./modal";
import { ImageGallery } from "~/app/shop/_components/ImageGallery";
import { ModalAddToCart } from "./ModalAddToCart";
// Client component for PostHog product view tracking
import { ProductViewTracker } from "~/app/shop/_components/ProductViewTracker";

// Intercepting route for product modal
// Shows product in modal overlay when navigating from shop page
// Direct URL access falls through to the full page at /shop/product/[id]
export default async function ProductModalPage({
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

  // Get actual available inventory (total minus reserved in other carts)
  const availableInventory = await getAvailableInventory(productId);

  // Sold-out fires for either admin-set status or natural inventory exhaustion.
  // Drives the red strikethrough + "Sold out" label treatment on the price line.
  const isSoldOut = product.status === "sold_out" || availableInventory === 0;

  return (
    <ProductModal>
      {/* Track product view for analytics (invisible component) */}
      <ProductViewTracker productId={product.id} categoryId={product.category_id ?? undefined} />
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          {/* Product images - interactive gallery */}
          <div className="flex-1">
            {/* Pass imgCrop so cropped images render with correct positioning */}
            <ImageGallery images={product.imgUrl} productTitle={product.title} imgCrop={product.imgCrop} />
          </div>

          {/* Product details */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Buenard heading font for product title */}
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] md:text-3xl">{product.title}</h1>
            {/* Sold-out: red strikethrough price + "Sold out" label inline.
                Matches the shop-grid treatment. */}
            {isSoldOut ? (
              <p className="flex items-center gap-2 text-xl font-semibold text-red-500 md:text-2xl">
                <span className="line-through">${product.price}</span>
                <span>Sold out</span>
              </p>
            ) : (
              <p className="text-xl font-semibold md:text-2xl">${product.price}</p>
            )}
            <p className="text-gray-700">
              {product.description}
            </p>
            {/* Inventory count only shown when in stock — when sold-out the
                price line already says "Sold out", a duplicate would be redundant. */}
            {!isSoldOut && (
              <p className="text-sm text-gray-500">
                {availableInventory} in stock
              </p>
            )}

            {/* Add to Cart - closes modal on success */}
            <div className="mt-4">
              <ModalAddToCart
                productId={product.id}
                disabled={availableInventory === 0}
                maxQuantity={availableInventory}
              />
            </div>
          </div>
        </div>
      </div>
    </ProductModal>
  );
}

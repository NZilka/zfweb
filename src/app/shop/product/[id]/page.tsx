import { getPublicProductById } from "~/server/queries";
import { getAvailableInventory } from "~/server/cart-actions";
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

  // Get actual available inventory (total minus reserved in other carts)
  const availableInventory = await getAvailableInventory(productId);

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
          <ImageGallery images={product.imgUrl} productTitle={product.title} />
        </div>

        {/* Product details section */}
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-3xl font-bold">{product.title}</h1>
          <p className="text-2xl font-semibold">${product.price}</p>
          <p className="text-gray-600 dark:text-gray-400">
            {product.description}
          </p>
          {/* Show available inventory (accounts for items reserved in other carts) */}
          <p className="text-sm text-gray-500">
            {availableInventory > 0
              ? `${availableInventory} in stock`
              : "Out of stock"}
          </p>
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

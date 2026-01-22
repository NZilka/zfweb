import { getPublicProductById } from "~/server/queries";
import { notFound } from "next/navigation";
import { ProductModal } from "./modal";
import { ImageGallery } from "~/app/shop/_components/ImageGallery";
import { AddToCartButton } from "~/app/shop/_components/AddToCartButton";

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

  return (
    <ProductModal>
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          {/* Product images - interactive gallery */}
          <div className="flex-1">
            <ImageGallery images={product.imgUrl} productTitle={product.title} />
          </div>

          {/* Product details */}
          <div className="flex flex-1 flex-col gap-4">
            <h1 className="text-2xl font-bold md:text-3xl">{product.title}</h1>
            <p className="text-xl font-semibold md:text-2xl">${product.price}</p>
            <p className="text-gray-600 dark:text-gray-400">
              {product.description}
            </p>
            <p className="text-sm text-gray-500">
              {product.inventory > 0
                ? `${product.inventory} in stock`
                : "Out of stock"}
            </p>

            {/* Add to Cart with quantity selector */}
            <div className="mt-4">
              <AddToCartButton
                productId={product.id}
                disabled={product.inventory === 0}
                variant="full"
                showQuantity={true}
                maxQuantity={product.inventory}
              />
            </div>
          </div>
        </div>
      </div>
    </ProductModal>
  );
}

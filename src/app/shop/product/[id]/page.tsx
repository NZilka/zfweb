import { getPublicProductById } from "~/server/queries";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "~/app/shop/_components/AddToCartButton";

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

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 p-8">
      <Link
        href="/shop"
        className="self-start text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Shop
      </Link>

      <div className="flex max-w-4xl flex-col gap-8 md:flex-row">
        {/* Product images section */}
        <div className="flex-1">
          {product.imgUrl[0] ? (
            <Image
              src={product.imgUrl[0]}
              alt={product.title}
              width={500}
              height={500}
              className="rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-[500px] w-[500px] items-center justify-center rounded-lg bg-gray-200 text-gray-400">
              No Image
            </div>
          )}
          {/* Thumbnail gallery for additional images */}
          {product.imgUrl.length > 1 && (
            <div className="mt-4 flex gap-2">
              {product.imgUrl.map((url, index) => (
                <Image
                  key={index}
                  src={url}
                  alt={`${product.title} ${index + 1}`}
                  width={80}
                  height={80}
                  className="rounded border object-contain"
                />
              ))}
            </div>
          )}
        </div>

        {/* Product details section */}
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-3xl font-bold">{product.title}</h1>
          <p className="text-2xl font-semibold">${product.price}</p>
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
  );
}

import { getPublicProductById } from "~/server/queries";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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
        <div className="flex-1">
          <Image
            src={product.imgUrl[0]!}
            alt={product.title}
            width={500}
            height={500}
            className="rounded-lg object-contain"
          />
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
          <button
            className="mt-4 inline-flex items-center justify-center bg-black px-6 py-3 text-white hover:bg-zinc-700 disabled:bg-gray-400"
            disabled={product.inventory === 0}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

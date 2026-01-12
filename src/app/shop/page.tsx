import Link from "next/link";
import { getProducts } from "~/server/queries";
import Image from "next/image";

export const dynamic = "force-dynamic";

// const Products = async () => {
//   const products = await db.query.product.findMany({
//     orderBy: (model: any, { asc }) => asc(model.id),
//   });

const Products = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      {products.map((product) => (
        <div key={product.id}>
          <div className="relative max-w-sm">
            <Link href={`/shop/product/${product.id}`}>
              <Image
                src={product.imgUrl[0]!}
                style={{ objectFit: "contain" }}
                width={250}
                height={250}
                alt={`Image ${product.id}`}
              />
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
              <a
                href="#"
                className="inline-flex items-center border-slate-300 bg-black px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-300 dark:bg-zinc-600 dark:hover:bg-black dark:focus:ring-zinc-800"
              >
                Add to Cart
              </a>
            </div>
          </div>
        </div>
      ))}
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

import Link from "next/link";
import { getProducts } from "~/server/queries";
import Image from "next/image";

export const dynamic = "force-dynamic";

// export const ProductInventory = async () => {
//   const products = await db.query.product.findMany({
//     orderBy: (model: any, { asc }) => asc(model.id),
//   });

export const ProductInventory = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {products.map((product) => (
        <div key={product.id}>
          <div className="relative max-w-sm">
            <Link href={`/admin/product/${product.id}`}>
              <Image
                src={product.imgUrl[0]!}
                style={{ objectFit: "contain" }}
                width={192}
                height={192}
                alt={`Image ${product.id}`}
              />
            </Link>
            <div className="flex flex-col items-center p-5">
              <a href="#">
                {/* Title uses theme foreground color */}
                <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground">
                  {product.title}
                </h1>
              </a>
              {/* Price uses muted foreground for hierarchy */}
              <p className="mb-3 text-xl font-normal text-muted-foreground">
                ${product.price}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

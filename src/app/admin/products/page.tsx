/**
 * Products tab - Admin product management
 * Displays product list/grid with filters, search, and CRUD modal
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { getCategories, getProducts } from "~/server/queries";
import { ProductsClient } from "./_components/ProductsClient";

// Force dynamic rendering to fetch fresh data
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  // Fetch products and categories in parallel for the admin interface
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          {/* Client component with list/grid views and filtering */}
          <ProductsClient products={products} categories={categories} />
        </div>
      </SignedIn>
    </main>
  );
}

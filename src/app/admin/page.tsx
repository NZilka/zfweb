import { SignedIn, SignedOut } from "@clerk/nextjs";
import { getCategories, getProducts } from "~/server/queries";
import AdminPageClient from "./_components/AdminPageClient";

// Force dynamic rendering to fetch fresh data
export const dynamic = "force-dynamic";

// Server component - fetches products and categories, passes to client
export default async function HomePage() {
  // Fetch products and categories in parallel for the admin interface
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <main>
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        {/* Client component manages product selection and form state */}
        <AdminPageClient products={products} categories={categories} />
      </SignedIn>
    </main>
  );
}

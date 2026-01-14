import { getProductById, getCategories } from "~/server/queries";
import ProductEditView from "./ProductEditView";

// Server component that fetches product data and passes to client component
// This pattern allows server-side data fetching with client-side interactivity
export default async function FullPageProductEdit(props: { id: number }) {
  // Validate product ID
  if (isNaN(props.id)) throw new Error("Invalid Product ID");

  // Fetch product and categories in parallel for edit form
  const [product, categories] = await Promise.all([
    getProductById(props.id),
    getCategories(),
  ]);

  // Pass data to client component which handles view/edit toggle
  return (
    <ProductEditView
      product={product}
      categories={categories}
    />
  );
}

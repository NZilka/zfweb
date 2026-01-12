import FullPageProductView from "~/app/admin/_components/ProductEdit";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: productId } = await params;
  return <FullPageProductView id={Number(productId)} />;
}

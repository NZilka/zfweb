import FullPageProductEdit from "~/app/admin/_components/ProductEdit";
import { Modal } from "./modal";

export default async function PhotoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: productId } = await params;
  return (
    <Modal>
      <FullPageProductEdit id={Number(productId)} />
    </Modal>
  );
}

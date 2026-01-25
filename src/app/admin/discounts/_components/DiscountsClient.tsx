/**
 * DiscountsClient - Discount management interface
 * Handles list display, create/edit modal, and actions
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { DiscountForm } from "./DiscountForm";
import {
  deleteDiscount,
  toggleDiscountActive,
  type DiscountData,
} from "~/server/discount-actions";

interface DiscountsClientProps {
  discounts: DiscountData[];
}

export function DiscountsClient({ discounts }: DiscountsClientProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountData | undefined>();
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Open dialog for creating new discount
  const handleCreate = () => {
    setEditingDiscount(undefined);
    setIsDialogOpen(true);
  };

  // Open dialog for editing existing discount
  const handleEdit = (discount: DiscountData) => {
    setEditingDiscount(discount);
    setIsDialogOpen(true);
  };

  // Handle form success
  const handleSuccess = () => {
    setIsDialogOpen(false);
    setEditingDiscount(undefined);
    router.refresh();
  };

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this discount?")) return;

    setIsDeleting(id);
    const result = await deleteDiscount(id);

    if (result.success) {
      toast.success("Discount deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete discount");
    }

    setIsDeleting(null);
  };

  // Handle toggle active
  const handleToggle = async (id: number) => {
    const result = await toggleDiscountActive(id);

    if (result.success) {
      toast.success("Discount status updated");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  // Format discount display
  const formatDiscount = (discount: DiscountData) => {
    if (discount.discountType === "percent") {
      return `${discount.discount}%`;
    }
    return `$${discount.discount}`;
  };

  // Check if discount is expired
  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discounts</h1>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Discount
        </Button>
      </div>

      {/* Discounts table */}
      {discounts.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No discount codes yet</p>
          <Button onClick={handleCreate} variant="outline" className="mt-4">
            Create your first discount
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-center">Free Ship</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Uses</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  {/* Code */}
                  <TableCell className="font-mono font-medium">{discount.code}</TableCell>
                  {/* Name */}
                  <TableCell>{discount.name}</TableCell>
                  {/* Discount value */}
                  <TableCell className="text-right font-medium">
                    {formatDiscount(discount)}
                  </TableCell>
                  {/* Free shipping */}
                  <TableCell className="text-center">
                    {discount.freeShipping && (
                      <Badge variant="secondary">Yes</Badge>
                    )}
                  </TableCell>
                  {/* Status */}
                  <TableCell className="text-center">
                    {isExpired(discount.expiresAt) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : discount.active ? (
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  {/* Uses */}
                  <TableCell className="text-right">
                    {discount.numberOfUses}
                    {discount.maxUses && `/${discount.maxUses}`}
                  </TableCell>
                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Toggle active */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(discount.id)}
                        title={discount.active ? "Deactivate" : "Activate"}
                      >
                        {discount.active ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(discount)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(discount.id)}
                        disabled={isDeleting === discount.id}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDiscount ? "Edit Discount" : "Create Discount"}
            </DialogTitle>
          </DialogHeader>
          <DiscountForm
            discount={editingDiscount}
            onSuccess={handleSuccess}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

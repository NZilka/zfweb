"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryInput,
} from "./db_connect";

// Category type matching database schema
export interface CategoryData {
  id: number;
  name: string;
  description: string;
}

interface CategoryManagerProps {
  categories: CategoryData[];
}

// Component for managing product categories (create, edit, delete)
// Displays as a collapsible section in the admin panel
export default function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  // Track which category is being edited (null = add mode)
  const [editingId, setEditingId] = useState<number | null>(null);
  // Form state for both create and edit
  const [formData, setFormData] = useState<CategoryInput>({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Controls section visibility
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset form to initial state
  const resetForm = () => {
    setFormData({ name: "", description: "" });
    setEditingId(null);
    setError(null);
  };

  // Enter edit mode for a category
  const handleEdit = (category: CategoryData) => {
    setEditingId(category.id);
    setFormData({ name: category.name, description: category.description });
    setError(null);
  };

  // Handle form submission for create or update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Category name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        // Update existing category
        await updateCategory(editingId, formData);
      } else {
        // Create new category
        await createCategory(formData);
      }
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle category deletion with confirmation
  const handleDelete = async (category: CategoryData) => {
    // Show confirmation with warning about affected products
    const confirmed = confirm(
      `Delete category "${category.name}"?\n\nProducts in this category will have their category set to "None".`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteCategory(category.id);
      // If we were editing this category, reset form
      if (editingId === category.id) {
        resetForm();
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-gray-700 bg-gray-800 p-4">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold">Manage Categories</h3>
        <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Category list */}
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`flex items-center justify-between rounded p-2 ${
                    editingId === category.id ? "bg-gray-700" : "bg-gray-900"
                  }`}
                >
                  <div>
                    <span className="font-medium">{category.name}</span>
                    {category.description && (
                      <span className="ml-2 text-sm text-gray-400">
                        - {category.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                      disabled={isSubmitting}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(category)}
                      disabled={isSubmitting}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No categories yet. Add one below.</p>
          )}

          {/* Add/Edit form */}
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-700 pt-4">
            <h4 className="font-medium">
              {editingId ? "Edit Category" : "Add New Category"}
            </h4>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Category name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="rounded bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                disabled={isSubmitting}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="rounded bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Error display */}
            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingId
                    ? "Update Category"
                    : "Add Category"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { type ElementRef, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Modal component for product display in shop
// Uses HTML dialog element for accessibility and native backdrop
export function ProductModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<ElementRef<"dialog">>(null);

  // Open modal on mount
  useEffect(() => {
    if (!dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, []);

  // Close modal and go back
  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  // Handle click on backdrop (outside modal content)
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the dialog backdrop itself, not its children
    if (e.target === dialogRef.current) {
      onDismiss();
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-0 h-screen w-screen max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/60"
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      {/* Modal content container - centered with max dimensions */}
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-2xl dark:bg-gray-900">
          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Product content */}
          {children}
        </div>
      </div>
    </dialog>,
    document.getElementById("modal-root")!
  );
}

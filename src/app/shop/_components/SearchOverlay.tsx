/**
 * SearchOverlay — Full-width search bar that slides down from top
 * Auto-focuses input, submits on Enter, closes on X or Escape
 * Navigates to /shop?q={term} for server-side filtering
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Search } from "lucide-react";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Auto-focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow transition to start before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Navigate to search results on submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    onClose();
    setQuery("");
  };

  if (!isOpen) return null;

  return (
    // Full-width overlay bar pinned to top of viewport
    <div className="fixed inset-x-0 top-0 z-50 border-b border-neutral-700 bg-black px-4 py-3">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-3xl items-center gap-3"
      >
        {/* Search icon */}
        <Search className="h-5 w-5 flex-shrink-0 text-neutral-400" />
        {/* Search input — full width, dark theme, auto-focused */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-transparent text-base text-white placeholder-neutral-500 outline-none"
        />
        {/* Close button — 44x44 touch target */}
        <button
          type="button"
          onClick={() => {
            onClose();
            setQuery("");
          }}
          className="flex h-9 w-9 items-center justify-center rounded text-neutral-400 hover:text-white"
          aria-label="Close search"
        >
          <X className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

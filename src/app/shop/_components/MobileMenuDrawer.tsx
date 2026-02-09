"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { X, LogIn, ChevronDown, ChevronUp } from "lucide-react";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

// Props for the mobile menu drawer
// aboutEnabled controls whether the About link is shown
type MobileMenuDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: number; name: string }[];
  aboutEnabled: boolean;
};

// Left-side slide-out drawer for mobile navigation
// Contains Products link, collapsible Categories section, About link, and sign-in/account
// Closes on backdrop click, X button, or Escape key
export function MobileMenuDrawer({
  isOpen,
  onClose,
  categories,
  aboutEnabled,
}: MobileMenuDrawerProps) {
  // Tracks whether the Categories section is expanded
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  // When true, skip slide-out animation so drawer vanishes instantly on nav
  const [isInstant, setIsInstant] = useState(false);
  // Track previous isOpen to reset isInstant when drawer re-opens
  const prevIsOpen = useRef(isOpen);

  // Close instantly when a nav link is clicked (no slide-out animation)
  const handleNavClose = () => {
    setIsInstant(true);
    onClose();
  };

  // Reset instant flag when drawer re-opens so slide-in animation plays
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setIsInstant(false);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  // Close on Escape key and lock body scroll when open
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Semi-transparent backdrop — skips fade when instant-closing */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 ${
          isInstant ? "" : "transition-opacity duration-300"
        } ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides from the left, skips animation on instant close */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[70%] max-w-xs flex-col bg-black text-white shadow-xl ${
          isInstant ? "" : "transition-transform duration-300 ease-in-out"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between border-b border-neutral-700 p-4">
          <span className="text-sm font-semibold uppercase tracking-widest">
            Menu
          </span>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-neutral-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links — vertical list with Products, collapsible Categories, and About */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {/* Products link — goes to shop home, instant close on click */}
          <Link
            href="/shop"
            onClick={handleNavClose}
            className="block border-b border-neutral-700 py-3 text-sm font-medium uppercase tracking-wide text-neutral-300 hover:text-white"
          >
            Products
          </Link>

          {/* Categories — collapsible section with expand/collapse toggle */}
          <div className="border-b border-neutral-700">
            <button
              onClick={() => setCategoriesExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between py-3 text-sm font-medium uppercase tracking-wide text-neutral-300 hover:text-white"
              aria-expanded={categoriesExpanded}
            >
              Categories
              {/* Chevron icon rotates based on expanded state */}
              {categoriesExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {/* Category links — indented, shown only when expanded */}
            {categoriesExpanded && (
              <div className="pb-2 pl-4">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/shop?category=${cat.id}`}
                    onClick={handleNavClose}
                    className="block py-2 text-sm text-neutral-400 hover:text-white"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* About link — instant close on click, only shown when enabled */}
          {aboutEnabled && (
            <Link
              href="/shop/about"
              onClick={handleNavClose}
              className="block border-b border-neutral-700 py-3 text-sm font-medium uppercase tracking-wide text-neutral-300 hover:text-white"
            >
              About
            </Link>
          )}
        </nav>

        {/* Bottom section — account/login */}
        <div className="border-t border-neutral-700 p-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="flex w-full items-center gap-2 py-2 text-sm text-neutral-300 hover:text-white">
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/shop/account"
              onClick={handleNavClose}
              className="flex w-full items-center gap-2 py-2 text-sm text-neutral-300 hover:text-white"
            >
              <LogIn className="h-4 w-4" />
              My Account
            </Link>
          </SignedIn>
          {/* Currency display — static for now */}
          <p className="mt-2 text-xs text-neutral-500">USD $</p>
        </div>
      </div>
    </>
  );
}

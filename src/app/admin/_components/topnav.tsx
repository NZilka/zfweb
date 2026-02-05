/**
 * TopNav - Top navigation bar for admin dashboard
 * Contains hamburger toggle (all sizes), Admin title, logo, and auth controls
 * Accepts optional logoUrl prop for dynamic logo from site settings
 */
"use client";

import Image from "next/image";
import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { useAdminNav } from "./AdminNavContext";

// logoUrl prop allows parent layout to pass custom logo from site settings
export const TopNav = ({ logoUrl }: { logoUrl?: string }) => {
  const { toggleOpen } = useAdminNav();

  return (
    // min-w-0 prevents flexbox/grid implicit minimum width overflow
    // z-30 ensures header stays above content but below drawer (z-50)
    <header className="min-w-0 border-b border-gray-700 bg-gray-900 z-30 relative">
      {/* Top nav bar with responsive padding */}
      <nav className="flex w-full min-w-0 items-center justify-between gap-2 sm:gap-4 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hamburger toggle - visible on all sizes, light colors for dark bg */}
          <button
            onClick={toggleOpen}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors duration-150"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg sm:text-xl font-semibold text-white">Admin</span>
        </div>

        {/* Logo - compact in header, hidden on mobile */}
        <div className="hidden sm:flex sm:flex-1 sm:justify-center sm:px-4">
          <div className="w-32 md:w-40 max-w-[160px]">
            {/* Use custom logo from settings or fallback to default */}
            <Image
              priority={true}
              src={logoUrl ?? "/logo.png"}
              width={3333}
              height={1304}
              alt="Zilka Forgewerks Logo"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Auth controls */}
        <div className="flex flex-row items-center gap-2 sm:gap-4">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton />
          </SignedOut>
        </div>
      </nav>
    </header>
  );
};

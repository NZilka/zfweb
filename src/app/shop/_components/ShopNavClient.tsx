"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { CartButton } from "./CartButton";
import { MobileMenuDrawer } from "./MobileMenuDrawer";

// Props passed from the TopNav server component
// aboutEnabled controls whether the About link appears in nav
type ShopNavClientProps = {
  categories: { id: number; name: string }[];
  logoUrl: string;
  aboutEnabled: boolean;
};

// Client component — interactive nav bar with 4 responsive states:
// Mobile (<768): hamburger | centered small logo | search + cart
// Tablet (768-1023): hamburger | centered larger logo | account + search + cart
// Desktop (1024+): logo left + Products | Categories dropdown | About | account + search + cart
// Manages hamburger open/close state for MobileMenuDrawer
export function ShopNavClient({
  categories,
  logoUrl,
  aboutEnabled,
}: ShopNavClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="relative flex w-full items-center justify-between border-b px-4 py-3 lg:px-6">
        {/* LEFT ZONE: Hamburger (mobile/tablet) or Logo + links (desktop) */}
        <div className="flex items-center gap-4">
          {/* Hamburger — visible below lg breakpoint */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Desktop logo — hidden below lg */}
          <Link href="/shop" className="hidden lg:block">
            <Image
              src={logoUrl}
              width={180}
              height={70}
              alt="Zilka Forgewerks Logo"
              className="h-auto w-36 xl:w-44"
            />
          </Link>

          {/* Desktop nav links — Products, Categories dropdown, About */}
          <div className="hidden items-center gap-5 lg:flex">
            {/* Products link — replaces old "All" link, goes to shop home */}
            <Link
              href="/shop"
              className="text-sm uppercase tracking-wide text-neutral-700 hover:text-black"
            >
              Products
            </Link>

            {/* Categories dropdown — CSS-only hover, no JS needed */}
            <div className="group relative">
              <button
                type="button"
                className="text-sm uppercase tracking-wide text-neutral-700 hover:text-black"
              >
                Categories
              </button>
              {/* Dropdown panel — absolutely positioned, appears on group hover */}
              <div className="invisible absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-neutral-200 bg-white py-1 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/shop?category=${cat.id}`}
                    className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* About link — only shown when about page is enabled in settings */}
            {aboutEnabled && (
              <Link
                href="/shop/about"
                className="text-sm uppercase tracking-wide text-neutral-700 hover:text-black"
              >
                About
              </Link>
            )}
          </div>
        </div>

        {/* CENTER ZONE: Logo — mobile/tablet only, absolutely centered */}
        <Link
          href="/shop"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden"
        >
          <Image
            src={logoUrl}
            width={160}
            height={62}
            alt="Zilka Forgewerks Logo"
            className="h-auto w-20 md:w-32"
          />
        </Link>

        {/* RIGHT ZONE: Icon buttons */}
        <div className="flex items-center gap-3">
          {/* Account — single Clerk UserButton when signed in, User icon for sign-in when signed out */}
          {/* Hidden on small mobile, visible md+ */}
          <SignedIn>
            <div className="hidden md:block">
              <UserButton afterSignOutUrl="/shop" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                className="hidden hover:text-neutral-500 md:block"
                aria-label="Sign in"
              >
                <User className="h-5 w-5" />
              </button>
            </SignInButton>
          </SignedOut>

          {/* Search placeholder — always visible */}
          <button
            className="hover:text-neutral-500"
            aria-label="Search"
            onClick={() => {
              /* Search coming soon — placeholder */
            }}
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Cart button with badge */}
          <CartButton />
        </div>
      </nav>

      {/* Mobile menu drawer — left slide-out, receives aboutEnabled for conditional About link */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        categories={categories}
        aboutEnabled={aboutEnabled}
      />
    </>
  );
}

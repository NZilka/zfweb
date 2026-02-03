import Image from "next/image";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";
import { CartButton } from "./CartButton";

// Top navigation bar for the shop
// Contains logo, products link, account/auth, and cart button with badge
// Mobile-first: smaller gaps, logo, and hidden text labels on small screens
export const TopNav = () => {
  return (
    <nav className="flex w-full items-center justify-between gap-2 border-b p-3 text-base font-semibold sm:gap-4 sm:p-4 sm:text-xl">
      {/* Left side: Products link */}
      <Link href="/shop" className="hover:text-gray-600">
        Products
      </Link>

      {/* Center: Logo - smaller on mobile */}
      <Link href="/shop" className="flex items-center justify-center">
        <Image
          src="/logo.png"
          width={200}
          height={78}
          alt="Zilka Forgewerks Logo"
          className="h-auto w-24 sm:w-40 md:w-48"
        />
      </Link>

      {/* Right side: auth controls and cart */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Show account link and user button when signed in */}
        <SignedIn>
          <Link
            href="/shop/account"
            className="flex items-center hover:text-gray-600"
            aria-label="My Account"
          >
            {/* Icon on mobile, text on sm+ */}
            <User className="h-5 w-5 sm:hidden" />
            <span className="hidden text-base sm:inline">My Account</span>
          </Link>
          <UserButton afterSignOutUrl="/shop" />
        </SignedIn>
        {/* Show sign in button when signed out */}
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-sm hover:text-gray-600 sm:text-base">Sign In</button>
          </SignInButton>
        </SignedOut>
        {/* Cart button with item count badge */}
        <CartButton />
      </div>
    </nav>
  );
};

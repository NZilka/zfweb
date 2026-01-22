import Image from "next/image";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { CartButton } from "./CartButton";

// Top navigation bar for the shop
// Contains logo, products link, account/auth, and cart button with badge
export const TopNav = () => {
  return (
    <div className="gap-4">
      <nav className="flex w-full items-center justify-between gap-4 border-b p-4 text-xl font-semibold">
        <Link href="/shop" className="hover:text-gray-600">
          Products
        </Link>
        {/* Right side: auth controls and cart */}
        <div className="flex items-center gap-4">
          {/* Show account link and user button when signed in */}
          <SignedIn>
            <Link
              href="/shop/account"
              className="text-base hover:text-gray-600"
            >
              My Account
            </Link>
            <UserButton afterSignOutUrl="/shop" />
          </SignedIn>
          {/* Show sign in button when signed out */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-base hover:text-gray-600">Sign In</button>
            </SignInButton>
          </SignedOut>
          {/* Cart button with item count badge */}
          <CartButton />
        </div>
      </nav>
      <div className="flex w-full items-center justify-center px-4 py-8">
        <div className="w-1/5"></div>
        <Link href="/shop" className="flex w-3/5 max-w-sm items-center justify-center">
          <Image
            src="/logo.png"
            width={3333}
            height={1304}
            alt="Zilka Forgewerks Logo"
          />
        </Link>
        <div className="w-1/5"></div>
      </div>
    </div>
  );
};

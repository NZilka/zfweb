import Image from "next/image";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { CartButton } from "./CartButton";

// Top navigation bar for the shop
// Contains logo, products link, account/auth, and cart button with badge
export const TopNav = () => {
  return (
    <nav className="flex w-full items-center justify-between gap-4 border-b p-4 text-xl font-semibold">
      {/* Left side: Products link */}
      <Link href="/shop" className="hover:text-gray-600">
        Products
      </Link>

      {/* Center: Logo */}
      <Link href="/shop" className="flex items-center justify-center">
        <Image
          src="/logo.png"
          width={200}
          height={78}
          alt="Zilka Forgewerks Logo"
          className="h-auto w-40 sm:w-48"
        />
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
  );
};

import Image from "next/image";
import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export const TopNav = () => {
  return (
    // min-w-0 prevents flexbox/grid implicit minimum width overflow
    <div className="min-w-0">
      {/* Top nav bar with responsive padding */}
      <nav className="flex w-full min-w-0 items-center justify-between gap-2 sm:gap-4 border-b px-3 py-2 sm:p-4 text-lg sm:text-xl font-semibold">
        <div>Admin</div>
        <div className="flex flex-row items-center gap-2 sm:gap-4">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton />
          </SignedOut>
        </div>
      </nav>
      {/* Logo section - responsive padding and centered */}
      <div className="flex w-full items-center justify-center px-4 py-4 sm:py-6 md:py-8">
        <div className="w-full max-w-xs sm:max-w-sm">
          <Image
            priority={true}
            src="/logo.png"
            width={3333}
            height={1304}
            alt="Zilka Forgewerks Logo"
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
};

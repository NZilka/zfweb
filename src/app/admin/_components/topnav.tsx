import Image from "next/image";
import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

export const TopNav = () => {
  return (
    <div className="gap-4">
      <nav className="flex w-full items-center justify-between gap-4 border-b p-4 text-xl font-semibold">
        <div>Admin</div>
        <div className="flex flex-row items-center gap-4">
          <SignedIn>
            {/*<UploadButton endpoint="imageUploader" onClientUploadComplete={() => {router.refresh();}} />*/}
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton />
          </SignedOut>
        </div>
      </nav>
      <div className="flex w-full items-center justify-center px-4 py-8">
        <div className="w-1/5"></div>
        <div className="flex w-3/5 max-w-sm items-center justify-center">
          <Image
            priority={true}
            src="/logo.png"
            width={3333}
            height={1304}
            alt="Zilka Forgewerks Logo"
          />
        </div>
        <div className="w-1/5"></div>
      </div>
    </div>
  );
};

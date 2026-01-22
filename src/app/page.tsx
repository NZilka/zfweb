import Link from "next/link";
import { db } from "~/server/db";
import Image from "next/image";
import { FileProvider } from "./_context/FileContext";

export const dynamic = "force-dynamic";

// Added a permanent redirect to /shop from /. If you need to change that, got to next.config.js and change the redirect there.

export default function HomePage() {
  return (
    <FileProvider>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Image
          src="/logo.png"
          width={3333}
          height={1304}
          alt="Zilka Forgewerks Logo"
        />
      </main>
    </FileProvider>
  );
}

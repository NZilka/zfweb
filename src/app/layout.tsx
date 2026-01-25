import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
// Sonner toast component for notifications across the app
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "Zilka Forgewerks",
  description: "Bespoke Ritually Forged Jewelry and Tools",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${GeistSans.variable} flex flex-col gap-4`}>
          {children}
          {/* Toast notification container - positioned at bottom-right by default */}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}

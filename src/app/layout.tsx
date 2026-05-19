import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
// Shop heading font — elegant serif for product names
import { Buenard } from "next/font/google";
// Shop body font — clean sans-serif for prices/descriptions
import { Work_Sans } from "next/font/google";
import { type Metadata } from "next";

const buenard = Buenard({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-buenard",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-work-sans",
});
import { ClerkProvider } from "@clerk/nextjs";
// Sonner toast component for notifications across the app
import { Toaster } from "~/components/ui/sonner";
// Yellow STAGING banner — renders only on the staging branch deploy.
import { StagingBanner } from "~/components/StagingBanner";
// Client-side providers including PostHog analytics
import { Providers } from "./providers";
// Used to distinguish staging from prod in the browser tab title.
import { isStaging } from "~/lib/env-info";

export const metadata: Metadata = {
  // Tab title differs only on staging so it's easy to tell which env a tab
  // belongs to when several are open. Prod + local both show the real name.
  title: isStaging ? "ZF Staging" : "Zilka Forgewerks",
  description: "Bespoke Ritually Forged Jewelry and Tools",
  // Favicon comes from src/app/icon.png via Next.js's metadata file
  // convention — no manual `icons:` array needed (Next.js auto-generates
  // the <link rel="icon"> tag and serves the file).
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        {/* Font vars: GeistSans for admin/UI, Buenard for shop headings, Work Sans for shop body */}
        <body className={`${GeistSans.variable} ${buenard.variable} ${workSans.variable} flex flex-col`}>
          {/* Site-wide staging marker — only renders when isStaging is true */}
          <StagingBanner />
          {/* Providers wrap app with client-side contexts (PostHog, etc.) */}
          <Providers>
            {children}
          </Providers>
          {/* Toast notification container - positioned at bottom-right by default */}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}

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
// Client-side providers including PostHog analytics
import { Providers } from "./providers";

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
        {/* Font vars: GeistSans for admin/UI, Buenard for shop headings, Work Sans for shop body */}
        <body className={`${GeistSans.variable} ${buenard.variable} ${workSans.variable} flex flex-col`}>
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

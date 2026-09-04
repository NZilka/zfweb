import { TopNav } from "./_components/topnav";
import { AdminNav } from "./_components/AdminNav";
import { AdminNavProvider } from "./_components/AdminNavContext";
// StagingBanner moved to root layout (src/app/layout.tsx) so it renders
// site-wide on staging deploys, not just inside /admin.
import { getSiteSettings } from "~/server/kv";
import { redirect } from "next/navigation";
import { checkAdmin } from "~/server/auth";

// Async layout — fetches site settings to pass custom logo URL to TopNav
export default async function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  // Defense in depth behind the proxy gate: a non-admin who somehow reaches
  // this layout (matcher gap, misconfiguration) is sent to the shop before
  // any admin data is fetched or rendered. The proxy already sends anonymous
  // visitors to sign-in, so this mostly guards signed-in non-admins.
  if (!(await checkAdmin())) redirect("/shop");

  // Fetch site settings for dynamic logo
  const settings = await getSiteSettings();

  return (
    // Provider enables sidebar toggle state sharing between TopNav and AdminNav
    <AdminNavProvider>
      {/*
        Layout structure:
        - TopNav: Full width header with hamburger, logo, auth
        - AdminNav: Overlay drawer (fixed position, toggles open/closed)
        - Main content: Full width, scrollable
      */}
      {/* print:hidden hides the entire admin layout when printing, so only packing slip shows */}
      <div className="flex h-dvh w-full min-w-0 flex-col print:hidden">
        {/* Top navigation bar - passes custom logo URL from settings.
            (Staging banner now lives in root layout so it shows site-wide.) */}
        <TopNav logoUrl={settings.logo.large.url ?? undefined} />

        {/* Overlay drawer navigation - fixed position, controlled by context */}
        <AdminNav />

        {/* Main content area - full width since nav is overlay */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          {children}
        </main>
      </div>
      {modal}
      <div id="modal-root" />
    </AdminNavProvider>
  );
}

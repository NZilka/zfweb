import { TopNav } from "./_components/topnav";
import { AdminNav } from "./_components/AdminNav";
import { AdminNavProvider } from "./_components/AdminNavContext";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    // Provider enables sidebar toggle state sharing between TopNav and AdminNav
    <AdminNavProvider>
      {/*
        Layout structure:
        - TopNav: Full width header with hamburger, logo, auth
        - AdminNav: Overlay drawer (fixed position, toggles open/closed)
        - Main content: Full width, scrollable
      */}
      <div className="flex h-dvh w-full min-w-0 flex-col">
        {/* Top navigation bar - always at top, spans full width */}
        <TopNav />

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

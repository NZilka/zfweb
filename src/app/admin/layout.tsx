import { TopNav } from "./_components/topnav";
import { AdminTabs } from "./_components/AdminTabs";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <>
      {/* Layout with fixed header containing nav and tabs, scrollable content below */}
      {/* dark class enables dark mode theme colors for admin section */}
      <div className="dark grid h-screen grid-rows-[auto_auto_1fr] bg-background text-foreground">
        <TopNav />
        {/* Tab navigation for admin sections */}
        <AdminTabs />
        <main className="overflow-y-scroll">{children}</main>
      </div>
      {modal}
      <div id="modal-root" />
    </>
  );
}

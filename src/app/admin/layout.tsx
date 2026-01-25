import { TopNav } from "./_components/topnav";
import { AdminTabs } from "./_components/AdminTabs";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <>
      {/* Layout with fixed header containing nav and tabs, scrollable content below */}
      {/* dark class makes shadcn components use dark theme colors */}
      <div className="dark grid h-screen grid-rows-[auto_auto_1fr]">
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

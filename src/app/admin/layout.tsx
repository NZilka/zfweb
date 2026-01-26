import { TopNav } from "./_components/topnav";
import { AdminTabs } from "./_components/AdminTabs";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <>
      {/* Layout with fixed header containing nav and tabs, scrollable content below */}
      {/* overflow-x-hidden prevents horizontal scroll on mobile */}
      <div className="grid h-screen w-full max-w-full overflow-x-hidden grid-rows-[auto_auto_1fr]">
        <TopNav />
        {/* Tab navigation for admin sections */}
        <AdminTabs />
        <main className="overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      {modal}
      <div id="modal-root" />
    </>
  );
}

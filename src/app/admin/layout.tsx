import { TopNav } from "./_components/topnav";
import { AdminTabs } from "./_components/AdminTabs";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <>
      {/* Layout with fixed header containing nav and tabs, scrollable content below */}
      <div className="grid h-dvh w-full grid-rows-[auto_auto_1fr]">
        <TopNav />
        {/* Tab navigation for admin sections - scrolls horizontally on mobile */}
        <AdminTabs />
        <main className="overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      {modal}
      <div id="modal-root" />
    </>
  );
}

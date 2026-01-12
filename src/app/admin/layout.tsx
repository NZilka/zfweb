import { TopNav } from "./_components/topnav";

export default function AdminLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <>
      <div className="grid h-screen grid-rows-[auto,1fr]">
        <TopNav />
        <main className="overflow-y-scroll">{children}</main>
      </div>
      {modal}
      <div id="modal-root" />
    </>
  );
}

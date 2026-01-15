import { TopNav } from "./_components/topnav";

export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <TopNav />
      <main className="overflow-y-scroll">{children}</main>
    </div>
  );
}

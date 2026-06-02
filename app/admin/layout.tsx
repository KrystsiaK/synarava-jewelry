import Link from "next/link";

import { LogoutForm } from "@/components/auth/logout-form";
import { requirePermission } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePermission("admin.access", "/admin");

  return (
    <main className="artifact-shell min-h-screen pt-28">
      <div className="site-shell grid gap-8 pb-16 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="panel h-fit p-6">
          <p className="mb-6 font-serif text-[1.6rem]">Admin</p>
          <nav className="flex flex-col gap-3">
            <Link href="/admin" className="label-caps text-muted transition-colors hover:text-accent">
              Overview
            </Link>
            <Link href="/admin/pages" className="label-caps text-muted transition-colors hover:text-accent">
              Pages
            </Link>
            <Link href="/admin/products" className="label-caps text-muted transition-colors hover:text-accent">
              Products
            </Link>
            <Link href="/admin/account" className="label-caps text-muted transition-colors hover:text-accent">
              Account
            </Link>
            <Link href="/shop" className="label-caps text-muted transition-colors hover:text-accent">
              Open shop
            </Link>
          </nav>
          <div className="mt-8 border-t border-stroke pt-6">
            <LogoutForm />
          </div>
        </aside>

        <section>{children}</section>
      </div>
    </main>
  );
}

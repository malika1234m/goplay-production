import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminSidebar from "@/components/layout/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  // Signed in, but not staff: say so rather than showing a sign-in form they can't use
  if (session.user.role !== "ADMIN") {
    return (
      <main id="main" className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-bold text-slate-900">This area is for GoPlay staff</h1>
          <p className="text-sm text-slate-500">You&apos;re signed in as {session.user.email}, which doesn&apos;t have admin access.</p>
          <Link href="/" className="inline-block rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">Go to GoPlay</Link>
        </div>
      </main>
    );
  }

  const adminUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!adminUser?.isActive) redirect("/login");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main id="main" tabIndex={-1} className="flex-1 min-w-0 pt-14 lg:pt-0 lg:pl-64 transition-all duration-300">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

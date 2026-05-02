import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import GroundOwnerSidebar from "@/components/layout/GroundOwnerSidebar";

export default async function GroundOwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.role !== "GROUND_OWNER") redirect("/login");

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (user?.mustChangePassword) redirect("/force-change-password");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <GroundOwnerSidebar />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

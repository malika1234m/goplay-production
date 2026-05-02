import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import WorkerSidebar from "@/components/layout/WorkerSidebar";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "GROUND_WORKER") redirect("/");

  // Verify DB state — handles stale JWTs after role revocation or worker removal
  const [dbUser, workerRecord] = await Promise.all([
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { role: true, mustChangePassword: true },
    }),
    db.facilityWorker.findUnique({ where: { userId: session.user.id } }),
  ]);

  if (!dbUser || dbUser.role !== "GROUND_WORKER") redirect("/");
  if (!workerRecord) redirect("/");
  if (dbUser.mustChangePassword) redirect("/force-change-password");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkerSidebar />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  // Workers and owners have their own dashboards — don't let them land here
  if (session.user.role === "GROUND_WORKER") redirect("/worker/dashboard");
  if (session.user.role === "GROUND_OWNER")  redirect("/ground-owner/dashboard");
  if (session.user.role === "ADMIN")         redirect("/admin/dashboard");

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

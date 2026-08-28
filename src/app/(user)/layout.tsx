import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import AdSenseScript from "@/components/ads/AdSenseScript";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      {/* Player-facing pages only. The owner, worker and admin portals stay
          ad-free — those are business tools, not consumer surfaces. */}
      <AdSenseScript />
    </div>
  );
}

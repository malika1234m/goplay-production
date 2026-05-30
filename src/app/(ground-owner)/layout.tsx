import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plan";
import GroundOwnerSidebar from "@/components/layout/GroundOwnerSidebar";

const ACTIVATION_EXEMPT = ["/ground-owner/activate", "/ground-owner/billing"];

export default async function GroundOwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.role !== "GROUND_OWNER") redirect("/login");

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { mustChangePassword: true, isActive: true },
  });
  if (!user?.isActive) redirect("/login");
  if (user?.mustChangePassword) redirect("/force-change-password");

  const hdrs    = await headers();
  const pathname = hdrs.get("x-pathname") ?? "";
  const isExempt = ACTIVATION_EXEMPT.some((p) => pathname.startsWith(p));

  const profile = await db.groundOwnerProfile.findUnique({
    where:  { userId: session.user.id },
    select: { isActivated: true, plan: true, planExpiresAt: true },
  });

  if (!isExempt && !profile?.isActivated) redirect("/ground-owner/activate");

  const effectivePlan = profile ? getEffectivePlan(profile) : "STARTER";
  const daysLeft = (profile?.planExpiresAt && profile.plan !== "STARTER")
    ? Math.ceil((profile.planExpiresAt.getTime() - Date.now()) / 86_400_000)
    : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
  const justExpired  = profile?.plan !== "STARTER" && effectivePlan === "STARTER" && profile?.planExpiresAt;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <GroundOwnerSidebar />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        {expiringSoon && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ Your {profile?.plan === "GROWTH" ? "Growth" : "Pro"} plan expires in <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"}</strong>. Renew to keep your features.
            </p>
            <Link href="/ground-owner/billing" className="text-xs font-bold text-amber-900 underline underline-offset-2 whitespace-nowrap shrink-0">
              Renew Now →
            </Link>
          </div>
        )}
        {justExpired && !expiringSoon && (
          <div className="bg-red-50 border-b border-red-200 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <p className="text-sm text-red-800 font-medium">
              Your paid plan has expired. You&apos;ve been moved to the Starter plan — some features may be limited.
            </p>
            <Link href="/ground-owner/billing" className="text-xs font-bold text-red-900 underline underline-offset-2 whitespace-nowrap shrink-0">
              Renew Plan →
            </Link>
          </div>
        )}
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Building2, CalendarCheck, Clock,
  DollarSign, Star, LogOut, User, TrendingUp, Wrench, Wallet, CalendarDays, Users,
} from "lucide-react";

const navItems = [
  { href: "/ground-owner/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/ground-owner/grounds",      label: "My Grounds",   icon: Building2 },
  { href: "/ground-owner/bookings",     label: "Bookings",     icon: CalendarCheck },
  { href: "/ground-owner/schedule",     label: "Schedule",     icon: CalendarDays },
  { href: "/ground-owner/earnings",     label: "Earnings",     icon: TrendingUp },
  { href: "/ground-owner/payouts",      label: "Payouts",      icon: Wallet },
  { href: "/ground-owner/reviews",      label: "Reviews",      icon: Star },
  { href: "/ground-owner/availability", label: "Availability", icon: Clock },
  { href: "/ground-owner/maintenance",  label: "Maintenance",  icon: Wrench },
  { href: "/ground-owner/workers",      label: "Workers",      icon: Users },
];

export default function GroundOwnerSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="GoPlay" width={34} height={34} className="rounded-lg object-contain bg-white" />
          <span className="text-lg font-bold text-white">
            Go<span className="text-green-400">Play</span>
          </span>
        </Link>
        <p className="text-xs text-slate-500 mt-1 ml-10">Ground Owner Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-green-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <Link
          href="/ground-owner/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors mb-1"
        >
          <User className="w-4 h-4 shrink-0" />
          Profile
        </Link>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() ?? "G"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

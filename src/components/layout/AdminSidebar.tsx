"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, MapPin, DollarSign, BarChart2,
  LogOut, ChevronLeft, ChevronRight, Wallet, ClipboardList, BadgeDollarSign, Settings, ReceiptText, Star, LocateFixed, Menu, X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const NAV = [
  { id: "dashboard",    href: "/admin/dashboard",    label: "Dashboard",         icon: LayoutDashboard },
  { id: "users",        href: "/admin/users",         label: "Users",             icon: Users },
  { id: "grounds",      href: "/admin/grounds",       label: "Ground Management", icon: MapPin },
  { id: "applications", href: "/admin/applications",  label: "Applications",      icon: ClipboardList },
  { id: "earnings",     href: "/admin/earnings",      label: "Earnings",          icon: DollarSign },
  { id: "commissions",  href: "/admin/commissions",   label: "Commissions",       icon: BadgeDollarSign },
  { id: "payouts",      href: "/admin/payouts",       label: "Payouts",           icon: Wallet },
  { id: "refunds",      href: "/admin/refunds",       label: "Refunds",           icon: ReceiptText },
  { id: "reviews",      href: "/admin/reviews",       label: "Reviews",           icon: Star },
  { id: "geocode",       href: "/admin/geocode",        label: "Geocode Facilities", icon: LocateFixed },
  { id: "analytics",    href: "/admin/analytics",     label: "Analytics",         icon: BarChart2 },
  { id: "settings",     href: "/admin/settings",      label: "Settings",           icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [pendingCount,    setPendingCount]    = useState(0);
  const [commissionDebt,  setCommissionDebt]  = useState(0);
  const [refundNeeded,    setRefundNeeded]    = useState(0);
  const [reportedReviews, setReportedReviews] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("adminSidebarCollapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/applications?status=PENDING");
      const data = await res.json();
      setPendingCount(data.summary?.pending ?? 0);
    } catch { /* silent */ }
  }, []);

  const loadCommissions = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/commissions");
      const data = await res.json();
      setCommissionDebt(data.summary?.ownersWithDebt ?? 0);
    } catch { /* silent */ }
  }, []);

  const loadRefunds = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/refunds");
      const data = await res.json();
      setRefundNeeded(data.summary?.refundNeeded ?? 0);
    } catch { /* silent */ }
  }, []);

  const loadReportedReviews = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/reviews?reported=true");
      const data = await res.json();
      setReportedReviews(data.totalReported ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadPending(); loadCommissions(); loadRefunds(); loadReportedReviews(); }, [loadPending, loadCommissions, loadRefunds, loadReportedReviews]);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("adminSidebarCollapsed", String(!c));
      return !c;
    });
  };

  const sidebarContent = (onClose?: () => void) => (
    <aside
      className={`h-screen flex flex-col transition-all duration-300 ${
        onClose ? "w-72" : collapsed ? "w-20" : "w-64"
      }`}
      style={{ background: "linear-gradient(180deg,#1e293b 0%,#0f172a 100%)" }}
    >
      {/* Mobile close button */}
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white lg:hidden z-10">
          <X className="w-5 h-5" />
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10 min-h-[72px]">
        {(!collapsed || onClose) && (
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.jpeg" alt="GoPlay" width={36} height={36} className="rounded-lg bg-white p-0.5 object-contain shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-extrabold text-white tracking-wide">GoPlay</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Admin</span>
            </div>
          </Link>
        )}
        {collapsed && !onClose && (
          <Link href="/" className="mx-auto">
            <Image src="/logo.jpeg" alt="GoPlay" width={36} height={36} className="rounded-lg bg-white p-0.5 object-contain" />
          </Link>
        )}
        {!onClose && (
          <button
            onClick={toggle}
            className="bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg w-8 h-8 flex items-center justify-center transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <ul className="space-y-1 px-3">
          {NAV.map(({ id, href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const badge  =
              id === "applications" && pendingCount    > 0 ? pendingCount    :
              id === "commissions"  && commissionDebt  > 0 ? commissionDebt  :
              id === "refunds"      && refundNeeded    > 0 ? refundNeeded    :
              id === "reviews"      && reportedReviews > 0 ? reportedReviews : 0;
            const showLabel = !collapsed || onClose;
            return (
              <li key={id}>
                <Link
                  href={href}
                  onClick={onClose}
                  title={collapsed && !onClose ? label : undefined}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    active
                      ? "bg-blue-600/20 text-white font-semibold border-l-4 border-blue-500 pl-2"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Icon className="w-5 h-5" />
                    {badge > 0 && !showLabel && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-[9px] font-bold text-slate-900 flex items-center justify-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  {showLabel && <span className="text-sm whitespace-nowrap flex-1">{label}</span>}
                  {showLabel && badge > 0 && (
                    <span className="ml-auto bg-yellow-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}

          <li className="my-3 border-t border-white/10" />

          <li>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all w-full"
              title={collapsed && !onClose ? "Sign out" : undefined}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {(!collapsed || onClose) && <span className="text-sm">Sign out</span>}
            </button>
          </li>
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          {(!collapsed || onClose) && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session?.user?.name ?? "Admin"}</p>
              <p className="text-xs text-slate-400">Super Admin</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 z-50 h-screen" style={{ width: collapsed ? "80px" : "256px", transition: "width 0.3s" }}>
        {sidebarContent()}
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 gap-3 border-b border-white/10"
        style={{ background: "linear-gradient(90deg,#1e293b,#0f172a)" }}>
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="GoPlay" width={28} height={28} className="rounded-md bg-white p-0.5 object-contain" />
          <span className="text-base font-bold text-white">GoPlay <span className="text-xs text-slate-400 font-normal">Admin</span></span>
        </Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full">
            {sidebarContent(() => setMobileOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}

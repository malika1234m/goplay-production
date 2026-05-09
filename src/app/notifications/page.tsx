"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, BellOff, CheckCircle, AlertTriangle, AlertCircle, Info,
  Trash2, CheckCheck, Loader2, ChevronLeft, ChevronRight,
  Inbox, Sparkles, ArrowLeft,
} from "lucide-react";

type NotifType = "info" | "success" | "warning" | "error";
type Tab = "all" | "unread";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<NotifType, {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  accent: string;
  label: string;
  badgeBg: string;
  badgeText: string;
}> = {
  info: {
    icon: Info,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    accent: "border-blue-400",
    label: "Info",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-600",
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    accent: "border-emerald-400",
    label: "Success",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-600",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    accent: "border-amber-400",
    label: "Warning",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-600",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-600",
    iconBg: "bg-red-100",
    accent: "border-red-400",
    label: "Alert",
    badgeBg: "bg-red-50",
    badgeText: "text-red-600",
  },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return date.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.setHours(0,0,0,0) - date.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <  7)  return date.toLocaleDateString("en-LK", { weekday: "long" });
  return date.toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDay(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const map = new Map<string, Notification[]>();
  for (const n of notifications) {
    const label = getDayLabel(n.createdAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

const LIMIT = 20;

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab]             = useState<Tab>("all");
  const [page, setPage]           = useState(1);
  const [notifications, setNotifs] = useState<Notification[]>([]);
  const [total, setTotal]         = useState(0);
  const [unreadCount, setUnread]  = useState(0);
  const [loading, setLoading]     = useState(true);
  const [markingAll, setMarkAll]  = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [deletingId, setDeleting] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const groups     = groupByDay(notifications);

  const fetchPage = useCallback(async (t: Tab, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(p), ...(t === "unread" ? { unread: "true" } : {}) });
      const res  = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setTotal(data.total ?? 0);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated") fetchPage(tab, page); }, [tab, page, status, fetchPage]);

  function switchTab(t: Tab) { setTab(t); setPage(1); }

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  async function deleteOne(id: string, wasUnread: boolean) {
    setDeleting(id);
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => t - 1);
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    setDeleting(null);
  }

  async function markAllRead() {
    setMarkAll(true);
    await fetch("/api/notifications/read-all", { method: "PUT" });
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    setMarkAll(false);
  }

  async function clearRead() {
    setClearing(true);
    await fetch("/api/notifications", { method: "DELETE" });
    await fetchPage(tab, 1);
    setPage(1);
    setClearing(false);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
      </div>
    );
  }

  const readCount  = total - unreadCount;
  const todayCount = notifications.filter((n) => getDayLabel(n.createdAt) === "Today").length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/20">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                  {session?.user?.name ?? "Your account"}
                </p>
                <h1 className="text-2xl font-bold text-white">Notifications</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  {unreadCount > 0
                    ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""} waiting`
                    : "You're all caught up!"}
                </p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  Mark all read
                </button>
              )}
              <button
                onClick={clearRead}
                disabled={clearing || readCount === 0}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors border border-white/10"
              >
                {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear read
              </button>
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { label: "Total",  value: total,       color: "bg-white/10 text-white" },
              { label: "Unread", value: unreadCount,  color: unreadCount > 0 ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30" : "bg-white/10 text-white" },
              { label: "Read",   value: readCount,   color: "bg-green-500/20 text-green-300" },
              { label: "Today",  value: todayCount,  color: "bg-blue-500/20 text-blue-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${color}`}>
                <span className="font-bold text-base leading-none">{value}</span>
                <span className="opacity-70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(["all", "unread"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${
                  tab === t
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t === "all" ? <Inbox className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {t}
                {t === "unread" && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {Math.min(unreadCount, 99)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 hidden sm:block">
            {total} notification{total !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading notifications…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5">
              {tab === "unread"
                ? <Sparkles className="w-9 h-9 text-slate-300" />
                : <Bell className="w-9 h-9 text-slate-300" />
              }
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">
              {tab === "unread" ? "All caught up!" : "No notifications yet"}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {tab === "unread"
                ? "You have no unread notifications. Great job staying on top of things."
                : "We'll notify you about bookings, payments, and account activity."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map(({ label, items }) => (
              <section key={label}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {items.map((n) => {
                    const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={n.id}
                        className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                          !n.isRead
                            ? "border-slate-200 shadow-sm ring-1 ring-green-500/10"
                            : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                        }`}
                      >
                        {/* Unread indicator bar */}
                        {!n.isRead && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-2xl" />
                        )}

                        <div className="flex items-start gap-4 px-5 py-4 pl-6">
                          {/* Type icon */}
                          <div className={`shrink-0 w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center mt-0.5`}>
                            <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-semibold leading-snug ${!n.isRead ? "text-slate-900" : "text-slate-600"}`}>
                                  {n.title}
                                </p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                                  <Icon className="w-2.5 h-2.5" />
                                  {cfg.label}
                                </span>
                                {!n.isRead && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                    New
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs text-slate-400">{formatTime(n.createdAt)}</span>
                              </div>
                            </div>

                            <p className={`text-sm mt-1 leading-relaxed ${!n.isRead ? "text-slate-700" : "text-slate-500"}`}>
                              {n.message}
                            </p>

                            <p className="text-[11px] text-slate-400 mt-2">
                              {formatFullDate(n.createdAt)}
                            </p>
                          </div>

                          {/* Action buttons */}
                          <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5">
                            {!n.isRead && (
                              <button
                                onClick={() => markRead(n.id)}
                                title="Mark as read"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteOne(n.id, !n.isRead)}
                              disabled={deletingId === n.id}
                              title="Delete"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {deletingId === n.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
              <span className="font-semibold text-slate-700">{totalPages}</span>
              <span className="text-slate-400"> · {total} total</span>
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              {/* Page numbers */}
              <div className="flex gap-1 mx-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pg = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  if (pg < 1 || pg > totalPages) return null;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`w-9 h-9 text-sm font-medium rounded-xl transition-colors ${
                        pg === page
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

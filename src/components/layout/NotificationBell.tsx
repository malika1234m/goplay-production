"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell, CheckCircle, AlertTriangle, AlertCircle, Info,
  X, CheckCheck, Loader2, ArrowRight, Sparkles,
} from "lucide-react";

type NotifType = "info" | "success" | "warning" | "error";

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
}> = {
  info:    { icon: Info,          iconColor: "text-blue-600",    iconBg: "bg-blue-100",    accent: "bg-blue-500"    },
  success: { icon: CheckCircle,   iconColor: "text-emerald-600", iconBg: "bg-emerald-100", accent: "bg-emerald-500" },
  warning: { icon: AlertTriangle, iconColor: "text-amber-600",   iconBg: "bg-amber-100",   accent: "bg-amber-500"   },
  error:   { icon: AlertCircle,   iconColor: "text-red-600",     iconBg: "bg-red-100",     accent: "bg-red-500"     },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen]           = useState(false);
  const [unreadCount, setUnread]  = useState(0);
  const [notifications, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(false);
  const [markingAll, setMarkAll]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1&unread=true", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  const fetchDropdown = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) fetchDropdown();
  }, [open, fetchDropdown]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markRead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  async function deleteOne(id: string, wasUnread: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  }

  async function markAllRead() {
    setMarkAll(true);
    await fetch("/api/notifications/read-all", { method: "PUT" });
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    setMarkAll(false);
  }

  const badge = Math.min(unreadCount, 99);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          open ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Bell className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white leading-none">
            {badge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2.5 w-[360px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">{unreadCount} unread</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                {markingAll
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <CheckCheck className="w-3 h-3" />
                }
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-600">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">No new notifications right now.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={`group relative flex gap-3 px-4 py-3.5 transition-colors ${
                      !n.isRead ? "bg-green-50/40 hover:bg-green-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    {/* Unread bar */}
                    {!n.isRead && (
                      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-green-500 rounded-full" />
                    )}

                    {/* Icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center mt-0.5`}>
                      <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-snug truncate ${!n.isRead ? "text-slate-900" : "text-slate-600"}`}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap mt-px">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Hover actions */}
                    <div className="shrink-0 absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-slate-100">
                      {!n.isRead && (
                        <button
                          onClick={(e) => markRead(n.id, e)}
                          title="Mark as read"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => deleteOne(n.id, !n.isRead, e)}
                        title="Delete"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors group"
            >
              View all notifications
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

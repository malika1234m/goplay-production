"use client";

import { useState, useEffect } from "react";
import { Wrench, CalendarX, Plus, Trash2, Loader2, AlertTriangle, Clock, Lock } from "lucide-react";
import Link from "next/link";

interface Facility { id: string; name: string; city: string }

interface BlockedEntry {
  id:           string;
  facilityId:   string;
  facilityName: string;
  date:         string;
  startTime:    string | null;
  endTime:      string | null;
  reason:       string | null;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function MaintenancePage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [blocked,    setBlocked]    = useState<BlockedEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [removing,   setRemoving]   = useState<string | null>(null);
  const [planUsage,  setPlanUsage]  = useState<{ used: number; max: number | null } | null>(null);

  useEffect(() => {
    fetch("/api/ground-owner/plan-status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPlanUsage(d.usage?.blockedDates ?? null); })
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    facilityId: "",
    date:       "",
    blockType:  "full" as "full" | "hours",
    startTime:  "08:00",
    endTime:    "10:00",
    reason:     "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/ground-owner/availability").then((r) => r.json()),
      fetch("/api/ground-owner/blocked-dates").then((r) => r.json()),
    ]).then(([facData, blockedData]) => {
      const list: Facility[] = facData.facilities ?? [];
      setFacilities(list);
      setBlocked(blockedData.blocked ?? []);
      if (list.length > 0) setForm((f) => ({ ...f, facilityId: list[0].id }));
    }).finally(() => setLoading(false));
  }, []);

  const addEntry = async () => {
    if (!form.facilityId || !form.date) {
      setFormError("Please select a ground and date.");
      return;
    }
    if (form.blockType === "hours") {
      if (!form.startTime || !form.endTime) {
        setFormError("Please set both start and end times.");
        return;
      }
      if (form.startTime >= form.endTime) {
        setFormError("Start time must be before end time.");
        return;
      }
    }
    setFormError("");
    setAdding(true);
    try {
      const body: Record<string, string> = {
        facilityId: form.facilityId,
        date:       form.date,
        reason:     form.reason,
      };
      if (form.blockType === "hours") {
        body.startTime = form.startTime;
        body.endTime   = form.endTime;
      }

      const res  = await fetch("/api/ground-owner/blocked-dates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBlocked((prev) =>
          [data.entry, ...prev].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
        setForm((f) => ({ ...f, date: "", reason: "", startTime: "08:00", endTime: "10:00" }));
      } else if (data.code === "PLAN_LIMIT") {
        setFormError("PLAN_LIMIT:" + (data.error ?? ""));
      } else {
        setFormError(data.error ?? "Failed to add.");
      }
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this blocked date?")) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/ground-owner/blocked-dates/${id}`, { method: "DELETE" });
      if (res.ok) setBlocked((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setRemoving(null);
    }
  };

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = blocked.filter((b) => new Date(b.date) >= today);
  const past     = blocked.filter((b) => new Date(b.date) < today);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance & Blocked Dates</h1>
          <p className="text-slate-500 text-sm mt-0.5">Block full days or specific hours when your ground is unavailable</p>
        </div>
        {planUsage && (
          <div className="flex items-center gap-2">
            {planUsage.max !== null ? (
              <>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Blocked this month</p>
                  <p className={`text-sm font-bold ${planUsage.used >= (planUsage.max ?? 0) ? "text-red-600" : "text-slate-900"}`}>
                    {planUsage.used} / {planUsage.max}
                  </p>
                </div>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${planUsage.used >= (planUsage.max ?? 0) ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, (planUsage.used / (planUsage.max ?? 1)) * 100)}%` }}
                  />
                </div>
                {planUsage.used >= (planUsage.max ?? 0) && (
                  <Link href="/ground-owner/billing" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition-colors whitespace-nowrap">
                    Upgrade →
                  </Link>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">{planUsage.used} blocked this month · Unlimited</span>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-3">
            <CalendarX className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{upcoming.length}</p>
          <p className="text-xs text-slate-500 mt-1">Upcoming Blocked</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {upcoming.filter((b) => b.startTime).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Partial Hour Blocks</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-3">
            <Wrench className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{past.length}</p>
          <p className="text-xs text-slate-500 mt-1">Past Maintenance</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5">Block a Date or Time</h2>

        {facilities.length === 0 ? (
          <p className="text-sm text-slate-400">No grounds found. Add a ground first.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Ground + date row */}
            <div className="flex flex-wrap gap-3">
              <select
                value={form.facilityId}
                onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>{fac.name} — {fac.city}</option>
                ))}
              </select>

              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Block type toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, blockType: "full" }))}
                className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                  form.blockType === "full"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                Full Day Closed
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, blockType: "hours" }))}
                className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                  form.blockType === "hours"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                Specific Hours
              </button>
            </div>

            {/* Time pickers (only for specific hours) */}
            {form.blockType === "hours" && (
              <div className="flex items-center gap-3 flex-wrap bg-slate-50 rounded-xl px-4 py-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">From</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">To</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  These hours will show as blocked (red) in the booking form
                </span>
              </div>
            )}

            {/* Reason + submit row */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Reason (e.g. Resurfacing, Maintenance)"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
              />
              <button
                onClick={addEntry}
                disabled={adding}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Block
              </button>
            </div>

            {formError && formError.startsWith("PLAN_LIMIT:") ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">{formError.slice(11)}</p>
                  <Link href="/ground-owner/billing" className="text-xs text-amber-700 underline underline-offset-2 mt-0.5 inline-block">Upgrade your plan →</Link>
                </div>
              </div>
            ) : formError ? (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />{formError}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Upcoming blocked entries */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Upcoming Blocks
            <span className="ml-2 text-slate-400 font-normal text-sm">({upcoming.length})</span>
          </h2>
        </div>

        {upcoming.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CalendarX className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No upcoming blocked dates or hours</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {upcoming.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    b.startTime ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"
                  }`}>
                    {b.startTime ? <Clock className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{fmtDate(b.date)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.facilityName}
                      {b.startTime && b.endTime
                        ? <> · <span className="text-red-500 font-medium">{b.startTime}–{b.endTime}</span></>
                        : <> · <span className="text-orange-600 font-medium">Full Day Closed</span></>
                      }
                      {b.reason && <> · {b.reason}</>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(b.id)}
                  disabled={removing === b.id}
                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                  title="Remove"
                >
                  {removing === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past entries */}
      {past.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="text-base font-semibold text-slate-900">
              Past Maintenance
              <span className="ml-2 text-slate-400 font-normal text-sm">({past.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {past.slice(0, 10).map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{fmtDate(b.date)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.facilityName}
                      {b.startTime && b.endTime ? <> · {b.startTime}–{b.endTime}</> : <> · Full Day</>}
                      {b.reason && <> · {b.reason}</>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(b.id)}
                  disabled={removing === b.id}
                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                >
                  {removing === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

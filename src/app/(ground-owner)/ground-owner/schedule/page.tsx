"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutGrid,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Facility { id: string; name: string; city: string }

interface AvailDay {
  dayOfWeek: number;
  isOpen:    boolean;
  openTime:  string;
  closeTime: string;
}

interface BookingEv {
  id:             string;
  bookingDate:    string;
  startTime:      string;
  endTime:        string;
  status:         "CONFIRMED" | "PENDING" | string;
  playerName:     string;
  totalAmount:    number;
  isPhoneBooking?: boolean;
}

interface BlockedEv {
  id:        string;
  date:      string;
  startTime: string | null;
  endTime:   string | null;
  reason:    string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOUR_H  = 56;   // px per hour in week view
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const DAYS_S  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_L  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pad2   = (n: number) => n.toString().padStart(2, "0");

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function getWeekStart(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay()); // Sunday
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first    = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const startDow = first.getDay();
  const cells: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh   = h % 12 || 12;
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${pad2(m)} ${ampm}`;
}

function isoDate(d: Date) {
  return dateKey(d);
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      {[
        { color: "bg-green-500",  label: "Confirmed"     },
        { color: "bg-purple-400", label: "Phone booking" },
        { color: "bg-amber-400",  label: "Pending"       },
        { color: "bg-red-400",    label: "Blocked hours" },
        { color: "bg-orange-400", label: "Full-day closed"},
        { color: "bg-slate-200",  label: "Outside hours" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  availByDow,
  bookingsByDate,
  blockedByDate,
}: {
  weekStart:      Date;
  availByDow:     Map<number, AvailDay>;
  bookingsByDate: Map<string, BookingEv[]>;
  blockedByDate:  Map<string, BlockedEv[]>;
}) {
  const today = dateKey(new Date());
  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="flex border-b border-slate-100">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const key    = dateKey(day);
            const isToday = key === today;
            const dow    = day.getDay();
            const sched  = availByDow.get(dow);
            return (
              <div
                key={key}
                className={`flex-1 px-2 py-2.5 text-center border-l border-slate-100 ${
                  isToday ? "bg-green-50" : ""
                }`}
              >
                <p className={`text-xs font-medium ${isToday ? "text-green-600" : "text-slate-400"}`}>
                  {DAYS_S[dow]}
                </p>
                <p className={`text-lg font-bold leading-tight ${isToday ? "text-green-700" : "text-slate-800"}`}>
                  {day.getDate()}
                </p>
                {sched?.isOpen ? (
                  <p className="text-[10px] text-slate-400">{fmtTime(sched.openTime)}–{fmtTime(sched.closeTime)}</p>
                ) : (
                  <p className="text-[10px] text-red-400">Closed</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative flex" style={{ height: 24 * HOUR_H }}>
          {/* Hour gutter */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-slate-300 -translate-y-2"
                style={{ top: h * HOUR_H }}
              >
                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key    = dateKey(day);
            const dow    = day.getDay();
            const sched  = availByDow.get(dow);
            const bkList = bookingsByDate.get(key) ?? [];
            const blList = blockedByDate.get(key)  ?? [];
            const fullDayBlock = blList.find((b) => !b.startTime || !b.endTime);

            const openMins  = sched?.isOpen ? toMins(sched.openTime)  : null;
            const closeMins = sched?.isOpen ? toMins(sched.closeTime) : null;

            return (
              <div key={key} className="flex-1 border-l border-slate-100 relative">
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div key={h} className="absolute w-full border-t border-slate-50" style={{ top: h * HOUR_H }} />
                ))}

                {/* Outside-hours shading */}
                {sched?.isOpen && openMins != null && closeMins != null ? (
                  <>
                    {openMins > 0 && (
                      <div
                        className="absolute inset-x-0 bg-slate-100 opacity-60 z-0"
                        style={{ top: 0, height: (openMins / 60) * HOUR_H }}
                      />
                    )}
                    {closeMins < 24 * 60 && (
                      <div
                        className="absolute inset-x-0 bg-slate-100 opacity-60 z-0"
                        style={{ top: (closeMins / 60) * HOUR_H, bottom: 0 }}
                      />
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-slate-100 opacity-60 z-0" />
                )}

                {/* Full-day block overlay */}
                {fullDayBlock && (
                  <div className="absolute inset-1 rounded-lg bg-orange-100 border border-orange-200 z-10 flex items-center justify-center">
                    <p className="text-xs font-medium text-orange-600 text-center px-1">
                      {fullDayBlock.reason ?? "Closed"}
                    </p>
                  </div>
                )}

                {/* Partial blocks */}
                {!fullDayBlock && blList.filter((b) => b.startTime && b.endTime).map((b) => {
                  const top = (toMins(b.startTime!) / 60) * HOUR_H;
                  const h   = ((toMins(b.endTime!) - toMins(b.startTime!)) / 60) * HOUR_H;
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-1 rounded-md bg-red-100 border border-red-200 z-10 overflow-hidden px-1.5 pt-0.5"
                      style={{ top, height: Math.max(h, 18) }}
                      title={b.reason ? `Blocked: ${b.reason}` : "Maintenance"}
                    >
                      <p className="text-[10px] font-medium text-red-600 leading-tight truncate">
                        {b.startTime}–{b.endTime}
                        {b.reason && ` · ${b.reason}`}
                      </p>
                    </div>
                  );
                })}

                {/* Bookings */}
                {!fullDayBlock && bkList.map((bk) => {
                  const top   = (toMins(bk.startTime) / 60) * HOUR_H;
                  const h     = ((toMins(bk.endTime) - toMins(bk.startTime)) / 60) * HOUR_H;
                  const phone = bk.isPhoneBooking;
                  const isConfirmed = bk.status === "CONFIRMED";
                  return (
                    <div
                      key={bk.id}
                      className={`absolute inset-x-1 rounded-md z-20 overflow-hidden px-1.5 pt-0.5 border ${
                        phone
                          ? "bg-purple-100 border-purple-300"
                          : isConfirmed
                            ? "bg-green-100 border-green-300"
                            : "bg-amber-50 border-amber-300"
                      }`}
                      style={{ top, height: Math.max(h, 20) }}
                      title={`${phone ? "📞 " : ""}${bk.playerName} · Rs. ${bk.totalAmount.toLocaleString()}`}
                    >
                      <div className="flex items-center gap-0.5">
                        {phone && <span className="text-[9px] leading-none">📞</span>}
                        <p className={`text-[10px] font-semibold leading-tight truncate ${
                          phone ? "text-purple-700" : isConfirmed ? "text-green-700" : "text-amber-700"
                        }`}>
                          {bk.startTime}–{bk.endTime}
                        </p>
                      </div>
                      <p className={`text-[9px] leading-tight truncate ${
                        phone ? "text-purple-600" : isConfirmed ? "text-green-600" : "text-amber-600"
                      }`}>
                        {bk.playerName}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  availByDow,
  bookingsByDate,
  blockedByDate,
}: {
  year:           number;
  month:          number;
  availByDow:     Map<number, AvailDay>;
  bookingsByDate: Map<string, BookingEv[]>;
  blockedByDate:  Map<string, BlockedEv[]>;
}) {
  const today = dateKey(new Date());
  const cells = getMonthGrid(year, month);

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_S.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="border-b border-r border-slate-50 min-h-[88px]" />;
          }
          const key   = dateKey(day);
          const dow   = day.getDay();
          const sched = availByDow.get(dow);
          const bkList = bookingsByDate.get(key) ?? [];
          const blList = blockedByDate.get(key)  ?? [];
          const fullDayBlock = blList.find((b) => !b.startTime || !b.endTime);
          const partialBlocks = blList.filter((b) => b.startTime && b.endTime);
          const confirmed = bkList.filter((b) => b.status === "CONFIRMED" && !b.isPhoneBooking).length;
          const phone     = bkList.filter((b) => b.isPhoneBooking).length;
          const pending   = bkList.filter((b) => b.status === "PENDING").length;
          const isToday   = key === today;
          const isClosed  = !sched?.isOpen;

          return (
            <div
              key={key}
              className={`border-b border-r border-slate-100 min-h-[88px] p-1.5 ${
                isClosed || fullDayBlock ? "bg-slate-50" : "bg-white"
              }`}
            >
              {/* Date number */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                isToday ? "bg-green-600 text-white" : "text-slate-700"
              }`}>
                {day.getDate()}
              </div>

              {/* Closed label */}
              {isClosed && !fullDayBlock && (
                <span className="text-[9px] text-slate-400 font-medium">Closed</span>
              )}

              {/* Full-day block */}
              {fullDayBlock && (
                <div className="rounded text-[9px] font-medium text-orange-700 bg-orange-100 px-1 py-0.5 mb-0.5 truncate">
                  {fullDayBlock.reason ?? "Closed"}
                </div>
              )}

              {/* Partial blocks */}
              {partialBlocks.length > 0 && (
                <div className="rounded text-[9px] font-medium text-red-600 bg-red-50 px-1 py-0.5 mb-0.5">
                  {partialBlocks.length} block{partialBlocks.length > 1 ? "s" : ""}
                </div>
              )}

              {/* Bookings */}
              {confirmed > 0 && (
                <div className="rounded text-[9px] font-medium text-green-700 bg-green-100 px-1 py-0.5 mb-0.5">
                  {confirmed} confirmed
                </div>
              )}
              {phone > 0 && (
                <div className="rounded text-[9px] font-medium text-purple-700 bg-purple-100 px-1 py-0.5 mb-0.5">
                  📞 {phone} phone
                </div>
              )}
              {pending > 0 && (
                <div className="rounded text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5">
                  {pending} pending
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [facilities,  setFacilities]  = useState<Facility[]>([]);
  const [facilityId,  setFacilityId]  = useState("");
  const [view,        setView]        = useState<"week" | "month">("week");
  const [weekStart,   setWeekStart]   = useState(() => getWeekStart(new Date()));
  const [monthDate,   setMonthDate]   = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [avail,     setAvail]     = useState<AvailDay[]>([]);
  const [bookings,  setBookings]  = useState<BookingEv[]>([]);
  const [blocked,   setBlocked]   = useState<BlockedEv[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadingFac, setLoadingFac] = useState(true);

  // Load facilities once
  useEffect(() => {
    fetch("/api/ground-owner/availability")
      .then((r) => r.json())
      .then((d) => {
        const list: Facility[] = d.facilities ?? [];
        setFacilities(list);
        if (list.length > 0) setFacilityId(list[0].id);
      })
      .finally(() => setLoadingFac(false));
  }, []);

  // Derived date range
  const { from, to } = useMemo(() => {
    if (view === "week") {
      return {
        from: isoDate(weekStart),
        to:   isoDate(addDays(weekStart, 6)),
      };
    }
    const year  = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return {
      from: isoDate(new Date(year, month, 1)),
      to:   isoDate(new Date(year, month + 1, 0)),
    };
  }, [view, weekStart, monthDate]);

  // Load schedule data whenever facility / range changes
  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/ground-owner/schedule?facilityId=${facilityId}&from=${from}&to=${to}`
      );
      const d = await r.json();
      setAvail(d.availability ?? []);
      setBookings(d.bookings ?? []);
      setBlocked(d.blocked ?? []);
    } finally {
      setLoading(false);
    }
  }, [facilityId, from, to]);

  useEffect(() => { load(); }, [load]);

  // Index data
  const availByDow = useMemo(() => {
    const m = new Map<number, AvailDay>();
    avail.forEach((a) => m.set(a.dayOfWeek, a));
    return m;
  }, [avail]);

  const bookingsByDate = useMemo(() => {
    const m = new Map<string, BookingEv[]>();
    bookings.forEach((b) => {
      const k = dateKey(new Date(b.bookingDate));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return m;
  }, [bookings]);

  const blockedByDate = useMemo(() => {
    const m = new Map<string, BlockedEv[]>();
    blocked.forEach((b) => {
      const k = dateKey(new Date(b.date));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return m;
  }, [blocked]);

  // Navigation
  const prevWeek  = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek  = () => setWeekStart((d) => addDays(d,  7));
  const todayWeek = () => setWeekStart(getWeekStart(new Date()));

  const prevMonth  = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth  = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const todayMonth = () => { const n = new Date(); setMonthDate(new Date(n.getFullYear(), n.getMonth(), 1)); };

  // Header label
  const headerLabel = view === "week"
    ? (() => {
        const end = addDays(weekStart, 6);
        const s   = weekStart;
        if (s.getMonth() === end.getMonth()) {
          return `${MONTHS[s.getMonth()]} ${s.getDate()}–${end.getDate()}, ${s.getFullYear()}`;
        }
        return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
      })()
    : `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  if (loadingFac) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-slate-500 text-sm mt-0.5">Bookings, maintenance blocks, and availability in one view</p>
        </div>

        {/* Facility selector */}
        {facilities.length > 1 && (
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name} — {f.city}</option>
            ))}
          </select>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setView("week")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Week
          </button>
          <button
            onClick={() => setView("month")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Month
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={view === "week" ? prevWeek : prevMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[200px] text-center">{headerLabel}</span>
          <button
            onClick={view === "week" ? nextWeek : nextMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={view === "week" ? todayWeek : todayMonth}
            className="ml-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        {/* Loading indicator */}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {/* Legend */}
      <Legend />

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {facilities.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No grounds found. Add a ground first.</p>
          </div>
        ) : view === "week" ? (
          <WeekView
            weekStart={weekStart}
            availByDow={availByDow}
            bookingsByDate={bookingsByDate}
            blockedByDate={blockedByDate}
          />
        ) : (
          <MonthView
            year={monthDate.getFullYear()}
            month={monthDate.getMonth()}
            availByDow={availByDow}
            bookingsByDate={bookingsByDate}
            blockedByDate={blockedByDate}
          />
        )}
      </div>
    </div>
  );
}

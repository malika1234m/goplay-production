"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, CalendarClock, Loader2,
  X, Clock, User, Phone, Mail, CreditCard, StickyNote, CheckCircle2,
  AlertCircle, XCircle, CalendarCheck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Court { id: string; name: string }

interface AvailDay {
  dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string;
}

interface BookingEv {
  id: string; bookingDate: string; startTime: string; endTime: string;
  status: string; playerName: string;
  courtName: string | null; courtId: string | null;
  totalAmount: number; totalHours: number;
  paymentMethod: string; paymentStatus: string;
  contactNumber: string | null; specialRequests: string | null;
  playerEmail: string; playerPhone: string | null;
  isPhoneBooking?: boolean;
}

interface BlockedEv {
  id: string; date: string;
  startTime: string | null; endTime: string | null; reason: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOUR_H = 56;
const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const DAYS_S = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toMins = (t: string) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const pad2   = (n: number) => n.toString().padStart(2,"0");

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate()+n); return r;
}
function getWeekStart(d: Date) {
  const r = new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r;
}
function getMonthGrid(year: number, month: number): (Date|null)[] {
  const first = new Date(year,month,1);
  const last  = new Date(year,month+1,0).getDate();
  const cells: (Date|null)[] = Array(first.getDay()).fill(null);
  for (let d=1; d<=last; d++) cells.push(new Date(year,month,d));
  while (cells.length%7 !== 0) cells.push(null);
  return cells;
}
function fmtTime(t: string) {
  const [h,m] = t.split(":").map(Number);
  const ap = h<12 ? "AM" : "PM"; const hh = h%12||12;
  return m===0 ? `${hh} ${ap}` : `${hh}:${pad2(m)} ${ap}`;
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "Pending",   color: "bg-amber-50  text-amber-700  border-amber-200",  icon: AlertCircle  },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-50   text-blue-700   border-blue-200",   icon: CheckCircle2 },
  COMPLETED: { label: "Completed", color: "bg-green-50  text-green-700  border-green-200",  icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-red-50    text-red-700    border-red-200",    icon: XCircle      },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function BookingDetailModal({ bk, onClose }: { bk: BookingEv; onClose: () => void }) {
  const sm     = STATUS_META[bk.status] ?? STATUS_META.PENDING;
  const Icon   = sm.icon;
  const phone  = bk.contactNumber ?? bk.playerPhone;
  const pmLabel: Record<string, string> = { ONLINE: "Online", ON_ARRIVAL: "Pay on Arrival" };
  const psLabel: Record<string, string> = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed", REFUNDED: "Refunded" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${bk.isPhoneBooking ? "bg-purple-50" : "bg-slate-50"}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {bk.isPhoneBooking && (
                <span className="text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                  📞 Phone / Walk-in
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${sm.color}`}>
                <Icon className="w-3 h-3" /> {sm.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{bk.playerName}</h2>
            {bk.courtName && (
              <span className="mt-0.5 inline-flex items-center text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                {bk.courtName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Date & time */}
          <div className="flex items-start gap-3">
            <CalendarCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(bk.bookingDate)}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                {fmtTime(bk.startTime)} – {fmtTime(bk.endTime)}
                <span className="text-slate-400">·</span>
                {bk.totalHours}h
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              {!bk.isPhoneBooking && (
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{bk.playerEmail}</span>
                </p>
              )}
              {phone && (
                <a href={`tel:${phone}`}
                  className="text-sm text-blue-600 hover:text-blue-500 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {phone}
                </a>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-bold text-slate-800">Rs. {bk.totalAmount.toLocaleString()}</p>
              <span className="text-xs text-slate-400">{pmLabel[bk.paymentMethod] ?? bk.paymentMethod}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                bk.paymentStatus === "PAID"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : bk.paymentStatus === "FAILED"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}>
                {psLabel[bk.paymentStatus] ?? bk.paymentStatus}
              </span>
            </div>
          </div>

          {/* Notes */}
          {bk.specialRequests && (
            <div className="flex items-start gap-3">
              <StickyNote className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-600 italic">{bk.specialRequests}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      {[
        { color:"bg-green-500",  label:"Confirmed"       },
        { color:"bg-purple-400", label:"Phone booking"   },
        { color:"bg-amber-400",  label:"Pending"         },
        { color:"bg-red-400",    label:"Blocked hours"   },
        { color:"bg-orange-400", label:"Full-day closed" },
        { color:"bg-slate-200",  label:"Outside hours"   },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Booking pill (shared by week + day) ─────────────────────────────────────

function BookingPill({
  bk, showCourt = false, onClick,
}: { bk: BookingEv; showCourt?: boolean; onClick?: () => void }) {
  const top   = (toMins(bk.startTime)/60)*HOUR_H;
  const h     = ((toMins(bk.endTime)-toMins(bk.startTime))/60)*HOUR_H;
  const phone = bk.isPhoneBooking;
  const ok    = bk.status === "CONFIRMED";

  const bg  = phone ? "bg-purple-100 border-purple-300"
            : ok    ? "bg-green-100  border-green-300"
            :         "bg-amber-50   border-amber-300";
  const txt = phone ? "text-purple-700"
            : ok    ? "text-green-700"
            :         "text-amber-700";
  const sub = phone ? "text-purple-600"
            : ok    ? "text-green-600"
            :         "text-amber-600";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`absolute inset-x-1 rounded-lg z-20 overflow-hidden px-2 pt-1 border ${bg} ${onClick ? "cursor-pointer hover:brightness-95 transition-[filter]" : ""}`}
      style={{ top, height: Math.max(h, 24) }}
      title={`${phone?"📞 ":""}${bk.playerName}${bk.courtName?` · ${bk.courtName}`:""} · Rs. ${bk.totalAmount.toLocaleString()}`}
    >
      <p className={`text-[10px] font-bold leading-tight ${txt}`}>
        {bk.startTime}–{bk.endTime}
      </p>
      {h >= 24 && (
        <p className={`text-[9px] leading-tight truncate ${sub}`}>
          {phone ? "📞 " : ""}{bk.playerName}
        </p>
      )}
      {showCourt && bk.courtName && h >= 40 && (
        <p className={`text-[8px] leading-tight truncate opacity-70 ${sub}`}>{bk.courtName}</p>
      )}
      {h >= 52 && (
        <p className={`text-[9px] font-semibold ${txt}`}>
          Rs. {bk.totalAmount.toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Day Column Body ──────────────────────────────────────────────────────────

function DayColumn({
  bkList, blList, sched, fullDayBlock, showCourt = false, onBookingClick,
}: {
  bkList: BookingEv[]; blList: BlockedEv[];
  sched: AvailDay | undefined; fullDayBlock: BlockedEv | undefined;
  showCourt?: boolean; onBookingClick?: (bk: BookingEv) => void;
}) {
  const openMins  = sched?.isOpen ? toMins(sched.openTime)  : null;
  const closeMins = sched?.isOpen ? toMins(sched.closeTime) : null;

  return (
    <>
      {HOURS.map((h) => (
        <div key={h} className="absolute w-full border-t border-slate-50" style={{ top: h*HOUR_H }} />
      ))}

      {/* Outside-hours shading */}
      {sched?.isOpen && openMins != null && closeMins != null ? (
        <>
          {openMins > 0 && (
            <div className="absolute inset-x-0 bg-slate-100/70 z-0"
              style={{ top: 0, height: (openMins/60)*HOUR_H }} />
          )}
          {closeMins < 24*60 && (
            <div className="absolute inset-x-0 bg-slate-100/70 z-0"
              style={{ top: (closeMins/60)*HOUR_H, bottom: 0 }} />
          )}
        </>
      ) : (
        !sched?.isOpen && <div className="absolute inset-0 bg-slate-100/70 z-0" />
      )}

      {/* Full-day block */}
      {fullDayBlock && (
        <div className="absolute inset-1 rounded-xl bg-orange-100 border border-orange-200 z-10
                        flex items-center justify-center">
          <p className="text-xs font-semibold text-orange-600 text-center px-2">
            {fullDayBlock.reason ?? "Closed"}
          </p>
        </div>
      )}

      {/* Partial blocks */}
      {!fullDayBlock && blList.filter((b) => b.startTime && b.endTime).map((b) => {
        const top = (toMins(b.startTime!)/60)*HOUR_H;
        const h   = ((toMins(b.endTime!)-toMins(b.startTime!))/60)*HOUR_H;
        return (
          <div key={b.id}
            className="absolute inset-x-1 rounded-md bg-red-100 border border-red-200 z-10
                       overflow-hidden px-1.5 pt-0.5"
            style={{ top, height: Math.max(h,18) }}
            title={b.reason ? `Blocked: ${b.reason}` : "Maintenance"}
          >
            <p className="text-[10px] font-medium text-red-600 leading-tight truncate">
              {b.startTime}–{b.endTime}{b.reason && ` · ${b.reason}`}
            </p>
          </div>
        );
      })}

      {/* Bookings */}
      {!fullDayBlock && bkList.map((bk) => (
        <BookingPill key={bk.id} bk={bk} showCourt={showCourt} onClick={() => onBookingClick?.(bk)} />
      ))}
    </>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({
  date, courts, availByDow, bookingsByDate, blockedByDate, onBookingClick,
}: {
  date: Date; courts: Court[];
  availByDow: Map<number,AvailDay>;
  bookingsByDate: Map<string,BookingEv[]>;
  blockedByDate: Map<string,BlockedEv[]>;
  onBookingClick: (bk: BookingEv) => void;
}) {
  const key    = dateKey(date);
  const dow    = date.getDay();
  const sched  = availByDow.get(dow);
  const allBk  = bookingsByDate.get(key) ?? [];
  const blList = blockedByDate.get(key) ?? [];
  const fullDayBlock = blList.find((b) => !b.startTime || !b.endTime);

  const hasCourts = courts.length > 0;
  type Col = { id: string|null; label: string; bookings: BookingEv[] };

  const columns: Col[] = hasCourts
    ? [
        ...courts.map((c) => ({
          id:       c.id,
          label:    c.name,
          bookings: allBk.filter((b) => b.courtId === c.id),
        })),
        ...(allBk.some((b) => !b.courtId)
          ? [{ id: null, label: "General", bookings: allBk.filter((b) => !b.courtId) }]
          : []),
      ]
    : [{ id: null, label: "All Bookings", bookings: allBk }];

  const minWidth = hasCourts ? `${columns.length * 200 + 56}px` : "420px";

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>

        {/* Court column headers */}
        {hasCourts && (
          <div className="flex border-b border-slate-100">
            <div className="w-14 shrink-0" />
            {columns.map((col) => (
              <div key={col.id ?? "gen"}
                className="flex-1 px-3 py-3 border-l border-slate-100 text-center bg-indigo-50/60">
                <p className="text-xs font-semibold text-indigo-700">{col.label}</p>
                <p className="text-[10px] text-indigo-400 mt-0.5">
                  {col.bookings.length} booking{col.bookings.length !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="relative flex" style={{ height: 24*HOUR_H }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 relative border-r border-slate-100">
            {HOURS.map((h) => (
              <div key={h}
                className="absolute right-2 text-[10px] text-slate-300 -translate-y-2"
                style={{ top: h*HOUR_H }}>
                {h===0 ? "12 AM" : h<12 ? `${h} AM` : h===12 ? "12 PM" : `${h-12} PM`}
              </div>
            ))}
          </div>

          {columns.map((col) => (
            <div key={col.id ?? "gen"}
              className="flex-1 border-l border-slate-100 relative">
              <DayColumn
                bkList={col.bookings}
                blList={blList}
                sched={sched}
                fullDayBlock={fullDayBlock}
                showCourt={false}
                onBookingClick={onBookingClick}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({
  weekStart, availByDow, bookingsByDate, blockedByDate, onDayClick, onBookingClick,
}: {
  weekStart: Date;
  availByDow: Map<number,AvailDay>;
  bookingsByDate: Map<string,BookingEv[]>;
  blockedByDate: Map<string,BlockedEv[]>;
  onDayClick: (d: Date) => void;
  onBookingClick: (bk: BookingEv) => void;
}) {
  const today = dateKey(new Date());
  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">

        {/* Day headers — clickable */}
        <div className="flex border-b border-slate-100">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const key = dateKey(day); const dow = day.getDay();
            const sched = availByDow.get(dow); const isToday = key === today;
            return (
              <button
                key={key}
                onClick={() => onDayClick(day)}
                className={`flex-1 px-2 py-2.5 text-center border-l border-slate-100
                            hover:bg-blue-50 transition-colors group ${isToday ? "bg-blue-50" : ""}`}
              >
                <p className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                  {DAYS_S[dow]}
                </p>
                <p className={`text-lg font-bold leading-tight
                               group-hover:text-blue-700 transition-colors
                               ${isToday ? "text-blue-700" : "text-slate-800"}`}>
                  {day.getDate()}
                </p>
                {sched?.isOpen
                  ? <p className="text-[10px] text-slate-400">{fmtTime(sched.openTime)}–{fmtTime(sched.closeTime)}</p>
                  : <p className="text-[10px] text-red-400">Closed</p>
                }
              </button>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative flex" style={{ height: 24*HOUR_H }}>
          <div className="w-14 shrink-0 relative border-r border-slate-100">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 text-[10px] text-slate-300 -translate-y-2"
                style={{ top: h*HOUR_H }}>
                {h===0 ? "12 AM" : h<12 ? `${h} AM` : h===12 ? "12 PM" : `${h-12} PM`}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = dateKey(day); const dow = day.getDay();
            const sched        = availByDow.get(dow);
            const bkList       = bookingsByDate.get(key) ?? [];
            const blList       = blockedByDate.get(key) ?? [];
            const fullDayBlock = blList.find((b) => !b.startTime || !b.endTime);

            return (
              <div key={key} className="flex-1 border-l border-slate-100 relative">
                <DayColumn
                  bkList={bkList}
                  blList={blList}
                  sched={sched}
                  fullDayBlock={fullDayBlock}
                  showCourt={true}
                  onBookingClick={onBookingClick}
                />
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  year, month, availByDow, bookingsByDate, blockedByDate, onDayClick,
}: {
  year: number; month: number;
  availByDow: Map<number,AvailDay>;
  bookingsByDate: Map<string,BookingEv[]>;
  blockedByDate: Map<string,BlockedEv[]>;
  onDayClick: (d: Date) => void;
}) {
  const today = dateKey(new Date());
  const cells = getMonthGrid(year, month);

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_S.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="border-b border-r border-slate-50 min-h-[100px] bg-slate-50/30" />;
          }

          const key    = dateKey(day);
          const dow    = day.getDay();
          const sched  = availByDow.get(dow);
          const bkList = bookingsByDate.get(key) ?? [];
          const blList = blockedByDate.get(key) ?? [];
          const fullBlock = blList.find((b) => !b.startTime || !b.endTime);
          const partials  = blList.filter((b) => b.startTime && b.endTime);
          const confirmed = bkList.filter((b) => b.status==="CONFIRMED" && !b.isPhoneBooking).length;
          const phone     = bkList.filter((b) => b.isPhoneBooking).length;
          const pending   = bkList.filter((b) => b.status==="PENDING").length;
          const isToday   = key === today;
          const isClosed  = !sched?.isOpen;
          const hasEvents = bkList.length > 0 || blList.length > 0;

          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-slate-100 min-h-[100px] p-2 text-left w-full
                          transition-colors hover:bg-slate-50/80 group
                          ${isClosed || fullBlock ? "bg-slate-50/60" : "bg-white"}`}
            >
              {/* Date number */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5
                               transition-colors group-hover:bg-blue-100
                               ${isToday ? "bg-blue-600 text-white" : "text-slate-700"}`}>
                {day.getDate()}
              </div>

              {isClosed && !fullBlock && (
                <span className="text-[9px] text-slate-400 font-medium">Closed</span>
              )}
              {fullBlock && (
                <div className="rounded-md text-[9px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 mb-0.5 truncate">
                  {fullBlock.reason ?? "Closed"}
                </div>
              )}
              {partials.length > 0 && (
                <div className="rounded-md text-[9px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 mb-0.5">
                  {partials.length} block{partials.length > 1 ? "s" : ""}
                </div>
              )}
              {confirmed > 0 && (
                <div className="rounded-md text-[9px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 mb-0.5">
                  {confirmed} confirmed
                </div>
              )}
              {phone > 0 && (
                <div className="rounded-md text-[9px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 mb-0.5">
                  📞 {phone} phone
                </div>
              )}
              {pending > 0 && (
                <div className="rounded-md text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5">
                  {pending} pending
                </div>
              )}
              {hasEvents && (
                <p className="text-[8px] text-slate-300 font-medium mt-1 group-hover:text-blue-400 transition-colors">
                  View day →
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkerSchedulePage() {
  const [courts,      setCourts]      = useState<Court[]>([]);
  const [courtId,     setCourtId]     = useState("");

  const [view,        setView]        = useState<"day"|"week"|"month">("week");
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [weekStart,   setWeekStart]   = useState(() => getWeekStart(new Date()));
  const [monthDate,   setMonthDate]   = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [avail,      setAvail]      = useState<AvailDay[]>([]);
  const [bookings,   setBookings]   = useState<BookingEv[]>([]);
  const [blocked,    setBlocked]    = useState<BlockedEv[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [selectedBk, setSelectedBk] = useState<BookingEv | null>(null);

  // Reset court filter when switching to day view
  useEffect(() => { if (view === "day") setCourtId(""); }, [view]);

  // Date range
  const { from, to } = useMemo(() => {
    if (view === "day") {
      const k = dateKey(selectedDay); return { from: k, to: k };
    }
    if (view === "week") {
      return { from: dateKey(weekStart), to: dateKey(addDays(weekStart, 6)) };
    }
    const y = monthDate.getFullYear(); const m = monthDate.getMonth();
    return {
      from: `${y}-${pad2(m+1)}-01`,
      to:   dateKey(new Date(y, m+1, 0)),
    };
  }, [view, selectedDay, weekStart, monthDate]);

  // Load schedule
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      // Day view: no court filter (courts shown as columns)
      if (courtId && view !== "day") params.set("courtId", courtId);
      const r = await fetch(`/api/worker/schedule?${params}`);
      const d = await r.json();
      setCourts(d.courts      ?? []);
      setAvail(d.availability  ?? []);
      setBookings(d.bookings   ?? []);
      setBlocked(d.blocked     ?? []);
    } finally { setLoading(false); }
  }, [from, to, courtId, view]);

  useEffect(() => { load(); }, [load]);

  // Index by date
  const availByDow = useMemo(() => {
    const m = new Map<number,AvailDay>();
    avail.forEach((a) => m.set(a.dayOfWeek, a));
    return m;
  }, [avail]);

  const bookingsByDate = useMemo(() => {
    const m = new Map<string,BookingEv[]>();
    bookings.forEach((b) => {
      const k = dateKey(new Date(b.bookingDate));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return m;
  }, [bookings]);

  const blockedByDate = useMemo(() => {
    const m = new Map<string,BlockedEv[]>();
    blocked.forEach((b) => {
      const k = dateKey(new Date(b.date));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    });
    return m;
  }, [blocked]);

  // Jump to day view
  const goDayView = (d: Date) => { setSelectedDay(d); setView("day"); };

  // Navigation
  const prev = () => {
    if (view === "day")   setSelectedDay((d) => addDays(d, -1));
    if (view === "week")  setWeekStart((d) => addDays(d, -7));
    if (view === "month") setMonthDate((d) => new Date(d.getFullYear(), d.getMonth()-1, 1));
  };
  const next = () => {
    if (view === "day")   setSelectedDay((d) => addDays(d, 1));
    if (view === "week")  setWeekStart((d) => addDays(d, 7));
    if (view === "month") setMonthDate((d) => new Date(d.getFullYear(), d.getMonth()+1, 1));
  };
  const goToday = () => {
    const n = new Date();
    setSelectedDay(n);
    setWeekStart(getWeekStart(n));
    setMonthDate(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  // Header label
  const headerLabel = useMemo(() => {
    if (view === "day") {
      return selectedDay.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    }
    if (view === "week") {
      const end = addDays(weekStart, 6); const s = weekStart;
      return s.getMonth() === end.getMonth()
        ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${end.getDate()}, ${s.getFullYear()}`
        : `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  }, [view, selectedDay, weekStart, monthDate]);

  return (
    <div className="flex flex-col gap-5">
      {selectedBk && (
        <BookingDetailModal bk={selectedBk} onClose={() => setSelectedBk(null)} />
      )}

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Bookings and maintenance blocks for your facility
          </p>
        </div>

        {/* Court filter (week/month only — day shows court columns) */}
        {courts.length > 1 && view !== "day" && (
          <select
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
            className="text-sm border border-indigo-200 rounded-lg px-3 py-2 text-slate-700
                       outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Courts</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3
                      flex flex-wrap items-center justify-between gap-3">

        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {([
            { v: "day"   as const, icon: CalendarClock, label: "Day"   },
            { v: "week"  as const, icon: CalendarDays,  label: "Week"  },
            { v: "month" as const, icon: LayoutGrid,    label: "Month" },
          ]).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[220px] text-center">
            {headerLabel}
          </span>
          <button
            onClick={next}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100
                       hover:bg-slate-200 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {/* Legend */}
      <Legend />

      {/* Calendar area */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {view === "day" ? (
          <DayView
            date={selectedDay}
            courts={courts}
            availByDow={availByDow}
            bookingsByDate={bookingsByDate}
            blockedByDate={blockedByDate}
            onBookingClick={setSelectedBk}
          />
        ) : view === "week" ? (
          <WeekView
            weekStart={weekStart}
            availByDow={availByDow}
            bookingsByDate={bookingsByDate}
            blockedByDate={blockedByDate}
            onDayClick={goDayView}
            onBookingClick={setSelectedBk}
          />
        ) : (
          <MonthView
            year={monthDate.getFullYear()}
            month={monthDate.getMonth()}
            availByDow={availByDow}
            bookingsByDate={bookingsByDate}
            blockedByDate={blockedByDate}
            onDayClick={goDayView}
          />
        )}
      </div>

    </div>
  );
}

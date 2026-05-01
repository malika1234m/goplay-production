"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CalendarCheck, Plus, Loader2, X, AlertTriangle,
  CheckCircle2, Clock3, XCircle, User, Phone,
  StickyNote, Calendar, Clock, MapPin, BadgeInfo, History,
} from "lucide-react";

interface Booking {
  id:              string;
  bookingDate:     string;
  startTime:       string;
  endTime:         string;
  status:          string;
  paymentMethod:   string;
  paymentStatus:   string;
  totalAmount:     number;
  playerName:      string;
  playerEmail:     string;
  playerPhone:     string | null;
  contactNumber:   string | null;
  specialRequests: string | null;
}

interface FacilityInfo {
  name:       string;
  city:       string;
  hourlyRate: number;
  availability: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
}

/* ── Helpers ── */
function timeToMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function isoDate(d: Date)      { return d.toISOString().split("T")[0]; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// Strip to YYYY-MM-DD regardless of whether the input is a plain date or a full ISO timestamp
function dateOnly(dateStr: string) { return dateStr.slice(0, 10); }

function isSessionOver(b: Booking) {
  const [h, m]     = b.endTime.split(":").map(Number);
  const sessionEnd = new Date(dateOnly(b.bookingDate) + "T00:00:00");
  sessionEnd.setHours(h, m, 0, 0);
  return sessionEnd <= new Date();
}

function isPastDue(b: Booking) { return b.status === "CONFIRMED" && isSessionOver(b); }

function fmtDate(dateStr: string) {
  const d   = new Date(dateOnly(dateStr) + "T00:00:00");
  const tod = isoDate(new Date());
  const tom = isoDate(addDays(new Date(), 1));
  const key = isoDate(d);
  if (key === tod) return "Today";
  if (key === tom) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtShort(dateStr: string) {
  return new Date(dateOnly(dateStr) + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

const statusColor: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  PENDING:   "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-600",
};

/* ── Section label ── */
function SectionLabel({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div className={`flex items-center gap-2 px-1 mb-1`}>
      <span className={`text-[11px] font-bold uppercase tracking-widest ${accent}`}>{label}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500`}>{count}</span>
    </div>
  );
}

/* ── Booking row ── */
function BookingRow({
  b, pastDue, updating, onConfirm, onComplete, onCancel,
}: {
  b:          Booking;
  pastDue:    boolean;
  updating:   boolean;
  onConfirm:  () => void;
  onComplete: () => void;
  onCancel:   () => void;
}) {
  const isWalkIn    = b.specialRequests?.startsWith("[Walk-in]");
  const displayName = isWalkIn
    ? b.specialRequests!.replace("[Walk-in] ", "").split(" — ")[0]
    : b.playerName;
  const sessionOver = isSessionOver(b);

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${pastDue ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-100"}`}>
      {pastDue && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Session has ended — please mark complete
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {/* Player */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isWalkIn ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
              {displayName[0]?.toUpperCase()}
            </div>
            <span className="font-semibold text-slate-900 text-sm">{displayName}</span>
            {isWalkIn && <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Phone</span>}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[b.status] ?? "bg-slate-100 text-slate-500"}`}>
              {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Date + time */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="font-medium text-slate-700">{fmtDate(b.bookingDate)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {b.startTime} – {b.endTime}
            </span>
            <span className="font-semibold text-slate-800">Rs. {b.totalAmount.toLocaleString()}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.paymentMethod === "ONLINE" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
              {b.paymentMethod === "ONLINE" ? "Online" : "Cash"}
            </span>
          </div>

          {/* Contact */}
          {b.contactNumber && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {b.contactNumber}
              </span>
              <a
                href={`tel:${b.contactNumber}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-blue-500 hover:bg-blue-600 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Phone className="w-3 h-3" /> Call
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {b.status === "PENDING" && (
            <button onClick={onConfirm} disabled={updating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-lg transition-colors">
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirm
            </button>
          )}
          {b.status === "CONFIRMED" && (
            <button onClick={sessionOver ? onComplete : undefined} disabled={updating || !sessionOver}
              title={!sessionOver ? "Session hasn't ended yet" : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                pastDue
                  ? "text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40"
                  : sessionOver
                  ? "text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                  : "text-slate-400 bg-slate-100 cursor-not-allowed"
              }`}>
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
              {sessionOver ? "Complete" : "Ongoing"}
            </button>
          )}
          {(b.status === "PENDING" || b.status === "CONFIRMED") && (
            <button onClick={onCancel} disabled={updating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 rounded-lg transition-colors">
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Walk-in / Phone Booking modal ── */
interface WalkInModalProps {
  facility:  FacilityInfo | null;
  onClose:   () => void;
  onCreated: () => void;
}

function WalkInModal({ facility, onClose, onCreated }: WalkInModalProps) {
  const today = isoDate(new Date());
  const [bookingDate,   setBookingDate]   = useState(today);
  const [startTime,     setStartTime]     = useState("08:00");
  const [endTime,       setEndTime]       = useState("09:00");
  const [playerName,    setPlayerName]    = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [daySchedule,   setDaySchedule]   = useState<{ openTime: string; closeTime: string; closed: boolean } | null>(null);

  useEffect(() => {
    if (!facility || !bookingDate) return;
    const dow = new Date(bookingDate + "T00:00:00").getDay();
    const sched = facility.availability.find((a) => a.dayOfWeek === dow);
    if (!sched || !sched.isOpen) setDaySchedule({ openTime: "", closeTime: "", closed: true });
    else setDaySchedule({ openTime: sched.openTime, closeTime: sched.closeTime, closed: false });
  }, [facility, bookingDate]);

  const durationMins  = Math.max(0, timeToMins(endTime) - timeToMins(startTime));
  const durationHrs   = durationMins / 60;
  const estimatedAmt  = facility ? Math.round(durationHrs * facility.hourlyRate) : 0;
  const isToday       = bookingDate === today;
  const isTomorrow    = bookingDate === isoDate(addDays(new Date(), 1));

  const handleSubmit = async () => {
    setError("");
    if (!bookingDate || !startTime || !endTime || !playerName.trim()) { setError("Please fill in all required fields."); return; }
    if (startTime >= endTime) { setError("Start time must be before end time."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingDate, startTime, endTime, playerName: playerName.trim(), contactNumber: contactNumber.trim() || undefined, specialRequests: notes.trim() || undefined }),
      });
      const d = await res.json();
      if (res.ok) { onCreated(); }
      else        { setError(d.error ?? "Failed to create booking."); }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Add Phone Booking</h3>
              <p className="text-xs text-slate-400">{facility ? `${facility.name} · ${facility.city}` : "Loading…"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Booking Time */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Booking Time</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" /> Date *
                </label>
                <div className="relative">
                  <input type="date" value={bookingDate} min={today} onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {(isToday || isTomorrow) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full pointer-events-none">
                      {isToday ? "Today" : "Tomorrow"}
                    </span>
                  )}
                </div>
                {bookingDate && <p className="text-xs text-slate-400 mt-1">{fmtShort(bookingDate)}</p>}
                {daySchedule?.closed && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Facility is normally closed on this day.
                  </p>
                )}
                {daySchedule && !daySchedule.closed && (
                  <p className="text-xs text-slate-400 mt-1">Operating hours: {daySchedule.openTime} – {daySchedule.closeTime}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Start Time *
                  </label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> End Time *
                  </label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {durationMins > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Clock3 className="w-4 h-4" />
                    <span className="font-semibold">
                      {durationHrs % 1 === 0 ? `${durationHrs} hr${durationHrs !== 1 ? "s" : ""}` : `${durationHrs.toFixed(1)} hrs`}
                    </span>
                    <span className="text-blue-400 text-xs">· {startTime} to {endTime}</span>
                  </div>
                  {facility && (
                    <div className="text-right">
                      <p className="text-xs text-blue-400">Estimated</p>
                      <p className="text-sm font-bold text-blue-700">Rs. {estimatedAmt.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Player Details */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Player Details</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" /> Player Name *
                </label>
                <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="e.g. Ashan Fernando"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-500" /> Contact Number
                </label>
                <input type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="07X XXX XXXX"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-blue-500" /> Notes
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300 resize-none" />
              </div>
            </div>
          </div>

          {/* Summary */}
          {playerName.trim() && durationMins > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Booking Summary</p>
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm overflow-hidden">
                  {[
                    { icon: MapPin,    label: "Ground",   value: facility ? `${facility.name}, ${facility.city}` : "—" },
                    { icon: User,      label: "Player",   value: playerName.trim() },
                    { icon: Calendar,  label: "Date",     value: bookingDate ? fmtShort(bookingDate) : "—" },
                    { icon: Clock,     label: "Time",     value: `${startTime} – ${endTime}` },
                    { icon: Clock3,    label: "Duration", value: durationHrs % 1 === 0 ? `${durationHrs} hr${durationHrs !== 1 ? "s" : ""}` : `${durationHrs.toFixed(1)} hrs` },
                    { icon: BadgeInfo, label: "Amount",   value: facility ? `Rs. ${estimatedAmt.toLocaleString()} (cash on arrival)` : "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-400 w-20 shrink-0">{label}</span>
                      <span className="font-medium text-slate-800 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}

          <div className="flex gap-3 pb-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cash confirmation modal ── */
function CashModal({ onConfirm, onClose, updating }: { onConfirm: (r: boolean) => void; onClose: () => void; updating: boolean }) {
  const [received, setReceived] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <h3 className="font-semibold text-slate-900 text-base">Confirm Cash Payment</h3>
        <p className="text-sm text-slate-500">Did you receive the cash payment for this session?</p>
        <div className="flex gap-2">
          <button onClick={() => setReceived(true)} className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${received ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"}`}>Yes, received</button>
          <button onClick={() => setReceived(false)} className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${!received ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>Not yet</button>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
          <button onClick={() => onConfirm(received)} disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors">
            {updating && <Loader2 className="w-4 h-4 animate-spin" />}
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function WorkerBookingsPage() {
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [updating,   setUpdating]   = useState<string | null>(null);
  const [facility,   setFacility]   = useState<FacilityInfo | null>(null);
  const [cashTarget, setCashTarget] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/worker/facility").then((r) => r.json()).then((d) => { if (d.facility) setFacility(d.facility); });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/worker/bookings");
      const d = await r.json();
      setBookings(d.bookings ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED", cashReceived?: boolean) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/worker/bookings/${id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, cashReceived }),
      });
      const d = await res.json();
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      } else {
        alert(d.error ?? "Failed to update.");
      }
    } finally {
      setUpdating(null);
      setCashTarget(null);
    }
  };

  const handleComplete = (b: Booking) => {
    if (b.paymentMethod === "ON_ARRIVAL" && b.paymentStatus !== "PAID") {
      setCashTarget(b.id);
    } else {
      updateStatus(b.id, "COMPLETED");
    }
  };

  /* ── Priority sort ── */
  const pastDue          = bookings.filter(isPastDue);
  const pendingUpcoming  = bookings.filter((b) => b.status === "PENDING").sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime));
  const confirmedUpcoming = bookings.filter((b) => b.status === "CONFIRMED" && !isPastDue(b)).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime));
  const completed        = bookings.filter((b) => b.status === "COMPLETED").sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  const cancelled        = bookings.filter((b) => b.status === "CANCELLED").sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

  const totalActive = pastDue.length + pendingUpcoming.length + confirmedUpcoming.length;

  const renderSection = (items: Booking[], isPD = false) =>
    items.map((b) => (
      <BookingRow
        key={b.id}
        b={b}
        pastDue={isPD}
        updating={updating === b.id}
        onConfirm={() => updateStatus(b.id, "CONFIRMED")}
        onComplete={() => handleComplete(b)}
        onCancel={() => { if (confirm(`Cancel booking for ${b.specialRequests?.startsWith("[Walk-in]") ? b.specialRequests.replace("[Walk-in] ", "").split(" — ")[0] : b.playerName}?`)) updateStatus(b.id, "CANCELLED"); }}
      />
    ));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalActive > 0 ? `${totalActive} active booking${totalActive !== 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/worker/booking-history"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <History className="w-4 h-4" /> View History
          </Link>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add Phone Booking
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Past Due",  value: pastDue.length,           color: "text-amber-600" },
          { label: "Pending",   value: pendingUpcoming.length,   color: "text-amber-500" },
          { label: "Confirmed", value: confirmedUpcoming.length, color: "text-green-600" },
          { label: "Completed", value: completed.length,         color: "text-blue-600"  },
          { label: "Cancelled", value: cancelled.length,         color: "text-red-500"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Booking list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading bookings…</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
          <CalendarCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No bookings in the next 60 days</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* 1. Past due — needs action */}
          {pastDue.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel label="Needs Action — Mark Complete" count={pastDue.length} accent="text-amber-600" />
              {renderSection(pastDue, true)}
            </div>
          )}

          {/* 2. Pending requests */}
          {pendingUpcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel label="Pending Requests" count={pendingUpcoming.length} accent="text-amber-500" />
              {renderSection(pendingUpcoming)}
            </div>
          )}

          {/* 3. Confirmed upcoming */}
          {confirmedUpcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel label="Confirmed Upcoming" count={confirmedUpcoming.length} accent="text-green-600" />
              {renderSection(confirmedUpcoming)}
            </div>
          )}

          {/* 4. Completed */}
          {completed.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel label="Completed" count={completed.length} accent="text-blue-500" />
              {renderSection(completed)}
            </div>
          )}

          {/* 5. Cancelled */}
          {cancelled.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel label="Cancelled" count={cancelled.length} accent="text-slate-400" />
              {renderSection(cancelled)}
            </div>
          )}
        </div>
      )}

      {/* Cash modal */}
      {cashTarget && (
        <CashModal
          updating={updating === cashTarget}
          onClose={() => setCashTarget(null)}
          onConfirm={(r) => updateStatus(cashTarget, "COMPLETED", r)}
        />
      )}

      {/* Phone booking modal */}
      {showModal && (
        <WalkInModal
          facility={facility}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

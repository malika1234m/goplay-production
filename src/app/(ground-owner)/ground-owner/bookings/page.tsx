"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Search, Loader2, CheckCircle, XCircle,
  Check, CreditCard, Banknote, AlertTriangle, ChevronDown, Bell, UserPlus, X,
  User, Phone, StickyNote, Clock3, BadgeInfo, CheckCircle2, PhoneCall, History,
} from "lucide-react";

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isoDateStr(d: Date) { return d.toISOString().split("T")[0]; }

function dateOnly(dateStr: string) { return dateStr.slice(0, 10); }

function fmtShort(dateStr: string) {
  return new Date(dateOnly(dateStr) + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

interface Booking {
  id:              string;
  bookingDate:     string;
  startTime:       string;
  endTime:         string;
  totalHours:      number;
  totalAmount:     number;
  status:          string;
  paymentMethod:   "ONLINE" | "ON_ARRIVAL";
  paymentStatus:   "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  contactNumber:   string | null;
  specialRequests: string | null;
  createdAt:       string;
  user:     { name: string; email: string; phone: string | null };
  facility: { name: string; city: string };
}

/* True when the session's end time has already passed */
function isSessionOver(b: Booking): boolean {
  const [h, m] = b.endTime.split(":").map(Number);
  const sessionEnd = new Date(b.bookingDate);
  sessionEnd.setHours(h, m, 0, 0);
  return sessionEnd < new Date();
}

/* Past-due = CONFIRMED and session is over (needs action banner) */
function isPastDue(b: Booking): boolean {
  return b.status === "CONFIRMED" && isSessionOver(b);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function PaymentBadge({ method, pStatus }: { method: string; pStatus: string }) {
  if (method === "ONLINE") {
    if (pStatus === "PAID")     return <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"><CreditCard className="w-3 h-3" />Paid Online</span>;
    if (pStatus === "FAILED")   return <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium"><CreditCard className="w-3 h-3" />Payment Failed</span>;
    if (pStatus === "REFUNDED") return <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium"><CreditCard className="w-3 h-3" />Refunded</span>;
    return <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium"><CreditCard className="w-3 h-3" />Awaiting Online Payment</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium"><Banknote className="w-3 h-3" />Cash on Arrival</span>;
}

const statusStyles: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-100",
  CONFIRMED: "bg-green-50 text-green-700 border-green-100",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-100",
};

/* ── Complete booking modal ── */
interface CompleteModalProps {
  booking: Booking;
  onClose: () => void;
  onConfirm: (cashReceived: boolean) => void;
  loading: boolean;
}

function CompleteModal({ booking, onClose, onConfirm, loading }: CompleteModalProps) {
  const isCash = booking.paymentMethod === "ON_ARRIVAL";
  const [cashReceived, setCashReceived] = useState<boolean | null>(isCash ? null : true);

  const canConfirm = !isCash || cashReceived !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Mark Session Complete</h3>
            <p className="text-xs text-slate-400">Confirm the session has finished</p>
          </div>
        </div>

        {/* Booking summary */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Player</span>
            <span className="font-medium text-slate-800">{booking.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="font-medium text-slate-800">{formatDate(booking.bookingDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Time</span>
            <span className="font-medium text-slate-800">{booking.startTime} – {booking.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ground</span>
            <span className="font-medium text-slate-800">{booking.facility.name}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-bold text-slate-900">Rs. {booking.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Cash payment question */}
        {isCash && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Banknote className="w-4 h-4 text-emerald-600" />
              Did you receive the cash payment?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCashReceived(true)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  cashReceived === true
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <Check className="w-4 h-4" />
                Yes, received
              </button>
              <button
                onClick={() => setCashReceived(false)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  cashReceived === false
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <XCircle className="w-4 h-4" />
                Not yet
              </button>
            </div>
            {cashReceived === false && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Booking will be marked complete but payment will remain as pending. You can follow up with the player directly.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(cashReceived!)}
            disabled={!canConfirm || loading}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Booking card ── */
interface BookingCardProps {
  booking: Booking;
  pastDue: boolean;
  sessionOver: boolean;
  updating: boolean;
  onConfirmBooking:  () => void;
  onCancelBooking:   () => void;
  onMarkComplete:    () => void;
}

function BookingCard({ booking: b, pastDue, sessionOver, updating, onConfirmBooking, onCancelBooking, onMarkComplete }: BookingCardProps) {
  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${
      pastDue ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-100"
    }`}>
      {/* Past-due warning strip */}
      {pastDue && (
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Session date has passed — please mark this booking as complete
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Player */}
          {(() => {
            const isWalkIn = b.specialRequests?.startsWith("[Walk-in]");
            const walkInName = isWalkIn
              ? b.specialRequests!.replace("[Walk-in] ", "").split(" — ")[0]
              : null;
            const displayName  = walkInName ?? b.user.name;
            const displayEmail = isWalkIn ? "Phone booking" : b.user.email;
            return (
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isWalkIn ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                }`}>
                  {displayName[0].toUpperCase()}
                </div>
                <span className="font-semibold text-slate-900">{displayName}</span>
                {isWalkIn && (
                  <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Phone</span>
                )}
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500">{displayEmail}</span>
              </div>
            );
          })()}

          <div className="flex items-center gap-1 text-slate-400 text-sm mb-2">
            <MapPin className="w-3.5 h-3.5" />
            {b.facility.name}, {b.facility.city}
          </div>

          <div className="mb-3">
            <PaymentBadge method={b.paymentMethod} pStatus={b.paymentStatus} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(b.bookingDate)}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {b.startTime} – {b.endTime}
              <span className="text-slate-400 text-xs">
                ({b.totalHours} {b.totalHours === 1 ? "hr" : "hrs"})
              </span>
            </div>
            <span className="font-semibold text-slate-900">Rs. {b.totalAmount.toLocaleString()}</span>
          </div>

          {b.specialRequests && (() => {
            const isWalkIn = b.specialRequests.startsWith("[Walk-in]");
            const note = isWalkIn
              ? b.specialRequests.replace("[Walk-in] ", "").split(" — ")[1]
              : b.specialRequests;
            return note
              ? <p className="mt-2 text-xs text-slate-500 italic">&ldquo;{note}&rdquo;</p>
              : null;
          })()}

          {(() => {
            const isWalkIn = b.specialRequests?.startsWith("[Walk-in]");
            const phone = b.contactNumber ?? (!isWalkIn ? b.user.phone : null);
            return phone ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <PhoneCall className="w-3 h-3 text-slate-400" />
                  {phone}
                </span>
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <PhoneCall className="w-3 h-3" />
                  Call
                </a>
              </div>
            ) : null;
          })()}
        </div>

        {/* Status + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyles[b.status]}`}>
            {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
          </span>

          {b.status === "PENDING" && (
            <div className="flex gap-2">
              <button
                onClick={onConfirmBooking}
                disabled={updating}
                className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Confirm
              </button>
              <button
                onClick={onCancelBooking}
                disabled={updating}
                className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3 h-3" />
                Cancel
              </button>
            </div>
          )}

          {b.status === "CONFIRMED" && (
            <div className="relative group">
              <button
                onClick={sessionOver ? onMarkComplete : undefined}
                disabled={updating || !sessionOver}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  !sessionOver
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : pastDue
                    ? "bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
                }`}
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Mark Complete
              </button>
              {!sessionOver && (
                <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10 whitespace-nowrap bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 pointer-events-none">
                  Session hasn&apos;t ended yet
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Walk-in modal ── */
interface FacilityOption { id: string; name: string; city: string; status: string; hourlyRate: number }

interface WalkInModalProps {
  facilities: FacilityOption[];
  onClose:    () => void;
  onCreated:  (booking: Booking) => void;
}

function WalkInModal({ facilities, onClose, onCreated }: WalkInModalProps) {
  const activeFacilities = facilities.filter((f) => f.status === "ACTIVE");
  const today = isoDateStr(new Date());

  const [facilityId,    setFacilityId]    = useState(activeFacilities[0]?.id ?? "");
  const [bookingDate,   setBookingDate]   = useState(today);
  const [startTime,     setStartTime]     = useState("08:00");
  const [endTime,       setEndTime]       = useState("09:00");
  const [playerName,    setPlayerName]    = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes,         setNotes]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [daySchedule,   setDaySchedule]   = useState<{ openTime: string; closeTime: string; closed: boolean } | null>(null);

  // Fetch operating hours whenever facility or date changes
  useEffect(() => {
    if (!facilityId || !bookingDate) { setDaySchedule(null); return; }
    fetch(`/api/grounds/${facilityId}/availability?date=${bookingDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.slots && d.slots.length === 0 && d.message) {
          setDaySchedule({ openTime: "", closeTime: "", closed: true });
        } else if (d.openTime && d.closeTime) {
          setDaySchedule({ openTime: d.openTime, closeTime: d.closeTime, closed: false });
        } else {
          setDaySchedule(null);
        }
      })
      .catch(() => setDaySchedule(null));
  }, [facilityId, bookingDate]);

  const selectedFacility = useMemo(
    () => activeFacilities.find((f) => f.id === facilityId) ?? null,
    [facilityId, activeFacilities]
  );

  const durationMins = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const diff = timeToMins(endTime) - timeToMins(startTime);
    return diff > 0 ? diff : 0;
  }, [startTime, endTime]);

  const durationHrs  = durationMins / 60;
  const estimatedAmt = selectedFacility ? Math.round(durationHrs * selectedFacility.hourlyRate) : 0;

  const isToday    = bookingDate === today;
  const isTomorrow = bookingDate === isoDateStr(new Date(Date.now() + 86400000));

  const handleSubmit = async () => {
    setError("");
    if (!facilityId || !bookingDate || !startTime || !endTime || !playerName.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (playerName.trim().length < 2) { setError("Player name must be at least 2 characters."); return; }
    if (startTime >= endTime)         { setError("Start time must be before end time."); return; }
    if (contactNumber.trim()) {
      const cleaned = contactNumber.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
        setError("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567).");
        return;
      }
    }
    setSaving(true);
    const res  = await fetch("/api/ground-owner/bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ facilityId, bookingDate, startTime, endTime, playerName: playerName.trim(), contactNumber: contactNumber.trim() || undefined, notes: notes.trim() || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create phone booking.");
    } else {
      onCreated(data.booking);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Add Phone Booking</h3>
              <p className="text-xs text-slate-400">Cash on arrival · no platform commission</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Section 1: Ground ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Ground</p>
            {activeFacilities.length > 1 ? (
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
              >
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} — {f.city}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium">{activeFacilities[0]?.name}</span>
                <span className="text-slate-400">— {activeFacilities[0]?.city}</span>
              </div>
            )}
            {selectedFacility && (
              <p className="text-xs text-slate-400 mt-1.5 ml-0.5">
                Rate: Rs. {selectedFacility.hourlyRate.toLocaleString()} / hr
              </p>
            )}
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Section 2: Booking Time ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Booking Time</p>
            <div className="space-y-3">

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-green-500" />
                  Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={bookingDate}
                    min={today}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {(isToday || isTomorrow) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full pointer-events-none">
                      {isToday ? "Today" : "Tomorrow"}
                    </span>
                  )}
                </div>
                {bookingDate && (
                  <p className="text-xs text-slate-400 mt-1 ml-0.5">{fmtShort(bookingDate)}</p>
                )}
                {daySchedule?.closed && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Facility is normally closed on this day. You can still add a booking if an exception applies.
                  </p>
                )}
                {daySchedule && !daySchedule.closed && (
                  <p className="text-xs text-slate-400 mt-1 ml-0.5">
                    Operating hours: {daySchedule.openTime} – {daySchedule.closeTime}
                  </p>
                )}
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-green-500" />
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-green-500" />
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Live duration + amount bar */}
              {durationMins > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Clock3 className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">
                      {durationMins < 60
                        ? `${durationMins} min`
                        : durationHrs % 1 === 0
                        ? `${durationHrs} hr${durationHrs !== 1 ? "s" : ""}`
                        : `${durationHrs.toFixed(1)} hrs`}
                    </span>
                    <span className="text-green-400 text-xs">· {startTime} to {endTime}</span>
                  </div>
                  {selectedFacility && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-green-400">Estimated</p>
                      <p className="text-sm font-bold text-green-700">Rs. {estimatedAmt.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Section 3: Player Details ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Player Details</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-green-500" />
                  Player Name *
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Ashan Fernando"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-green-500" />
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="07X XXX XXXX"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-green-500" />
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or notes from the caller…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300 resize-none"
                />
              </div>
            </div>
          </div>

          {/* ── Booking summary card ── */}
          {playerName.trim() && durationMins > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Booking Summary</p>
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm overflow-hidden">
                  {[
                    { icon: MapPin,    label: "Ground",   value: selectedFacility ? `${selectedFacility.name}, ${selectedFacility.city}` : "—" },
                    { icon: User,      label: "Player",   value: playerName.trim() },
                    { icon: Calendar,  label: "Date",     value: bookingDate ? fmtShort(bookingDate) : "—" },
                    { icon: Clock,     label: "Time",     value: `${startTime} – ${endTime}` },
                    { icon: Clock3,    label: "Duration", value: durationHrs % 1 === 0 ? `${durationHrs} hr${durationHrs !== 1 ? "s" : ""}` : `${durationHrs.toFixed(1)} hrs` },
                    { icon: BadgeInfo, label: "Amount",   value: selectedFacility ? `Rs. ${estimatedAmt.toLocaleString()} (cash on arrival)` : "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-400 w-20 shrink-0">{label}</span>
                      <span className="font-medium text-slate-800 min-w-0 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function GroundOwnerBookingsPage() {
  const [bookings,       setBookings]       = useState<Booking[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [statusFilter,   setStatusFilter]   = useState("");
  const [search,         setSearch]         = useState("");
  const [updating,       setUpdating]       = useState<string | null>(null);
  const [error,          setError]          = useState("");
  const [completeTarget, setCompleteTarget] = useState<Booking | null>(null);
  const [showWalkIn,     setShowWalkIn]     = useState(false);
  const [facilities,     setFacilities]     = useState<FacilityOption[]>([]);
  const needsActionRef   = useRef<HTMLDivElement>(null);

  // Load facilities once for the walk-in modal
  useEffect(() => {
    fetch("/api/ground-owner/grounds")
      .then((r) => r.json())
      .then((d) => setFacilities(d.grounds ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const url = statusFilter
      ? `/api/ground-owner/bookings?status=${statusFilter}`
      : "/api/ground-owner/bookings";
    const res  = await fetch(url);
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  /* Generic status update (Confirm / Cancel) */
  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    setError("");
    const res  = await fetch(`/api/ground-owner/bookings/${id}/status`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    const data = await res.json();
    setUpdating(null);
    if (!res.ok) {
      setError(data.error ?? "Failed to update status.");
    } else {
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
    }
  };

  /* Complete booking — called from modal with cash decision */
  const handleComplete = async (cashReceived: boolean) => {
    if (!completeTarget) return;
    const id = completeTarget.id;
    setUpdating(id);
    setError("");
    const res  = await fetch(`/api/ground-owner/bookings/${id}/status`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "COMPLETED", cashReceived }),
    });
    const data = await res.json();
    setUpdating(null);
    setCompleteTarget(null);
    if (!res.ok) {
      setError(data.error ?? "Failed to update status.");
    } else {
      const newPaymentStatus = completeTarget.paymentMethod === "ON_ARRIVAL"
        ? (cashReceived ? "PAID" : "PENDING")
        : completeTarget.paymentStatus;
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status: "COMPLETED", paymentStatus: newPaymentStatus } : b
        )
      );
    }
  };

  const filtered = bookings.filter(
    (b) => {
      const term = search.toLowerCase();
      const isWalkIn = b.specialRequests?.startsWith("[Walk-in]");
      const walkInName = isWalkIn ? b.specialRequests!.replace("[Walk-in] ", "").split(" — ")[0] : null;
      return (
        (walkInName ?? b.user.name).toLowerCase().includes(term) ||
        b.facility.name.toLowerCase().includes(term)
      );
    }
  );

  const byDateAsc  = (a: Booking, b: Booking) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime);
  const byDateDesc = (a: Booking, b: Booking) => b.bookingDate.localeCompare(a.bookingDate) || b.startTime.localeCompare(a.startTime);

  const pastDueGroup      = filtered.filter(isPastDue).sort(byDateAsc);
  const pendingGroup      = filtered.filter((b) => b.status === "PENDING").sort(byDateAsc);
  const confirmedGroup    = filtered.filter((b) => b.status === "CONFIRMED" && !isPastDue(b)).sort(byDateAsc);
  const completedGroup    = filtered.filter((b) => b.status === "COMPLETED").sort(byDateDesc);
  const cancelledGroup    = filtered.filter((b) => b.status === "CANCELLED").sort(byDateDesc);

  const pendingCount  = bookings.filter((b) => b.status === "PENDING").length;
  const pastDueCount  = bookings.filter(isPastDue).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage all bookings for your grounds
            {pendingCount > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/ground-owner/booking-history"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <History className="w-4 h-4" />
            View History
          </Link>
          {facilities.some((f) => f.status === "ACTIVE") && (
            <button
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Phone Booking
            </button>
          )}
        </div>
      </div>

      {/* Needs Action Banner */}
      {pastDueCount > 0 && !statusFilter && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pastDueCount} booking{pastDueCount > 1 ? "s" : ""} need{pastDueCount === 1 ? "s" : ""} to be marked complete
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                These sessions have already taken place. Please confirm completion and verify any cash payments.
              </p>
            </div>
          </div>
          <button
            onClick={() => needsActionRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            View
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by player name or ground..."
            className="bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading bookings...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No bookings found</h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            {search || statusFilter
              ? "Try adjusting your search or filter."
              : "Bookings from players will appear here once they book your grounds."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6" ref={needsActionRef}>

          {/* 1. Past-due — needs action */}
          {pastDueGroup.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 px-1">
                Needs Action — Mark Complete ({pastDueGroup.length})
              </p>
              {pastDueGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => updateStatus(b.id, "CANCELLED")}
                  onMarkComplete={() => setCompleteTarget(b)} />
              ))}
            </div>
          )}

          {/* 2. Pending requests */}
          {pendingGroup.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500 px-1">
                Pending Requests ({pendingGroup.length})
              </p>
              {pendingGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => updateStatus(b.id, "CANCELLED")}
                  onMarkComplete={() => setCompleteTarget(b)} />
              ))}
            </div>
          )}

          {/* 3. Confirmed upcoming */}
          {confirmedGroup.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-600 px-1">
                Confirmed Upcoming ({confirmedGroup.length})
              </p>
              {confirmedGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => updateStatus(b.id, "CANCELLED")}
                  onMarkComplete={() => setCompleteTarget(b)} />
              ))}
            </div>
          )}

          {/* 4. Completed */}
          {completedGroup.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1">
                Completed ({completedGroup.length})
              </p>
              {completedGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => updateStatus(b.id, "CANCELLED")}
                  onMarkComplete={() => setCompleteTarget(b)} />
              ))}
            </div>
          )}

          {/* 5. Cancelled */}
          {cancelledGroup.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 px-1">
                Cancelled ({cancelledGroup.length})
              </p>
              {cancelledGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => updateStatus(b.id, "CANCELLED")}
                  onMarkComplete={() => setCompleteTarget(b)} />
              ))}
            </div>
          )}

          {pastDueGroup.length + pendingGroup.length + confirmedGroup.length + completedGroup.length + cancelledGroup.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-sm text-slate-400">No bookings match your search.</p>
            </div>
          )}
        </div>
      )}

      {/* Complete modal */}
      {completeTarget && (
        <CompleteModal
          booking={completeTarget}
          loading={updating === completeTarget.id}
          onClose={() => setCompleteTarget(null)}
          onConfirm={handleComplete}
        />
      )}

      {/* Walk-in modal */}
      {showWalkIn && (
        <WalkInModal
          facilities={facilities}
          onClose={() => setShowWalkIn(false)}
          onCreated={(booking) => {
            setShowWalkIn(false);
            setBookings((prev) => [booking, ...prev]);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CalendarCheck, Plus, Loader2, X, AlertTriangle, CheckCircle2, Clock3, XCircle, User, Phone, StickyNote, Calendar, Clock, MapPin, BadgeInfo, History, UserX, ShieldAlert,
} from "lucide-react";
import { TimeRangePicker } from "@/components/booking/TimeRangePicker";
import ActionInbox, { type InboxCounts } from "@/components/payments/ActionInbox";
import { RowAmount, RowGroup, RowTag, RowWhen, RowWho, TypeBadge, TypeLegend, bookingType, primaryBtn, quietBtn, typedRow } from "@/components/payments/BookingRow";
import { tk, formatDay } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

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
  courtName:       string | null;
  isOpenMatch?:    boolean;
  isPhoneBooking?: boolean;
  openMatchId?:    string | null;
}

interface FacilityInfo {
  id:         string;
  name:       string;
  city:       string;
  hourlyRate: number;
  courts:     { id: string; name: string }[];
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


function fmtShort(dateStr: string, locale: string) {
  return formatDay(new Date(dateOnly(dateStr) + "T00:00:00"), locale, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}


/* ── Cancel warning modal ── */
function CancelWarningModal({
  booking, onConfirm, onClose, updating,
}: {
  booking: Booking;
  onConfirm: () => void;
  onClose:   () => void;
  updating:  boolean;
}) {
  const { t, locale } = useT();
  const isOnline = booking.paymentMethod === "ONLINE";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t("Cancel Booking?")}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {booking.playerName}
              {" · "}{formatDay(new Date(dateOnly(booking.bookingDate) + "T00:00:00"), locale, { weekday: "short", month: "short", day: "numeric" })}
              {" · "}{booking.startTime}–{booking.endTime}
            </p>
          </div>
        </div>

        {/* Refund info */}
        <div className={`rounded-xl border p-4 text-sm ${isOnline ? "bg-blue-50 border-blue-100 text-blue-800" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
          {isOnline ? (
            <p>{t("The player paid online. Cancelling means the ground owes them a full refund of Rs. {amount}. The owner sends it back and marks it sent under Receipts.", { amount: booking.totalAmount.toLocaleString() })}</p>
          ) : (
            <p>{t("This is a cash booking — no payment was collected online.")}</p>
          )}
        </div>

        {/* Strike warning */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 space-y-1">
            <p className="font-semibold">{t("This will add a strike to your facility.")}</p>
            <p>{t("3 strikes within 90 days automatically suspends the facility listing. The admin will be notified that you cancelled this booking.")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-medium">
            {t("Keep Booking")}
          </button>
          <button onClick={onConfirm} disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors">
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {t("Yes, Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── No-show warning modal ── */
function NoShowModal({
  booking, onConfirm, onClose, updating,
}: {
  booking: Booking;
  onConfirm: () => void;
  onClose:   () => void;
  updating:  boolean;
}) {
  const { t, locale } = useT();
  const isOnline = booking.paymentMethod === "ONLINE";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t("Mark as No-Show?")}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {booking.playerName}
              {" · "}{formatDay(new Date(dateOnly(booking.bookingDate) + "T00:00:00"), locale, { weekday: "short", month: "short", day: "numeric" })}
              {" · "}{booking.startTime}–{booking.endTime}
            </p>
          </div>
        </div>

        {/* Payment context */}
        <div className={`rounded-xl border p-4 text-sm ${isOnline ? "bg-blue-50 border-blue-100 text-blue-800" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
          {isOnline ? (
            <p><span className="font-semibold">{t("Online payment was collected.")}</span> {t("The facility keeps the payment — no refund is issued for no-shows.")}</p>
          ) : (
            <p>{t("This was a cash booking — no payment was collected. The slot was held and not used.")}</p>
          )}
        </div>

        {/* Consequence warning */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 space-y-1">
            <p className="font-semibold">{t("Consequences for the player:")}</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-600">
              <li>{t("1st no-show — warning")}</li>
              <li>{t("2nd no-show — must pay online for all future bookings")}</li>
              <li>{t("3rd no-show — account suspended from booking")}</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-medium">
            {t("Cancel")}
          </button>
          <button onClick={onConfirm} disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-colors">
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            {t("Mark No-Show")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Section label ── */

/* ── Booking row ── */
function BookingRow({
  b, pastDue, updating, onConfirm, onComplete, onCancel, onNoShow,
}: {
  b:          Booking;
  pastDue:    boolean;
  updating:   boolean;
  onConfirm:  () => void;
  onComplete: () => void;
  onCancel:   () => void;
  onNoShow:   () => void;
}) {
  const { t } = useT();
  const isOpenMatch = b.isOpenMatch ?? false;
  const sessionOver = isSessionOver(b);
  const phone = isOpenMatch ? null : b.contactNumber ?? b.playerPhone;
  const awaitingTransfer = b.status === "PENDING" && b.paymentMethod === "ONLINE" && b.paymentStatus !== "PAID";
  const statusTag: Record<string, [string, "neutral" | "pitch" | "amber" | "red" | "blue"]> = {
    PENDING: [t("Request"), "amber"], CONFIRMED: [t("Confirmed"), "pitch"], COMPLETED: [t("Played"), "neutral"],
    CANCELLED: [t("Cancelled"), "red"], NO_SHOW: [t("No-show"), "red"],
  };
  const type = bookingType(b);
  // Only online bookings carry a separate payment state; cash is settled when the session is closed
  const payTag: [string, "neutral" | "pitch" | "amber" | "red" | "blue"] | null =
    b.paymentMethod === "ON_ARRIVAL" ? null
    : b.paymentStatus === "PAID" ? [t("Transfer confirmed"), "pitch"]
    : b.paymentStatus === "RECEIPT_SUBMITTED" ? [t("Receipt to check"), "amber"]
    : b.paymentStatus === "REJECTED" ? [t("Receipt sent back"), "red"]
    : b.paymentStatus === "REFUNDED" ? [t("Refunded"), "neutral"]
    : [t("Waiting for transfer"), "blue"];

  return (
    <li className={typedRow(type)}>
      <RowWhen date={b.bookingDate} startTime={b.startTime} endTime={b.endTime} />
      <div className="flex-1 min-w-0">
        <RowWho name={b.playerName} place={[b.courtName, isOpenMatch ? t("open match") : null].filter(Boolean).join(", ") || t("Whole ground")} phone={phone}>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <RowTag tone={statusTag[b.status]?.[1] ?? "neutral"}>{statusTag[b.status]?.[0] ?? b.status}</RowTag>
            <TypeBadge type={type} />
            {payTag && <RowTag tone={payTag[1]}>{payTag[0]}</RowTag>}
            {pastDue && <RowTag tone="amber">{t("Session ended — close it")}</RowTag>}
            {b.status === "PENDING" && sessionOver && <RowTag tone="amber">{t("Date passed")}</RowTag>}
          </div>
          {isOpenMatch && b.openMatchId && (
            <Link href={`/open-matches/${b.openMatchId}`} target="_blank" className="mt-1.5 inline-block text-sm text-pitch hover:underline">{t("View lobby")}</Link>
          )}
          {b.specialRequests && <p className="mt-1.5 text-sm text-slate-500">&ldquo;{b.specialRequests}&rdquo;</p>}
        </RowWho>
      </div>
      <RowAmount amount={b.totalAmount} />
      <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
        {b.status === "PENDING" && (awaitingTransfer ? (
          <Link href="/worker/bookings" className={`flex-1 ${quietBtn}`}>
            {b.paymentStatus === "RECEIPT_SUBMITTED" ? t("Check receipt") : t("Waiting for transfer")}
          </Link>
        ) : (
          <button onClick={onConfirm} disabled={updating} className={`flex-1 ${primaryBtn}`}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm booking
          </button>
        ))}
        {b.status === "CONFIRMED" && sessionOver && (
          <button onClick={onComplete} disabled={updating} className={`flex-1 ${primaryBtn}`}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock3 className="w-4 h-4" />} Mark played
          </button>
        )}
        {b.status === "CONFIRMED" && sessionOver && !isOpenMatch && (
          <button onClick={onNoShow} disabled={updating} className={`flex-1 ${quietBtn}`}>{t("No-show")}</button>
        )}
        {(b.status === "PENDING" || (b.status === "CONFIRMED" && !sessionOver)) && !isOpenMatch && (
          <button onClick={onCancel} disabled={updating} className={`flex-1 ${quietBtn} hover:border-red-300 hover:text-red-700`}>
            <XCircle className="w-4 h-4" /> {t("Cancel")}
          </button>
        )}
      </div>
    </li>
  );
}

interface WalkInModalProps {
  facility:  FacilityInfo | null;
  onClose:   () => void;
  onCreated: () => void;
}

function WalkInModal({ facility, onClose, onCreated }: WalkInModalProps) {
  const { t, tn, locale } = useT();
  const today   = isoDate(new Date());
  const maxDate = isoDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
  const courts = facility?.courts ?? [];
  const [courtId,       setCourtId]       = useState(() => courts.length === 1 ? courts[0].id : "");
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
    if (!bookingDate || !startTime || !endTime || !playerName.trim()) { setError(t("Please fill in all required fields.")); return; }
    if (playerName.trim().length < 2) { setError(t("Player name must be at least 2 characters.")); return; }
    if (courts.length > 0 && !courtId) { setError(t("Please select a court.")); return; }
    if (startTime >= endTime) { setError(t("Start time must be before end time.")); return; }
    if (contactNumber.trim()) {
      const cleaned = contactNumber.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
        setError(t("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)."));
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/worker/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ courtId: courtId || undefined, bookingDate, startTime, endTime, playerName: playerName.trim(), contactNumber: contactNumber.trim() || undefined, specialRequests: notes.trim() || undefined }),
      });
      const d = await res.json();
      if (res.ok) { onCreated(); }
      else        { setError(d.error ?? t("Failed to create booking.")); }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{t("Add Phone Booking")}</h3>
              <p className="text-sm text-slate-400">{facility ? `${facility.name} · ${facility.city}` : "Loading…"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* Court selector — only when facility has courts */}
          {courts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{t("Court / Field")}</p>
              <div className="grid grid-cols-2 gap-3">
                {courts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCourtId(c.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      courtId === c.id
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      courtId === c.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
              {courts.length > 0 && !courtId && (
                <p className="text-sm text-amber-600 mt-2 ml-0.5">{t("Select a court to continue")}</p>
              )}
            </div>
          )}

          {courts.length > 0 && <div className="border-t border-slate-100" />}

          {/* Booking Time */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Booking Time")}</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-500" /> {t("Date *")}
                </label>
                <div className="relative">
                  <input type="date" value={bookingDate} min={today} max={maxDate} onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500" />
                  {(isToday || isTomorrow) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full pointer-events-none">
                      {isToday ? t("Today") : t("Tomorrow")}
                    </span>
                  )}
                </div>
                {bookingDate && <p className="text-sm text-slate-400 mt-1.5">{fmtShort(bookingDate, locale)}</p>}
                {daySchedule?.closed && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mt-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {t("Facility is normally closed on this day.")}
                  </p>
                )}
                {daySchedule && !daySchedule.closed && (
                  <p className="text-sm text-slate-400 mt-1.5">Operating hours: {daySchedule.openTime} – {daySchedule.closeTime}</p>
                )}
              </div>
              <TimeRangePicker
                openTime={daySchedule && !daySchedule.closed ? daySchedule.openTime  : undefined}
                closeTime={daySchedule && !daySchedule.closed ? daySchedule.closeTime : undefined}
                startTime={startTime}
                endTime={endTime}
                onChange={(s, e) => { setStartTime(s); setEndTime(e); }}
                accent="blue"
              />
              {durationMins > 0 && facility && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Clock3 className="w-4 h-4" />
                    <span className="font-semibold">
                      {tn(durationHrs, "{n} hour", "{n} hours")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-400">{t("Estimated")}</p>
                    <p className="text-sm font-bold text-blue-700">{t("Rs.")} {estimatedAmt.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Player Details */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Player Details")}</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-500" /> {t("Player Name *")}
                </label>
                <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder={t("e.g. Ashan Fernando")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-blue-500" /> {t("Contact Number")}
                </label>
                <input type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder={t("07X XXX XXXX")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <StickyNote className="w-4 h-4 text-blue-500" /> {t("Notes")}
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t("Any special requests…")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300 resize-none" />
              </div>
            </div>
          </div>

          {/* Summary */}
          {playerName.trim() && durationMins > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Booking Summary")}</p>
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {[
                    { icon: MapPin,    label: t("Ground"),   value: facility ? `${facility.name}, ${facility.city}` : "—" },
                    ...(courtId ? [{ icon: BadgeInfo, label: t("Court"), value: courts.find((c) => c.id === courtId)?.name ?? courtId }] : []),
                    { icon: User,      label: t("Player"),   value: playerName.trim() },
                    { icon: Calendar,  label: t("Date"),     value: bookingDate ? fmtShort(bookingDate, locale) : "—" },
                    { icon: Clock,     label: t("Time"),     value: `${startTime} – ${endTime}` },
                    { icon: Clock3,    label: t("Duration"), value: tn(durationHrs, "{n} hour", "{n} hours") },
                    { icon: BadgeInfo, label: t("Amount"),   value: facility ? t("Rs. {amount} (cash on arrival)", { amount: estimatedAmt.toLocaleString() }) : "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-5 py-3">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-400 w-20 shrink-0">{label}</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{t(error)}
            </p>
          )}

          <div className="flex gap-3 pb-1">
            <button onClick={onClose} className="flex-1 py-3.5 border border-slate-200 rounded-xl text-base text-slate-600 font-medium hover:border-slate-300 transition-colors">{t("Cancel")}</button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {t("Confirm Booking")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Cash confirmation modal ── */
function CashModal({ onConfirm, onClose, updating }: { onConfirm: (r: boolean) => void; onClose: () => void; updating: boolean }) {
  const { t } = useT();
  const [received, setReceived] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <h3 className="font-semibold text-slate-900 text-base">{t("Confirm Cash Payment")}</h3>
        <p className="text-sm text-slate-500">{t("Did you receive the cash payment for this session?")}</p>
        <div className="flex gap-2">
          <button onClick={() => setReceived(true)} className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${received ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"}`}>{t("Yes, received")}</button>
          <button onClick={() => setReceived(false)} className={`flex-1 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${!received ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>{t("Not yet")}</button>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">{t("Cancel")}</button>
          <button onClick={() => onConfirm(received)} disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors">
            {updating && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("Mark Complete")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function WorkerBookingsPage() {
  const { t, tn } = useT();
  const [bookings,      setBookings]      = useState<Booking[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [actionError,   setActionError]   = useState("");
  const [showModal,     setShowModal]     = useState(false);
  const [updating,      setUpdating]      = useState<string | null>(null);
  const [facility,      setFacility]      = useState<FacilityInfo | null>(null);
  const [cashTarget,    setCashTarget]    = useState<string | null>(null);
  const [cancelTarget,  setCancelTarget]  = useState<Booking | null>(null);
  // One screen: the action inbox (receipts, cash requests, refunds) and the full booking list
  const [view,   setView]   = useState<"requests" | "receipts" | "complete" | "all">("requests");
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const [noShowTarget,  setNoShowTarget]  = useState<Booking | null>(null);

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

  const updateStatus = async (id: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW", cashReceived?: boolean) => {
    setUpdating(id);
    setActionError("");
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
        setActionError(d.error ?? t("Failed to update booking."));
      }
    } catch {
      setActionError(t("Network error. Check your connection and try again."));
    } finally {
      setUpdating(null);
      setCashTarget(null);
      setCancelTarget(null);
      setNoShowTarget(null);
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
  const pastDue           = bookings.filter(isPastDue);
  const pendingUpcoming   = bookings.filter((b) => b.status === "PENDING").sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime));
  const confirmedUpcoming = bookings.filter((b) => b.status === "CONFIRMED" && !isPastDue(b)).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime));
  const completed         = bookings.filter((b) => b.status === "COMPLETED").sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  const cancelled         = bookings.filter((b) => b.status === "CANCELLED").sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  const noShows           = bookings.filter((b) => b.status === "NO_SHOW").sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

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
        onCancel={() => setCancelTarget(b)}
        onNoShow={() => setNoShowTarget(b)}
      />
    ));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Bookings")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalActive > 0 ? tn(totalActive, "{n} active booking", "{n} active bookings") : t("All caught up")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/worker/booking-history"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <History className="w-4 h-4" /> {t("View History")}
          </Link>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> {t("Add Phone Booking")}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">{t(actionError)}</div>
      )}

      <div role="tablist" className="flex gap-6 border-b border-rule overflow-x-auto">
        {([["requests", tk("Requests")], ["receipts", tk("Receipts")], ["complete", tk("To complete")], ["all", tk("All bookings")]] as const).map(([key, label]) => {
          const n = key === "all" ? null : counts?.[key];
          return (
            <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
              className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[15px] font-medium ${view === key ? "border-pitch text-pitch-deep" : "border-transparent text-slate-500 hover:text-pitch-deep"}`}>
              {t(label)}{n ? <span className="ml-1.5 rounded-full bg-pitch/10 px-1.5 py-0.5 text-xs tabular-nums text-pitch">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {view !== "all" ? <ActionInbox role="worker" view={view} onCounts={setCounts} /> : (<>
      <TypeLegend />
      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: t("Past Due"),  value: pastDue.length,           color: "text-amber-600"  },
          { label: t("Pending"),   value: pendingUpcoming.length,   color: "text-amber-500"  },
          { label: t("Confirmed"), value: confirmedUpcoming.length, color: "text-green-600"  },
          { label: t("Completed"), value: completed.length,         color: "text-blue-600"   },
          { label: t("Cancelled"), value: cancelled.length,         color: "text-red-500"    },
          { label: t("No-Shows"),  value: noShows.length,           color: "text-purple-600" },
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
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">{t("Loading bookings…")}</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
          <CalendarCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">{t("No bookings in the next 60 days")}</p>
        </div>
      ) : (
        <div className="flex flex-col">

          {/* 1. Past due — needs action */}
          {pastDue.length > 0 && (
            <RowGroup title={t("Played — close the booking")} count={pastDue.length}>
              {renderSection(pastDue, true)}
            </RowGroup>
          )}

          {/* 2. Pending requests */}
          {pendingUpcoming.length > 0 && (
            <RowGroup title={t("Booking requests")} count={pendingUpcoming.length}>
              {renderSection(pendingUpcoming)}
            </RowGroup>
          )}

          {/* 3. Confirmed upcoming */}
          {confirmedUpcoming.length > 0 && (
            <RowGroup title={t("Confirmed")} count={confirmedUpcoming.length}>
              {renderSection(confirmedUpcoming)}
            </RowGroup>
          )}

          {/* 4. Completed */}
          {completed.length > 0 && (
            <RowGroup title={t("Played")} count={completed.length}>
              {renderSection(completed)}
            </RowGroup>
          )}

          {/* 5. Cancelled */}
          {cancelled.length > 0 && (
            <RowGroup title={t("Cancelled")} count={cancelled.length}>
              {renderSection(cancelled)}
            </RowGroup>
          )}

          {/* 6. No-Shows */}
          {noShows.length > 0 && (
            <RowGroup title={t("No-shows")} count={noShows.length}>
              {renderSection(noShows)}
            </RowGroup>
          )}
        </div>
      )}

      </>)}

      {/* Cash modal */}
      {cashTarget && (
        <CashModal
          updating={updating === cashTarget}
          onClose={() => setCashTarget(null)}
          onConfirm={(r) => updateStatus(cashTarget, "COMPLETED", r)}
        />
      )}

      {/* Cancel warning modal */}
      {cancelTarget && (
        <CancelWarningModal
          booking={cancelTarget}
          updating={updating === cancelTarget.id}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => updateStatus(cancelTarget.id, "CANCELLED")}
        />
      )}

      {/* No-show modal */}
      {noShowTarget && (
        <NoShowModal
          booking={noShowTarget}
          updating={updating === noShowTarget.id}
          onClose={() => setNoShowTarget(null)}
          onConfirm={() => updateStatus(noShowTarget.id, "NO_SHOW")}
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

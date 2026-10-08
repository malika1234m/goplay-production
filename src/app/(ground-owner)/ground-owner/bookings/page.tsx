"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Search, Loader2, CheckCircle, XCircle, Check, CreditCard, Banknote, AlertTriangle, UserPlus, X, User, Phone, StickyNote, Clock3, BadgeInfo, CheckCircle2, History, UserX, ShieldAlert,
} from "lucide-react";
import { TimeRangePicker } from "@/components/booking/TimeRangePicker";
import ActionInbox, { type InboxCounts } from "@/components/payments/ActionInbox";
import { tk, type T, formatDay } from "@/i18n/core";
import { RowAmount, RowGroup, RowTag, RowWhen, RowWho, TypeBadge, TypeLegend, bookingType, primaryBtn, quietBtn, typedRow } from "@/components/payments/BookingRow";
import { useT } from "@/i18n/I18nProvider";

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isoDateStr(d: Date) { return d.toISOString().split("T")[0]; }

function dateOnly(dateStr: string) { return dateStr.slice(0, 10); }

function fmtShort(dateStr: string, locale: string) {
  return formatDay(new Date(dateOnly(dateStr) + "T00:00:00"), locale, {
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
  paymentStatus:   "PENDING" | "RECEIPT_SUBMITTED" | "REJECTED" | "PAID" | "FAILED" | "REFUNDED";
  contactNumber:   string | null;
  specialRequests: string | null;
  createdAt:       string;
  isOpenMatch:     boolean;
  user:     { name: string; email: string; phone: string | null };
  facility: { name: string; city: string };
  court:    { name: string } | null;
  openMatch: {
    id: string;
    category: { name: string };
    spots: { groupSize: number; user: { name: string; phone: string | null } }[];
  } | null;
}

/* Resolve the display name regardless of booking type */
function getDisplayName(b: Booking, t: T): string {
  if (b.isOpenMatch) return "GoPlay Connect";
  const isWalkIn = b.specialRequests?.startsWith("[Walk-in]");
  if (isWalkIn) {
    return b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[0].trim() || t("Phone Booking");
  }
  return b.user.name;
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

function formatDate(dateStr: string, locale: string) {
  return formatDay(new Date(dateStr), locale, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}



/* ── Owner cancel warning modal ── */
interface CancelWarningModalProps {
  booking:  Booking;
  onClose:  () => void;
  onConfirm: () => void;
  loading:  boolean;
}

function CancelWarningModal({ booking, onClose, onConfirm, loading }: CancelWarningModalProps) {
  const { t, locale } = useT();
  const isOnlinePaid = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t("Cancel Booking")}</h3>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Player")}</span>
            <span className="font-medium">{booking.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Date")}</span>
            <span className="font-medium">{formatDate(booking.bookingDate, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Amount")}</span>
            <span className="font-bold text-slate-900">{t("Rs.")} {booking.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {isOnlinePaid && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> {t("Full Refund Will Be Issued")}
            </p>
            <p>{t("You'll owe a full refund of Rs. {amount}.", { amount: booking.totalAmount.toLocaleString() })}</p>
          </div>
        )}

        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {t("Strike Warning")}
          </p>
          <p>{t("Adds a strike. 3 strikes in 90 days can suspend your listing.")}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {t("Keep Booking")}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {t("Confirm Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── No-show modal ── */
interface NoShowModalProps {
  booking:  Booking;
  onClose:  () => void;
  onConfirm: () => void;
  loading:  boolean;
}

function NoShowModal({ booking, onClose, onConfirm, loading }: NoShowModalProps) {
  const { t, locale } = useT();
  const isOnline = booking.paymentMethod === "ONLINE";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t("Mark as No-Show")}</h3>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Player")}</span>
            <span className="font-medium">{getDisplayName(booking, t)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Date")}</span>
            <span className="font-medium">{formatDate(booking.bookingDate, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Time")}</span>
            <span className="font-medium">{booking.startTime} – {booking.endTime}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="text-slate-500">{t("Amount")}</span>
            <span className="font-bold text-slate-900">{t("Rs.")} {booking.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {isOnline ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
            <p className="font-semibold">{t("You Keep the Payment")}</p>
            <p className="mt-0.5">{t("No refund for no-shows.")}</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <p className="font-semibold">{t("Cash Booking — No Payment Collected")}</p>
            <p className="mt-0.5">{t("No cash was collected.")}</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
          {t("This counts against the player.")}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {t("Cancel")}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            {t("Mark No-Show")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Complete booking modal ── */
interface CompleteModalProps {
  booking: Booking;
  onClose: () => void;
  onConfirm: (cashReceived: boolean) => void;
  loading: boolean;
}

function CompleteModal({ booking, onClose, onConfirm, loading }: CompleteModalProps) {
  const { t, locale } = useT();
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
            <h3 className="font-bold text-slate-900 text-base">{t("Mark Session Complete")}</h3>
          </div>
        </div>

        {/* Booking summary */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Player")}</span>
            <span className="font-medium text-slate-800">{getDisplayName(booking, t)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Date")}</span>
            <span className="font-medium text-slate-800">{formatDate(booking.bookingDate, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Time")}</span>
            <span className="font-medium text-slate-800">{booking.startTime} – {booking.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t("Ground")}</span>
            <span className="font-medium text-slate-800">{booking.facility.name}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="text-slate-500">{t("Amount")}</span>
            <span className="font-bold text-slate-900">{t("Rs.")} {booking.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Cash payment question */}
        {isCash && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Banknote className="w-4 h-4 text-emerald-600" />
              {t("Did you receive the cash payment?")}
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
                {t("Yes, received")}
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
                {t("Not yet")}
              </button>
            </div>
            {cashReceived === false && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {t("Payment stays as pending.")}
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
            {t("Cancel")}
          </button>
          <button
            onClick={() => canConfirm && onConfirm(cashReceived!)}
            disabled={!canConfirm || loading}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {t("Confirm")}
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
  onMarkNoShow:      () => void;
}

function BookingCard({ booking: b, pastDue, sessionOver, updating, onConfirmBooking, onCancelBooking, onMarkComplete, onMarkNoShow }: BookingCardProps) {
  const { t, tn } = useT();
  const isWalkIn = !b.isOpenMatch && (b.specialRequests?.startsWith("[Walk-in]") ?? false);
  const name     = getDisplayName(b, t);
  const phone    = b.isOpenMatch ? null : b.contactNumber ?? (!isWalkIn ? b.user.phone : null);
  const note     = b.isOpenMatch || !b.specialRequests ? null
    : isWalkIn ? b.specialRequests.replace("[Walk-in] ", "").split(" — ")[1] ?? null : b.specialRequests;
  const place    = [b.facility.name, b.court?.name].filter(Boolean).join(", ");
  const awaitingTransfer = b.status === "PENDING" && b.paymentMethod === "ONLINE" && b.paymentStatus !== "PAID";

  const statusTag: Record<string, [string, "neutral" | "pitch" | "amber" | "red" | "blue"]> = {
    PENDING:   [t("Request"), "amber"],
    CONFIRMED: [t("Confirmed"), "pitch"],
    COMPLETED: [t("Played"), "neutral"],
    CANCELLED: [t("Cancelled"), "red"],
    NO_SHOW:   [t("No-show"), "red"],
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
        <RowWho name={name} place={b.isOpenMatch && b.openMatch ? `${place} — ${t("{sport} open match", { sport: t(b.openMatch.category.name) })}` : place} phone={phone}>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <RowTag tone={statusTag[b.status]?.[1] ?? "neutral"}>{statusTag[b.status]?.[0] ?? b.status}</RowTag>
            <TypeBadge type={type} />
            {payTag && <RowTag tone={payTag[1]}>{payTag[0]}</RowTag>}
            {pastDue && <RowTag tone="amber">{t("Session ended — close it")}</RowTag>}
            {b.status === "PENDING" && sessionOver && <RowTag tone="amber">{t("Date passed")}</RowTag>}
          </div>
          {b.isOpenMatch && b.openMatch && (
            <p className="mt-1.5 text-sm text-slate-500">
              {b.openMatch.spots.map((sp) => `${sp.user.name}${sp.groupSize > 1 ? ` ×${sp.groupSize}` : ""}`).join(", ")}{" "}
              <Link href={`/open-matches/${b.openMatch.id}`} target="_blank" className="text-pitch hover:underline">{t("View lobby")}</Link>
            </p>
          )}
          {note && <p className="mt-1.5 text-sm text-slate-500">&ldquo;{note}&rdquo;</p>}
        </RowWho>
      </div>
      <RowAmount amount={b.totalAmount} note={tn(b.totalHours, "{n} hour", "{n} hours")} />
      <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
        {b.status === "PENDING" && (awaitingTransfer ? (
          <Link href="/ground-owner/bookings" className={`flex-1 ${quietBtn}`}>
            {b.paymentStatus === "RECEIPT_SUBMITTED" ? t("Check receipt") : t("Waiting for transfer")}
          </Link>
        ) : (
          <button onClick={onConfirmBooking} disabled={updating} className={`flex-1 ${primaryBtn}`}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Confirm booking")}
          </button>
        ))}
        {b.status === "PENDING" && !b.isOpenMatch && (
          <button onClick={onCancelBooking} disabled={updating} className={`flex-1 ${quietBtn} hover:border-red-300 hover:text-red-700`}>{t("Cancel")}</button>
        )}
        {b.status === "CONFIRMED" && sessionOver && (
          <button onClick={onMarkComplete} disabled={updating} className={`flex-1 ${primaryBtn}`}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {t("Mark played")}
          </button>
        )}
        {b.status === "CONFIRMED" && sessionOver && !b.isOpenMatch && (
          <button onClick={onMarkNoShow} disabled={updating} className={`flex-1 ${quietBtn}`}><UserX className="w-4 h-4" /> {t("No-show")}</button>
        )}
        {b.status === "CONFIRMED" && !sessionOver && !b.isOpenMatch && (
          <button onClick={onCancelBooking} disabled={updating} className={`flex-1 ${quietBtn} hover:border-red-300 hover:text-red-700`}>{t("Cancel")}</button>
        )}
      </div>
    </li>
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
  const { t, tn, locale } = useT();
  const activeFacilities = facilities.filter((f) => f.status === "ACTIVE");
  const today = isoDateStr(new Date());

  const [facilityId,    setFacilityId]    = useState(activeFacilities[0]?.id ?? "");
  const [courtId,       setCourtId]       = useState("");
  const [courts,        setCourts]        = useState<{ id: string; name: string }[]>([]);
  const [bookingDate,   setBookingDate]   = useState(today);
  const [startTime,     setStartTime]     = useState("08:00");
  const [endTime,       setEndTime]       = useState("09:00");
  const [playerName,    setPlayerName]    = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes,         setNotes]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [daySchedule,   setDaySchedule]   = useState<{ openTime: string; closeTime: string; closed: boolean } | null>(null);

  // Fetch courts whenever facility changes
  useEffect(() => {
    if (!facilityId) { setCourts([]); setCourtId(""); return; }
    fetch(`/api/ground-owner/grounds/${facilityId}/courts`)
      .then((r) => r.json())
      .then((d) => {
        const active = (d.courts ?? []).filter((c: { id: string; name: string; isActive: boolean }) => c.isActive);
        setCourts(active);
        setCourtId(active.length === 1 ? active[0].id : "");
      })
      .catch(() => { setCourts([]); setCourtId(""); });
  }, [facilityId]);

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
      setError(t("Please fill in all required fields."));
      return;
    }
    if (playerName.trim().length < 2) { setError(t("Player name must be at least 2 characters.")); return; }
    if (courts.length > 0 && !courtId) { setError(t("Please select a court.")); return; }
    if (startTime >= endTime)         { setError(t("Start time must be before end time.")); return; }
    if (contactNumber.trim()) {
      const cleaned = contactNumber.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
        setError(t("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)."));
        return;
      }
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/ground-owner/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ facilityId, courtId: courtId || undefined, bookingDate, startTime, endTime, playerName: playerName.trim(), contactNumber: contactNumber.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("Failed to create phone booking."));
      } else {
        onCreated(data.booking);
      }
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{t("Add Phone Booking")}</h3>
              <p className="text-sm text-slate-400">{t("Cash on arrival")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* ── Section 1: Ground ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Ground")}</p>
            {activeFacilities.length > 1 ? (
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
              >
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} — {f.city}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3 text-base text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium">{activeFacilities[0]?.name}</span>
                <span className="text-slate-400">— {activeFacilities[0]?.city}</span>
              </div>
            )}
            {selectedFacility && (
              <p className="text-sm text-slate-400 mt-2 ml-0.5">
                {t("Rate: Rs. {amount} / hour", { amount: selectedFacility.hourlyRate.toLocaleString() })}
              </p>
            )}
          </div>

          {/* ── Section 1b: Court ── only shown when facility has courts */}
          {courts.length > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Court / Field")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {courts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCourtId(c.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all text-left ${
                        courtId === c.id
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        courtId === c.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
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
            </>
          )}

          <div className="border-t border-slate-100" />

          {/* ── Section 2: Booking Time ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Booking Time")}</p>
            <div className="space-y-4">

              {/* Date */}
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  {t("Date *")}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={bookingDate}
                    min={today}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {(isToday || isTomorrow) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full pointer-events-none">
                      {isToday ? t("Today") : t("Tomorrow")}
                    </span>
                  )}
                </div>
                {bookingDate && (
                  <p className="text-sm text-slate-400 mt-1.5 ml-0.5">{fmtShort(bookingDate, locale)}</p>
                )}
                {daySchedule?.closed && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mt-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {t("Facility is normally closed on this day. You can still add a booking if an exception applies.")}
                  </p>
                )}
                {daySchedule && !daySchedule.closed && (
                  <p className="text-sm text-slate-400 mt-1.5 ml-0.5">
                    {t("Opening hours: {open} – {close}", { open: daySchedule.openTime, close: daySchedule.closeTime })}
                  </p>
                )}
              </div>

              {/* Times */}
              <TimeRangePicker
                openTime={daySchedule && !daySchedule.closed ? daySchedule.openTime  : undefined}
                closeTime={daySchedule && !daySchedule.closed ? daySchedule.closeTime : undefined}
                startTime={startTime}
                endTime={endTime}
                onChange={(s, e) => { setStartTime(s); setEndTime(e); }}
                accent="green"
              />

              {/* Live duration + amount bar */}
              {durationMins > 0 && selectedFacility && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Clock3 className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">
                      {durationMins < 60 ? t("{n} min", { n: durationMins }) : tn(durationHrs, "{n} hour", "{n} hours")}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-green-400">{t("Estimated")}</p>
                    <p className="text-sm font-bold text-green-700">{t("Rs.")} {estimatedAmt.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Section 3: Player Details ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Player Details")}</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-green-500" />
                  {t("Player Name *")}
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t("e.g. Ashan Fernando")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-green-500" />
                  {t("Contact Number")}
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder={t("07X XXX XXXX")}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2">
                  <StickyNote className="w-4 h-4 text-green-500" />
                  {t("Notes")}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("Any special requests or notes from the caller…")}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300 resize-none"
                />
              </div>
            </div>
          </div>

          {/* ── Booking summary card ── */}
          {playerName.trim() && durationMins > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">{t("Booking Summary")}</p>
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {[
                    { icon: MapPin,    label: t("Ground"),   value: selectedFacility ? `${selectedFacility.name}, ${selectedFacility.city}` : "—" },
                    ...(courtId ? [{ icon: BadgeInfo, label: t("Court"), value: courts.find((c) => c.id === courtId)?.name ?? courtId }] : []),
                    { icon: User,      label: t("Player"),   value: playerName.trim() },
                    { icon: Calendar,  label: t("Date"),     value: bookingDate ? fmtShort(bookingDate, locale) : "—" },
                    { icon: Clock,     label: t("Time"),     value: `${startTime} – ${endTime}` },
                    { icon: Clock3,    label: t("Duration"), value: tn(durationHrs, "{n} hour", "{n} hours") },
                    { icon: BadgeInfo, label: t("Amount"),   value: selectedFacility ? t("Rs. {amount} (cash on arrival)", { amount: estimatedAmt.toLocaleString() }) : "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-5 py-3">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-400 w-20 shrink-0">{label}</span>
                      <span className="text-sm font-medium text-slate-800 min-w-0 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {t(error)}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-1">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 border border-slate-200 rounded-xl text-base font-medium text-slate-600 hover:border-slate-300 transition-colors"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {t("Confirm Booking")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function GroundOwnerBookingsPage() {
  const { t } = useT();
  const [bookings,        setBookings]        = useState<Booking[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [total,           setTotal]           = useState(0);
  const [hasMore,         setHasMore]         = useState(false);
  const [statusFilter,    setStatusFilter]    = useState("");
  const [search,          setSearch]          = useState("");
  const [updating,        setUpdating]        = useState<string | null>(null);
  const [error,           setError]           = useState("");
  const [completeTarget,  setCompleteTarget]  = useState<Booking | null>(null);
  const [cancelTarget,    setCancelTarget]    = useState<Booking | null>(null);
  const [noShowTarget,    setNoShowTarget]    = useState<Booking | null>(null);
  const [showWalkIn,      setShowWalkIn]      = useState(false);
  const [facilities,      setFacilities]      = useState<FacilityOption[]>([]);
  const needsActionRef    = useRef<HTMLDivElement>(null);
  // One screen: the action inbox (receipts, cash requests, refunds) and the full booking list
  const [view,   setView]   = useState<"requests" | "receipts" | "complete" | "all">("requests");
  const [counts, setCounts] = useState<InboxCounts | null>(null);

  // Load facilities once for the walk-in modal
  useEffect(() => {
    fetch("/api/ground-owner/grounds")
      .then((r) => r.json())
      .then((d) => setFacilities(d.grounds ?? []));
  }, []);

  const load = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (pageNum > 1)  params.set("page",   String(pageNum));

      const res  = await fetch(`/api/ground-owner/bookings?${params}`);
      const data = await res.json();

      if (append) setBookings((prev) => [...prev, ...(data.bookings ?? [])]);
      else        setBookings(data.bookings ?? []);

      setTotal(data.total    ?? 0);
      setHasMore(data.hasMore ?? false);
      setCurrentPage(pageNum);
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      if (pageNum === 1) setLoading(false);
      else setLoadingMore(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(1); }, [load]);

  /* Generic status update (Confirm / Cancel) */
  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/bookings/${id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("Failed to update status."));
      } else {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      }
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      setUpdating(null);
    }
  };

  /* Owner cancel — called from warning modal */
  const handleOwnerCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setUpdating(id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/bookings/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("Failed to cancel booking."));
      } else {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "CANCELLED" } : b));
      }
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      setUpdating(null);
      setCancelTarget(null);
    }
  };

  /* Mark no-show */
  const handleNoShow = async () => {
    if (!noShowTarget) return;
    const id = noShowTarget.id;
    setUpdating(id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/bookings/${id}/noshow`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("Failed to mark no-show."));
      } else {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "NO_SHOW" } : b));
      }
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      setUpdating(null);
      setNoShowTarget(null);
    }
  };

  /* Complete booking — called from modal with cash decision */
  const handleComplete = async (cashReceived: boolean) => {
    if (!completeTarget) return;
    const id = completeTarget.id;
    const target = completeTarget;
    setUpdating(id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/bookings/${id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "COMPLETED", cashReceived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("Failed to update status."));
      } else {
        const newPaymentStatus = target.paymentMethod === "ON_ARRIVAL"
          ? (cashReceived ? "PAID" : "PENDING")
          : target.paymentStatus;
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, status: "COMPLETED", paymentStatus: newPaymentStatus } : b
          )
        );
      }
    } catch {
      setError(t("Network error. Check your connection and try again."));
    } finally {
      setUpdating(null);
      setCompleteTarget(null);
    }
  };

  const filtered = bookings.filter((b) => {
    const term = search.toLowerCase();
    return getDisplayName(b, t).toLowerCase().includes(term) || b.facility.name.toLowerCase().includes(term);
  });

  const byDateAsc  = (a: Booking, b: Booking) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime);
  const byDateDesc = (a: Booking, b: Booking) => b.bookingDate.localeCompare(a.bookingDate) || b.startTime.localeCompare(a.startTime);

  const pastDueGroup      = filtered.filter(isPastDue).sort(byDateAsc);
  const pendingGroup      = filtered.filter((b) => b.status === "PENDING").sort(byDateAsc);
  const confirmedGroup    = filtered.filter((b) => b.status === "CONFIRMED" && !isPastDue(b)).sort(byDateAsc);
  const completedGroup    = filtered.filter((b) => b.status === "COMPLETED").sort(byDateDesc);
  const cancelledGroup    = filtered.filter((b) => b.status === "CANCELLED").sort(byDateDesc);
  const noShowGroup       = filtered.filter((b) => b.status === "NO_SHOW").sort(byDateDesc);


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Bookings")}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/ground-owner/booking-history"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <History className="w-4 h-4" />
            {t("View History")}
          </Link>
          {facilities.some((f) => f.status === "ACTIVE") && (
            <button
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {t("Add Phone Booking")}
            </button>
          )}
        </div>
      </div>

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

      {view !== "all" ? <ActionInbox role="owner" view={view} onCounts={setCounts} /> : (<>
      <TypeLegend />
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search by player name or ground...")}
            className="bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">{t("All Status")}</option>
          <option value="PENDING">{t("Pending")}</option>
          <option value="CONFIRMED">{t("Confirmed")}</option>
          <option value="COMPLETED">{t("Completed")}</option>
          <option value="CANCELLED">{t("Cancelled")}</option>
          <option value="NO_SHOW">{t("No-Show")}</option>
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          {t(error)}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t("Loading bookings...")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">{t("No bookings found")}</h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            {search || statusFilter
              ? t("Try adjusting your search or filter.")
              : t("Bookings from players will appear here once they book your grounds.")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col" ref={needsActionRef}>

          {/* 1. Past-due — needs action */}
          {pastDueGroup.length > 0 && (
            <RowGroup title={t("Played — close the booking")} count={pastDueGroup.length}>
              {pastDueGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {/* 2. Pending requests */}
          {pendingGroup.length > 0 && (
            <RowGroup title={t("Booking requests")} count={pendingGroup.length}>
              {pendingGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {/* 3. Confirmed upcoming */}
          {confirmedGroup.length > 0 && (
            <RowGroup title={t("Confirmed")} count={confirmedGroup.length}>
              {confirmedGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {/* 4. Completed */}
          {completedGroup.length > 0 && (
            <RowGroup title={t("Played")} count={completedGroup.length}>
              {completedGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {/* 5. Cancelled */}
          {cancelledGroup.length > 0 && (
            <RowGroup title={t("Cancelled")} count={cancelledGroup.length}>
              {cancelledGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {/* 6. No-Show */}
          {noShowGroup.length > 0 && (
            <RowGroup title={t("No-shows")} count={noShowGroup.length}>
              {noShowGroup.map((b) => (
                <BookingCard key={b.id} booking={b} pastDue={false} sessionOver={isSessionOver(b)}
                  updating={updating === b.id}
                  onConfirmBooking={() => updateStatus(b.id, "CONFIRMED")}
                  onCancelBooking={() => setCancelTarget(b)}
                  onMarkComplete={() => setCompleteTarget(b)}
                  onMarkNoShow={() => setNoShowTarget(b)} />
              ))}
            </RowGroup>
          )}

          {pastDueGroup.length + pendingGroup.length + confirmedGroup.length + completedGroup.length + cancelledGroup.length + noShowGroup.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-sm text-slate-400">{t("No bookings match your search.")}</p>
            </div>
          )}

          {/* Load More */}
          {!loading && hasMore && !search && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                onClick={() => load(currentPage + 1, true)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:border-green-500 hover:text-green-600 text-slate-600 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("Load More")}
              </button>
              <p className="text-xs text-slate-400">
                {t("Showing {shown} of {total} bookings", { shown: bookings.length, total })}
              </p>
            </div>
          )}
          {!loading && !hasMore && total > 0 && !search && (
            <p className="text-center text-xs text-slate-400 pt-2">
              {t("All {total} bookings loaded", { total })}
            </p>
          )}
        </div>
      )}

      </>)}

      {/* Complete modal */}
      {completeTarget && (
        <CompleteModal
          booking={completeTarget}
          loading={updating === completeTarget.id}
          onClose={() => setCompleteTarget(null)}
          onConfirm={handleComplete}
        />
      )}

      {/* Owner cancel warning modal */}
      {cancelTarget && (
        <CancelWarningModal
          booking={cancelTarget}
          loading={updating === cancelTarget.id}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleOwnerCancel}
        />
      )}

      {/* No-show modal */}
      {noShowTarget && (
        <NoShowModal
          booking={noShowTarget}
          loading={updating === noShowTarget.id}
          onClose={() => setNoShowTarget(null)}
          onConfirm={handleNoShow}
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

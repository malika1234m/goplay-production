"use client";

import { Banknote, Landmark, Phone, PhoneCall } from "lucide-react";
import { tk, formatDay } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

// Shared row anatomy for every booking list in the ground portal — the Needs action inbox
// and the full booking list use the same pieces so they read as one system.

const day = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");

/** The date block on the left of every row — the thing an owner scans first. */
export function RowWhen({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }) {
  const { t, locale } = useT();
  const d = day(date);
  return (
    <div className="w-24 shrink-0">
      <p className="text-xs text-slate-500">{formatDay(d, locale, { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="font-scoreboard text-[22px] leading-tight font-semibold text-pitch-deep tabular-nums">{startTime}</p>
      <p className="text-xs text-slate-400 tabular-nums">{t("to {time}", { time: endTime })}</p>
    </div>
  );
}

/** Who booked, where, and how to reach them. */
export function RowWho({ name, place, phone, children }: { name: string; place: string; phone?: string | null; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold text-pitch-deep truncate">{name}</p>
      <p className="text-sm text-slate-500 truncate">{place}</p>
      {phone && (
        <a href={`tel:${phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-pitch">
          <Phone className="w-3.5 h-3.5" /> {phone}
        </a>
      )}
      {children}
    </div>
  );
}

export function RowAmount({ amount, note }: { amount: number; note?: string }) {
  const { t } = useT();
  return (
    <p className="sm:w-28 sm:text-right shrink-0">
      <span className="font-scoreboard text-xl font-semibold text-pitch-deep tabular-nums">{t("Rs.")} {amount.toLocaleString()}</span>
      {note && <span className="block text-xs text-slate-400">{note}</span>}
    </p>
  );
}

const TONES = {
  neutral: "bg-slate-100 text-slate-600",
  pitch:   "bg-pitch/10 text-pitch",
  amber:   "bg-amber-100 text-amber-800",
  red:     "bg-red-50 text-red-700",
  blue:    "bg-sky-50 text-sky-800",
} as const;

/** Small status label — plain words, sentence case. */
export function RowTag({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

/** A titled group of rows: heading, count, one-line hint, then a single bordered list. */
export function RowGroup({ title, hint, count, children }: { title: string; hint?: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-[17px] font-semibold text-pitch-deep">{title}</h2>
        <span className="text-sm text-slate-500 tabular-nums">{count}</span>
      </div>
      {hint && <p className="text-sm text-slate-500 mb-3 max-w-prose">{hint}</p>}
      <ul className={`bg-white rounded-xl border border-rule divide-y divide-rule overflow-hidden ${hint ? "" : "mt-2"}`}>{children}</ul>
    </section>
  );
}

export const rowClass = "p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4";
export const primaryBtn = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60";
export const quietBtn   = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-pitch disabled:opacity-60";

/** The three ways a booking gets paid — each with its own colour so they're told apart at a glance. */
export type BookingType = "cash" | "walkin" | "online";

const TYPE = {
  cash:   { label: tk("Pay at ground"), edge: "border-l-amber-400", chip: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Banknote },
  walkin: { label: tk("Walk-in"),       edge: "border-l-sky-500",   chip: "bg-sky-50 text-sky-800 ring-sky-200",       Icon: PhoneCall },
  online: { label: tk("Paid online"),   edge: "border-l-pitch",     chip: "bg-pitch/10 text-pitch ring-pitch/30",      Icon: Landmark },
} as const;

export function TypeBadge({ type }: { type: BookingType }) {
  const { t } = useT();
  const k = TYPE[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${k.chip}`}>
      <k.Icon className="w-3.5 h-3.5" aria-hidden /> {t(k.label)}
    </span>
  );
}

/** Row container with a coloured left edge for the booking type. */
export const typedRow = (type: BookingType) => `${rowClass} border-l-4 ${TYPE[type].edge}`;

export function bookingType(b: { paymentMethod: string; specialRequests?: string | null; isPhoneBooking?: boolean }): BookingType {
  if (b.paymentMethod === "ONLINE") return "online";
  return b.isPhoneBooking || b.specialRequests?.startsWith("[Walk-in]") ? "walkin" : "cash";
}

/** Key shown above lists so the three colours are never a guess. */
export function TypeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <TypeBadge type="cash" /><TypeBadge type="walkin" /><TypeBadge type="online" />
    </div>
  );
}

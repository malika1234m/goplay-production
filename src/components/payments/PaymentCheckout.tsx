"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, FileText, ImageUp, Loader2, MapPin, RefreshCw } from "lucide-react";
import ComplaintForm from "./ComplaintForm";
import type { Complaint, PaymentDetails, PaymentStatus } from "./types";
import { tk, formatDay } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

export interface CheckoutProps {
  backHref:          string;
  backLabel:         string;
  doneLabel:         string;          // button shown once paid, e.g. "Go to my bookings"
  groundName:        string;
  groundAddress:     string;
  image:             string | null;
  date:              string;          // ISO date of play
  startTime:         string;
  endTime:           string;
  detail:            string;          // "Court 1" or "Open match spot · Tennis · 2 players"
  amount:            number;
  reference:         string;
  paymentStatus:     PaymentStatus;
  deadline:          Date | null;     // when an unpaid hold is released
  details:           PaymentDetails | null;
  receiptUrl:        string | null;
  rejectReason:      string | null;
  latestComplaint:   Complaint | null;
  uploadEndpoint:    string;
  bookingId?:        string;
  spotId?:           string;
  onChanged:         () => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

function formatAccount(n: string) {
  return n.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function useCountdown(deadline: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const ms = Math.max(0, deadline.getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ms, label: `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}` };
}

/** A slip row: what to type into the banking app, with one-tap copy. */
function SlipField({ label, value, display, emphasis }: { label: string; value: string; display?: string; emphasis?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { t } = useT();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* the value is on screen to copy by hand */ }
  }
  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-3 py-3 border-b border-dashed border-rule last:border-b-0">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className={emphasis ? "font-scoreboard text-[28px] leading-none font-semibold text-pitch-deep tabular-nums" : "text-[15px] font-medium text-pitch-deep break-words"}>
        {display ?? value}
      </dd>
      <button
        type="button"
        onClick={copy}
        className="self-center inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-pitch hover:bg-pitch/10 focus-visible:outline-2 focus-visible:outline-pitch"
        aria-label={t("Copy {label}", { label })}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t("Copied") : t("Copy")}
      </button>
    </div>
  );
}

const STEPS = [tk("Slot held"), tk("Receipt sent"), tk("Booking confirmed")];

function Tracker({ status }: { status: PaymentStatus }) {
  const reached = status === "PAID" ? 3 : status === "RECEIPT_SUBMITTED" ? 2 : 1;
  const rejected = status === "REJECTED";
  const { t } = useT();
  return (
    <ol className="flex items-center gap-0 w-full max-w-xl" aria-label={t("Payment progress")}>
      {STEPS.map((label, i) => {
        const done   = i < reached;
        const isNext = i === reached && !rejected;
        const failed = rejected && i === 1;
        return (
          <li key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`grid place-items-center w-6 h-6 rounded-full text-xs font-bold transition-colors duration-500 ${
                  failed ? "bg-red-600 text-white" : done ? "bg-pitch text-white" : isNext ? "border-2 border-pitch text-pitch" : "border-2 border-rule text-slate-400"
                }`}
                aria-hidden
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`text-sm ${failed ? "text-red-700 font-semibold" : done || isNext ? "text-pitch-deep font-medium" : "text-slate-400"}`}>
                {failed ? t("Receipt rejected") : t(label)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`mx-3 h-px flex-1 transition-colors duration-500 ${i < reached - 1 ? "bg-pitch" : "bg-rule"}`} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Dropzone({ endpoint, onUploaded, again }: { endpoint: string; onUploaded: () => void; again: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const { t } = useT();

  function pick(f: File | undefined | null) {
    setError("");
    if (!f) return;
    if (f.size > MAX_BYTES) { setError(t("That file is over 8 MB. Take a screenshot of the receipt instead.")); return; }
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") { setError(t("Use a photo, screenshot or PDF of the receipt.")); return; }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function send() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("receipt", file);
      const res  = await fetch(endpoint, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? t("The receipt didn't upload. Try again.")); return; }
      onUploaded();
    } catch {
      setError(t("You're offline or the connection dropped. Try again."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label={t("Receipt file")} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-pitch ${
          dragging ? "border-pitch bg-pitch/5" : "border-rule hover:border-pitch/60 bg-white"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={t("Selected receipt")} className="w-16 h-16 rounded-lg object-cover border border-rule" />
        ) : (
          <span className="grid place-items-center w-16 h-16 rounded-lg bg-slip text-pitch shrink-0">
            {file ? <FileText className="w-7 h-7" /> : <ImageUp className="w-7 h-7" />}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-pitch-deep truncate">
            {file ? file.name : again ? t("Choose a new receipt") : t("Add your transfer receipt")}
          </p>
          <p className="text-sm text-slate-500">
            {file ? t("Tap to choose a different file") : t("Drop a screenshot or PDF here, or tap to choose one")}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{t(error)}</p>}
      <button
        type="button"
        onClick={send}
        disabled={!file || uploading}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-pitch px-5 py-3.5 text-[15px] font-semibold text-white hover:bg-pitch-deep disabled:bg-slate-300 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      >
        {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
        {uploading ? t("Sending receipt") : t("Send receipt to the ground")}
      </button>
    </div>
  );
}

/**
 * The "Pay online" checkout: a match ticket joined to a bank transfer slip.
 * Shared by bookings and open match spots.
 */
export default function PaymentCheckout(p: CheckoutProps) {
  const countdown = useCountdown(p.paymentStatus === "PENDING" || p.paymentStatus === "REJECTED" ? p.deadline : null);
  const urgent    = countdown !== null && countdown.ms < 30 * 60_000;
  const complaintOpen = p.latestComplaint?.status === "OPEN";
  const { t, locale } = useT();

  const day   = new Date(p.date.slice(0, 10) + "T00:00:00");
  const dow   = formatDay(day, locale, { weekday: "long" });
  const dm    = formatDay(day, locale, { day: "numeric", month: "short" });

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={p.backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-pitch-deep">
        <ArrowLeft className="w-4 h-4" /> {p.backLabel}
      </Link>

      <header className="mt-4 mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] sm:text-[34px] leading-tight font-bold text-pitch-deep tracking-tight">
            {p.paymentStatus === "PAID" ? t("You're booked") : p.paymentStatus === "RECEIPT_SUBMITTED" ? t("Receipt sent") : t("Pay the ground to lock in your slot")}
          </h1>
          <p className="mt-1 text-slate-600 max-w-prose">
            {p.paymentStatus === "PAID"
              ? t("{ground} confirmed your transfer. See you there.", { ground: p.groundName })
              : p.paymentStatus === "RECEIPT_SUBMITTED"
              ? t("{ground} is checking their account. Your booking is confirmed the moment they see the money — we'll notify you.", { ground: p.groundName })
              : t("Transfer the amount below from your banking app, then send a screenshot of the receipt.")}
          </p>
        </div>
        {countdown && !complaintOpen && (
          <div className={`shrink-0 rounded-xl px-4 py-2.5 border ${urgent ? "border-deadline/40 bg-amber-50" : "border-rule bg-white"}`} role="timer" aria-live="off">
            <p className={`text-xs ${urgent ? "text-deadline" : "text-slate-500"}`}>{t("Slot held for")}</p>
            <p className={`font-scoreboard text-[30px] leading-none font-semibold tabular-nums ${urgent ? "text-deadline" : "text-pitch-deep"}`}>
              {countdown.ms > 0 ? countdown.label : "0:00"}
            </p>
          </div>
        )}
      </header>

      <Tracker status={p.paymentStatus} />

      {/* Ticket stub + transfer slip */}
      <div className="mt-8 grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] rounded-2xl bg-white shadow-[0_1px_0_#d9e1da,0_12px_32px_-18px_rgba(15,42,29,0.35)] overflow-hidden">
        <section aria-label={t("Your booking")} className="relative bg-pitch-deep text-white">
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div className="relative p-6 sm:p-7 flex flex-col h-full">
            <p className="text-sm text-white/70">{p.groundName}</p>
            <p className="mt-6 text-white/80 text-sm">{dow}</p>
            <p className="font-scoreboard text-[56px] leading-[0.95] font-bold tracking-tight">{dm}</p>
            <p className="font-scoreboard text-[34px] leading-none font-semibold mt-2 tabular-nums">{p.startTime}–{p.endTime}</p>
            <p className="mt-4 text-[15px] text-white/90">{p.detail}</p>
            <p className="mt-auto pt-8 flex items-start gap-1.5 text-sm text-white/70">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {p.groundAddress}
            </p>
          </div>
          {/* perforation between stub and slip */}
          <span aria-hidden className="hidden md:block absolute -right-3 top-0 bottom-0 w-6 bg-[radial-gradient(circle_at_center,#f8fafc_5px,transparent_5.5px)] bg-size-[24px_18px] bg-repeat-y" />
        </section>

        <section aria-label={t("Bank transfer")} className="bg-slip p-6 sm:p-8">
          {p.paymentStatus === "PAID" ? (
            <div className="h-full flex flex-col justify-center">
              <span className="grid place-items-center w-12 h-12 rounded-full bg-pitch text-white"><Check className="w-6 h-6" /></span>
              <p className="mt-4 text-xl font-semibold text-pitch-deep">{t("Payment received")}</p>
              <p className="mt-1 text-slate-600">{t("Rs. {amount} reached {account}. Booking reference {ref}.", { amount: p.amount.toLocaleString(), account: p.details?.accountName ?? p.groundName, ref: p.reference })}</p>
            </div>
          ) : !p.details ? (
            <p className="text-slate-600">{t("This ground hasn't added a bank account yet. Contact the ground to arrange payment.")}</p>
          ) : (
            <>
              <h2 className="text-[17px] font-semibold text-pitch-deep">{t("Transfer from your banking app")}</h2>
              <dl className="mt-3">
                <SlipField label={t("Amount")} value={String(p.amount)} display={`${t("Rs.")} ${p.amount.toLocaleString()}`} emphasis />
                <SlipField label={t("Account name")} value={p.details.accountName} />
                <SlipField label={t("Account number")} value={p.details.accountNumber.replace(/\s+/g, "")} display={formatAccount(p.details.accountNumber)} />
                <SlipField label={t("Bank")} value={p.details.bankBranch ? `${p.details.bankName}, ${p.details.bankBranch}` : p.details.bankName} />
                <SlipField label={t("Remark")} value={p.reference} display={`${p.reference}`} />
              </dl>
              <p className="mt-3 text-sm text-slate-500">{t("Put the remark in the transfer description so the ground can match your payment.")}</p>
              {p.details.instructions && (
                <p className="mt-3 text-sm text-pitch-deep bg-white rounded-lg px-3 py-2 border border-rule">{p.details.instructions}</p>
              )}
            </>
          )}
        </section>
      </div>

      {/* What to do next */}
      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="text-sm text-slate-600 leading-relaxed md:pr-6">
          {p.paymentStatus === "REJECTED" ? (
            <>
              <p className="font-semibold text-red-700">{t("The ground couldn't match your receipt.")}</p>
              <p className="mt-1">{p.rejectReason ? t("Their note: “{reason}”", { reason: p.rejectReason }) : t("They didn't say why.")} {t("Check the amount and account, then send the receipt again.")}</p>
            </>
          ) : p.paymentStatus === "RECEIPT_SUBMITTED" ? (
            <p>{t("Most grounds confirm within a few hours. If you cancel before then, any refund comes from the ground by bank transfer.")}</p>
          ) : p.paymentStatus === "PENDING" ? (
            <p>{t("If no receipt arrives before the timer runs out, the slot is released for other players and nothing is charged.")}</p>
          ) : null}
        </div>

        <div>
          {(p.paymentStatus === "PENDING" || p.paymentStatus === "REJECTED") && p.details && (
            <Dropzone endpoint={p.uploadEndpoint} onUploaded={p.onChanged} again={p.paymentStatus === "REJECTED"} />
          )}

          {p.paymentStatus === "RECEIPT_SUBMITTED" && p.receiptUrl && (
            <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-pitch hover:underline">
              <FileText className="w-4 h-4" /> {t("View the receipt you sent")}
            </a>
          )}

          {p.paymentStatus === "REJECTED" && (
            <div className="mt-6 pt-6 border-t border-rule">
              {complaintOpen ? (
                <p className="text-sm text-pitch-deep">
                  {t("GoPlay is looking into your complaint. Your slot stays held until it's settled.")}
                </p>
              ) : (
                <>
                  {p.latestComplaint && (
                    <p className="text-sm text-slate-600 mb-3">
                      {p.latestComplaint.status === "RESOLVED" ? t("Your last complaint was resolved.") : t("Your last complaint was closed.")}
                      {p.latestComplaint.adminNote && <> {t("GoPlay's note: {note}", { note: p.latestComplaint.adminNote })}</>}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 mb-3">{t("Sure you paid the right amount? Ask GoPlay to step in.")}</p>
                  <ComplaintForm bookingId={p.bookingId} spotId={p.spotId} onSubmitted={p.onChanged} />
                </>
              )}
            </div>
          )}

          {p.paymentStatus === "PAID" && (
            <Link href={p.backHref} className="inline-flex items-center gap-2 rounded-xl bg-pitch px-5 py-3 text-[15px] font-semibold text-white hover:bg-pitch-deep">
              {p.doneLabel}
            </Link>
          )}

          {p.paymentStatus === "RECEIPT_SUBMITTED" && (
            <button type="button" onClick={p.onChanged} className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-pitch-deep">
              <RefreshCw className="w-3.5 h-3.5" /> {t("Check again")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

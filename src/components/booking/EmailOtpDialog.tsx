"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, MailOpen, X } from "lucide-react";

interface Props {
  /** Prefill — usually the account's email */
  defaultEmail: string;
  onClose:      () => void;
  /** The code checked out — create the booking with this address. Rejects with a message if booking fails. */
  onVerified:   (email: string) => Promise<void>;
}

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Web version of the app's pay-at-ground check: ask for an email, send a 6-digit code,
 *  then a separate code step books once it checks out. Mount it only while open. */
export default function EmailOtpDialog({ defaultEmail, onClose, onVerified }: Props) {
  const [step,     setStep]     = useState<"email" | "code">("email");
  const [email,    setEmail]    = useState(defaultEmail);
  const [code,     setCode]     = useState("");
  const [error,    setError]    = useState("");
  const [notice,   setNotice]   = useState("");
  const [busy,     setBusy]     = useState(false);
  const [verified, setVerified] = useState(false);   // code accepted — only the booking itself is left to retry
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function sendCode() {
    const value = email.trim();
    if (!isEmail(value)) { setError("Enter a valid email address."); return; }
    setBusy(true); setError(""); setNotice("");
    const res  = await fetch("/api/email-verification/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "We couldn't send the code. Try again."); return; }
    if (step === "code") setNotice("A new code is on its way.");
    setStep("code"); setCode(data.devCode ?? "");
    setCooldown(data.resendInSec ?? 60);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function check(value: string) {
    if (busy || (!verified && value.length !== 6)) return;
    setBusy(true); setError(""); setNotice("");
    if (!verified) {
      const res  = await fetch("/api/email-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setBusy(false); setError(data.error ?? "That code isn't right."); setCode(""); return; }
      setVerified(true);
    }
    try { await onVerified(email.trim()); }
    catch (e) { setError(e instanceof Error ? e.message : "Booking failed. Please try again."); }
    finally { setBusy(false); }
  }

  const btn = "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="eo-title"
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          {step === "email" ? <Mail className="w-6 h-6 text-green-600" /> : <MailOpen className="w-6 h-6 text-green-600" />}
        </div>

        {step === "email" ? (
          // Not a <form>: the dialog renders inside BookingForm's form, and forms can't nest
          <div className="space-y-4">
            <h2 id="eo-title" className="text-xl font-extrabold text-slate-900 text-center">Confirm with your email</h2>
            <p className="text-sm text-slate-600 text-center">Pay-on-arrival bookings are confirmed with a 6-digit code. We&apos;ll email it to this address.</p>
            <input type="email" value={email} autoComplete="email" autoFocus aria-label="Email address" placeholder="you@example.com"
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendCode(); } }}
              className={`w-full rounded-xl border-2 ${error ? "border-red-400" : "border-slate-200"} bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none focus:border-green-500`} />
            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
            <button type="button" onClick={sendCode} disabled={busy} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send code
            </button>
            <button type="button" onClick={onClose} className={`${btn} text-green-700 hover:bg-green-50`}>Back</button>
          </div>
        ) : (
          <>
            <h2 id="eo-title" className="text-xl font-extrabold text-slate-900 text-center">Check your email</h2>
            <p className="text-sm text-slate-600 text-center">
              We sent a 6-digit code to <span className="font-bold text-slate-900">{email.trim()}</span>. It expires in 10 minutes — check your spam folder if you can&apos;t see it.
            </p>
            <input ref={inputRef} value={code}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void check(code); } }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" placeholder="••••••" disabled={verified}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(d); setError(""); if (d.length === 6) void check(d); }}
              className={`w-full rounded-xl border-2 ${error ? "border-red-400" : "border-slate-200"} bg-slate-50 py-3 text-center text-3xl font-extrabold tracking-[0.5em] text-slate-900 outline-none focus:border-green-500`} />
            {notice && <p className="text-sm text-green-700 text-center">{notice}</p>}
            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
            <button type="button" onClick={() => check(code)} disabled={busy || (!verified && code.length !== 6)} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {verified ? "Try booking again" : "Verify & book"}
            </button>
            {!verified && (
              <p className="text-sm text-slate-500 text-center">
                Didn&apos;t get it?{" "}
                {cooldown > 0 ? <span>Resend in {cooldown}s</span>
                  : <button type="button" onClick={sendCode} disabled={busy} className="font-semibold text-green-700 hover:underline">Resend code</button>}
              </p>
            )}
            <button type="button" onClick={() => verified ? onClose() : (setStep("email"), setError(""), setCode(""))} className="block mx-auto text-sm font-semibold text-green-700 hover:underline">
              {verified ? "Back to the booking form" : "Wrong email? Change it"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquareText, Phone, X } from "lucide-react";

interface Props {
  open:           boolean;
  phone:          string;
  onClose:        () => void;
  /** The number is proven — carry on with the booking */
  onVerified:     () => void;
  /** Player wants to fix the number in the form */
  onChangeNumber: () => void;
}

function prettyPhone(p: string) {
  const c = p.replace(/[\s\-().]/g, "").replace(/^\+94/, "0").replace(/^94(?=7\d{8}$)/, "0");
  return /^07\d{8}$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}` : p;
}

/** Web version of the app's phone check: confirm the number, text a 6-digit code, then book.
 *  Mount it only while open, so every opening starts fresh at "is this your number?". */
export default function PhoneVerifyDialog({ open, phone, onClose, onVerified, onChangeNumber }: Props) {
  const [step,     setStep]     = useState<"confirm" | "code">("confirm");
  const [code,     setCode]     = useState("");
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function sendCode() {
    setBusy(true); setError("");
    const res  = await fetch("/api/phone-verification/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "We couldn't send the code. Try again."); return; }
    if (data.verified) { onVerified(); return; }
    setStep("code"); setCode(data.devCode ?? "");
    setCooldown(data.resendInSec ?? 60);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function check(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError("");
    const res  = await fetch("/api/phone-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code: value }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "That code isn't right."); setCode(""); return; }
    onVerified();
  }

  const btn = "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="pv-title"
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          {step === "confirm" ? <Phone className="w-6 h-6 text-green-600" /> : <MessageSquareText className="w-6 h-6 text-green-600" />}
        </div>

        {step === "confirm" ? (
          <>
            <h2 id="pv-title" className="text-xl font-extrabold text-slate-900 text-center">Is this your number?</h2>
            <p className="text-2xl font-black text-slate-900 text-center tracking-wide">{prettyPhone(phone)}</p>
            <p className="text-sm text-slate-600 text-center">We&apos;ll text a 6-digit code to this number to confirm your booking. The ground will also use it to reach you.</p>
            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
            <button type="button" onClick={sendCode} disabled={busy} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Yes, send the code
            </button>
            <button type="button" onClick={onChangeNumber} className={`${btn} text-green-700 hover:bg-green-50`}>Change number</button>
          </>
        ) : (
          <>
            <h2 id="pv-title" className="text-xl font-extrabold text-slate-900 text-center">Enter the code</h2>
            <p className="text-sm text-slate-600 text-center">We texted a 6-digit code to {prettyPhone(phone)}. It expires in 5 minutes.</p>
            <input ref={inputRef} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" placeholder="••••••"
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(d); if (d.length === 6) void check(d); }}
              className={`w-full rounded-xl border-2 ${error ? "border-red-400" : "border-slate-200"} bg-slate-50 py-3 text-center text-3xl font-extrabold tracking-[0.5em] text-slate-900 outline-none focus:border-green-500`} />
            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
            <button type="button" onClick={() => check(code)} disabled={busy || code.length !== 6} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify &amp; book
            </button>
            <p className="text-sm text-slate-500 text-center">
              Didn&apos;t get it?{" "}
              {cooldown > 0 ? <span>Resend in {cooldown}s</span>
                : <button type="button" onClick={sendCode} disabled={busy} className="font-semibold text-green-700 hover:underline">Resend code</button>}
            </p>
            <button type="button" onClick={onChangeNumber} className="block mx-auto text-sm font-semibold text-green-700 hover:underline">Wrong number? Change it</button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { CheckCircle, Clock, Loader2, ShieldAlert } from "lucide-react";

interface Props {
  bookingId:        string;
  review:           "PENDING" | "CONFIRMED" | "OVERTURNED" | null;
  disputedAt:       string | null;
  onChanged?:       () => void;
}

/** The player's side of a no-show report, and where GoPlay's review of it stands. */
export default function NoShowDispute({ bookingId, review, disputedAt, onChanged }: Props) {
  const [open,  setOpen]  = useState(false);
  const [text,  setText]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [sent,  setSent]  = useState(!!disputedAt);

  if (review === "OVERTURNED") {
    return <p className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2"><CheckCircle className="w-3.5 h-3.5" />GoPlay reviewed this and removed the no-show from your account.</p>;
  }
  if (review === "CONFIRMED") {
    return <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"><ShieldAlert className="w-3.5 h-3.5" />GoPlay reviewed this no-show and it stands.</p>;
  }
  if (sent) {
    return <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><Clock className="w-3.5 h-3.5" />You disputed this no-show. GoPlay is reviewing it.</p>;
  }

  async function send() {
    setBusy(true); setError("");
    const res  = await fetch(`/api/user/bookings/${bookingId}/dispute-noshow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Couldn't send your dispute."); return; }
    setSent(true);
    onChanged?.();
  }

  return (
    <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-3">
      {!open ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-purple-900">The ground marked you as a no-show.</p>
          <button onClick={() => setOpen(true)} className="text-sm font-semibold text-purple-700 hover:underline">I was there — dispute</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-purple-900" htmlFor={`dispute-${bookingId}`}>What happened? GoPlay reviews every dispute.</label>
          <textarea id={`dispute-${bookingId}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I arrived at 6pm, played with 3 friends and paid Rs. 2,500 in cash to the staff."
            className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={send} disabled={busy || text.trim().length < 10}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send dispute
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-slate-500 px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

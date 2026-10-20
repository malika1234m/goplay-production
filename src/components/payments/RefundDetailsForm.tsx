"use client";

import { useState } from "react";
import { CheckCircle2, Landmark, Loader2, Undo2 } from "lucide-react";

interface Props {
  matchId:         string;
  refundStatus:    "NEEDED" | "PROCESSED";
  refundAmount:    number | null;
  refundDetailsAt: string | null;
  refundedAt:      string | null;
  refundReference: string | null;
  onSaved?:        () => void;
}

/** A refund GoPlay owes for a lobby: where to send it, then confirmation once it's sent. */
export default function RefundDetailsForm({ matchId, refundStatus, refundAmount, refundDetailsAt, refundedAt, refundReference, onSaved }: Props) {
  const [editing, setEditing] = useState(!refundDetailsAt);
  const [form,    setForm]    = useState({ bankName: "", bankBranch: "", accountName: "", accountNumber: "" });
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState("");
  const amount = `Rs. ${Math.round(refundAmount ?? 0).toLocaleString()}`;

  if (refundStatus === "PROCESSED") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-900">Refund sent — {amount}</p>
          <p className="text-xs text-green-800 mt-0.5">
            GoPlay sent it{refundedAt ? ` on ${new Date(refundedAt).toLocaleDateString()}` : ""}{refundReference ? ` · reference ${refundReference}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res  = await fetch(`/api/open-matches/${matchId}/refund-details`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Couldn't save your details."); return; }
    setEditing(false);
    onSaved?.();
  }

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500";
  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Undo2 className="w-5 h-5 text-amber-600" /></div>
        <div>
          <p className="font-bold text-slate-900">GoPlay owes you {amount}</p>
          <p className="text-xs text-slate-500">{refundDetailsAt && !editing ? "We have your bank details — the refund is on its way." : "Tell us where to send your refund."}</p>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2.5">
          <input className={input} placeholder="Bank (e.g. Sampath Bank)" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
          <input className={input} placeholder="Branch (optional)" value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} />
          <input className={input} placeholder="Account holder's name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required />
          <input className={input} placeholder="Account number" inputMode="numeric" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} required />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={busy} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />} Save bank details
          </button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-green-700 hover:underline">Change bank details</button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";

interface Fields {
  bankName:      string;
  bankBranch:    string;
  accountName:   string;
  accountNumber: string;
  instructions:  string;
}

const EMPTY: Fields = { bankName: "", bankBranch: "", accountName: "", accountNumber: "", instructions: "" };

/**
 * Bank account players transfer to when they choose "Pay online".
 * mode "owner": default for every ground (profile). mode "ground": override for one ground.
 */
export default function PaymentDetailsForm({ mode, groundId, onSaved, bare }: { mode: "owner" | "ground"; groundId?: string; onSaved?: () => void; bare?: boolean }) {
  const url = mode === "owner" ? "/api/ground-owner/bank-details" : `/api/ground-owner/grounds/${groundId}/payment-details`;

  const [form,    setForm]    = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (mode === "owner" && d.bankDetails) {
          const b = d.bankDetails;
          setForm({ bankName: b.bankName ?? "", bankBranch: b.bankBranch ?? "", accountName: b.accountHolderName ?? "", accountNumber: b.accountNumber ?? "", instructions: "" });
        } else if (mode === "ground" && d.paymentDetails) {
          const p = d.paymentDetails;
          setForm({ bankName: p.paymentBankName ?? "", bankBranch: p.paymentBankBranch ?? "", accountName: p.paymentAccountName ?? "", accountNumber: p.paymentAccountNumber ?? "", instructions: p.paymentInstructions ?? "" });
        }
      })
      .catch(() => setError("Could not load payment details."))
      .finally(() => setLoading(false));
  }, [url, mode]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const body = mode === "owner"
      ? { bankName: form.bankName, bankBranch: form.bankBranch, accountHolderName: form.accountName, accountNumber: form.accountNumber }
      : { paymentBankName: form.bankName, paymentBankBranch: form.bankBranch, paymentAccountName: form.accountName, paymentAccountNumber: form.accountNumber, paymentInstructions: form.instructions };
    try {
      const res  = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not save.");
      else { setSaved(true); onSaved?.(); }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-pitch";

  return (
    <div className={bare ? "flex flex-col gap-4" : "bg-white rounded-2xl border border-rule p-6 flex flex-col gap-4"}>
      <div className={bare ? "hidden" : "flex items-start gap-3"}>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{mode === "owner" ? "Default payment details" : "Payment details for this ground"}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === "owner"
              ? "Players who choose \"Pay online\" transfer to this account and upload the receipt. Used for every ground that doesn't have its own details."
              : "Players booking this ground transfer here. Leave the account fields blank to use your default details from your profile."}
          </p>
        </div>
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bank name</label>
              <input value={form.bankName} onChange={set("bankName")} maxLength={50} placeholder="e.g. Commercial Bank" className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
              <input value={form.bankBranch} onChange={set("bankBranch")} maxLength={60} placeholder="e.g. Kandy" className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Account holder name</label>
              <input value={form.accountName} onChange={set("accountName")} maxLength={60} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Account number</label>
              <input value={form.accountNumber} onChange={set("accountNumber")} maxLength={24} inputMode="numeric" className={`${input} font-mono`} />
            </div>
          </div>
          {mode === "ground" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Instructions for players (optional)</label>
              <textarea value={form.instructions} onChange={set("instructions")} rows={2} maxLength={500}
                placeholder="e.g. Use your booking reference as the transfer remark."
                className={`${input} resize-none`} />
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="bg-pitch hover:bg-pitch-deep disabled:bg-slate-300 text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save payment details
            </button>
            {saved && <span className="text-xs text-pitch flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Saved</span>}
          </div>
        </>
      )}
    </div>
  );
}

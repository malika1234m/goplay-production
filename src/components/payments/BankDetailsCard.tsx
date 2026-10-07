"use client";

import { useState } from "react";
import { Building2, Check, Copy } from "lucide-react";
import type { PaymentDetails } from "./types";

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the value is still visible */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-blue-100 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className={`text-sm font-semibold text-slate-900 break-all ${mono ? "font-mono tracking-wide" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

/** Where to send a "Pay online" bank transfer. */
export default function BankDetailsCard({
  details,
  amount,
  reference,
}: {
  details:    PaymentDetails;
  amount?:    number;
  reference?: string;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-900">Transfer to the ground&apos;s bank account</p>
      </div>
      <div>
        <CopyRow label="Bank" value={details.bankBranch ? `${details.bankName} — ${details.bankBranch}` : details.bankName} />
        <CopyRow label="Account name" value={details.accountName} />
        <CopyRow label="Account number" value={details.accountNumber} mono />
        {amount !== undefined && <CopyRow label="Amount (Rs.)" value={String(amount)} />}
        {reference && <CopyRow label="Reference (add to your transfer)" value={reference} mono />}
      </div>
      {details.instructions && (
        <p className="text-xs text-blue-800 mt-3 whitespace-pre-line">{details.instructions}</p>
      )}
    </div>
  );
}

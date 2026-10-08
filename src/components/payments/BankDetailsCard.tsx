"use client";

import { useState } from "react";
import { Building2, Check, Copy } from "lucide-react";
import type { PaymentDetails } from "./types";
import { useT } from "@/i18n/I18nProvider";

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the value is still visible */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-rule last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className={`text-sm font-semibold text-slate-900 break-all ${mono ? "font-mono tracking-wide" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={t("Copy {label}", { label })}
        className="shrink-0 p-2 rounded-lg text-pitch hover:bg-pitch/10 transition-colors"
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
  const { t } = useT();
  return (
    <div className="bg-slip border border-rule rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-pitch" />
        <p className="text-sm font-semibold text-pitch-deep">{t("Transfer to the ground's bank account")}</p>
      </div>
      <div>
        <CopyRow label={t("Bank")} value={details.bankBranch ? `${details.bankName} — ${details.bankBranch}` : details.bankName} />
        <CopyRow label={t("Account name")} value={details.accountName} />
        <CopyRow label={t("Account number")} value={details.accountNumber} mono />
        {amount !== undefined && <CopyRow label={t("Amount (Rs.)")} value={String(amount)} />}
        {reference && <CopyRow label={t("Reference (add to your transfer)")} value={reference} mono />}
      </div>
      {details.instructions && (
        <p className="text-xs text-pitch-deep mt-3 whitespace-pre-line">{details.instructions}</p>
      )}
    </div>
  );
}

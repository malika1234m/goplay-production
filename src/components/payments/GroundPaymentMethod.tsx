"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import PaymentOptionsPicker, { type PayOpt } from "./PaymentOptionsPicker";
import { useT } from "@/i18n/I18nProvider";

/** Edit-page section: choose how players pay for this ground. Saves on choice. */
export default function GroundPaymentMethod({ groundId }: { groundId: string }) {
  const [value,  setValue]  = useState<PayOpt | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");
  const { t } = useT();

  useEffect(() => {
    fetch(`/api/ground-owner/grounds/${groundId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setValue((d.ground ?? d).paymentOptions ?? null))
      .catch(() => setError(t("Couldn't load the payment method.")));
  }, [groundId]);

  async function choose(v: PayOpt) {
    const before = value;
    setValue(v); setSaving(true); setSaved(false); setError("");
    const res = await fetch(`/api/ground-owner/grounds/${groundId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentOptions: v }),
    });
    setSaving(false);
    if (!res.ok) { setValue(before); setError((await res.json().catch(() => ({}))).error ?? t("Couldn't save. Try again.")); return; }
    setSaved(true);
  }

  return (
    <section className="bg-white rounded-2xl border border-rule p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-pitch-deep">{t("How players pay")}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t("Players only see what you allow.")}</p>
        </div>
        {saving ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          : saved ? <span className="flex items-center gap-1 text-xs text-pitch"><Check className="w-4 h-4" />{t("Saved")}</span> : null}
      </div>
      {value === undefined
        ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        : <PaymentOptionsPicker name={`pay-${groundId}`} value={value} onChange={choose} disabled={saving} />}
      {value === null && <p className="mt-3 text-[13px] text-deadline">{t("Not set — both allowed for now.")}</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>}
    </section>
  );
}

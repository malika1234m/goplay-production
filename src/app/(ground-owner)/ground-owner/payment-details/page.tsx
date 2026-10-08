"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Landmark, Loader2 } from "lucide-react";
import PaymentDetailsForm from "@/components/payments/PaymentDetailsForm";
import { tk } from "@/i18n/core";
import { statusKey } from "@/i18n/labels";
import { useT } from "@/i18n/I18nProvider";

interface Ground {
  id: string; name: string; city: string; status: string;
  paymentBankName: string | null; paymentBankBranch: string | null;
  paymentAccountName: string | null; paymentAccountNumber: string | null;
}
interface Default { bankName: string | null; bankBranch: string | null; accountHolderName: string | null; accountNumber: string | null }

const grouped = (n: string) => n.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
const last4   = (n: string) => `•••• ${n.replace(/\s+/g, "").slice(-4)}`;

/** The account as players see it on their payment page — a transfer slip. */
function Slip({ bank, branch, name, number }: { bank: string; branch: string | null; name: string; number: string }) {
  const { t } = useT();
  return (
    <dl className="rounded-lg bg-slip border border-rule px-5 py-1">
      {[
        [tk("Account name"), name],
        [tk("Account number"), grouped(number)],
        [tk("Bank"), branch ? `${bank}, ${branch}` : bank],
      ].map(([k, v]) => (
        <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 border-b border-dashed border-rule last:border-b-0">
          <dt className="text-[13px] text-slate-500">{t(k)}</dt>
          <dd className={`text-[15px] font-medium text-pitch-deep ${k === "Account number" ? "tabular-nums tracking-wide" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Status({ tone, children }: { tone: "own" | "default" | "missing"; children: React.ReactNode }) {
  const cls = tone === "own" ? "bg-pitch/10 text-pitch" : tone === "default" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** Where players' "Pay online" transfers go, ground by ground. */
export default function PaymentAccountsPage() {
  const [grounds,  setGrounds]  = useState<Ground[] | null>(null);
  const [fallback, setFallback] = useState<Default | null>(null);
  const [editing,  setEditing]  = useState<string | null>(null);   // ground id, or "default"
  const [busy,     setBusy]     = useState<string | null>(null);
  const [error,    setError]    = useState("");
  const { t } = useT();

  const load = useCallback(async () => {
    try {
      const [g, d] = await Promise.all([
        fetch("/api/ground-owner/grounds", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/ground-owner/bank-details", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setGrounds(g.grounds ?? []);
      setFallback(d.bankDetails ?? null);
    } catch {
      setError(t("Your accounts didn't load. Refresh the page to try again."));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function useDefault(g: Ground) {
    setBusy(g.id);
    setError("");
    try {
      const res = await fetch(`/api/ground-owner/grounds/${g.id}/payment-details`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentBankName: "", paymentBankBranch: "", paymentAccountName: "", paymentAccountNumber: "", paymentInstructions: "" }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? t("Couldn't switch to the default account."));
      setEditing(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (error && !grounds) return <p className="text-red-700">{t(error)}</p>;
  if (!grounds) return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const hasDefault = !!(fallback?.bankName && fallback.accountHolderName && fallback.accountNumber);
  const own   = (g: Ground) => !!(g.paymentBankName && g.paymentAccountName && g.paymentAccountNumber);
  const live  = grounds.filter((g) => g.status === "ACTIVE");
  const ready = live.filter((g) => own(g) || hasDefault).length;
  const allReady = live.length > 0 && ready === live.length;

  return (
    <div className="max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pitch-deep">{t("Payment accounts")}</h1>
        <p className="mt-1 text-slate-600 max-w-prose">
          {t("Where online payments go.")}
        </p>
      </header>

      {/* Readiness */}
      <div className={`mt-6 flex items-center gap-4 rounded-xl border px-5 py-4 ${allReady ? "border-pitch/30 bg-pitch/5" : "border-amber-300 bg-amber-50"}`}>
        <p className="font-scoreboard text-[34px] leading-none font-semibold tabular-nums text-pitch-deep">
          {ready}<span className="text-slate-400"> / {live.length}</span>
        </p>
        <div>
          <p className="text-[15px] font-semibold text-pitch-deep">
            {allReady ? t("All live grounds take online payments") : live.length === 0 ? t("No live grounds yet") : t("grounds can take online payments")}
          </p>
          {!allReady && live.length > 0 && (
            <p className="text-sm text-slate-600">
              {hasDefault ? t("Add an account to the grounds marked Not ready.") : t("Add a default account to cover every ground.")}
            </p>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-700" role="alert">{t(error)}</p>}

      {/* Default account */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h2 className="text-[17px] font-semibold text-pitch-deep">{t("Default account")}</h2>
            <p className="text-sm text-slate-500">{t("For grounds without their own.")}</p>
          </div>
          {hasDefault && editing !== "default" && (
            <button onClick={() => setEditing("default")} className="rounded-lg border border-rule bg-white px-3.5 py-2 text-sm font-medium text-pitch-deep hover:border-pitch">{t("Change")}</button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-rule p-5">
          {editing === "default" ? (
            <>
              <PaymentDetailsForm mode="owner" bare onSaved={() => { setEditing(null); load(); }} />
              <button onClick={() => setEditing(null)} className="mt-3 text-sm text-slate-500 hover:text-pitch-deep">{t("Cancel")}</button>
            </>
          ) : hasDefault ? (
            <Slip bank={fallback!.bankName!} branch={fallback!.bankBranch} name={fallback!.accountHolderName!} number={fallback!.accountNumber!} />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-slip text-pitch shrink-0"><Landmark className="w-6 h-6" /></span>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-pitch-deep">{t("No default account yet")}</p>
                <p className="text-sm text-slate-500">{t("One account covers every ground.")}</p>
              </div>
              <button onClick={() => setEditing("default")}
                className="rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep">{t("Add default account")}</button>
            </div>
          )}
        </div>
      </section>

      {/* Grounds */}
      <section className="mt-10">
        <h2 className="text-[17px] font-semibold text-pitch-deep">{t("Grounds")}</h2>

        <ul className="bg-white rounded-xl border border-rule divide-y divide-rule overflow-hidden">
          {grounds.map((g) => {
            const hasOwn = own(g);
            const open   = editing === g.id;
            return (
              <li key={g.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <span className="grid place-items-center w-11 h-11 rounded-lg bg-pitch-deep text-white font-scoreboard text-xl font-semibold shrink-0" aria-hidden>
                    {g.name[0]?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-pitch-deep">{g.name}</p>
                      {hasOwn ? <Status tone="own"><Check className="w-3.5 h-3.5" />{t("Own account")}</Status>
                        : hasDefault ? <Status tone="default">{t("Uses default")}</Status>
                        : <Status tone="missing"><AlertTriangle className="w-3.5 h-3.5" />{t("Not ready")}</Status>}
                      {g.status !== "ACTIVE" && <Status tone="default">{g.status === "PENDING" ? t("Awaiting approval") : t(statusKey(g.status))}</Status>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {hasOwn ? `${g.paymentAccountName}, ${g.paymentBankName} ${last4(g.paymentAccountNumber!)}`
                        : hasDefault ? `${fallback!.accountHolderName}, ${fallback!.bankName} ${last4(fallback!.accountNumber!)}`
                        : t("{city} — players can only pay at the ground", { city: g.city })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {hasOwn && !open && (
                      <button onClick={() => useDefault(g)} disabled={busy === g.id || !hasDefault} title={hasDefault ? undefined : t("Add a default account first")}
                        className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-pitch-deep disabled:opacity-40">
                        {busy === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Use default instead")}
                      </button>
                    )}
                    <button onClick={() => setEditing(open ? null : g.id)}
                      className="rounded-lg border border-rule bg-white px-3.5 py-2 text-sm font-medium text-pitch-deep hover:border-pitch">
                      {open ? t("Close") : hasOwn ? t("Change") : hasDefault ? t("Separate account") : t("Add account")}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-5 sm:ml-15 rounded-lg border border-dashed border-rule bg-slip/50 p-5">
                    <PaymentDetailsForm mode="ground" groundId={g.id} bare onSaved={() => { setEditing(null); load(); }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 text-sm text-slate-500">{t("Workers can see these. Only you can change them.")}</p>
    </div>
  );
}

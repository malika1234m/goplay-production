"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import PaymentDetailsForm from "@/components/payments/PaymentDetailsForm";

interface Ground {
  id: string; name: string; city: string; status: string; images: string[];
  paymentBankName: string | null; paymentBankBranch: string | null;
  paymentAccountName: string | null; paymentAccountNumber: string | null;
}
interface Default { bankName: string | null; bankBranch: string | null; accountHolderName: string | null; accountNumber: string | null }

const last4 = (n: string) => `••${n.replace(/\s+/g, "").slice(-4)}`;

/** Where players' "Pay online" transfers go, ground by ground. */
export default function PaymentAccountsPage() {
  const [grounds,  setGrounds]  = useState<Ground[] | null>(null);
  const [fallback, setFallback] = useState<Default | null>(null);
  const [editing,  setEditing]  = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, d] = await Promise.all([
      fetch("/api/ground-owner/grounds", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/ground-owner/bank-details", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setGrounds(g.grounds ?? []);
    setFallback(d.bankDetails ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasDefault = !!(fallback?.bankName && fallback.accountHolderName && fallback.accountNumber);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-pitch-deep">Payment accounts</h1>
      <p className="mt-1 text-slate-600 max-w-prose">
        Players who choose Pay online transfer straight into these accounts and send you the receipt.
        Give each ground its own account, or let it use your default one.
      </p>

      {!grounds ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <h2 className="mt-8 mb-3 text-[17px] font-semibold text-pitch-deep">Your grounds</h2>
          <ul className="bg-white rounded-xl border border-rule divide-y divide-rule">
            {grounds.map((g) => {
              const own = !!(g.paymentBankName && g.paymentAccountName && g.paymentAccountNumber);
              const open = editing === g.id;
              return (
                <li key={g.id} className="p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    {g.images[0]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={g.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slip" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      : <span className="w-14 h-14 rounded-lg bg-slip shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-pitch-deep truncate">{g.name}</p>
                      <p className="text-sm text-slate-600">
                        {own
                          ? <>{g.paymentAccountName}, {g.paymentBankName} {last4(g.paymentAccountNumber!)}</>
                          : hasDefault
                          ? <>Uses your default account ({fallback!.bankName} {last4(fallback!.accountNumber!)})</>
                          : <span className="inline-flex items-center gap-1 text-deadline"><AlertTriangle className="w-3.5 h-3.5" /> No account — players can&apos;t pay online</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditing(open ? null : g.id)}
                      className="shrink-0 rounded-lg border border-rule px-3.5 py-2 text-sm font-medium text-pitch-deep hover:border-pitch">
                      {open ? "Close" : own ? "Change" : hasDefault ? "Use a separate account" : "Add account"}
                    </button>
                  </div>
                  {open && (
                    <div className="mt-4 pt-4 border-t border-dashed border-rule">
                      <PaymentDetailsForm mode="ground" groundId={g.id} bare onSaved={load} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <h2 className="mt-10 mb-1 text-[17px] font-semibold text-pitch-deep">Default account</h2>
          <p className="mb-3 text-sm text-slate-600">Used for any ground above that doesn&apos;t have its own account.</p>
          <PaymentDetailsForm mode="owner" onSaved={load} />

          <p className="mt-6 text-sm text-slate-500">Your ground workers can see these accounts while checking receipts, but only you can change them.</p>
        </>
      )}
    </div>
  );
}

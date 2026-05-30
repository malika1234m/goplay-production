"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Crown, Zap, Shield, CheckCircle, XCircle,
  Building2, Loader2, ChevronLeft, ChevronRight,
  Settings2, Calendar, UserCheck, UserX,
} from "lucide-react";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

interface Owner {
  id:            string;
  userId:        string;
  name:          string;
  email:         string;
  businessName:  string | null;
  isActivated:   boolean;
  plan:          PlanKey;
  effectivePlan: PlanKey;
  planExpiresAt: string | null;
  facilityCount: number;
  joinedAt:      string;
  lastPayment:   { amount: number; status: string; paidAt: string | null } | null;
}

const PLAN_ICONS: Record<PlanKey, React.ElementType> = { STARTER: Shield, GROWTH: Zap, PRO: Crown };
const PLAN_STYLES: Record<PlanKey, string> = {
  STARTER: "bg-slate-100 text-slate-600",
  GROWTH:  "bg-blue-100 text-blue-700",
  PRO:     "bg-purple-100 text-purple-700",
};

function PlanBadge({ plan, expired }: { plan: PlanKey; expired?: boolean }) {
  const Icon = PLAN_ICONS[plan];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_STYLES[plan]} ${expired ? "opacity-50" : ""}`}>
      <Icon className="w-3 h-3" />
      {PLAN_CONFIG[plan].label}{expired ? " (exp.)" : ""}
    </span>
  );
}

interface ModalState {
  owner: Owner;
  plan: PlanKey;
  forceActivate: boolean;
  deactivate: boolean;
  expiresAt: string;
  notes: string;
}

export default function AdminOwnersPage() {
  const [owners,    setOwners]    = useState<Owner[]>([]);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [page,      setPage]      = useState(1);
  const [q,         setQ]         = useState("");
  const [planFilter,setPlanFilter]= useState("");
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<ModalState | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(planFilter ? { plan: planFilter } : {}) });
    const res  = await fetch(`/api/admin/owners?${params}`);
    const data = await res.json();
    setOwners(data.owners ?? []);
    setTotal(data.total  ?? 0);
    setPages(data.pages  ?? 1);
    setLoading(false);
  }, [page, q, planFilter]);

  useEffect(() => { load(); }, [load]);

  function openModal(owner: Owner) {
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setModal({ owner, plan: owner.effectivePlan, forceActivate: false, deactivate: false, expiresAt: defaultExpiry, notes: "" });
    setSaveMsg("");
  }

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    setSaveMsg("");
    const body: Record<string, unknown> = { notes: modal.notes };
    if (modal.plan !== modal.owner.effectivePlan) body.plan = modal.plan;
    if (modal.plan !== "STARTER") body.expiresAt = modal.expiresAt;
    if (modal.forceActivate) body.forceActivate = true;
    if (modal.deactivate)    body.deactivate    = true;

    const res = await fetch(`/api/admin/owners/${modal.owner.id}/plan`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveMsg(data.error ?? "Failed."); return; }
    setSaveMsg("Saved successfully.");
    setTimeout(() => { setModal(null); load(); }, 1000);
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Owner Plans</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} ground owner{total !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or email…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-60"
            />
          </div>
          {/* Plan filter */}
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Plans</option>
            <option value="STARTER">Starter</option>
            <option value="GROWTH">Growth</option>
            <option value="PRO">Pro</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : owners.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No owners found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Expiry</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Facilities</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {owners.map((o) => {
                  const isExpired = o.plan !== "STARTER" && o.effectivePlan === "STARTER" && o.planExpiresAt;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 text-sm">{o.name}</p>
                        <p className="text-xs text-slate-400">{o.email}</p>
                        {o.businessName && <p className="text-xs text-slate-400">{o.businessName}</p>}
                        {/* Show status inline on small screens */}
                        <span className="sm:hidden mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 block w-fit">
                          {o.isActivated
                            ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">Active</span>
                            : <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">Not Activated</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {o.isActivated ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                            <XCircle className="w-3 h-3" /> Not Activated
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <PlanBadge plan={o.effectivePlan} expired={!!isExpired} />
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {o.planExpiresAt ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmt(o.planExpiresAt)}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {o.facilityCount}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 hidden lg:table-cell">{fmt(o.joinedAt)}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => openModal(o)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
            <p className="text-xs text-slate-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-1">Manage Plan</h2>
            <p className="text-sm text-slate-500 mb-6">{modal.owner.name} · {modal.owner.email}</p>

            {/* Plan select */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-2">Plan</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["STARTER", "GROWTH", "PRO"] as const).map((p) => {
                  const Icon = PLAN_ICONS[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModal((m) => m ? { ...m, plan: p } : m)}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        modal.plan === p
                          ? `${PLAN_STYLES[p]} border-current`
                          : "border-slate-100 text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {PLAN_CONFIG[p].label}
                      <span className="font-normal text-[10px]">
                        {PLAN_CONFIG[p].monthlyFee === 0 ? "Free" : `Rs. ${PLAN_CONFIG[p].monthlyFee.toLocaleString()}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expiry (for paid plans) */}
            {modal.plan !== "STARTER" && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plan Expiry Date</label>
                <input
                  type="date"
                  value={modal.expiresAt}
                  onChange={(e) => setModal((m) => m ? { ...m, expiresAt: e.target.value } : m)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Activation toggles */}
            <div className="flex flex-col gap-2 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modal.forceActivate}
                  onChange={(e) => setModal((m) => m ? { ...m, forceActivate: e.target.checked, deactivate: e.target.checked ? false : m.deactivate } : m)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex items-center gap-1.5 text-sm text-slate-700">
                  <UserCheck className="w-4 h-4 text-green-500" />
                  Force Activate Account (bypass payment)
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modal.deactivate}
                  onChange={(e) => setModal((m) => m ? { ...m, deactivate: e.target.checked, forceActivate: e.target.checked ? false : m.forceActivate } : m)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex items-center gap-1.5 text-sm text-slate-700">
                  <UserX className="w-4 h-4 text-red-500" />
                  Deactivate Account
                </div>
              </label>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Internal Notes (optional)</label>
              <input
                type="text"
                placeholder="Reason for change…"
                value={modal.notes}
                onChange={(e) => setModal((m) => m ? { ...m, notes: e.target.value } : m)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {saveMsg && (
              <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${saveMsg.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

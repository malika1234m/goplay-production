"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, CheckCircle, AlertCircle, Save, BadgeDollarSign, Wallet, Clock } from "lucide-react";

interface PlatformSettings {
  commissionRate:     string;
  minPayout:          string;
  payoutCooldownDays: string;
}

export default function AdminSettingsPage() {
  const [form,    setForm]    = useState<PlatformSettings>({ commissionRate: "10", minPayout: "1000", payoutCooldownDays: "7" });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setForm(d))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    const res  = await fetch("/api/admin/settings", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        commissionRate:     form.commissionRate,
        minPayout:          form.minPayout,
        payoutCooldownDays: form.payoutCooldownDays,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const set = (key: keyof PlatformSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading settings…</span>
      </div>
    );
  }

  const rate = Number(form.commissionRate);

  return (
    <div className="flex flex-col gap-7 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Changes take effect immediately — new bookings will use the updated rates
        </p>
      </div>

      {/* Commission rate card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <BadgeDollarSign className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Commission Rate</h2>
            <p className="text-xs text-slate-400">Percentage taken from each completed booking</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={form.commissionRate}
              onChange={set("commissionRate")}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0%</span>
              <span>15%</span>
              <span>30%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 w-28 shrink-0">
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={form.commissionRate}
              onChange={set("commissionRate")}
              className="w-full text-sm font-bold text-slate-900 outline-none bg-transparent"
            />
            <span className="text-sm text-slate-400 shrink-0">%</span>
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Live Preview — Rs. 5,000 booking</p>
          <div className="flex justify-between text-slate-600">
            <span>Booking amount</span>
            <span>Rs. 5,000</span>
          </div>
          <div className="flex justify-between text-orange-600">
            <span>Platform fee ({form.commissionRate}%)</span>
            <span>−Rs. {Math.round(5000 * rate / 100).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1.5">
            <span>Ground owner receives</span>
            <span>Rs. {Math.round(5000 * (1 - rate / 100)).toLocaleString()}</span>
          </div>
        </div>

        {rate < 5 && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Low rate — suitable for testing but make sure to raise this before going live.
          </div>
        )}
        {rate === 0 && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            0% means no commission is charged. Earnings will show Rs. 0 platform fee.
          </div>
        )}
      </div>

      {/* Payout limits card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Payout Rules</h2>
            <p className="text-xs text-slate-400">Controls when ground owners can request payouts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Minimum Payout Amount (Rs.)</label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2.5">
              <span className="text-sm text-slate-400 shrink-0">Rs.</span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.minPayout}
                onChange={set("minPayout")}
                className="w-full text-sm font-semibold text-slate-900 outline-none bg-transparent"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Owners can only request a payout if their balance is at least this amount</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />Cooldown Period (days)
            </label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2.5">
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                value={form.payoutCooldownDays}
                onChange={set("payoutCooldownDays")}
                className="w-full text-sm font-semibold text-slate-900 outline-none bg-transparent"
              />
              <span className="text-sm text-slate-400 shrink-0">days</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">How long an owner must wait before requesting another payout</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Saved — new bookings will use updated rates
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 space-y-1">
        <p><strong>Note:</strong> Changing the commission rate only affects future bookings. Existing <code>GroundEarning</code> records keep the rate that was applied at the time of completion.</p>
        <p>Set to <strong>0%</strong> to do test bookings without generating any commission debt.</p>
      </div>
    </div>
  );
}

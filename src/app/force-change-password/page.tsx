"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock, CheckCircle } from "lucide-react";

const REQUIREMENTS = [
  { label: "At least 8 characters",         test: (p: string) => p.length >= 8 },
  { label: "At least one uppercase letter",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "At least one number",            test: (p: string) => /\d/.test(p) },
];

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [form, setForm]               = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [done, setDone]               = useState(false);

  const req = REQUIREMENTS.map((r) => ({ ...r, met: r.test(form.newPassword) }));
  const allMet = req.every((r) => r.met);
  const passwordsMatch = form.newPassword && form.newPassword === form.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet)          { setError("Please meet all password requirements."); return; }
    if (!passwordsMatch)  { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");

    const res  = await fetch("/api/ground-owner/force-change-password", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to update password.");
      return;
    }

    setDone(true);
    const dest = session?.user?.role === "GROUND_WORKER" ? "/worker/dashboard" : "/ground-owner/dashboard";
    setTimeout(() => router.push(dest), 2500);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Password Updated!</h2>
          <p className="text-slate-500 text-sm mb-1">Your account is now secured.</p>
          <p className="text-xs text-slate-400">Redirecting to your dashboard...</p>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-1">
            <div className="bg-green-500 h-1 rounded-full animate-[grow_2.5s_linear_forwards]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <Image src="/logo.jpeg" alt="GoPlay" width={36} height={36} className="rounded-lg bg-white p-0.5 object-contain" />
              <span className="text-white font-bold text-lg">GoPlay</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">Security Update Required</h1>
                <p className="text-green-100 text-sm mt-1 leading-relaxed">
                  {session?.user?.role === "GROUND_WORKER"
                    ? "You've been added as a Ground Worker. Please set a new password to secure your account before continuing."
                    : "Congratulations on becoming a Ground Owner! Please set a new password to secure your upgraded account before continuing."}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Current password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    required
                    value={form.currentPassword}
                    onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                    placeholder="Your registration password"
                    className="w-full pl-9 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    placeholder="Choose a strong password"
                    className="w-full pl-9 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Requirements */}
                {form.newPassword && (
                  <ul className="mt-2 space-y-1">
                    {req.map((r) => (
                      <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? "text-green-600" : "text-slate-400"}`}>
                        <CheckCircle className={`w-3.5 h-3.5 ${r.met ? "text-green-500" : "text-slate-300"}`} />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    className={`w-full pl-9 pr-10 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 placeholder:text-slate-400 ${
                      form.confirmPassword
                        ? passwordsMatch
                          ? "border-green-300 focus:ring-green-500"
                          : "border-red-300 focus:ring-red-400"
                        : "border-slate-200 focus:ring-green-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !allMet || !passwordsMatch}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Updating Password..." : "Update Password & Continue"}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-5">
              This step is required to access your dashboard.
              <br />You cannot skip this step.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [showCon,   setShowCon]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm)          { setError("Passwords do not match."); return; }
    if (password.length < 8)           { setError("Password must be at least 8 characters."); return; }
    if (!/[a-zA-Z]/.test(password))    { setError("Password must contain at least one letter."); return; }
    if (!/[0-9]/.test(password))       { setError("Password must contain at least one number."); return; }

    setLoading(true);
    setError("");

    const res  = await fetch("/api/auth/reset-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Password reset!</h1>
        <p className="text-sm text-slate-500 mb-6">
          Your password has been updated. Redirecting you to sign in…
        </p>
        <Link
          href="/login"
          className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Sign in now
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid link</h1>
        <p className="text-sm text-slate-500 mb-6">This reset link is invalid or has expired.</p>
        <Link
          href="/forgot-password"
          className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
        <p className="text-slate-500 text-sm mt-1">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
            <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Min 8 characters, at least one letter and one number.</p>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
          <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
            <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type={showCon ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400"
            />
            <button type="button" onClick={() => setShowCon((v) => !v)} className="text-slate-400 hover:text-slate-600">
              {showCon ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
            {(error.includes("expired") || error.includes("used")) && (
              <Link href="/forgot-password" className="block mt-1 text-xs underline text-red-500 hover:text-red-700">
                Request a new reset link
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Resetting…" : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
      <p className="text-center text-sm text-slate-400 mt-6">
        Remembered it?{" "}
        <Link href="/login" className="text-white font-medium hover:text-green-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

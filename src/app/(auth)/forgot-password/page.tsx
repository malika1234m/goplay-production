"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import Turnstile, { turnstileEnabled } from "@/components/security/Turnstile";

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");
  const [captcha,   setCaptcha]   = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);   // remount = fresh single-use token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (turnstileEnabled && !captcha) { setError("Please wait a moment for the security check, then try again."); return; }
    setLoading(true);
    setError("");

    const res  = await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, turnstileToken: captcha ?? "" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setCaptcha(null); setCaptchaKey((k) => k + 1);
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-sm text-slate-500 mb-1">
            If <span className="font-medium text-slate-700">{email}</span> is registered, we&apos;ve sent a password reset link.
          </p>
          <p className="text-xs text-slate-400 mb-6">The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Forgot password?</h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400"
              />
            </div>
          </div>

          <Turnstile key={captchaKey} action="forgot_password" onToken={setCaptcha} />

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-slate-400 mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-white font-medium hover:text-green-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

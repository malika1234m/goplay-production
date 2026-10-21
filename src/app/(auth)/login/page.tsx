"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Eye, EyeOff, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import Turnstile, { turnstileEnabled } from "@/components/security/Turnstile";
import GoogleButton from "@/components/auth/GoogleButton";
import AuthTabs from "@/components/auth/AuthTabs";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const registered   = searchParams.get("registered") === "1";
  // Set by the Google sign-in callback when it can't let someone in
  const googleError  = { google: "Google sign-in didn't work. Please try again.", inactive: "Your account has been deactivated. Please contact support." }[searchParams.get("error") ?? ""] ?? "";

  const [form,         setForm]         = useState({ email: "", password: "" });
  const [touched,      setTouched]      = useState({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [captcha,      setCaptcha]      = useState<string | null>(null);
  const [captchaKey,   setCaptchaKey]   = useState(0);   // remount = fresh single-use token

  const emailError    = touched.email    && !form.email.trim()    ? "Email address is required."  : "";
  const passwordError = touched.password && !form.password.trim() ? "Password is required."       : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!form.email.trim() || !form.password.trim()) return;
    if (turnstileEnabled && !captcha) { setError("Please wait a moment for the security check, then try again."); return; }

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email:    form.email,
      password: form.password,
      turnstileToken: captcha ?? "",
      redirect: false,
    });

    setLoading(false);
    if (result?.error) { setCaptcha(null); setCaptchaKey((k) => k + 1); }

    // next-auth reports the custom reason in `code`; `error` is just "CredentialsSignin"
    if (result?.code === "blocked") {
      setError("This account has been blocked. Check your email for details, or contact official.goplay.support@gmail.com.");
      return;
    }
    if (result?.code === "captcha") {
      setError("The security check didn't go through. Please try again.");
      return;
    }
    if (result?.code === "rate_limit") {
      setError("Too many login attempts. Please wait 15 minutes and try again.");
      return;
    }
    if (result?.error) {
      setError("Invalid email or password. Please try again.");
      return;
    }

    const session = await getSession();
    const role    = session?.user?.role;
    const mustChange = session?.user?.mustChangePassword;

    if (mustChange) {
      router.push("/force-change-password");
      return;
    }

    if      (role === "ADMIN")         router.push("/admin/dashboard");
    else if (role === "GROUND_OWNER")  router.push("/ground-owner/dashboard");
    else if (role === "GROUND_WORKER") router.push("/worker/dashboard");
    else                               router.push("/dashboard");

    router.refresh();
  };

  const inputClass = (err: string) =>
    `w-full h-12 px-4 rounded-xl border bg-white text-slate-900 placeholder-slate-400 text-base sm:text-sm focus:outline-none focus:ring-2 transition ${
      err
        ? "border-red-300 focus:ring-red-300"
        : "border-slate-200 focus:ring-green-500 focus:border-transparent"
    }`;

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/10 ring-1 ring-slate-100 p-6 sm:p-8 space-y-6">
        <AuthTabs />

        <div>
          <p className="font-scoreboard text-sm font-bold uppercase tracking-[0.2em] text-green-600">Matchday</p>
          <h1 className="font-scoreboard text-4xl font-bold uppercase tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Players, ground owners and staff sign in here.</p>
        </div>

        {/* Registered success banner */}
        {registered && (
          <div role="status" className="flex items-center gap-2.5 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Account created! Sign in to get started.
          </div>
        )}

        {googleError && (
          <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{googleError}</div>
        )}

        <GoogleButton />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "login-email-error" : undefined}
              className={inputClass(emailError)}
            />
            {emailError && <p id="login-email-error" className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs font-medium text-green-700 hover:text-green-800">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder="Your password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "login-password-error" : undefined}
                className={inputClass(passwordError) + " pr-12"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            {passwordError && <p id="login-password-error" className="text-xs text-red-600 mt-1">{passwordError}</p>}
          </div>

          <Turnstile key={captchaKey} action="login" onToken={setCaptcha} />

          {error && (
            <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group w-full h-12 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-600/25"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        New to GoPlay?{" "}
        <Link href="/register" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
          Create a free account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-[520px] bg-white rounded-3xl animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}

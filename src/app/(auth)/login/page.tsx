"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const registered   = searchParams.get("registered") === "1";

  const [form,         setForm]         = useState({ email: "", password: "" });
  const [touched,      setTouched]      = useState({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const emailError    = touched.email    && !form.email.trim()    ? "Email address is required."  : "";
  const passwordError = touched.password && !form.password.trim() ? "Password is required."       : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!form.email.trim() || !form.password.trim()) return;

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email:    form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error === "rate_limit") {
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
    `w-full px-4 py-3 rounded-xl border text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition ${
      err
        ? "border-red-300 focus:ring-red-300"
        : "border-slate-200 focus:ring-green-500 focus:border-transparent"
    }`;

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your GoPlay account</p>
        </div>

        {/* Registered success banner */}
        {registered && (
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Account created! Sign in to get started.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              className={inputClass(emailError)}
            />
            {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-green-600 hover:text-green-700">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder="••••••••"
                className={inputClass(passwordError) + " pr-11"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
          </div>

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
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-slate-400 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-white font-medium hover:text-green-300 transition-colors">
          Create one free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-80 bg-white rounded-2xl animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}

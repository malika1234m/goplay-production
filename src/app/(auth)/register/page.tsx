"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// ── Validators ────────────────────────────────────────────────────────────────
function validateName(v: string) {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().length < 2) return "Name must be at least 2 characters.";
  if (v.trim().length > 50) return "Name must be under 50 characters.";
  if (!/^[a-zA-Z\s'-]+$/.test(v.trim())) return "Name can only contain letters, spaces, hyphens and apostrophes.";
  return "";
}

function validateEmail(v: string) {
  if (!v.trim()) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  return "";
}

function validatePhone(v: string) {
  if (!v.trim()) return ""; // optional
  const cleaned = v.replace(/[\s\-().]/g, "");
  if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned))
    return "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567).";
  return "";
}

function validatePassword(v: string) {
  if (!v) return "Password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(v)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(v)) return "Password must contain at least one number.";
  return "";
}

function passwordStrength(v: string): { label: string; color: string; width: string } {
  if (!v) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (v.length >= 8)  score++;
  if (v.length >= 12) score++;
  if (/[a-zA-Z]/.test(v) && /[0-9]/.test(v)) score++;
  if (/[^a-zA-Z0-9]/.test(v)) score++;
  if (score <= 1) return { label: "Weak",   color: "bg-red-400",    width: "25%" };
  if (score === 2) return { label: "Fair",   color: "bg-yellow-400", width: "50%" };
  if (score === 3) return { label: "Good",   color: "bg-blue-400",   width: "75%" };
  return              { label: "Strong", color: "bg-green-500",  width: "100%" };
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function inputClass(err: string) {
  return `w-full px-4 py-3 rounded-xl border text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition ${
    err
      ? "border-red-300 focus:ring-red-300"
      : "border-slate-200 focus:ring-green-500 focus:border-transparent"
  }`;
}

// ── Form ──────────────────────────────────────────────────────────────────────
function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [touched, setTouched] = useState({ name: false, email: false, phone: false, password: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const errors = {
    name:     validateName(form.name),
    email:    validateEmail(form.email),
    phone:    validatePhone(form.phone),
    password: validatePassword(form.password),
  };

  const strength = passwordStrength(form.password);

  const touch = (field: keyof typeof touched) =>
    setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, password: true });

    if (errors.name || errors.email || errors.phone || errors.password) return;

    setLoading(true);
    setServerError("");

    const res  = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, role: "USER" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setServerError(data.error ?? "Something went wrong. Please try again.");
    } else {
      router.push("/login?registered=1");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Join thousands of players on GoPlay</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => touch("name")}
              placeholder="Malika Perera"
              className={inputClass(touched.name ? errors.name : "")}
            />
            {touched.name && <FieldError msg={errors.name} />}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => touch("email")}
              placeholder="you@example.com"
              className={inputClass(touched.email ? errors.email : "")}
            />
            {touched.email && <FieldError msg={errors.email} />}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onBlur={() => touch("phone")}
              placeholder="+94 77 123 4567"
              className={inputClass(touched.phone ? errors.phone : "")}
            />
            {touched.phone && <FieldError msg={errors.phone} />}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => touch("password")}
                placeholder="Min 8 characters"
                className={inputClass(touched.password ? errors.password : "")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {form.password && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className={`text-xs mt-1 ${
                  strength.label === "Strong" ? "text-green-600"
                  : strength.label === "Good" ? "text-blue-500"
                  : strength.label === "Fair" ? "text-yellow-600"
                  : "text-red-500"
                }`}>{strength.label}</p>
              </div>
            )}
            {touched.password && <FieldError msg={errors.password} />}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-slate-600 underline">Terms</Link> and{" "}
            <Link href="/privacy" className="text-slate-600 underline">Privacy Policy</Link>.
          </p>
        </form>
      </div>

      <p className="text-center text-sm text-slate-400 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-white font-medium hover:text-green-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-96 bg-white rounded-2xl animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import Turnstile, { turnstileEnabled } from "@/components/security/Turnstile";
import GoogleButton from "@/components/auth/GoogleButton";
import AuthTabs from "@/components/auth/AuthTabs";

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
function FieldError({ id, msg }: { id: string; msg: string }) {
  if (!msg) return null;
  return <p id={id} className="text-xs text-red-600 mt-1">{msg}</p>;
}

function inputClass(err: string) {
  return `w-full h-12 px-4 rounded-xl border bg-white text-slate-900 placeholder-slate-400 text-base sm:text-sm focus:outline-none focus:ring-2 transition ${
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
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);   // remount = fresh single-use token

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
    if (turnstileEnabled && !captcha) { setServerError("Please wait a moment for the security check, then try again."); return; }

    setLoading(true);
    setServerError("");

    const res  = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, role: "USER", turnstileToken: captcha ?? "" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setCaptcha(null); setCaptchaKey((k) => k + 1);
      setServerError(data.error ?? "Something went wrong. Please try again.");
    } else {
      router.push("/login?registered=1");
    }
  };

  // Accessible wiring for a field: its error is announced and linked to the input
  const fieldA11y = (field: keyof typeof touched) => {
    const err = touched[field] ? errors[field] : "";
    return { "aria-invalid": !!err, "aria-describedby": err ? `reg-${field}-error` : undefined };
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/10 ring-1 ring-slate-100 p-6 sm:p-8 space-y-6">
        <AuthTabs />

        <div>
          <p className="font-scoreboard text-sm font-bold uppercase tracking-[0.2em] text-green-600">Join the squad</p>
          <h1 className="font-scoreboard text-4xl font-bold uppercase tracking-tight text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Book grounds and join open matches across Sri Lanka. It&apos;s free.</p>
        </div>

        <GoogleButton label="Sign up with Google" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <div>
            <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => touch("name")}
              placeholder="Malika Perera"
              {...fieldA11y("name")}
              className={inputClass(touched.name ? errors.name : "")}
            />
            {touched.name && <FieldError id="reg-name-error" msg={errors.name} />}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => touch("email")}
              placeholder="you@example.com"
              {...fieldA11y("email")}
              className={inputClass(touched.email ? errors.email : "")}
            />
            {touched.email && <FieldError id="reg-email-error" msg={errors.email} />}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onBlur={() => touch("phone")}
              placeholder="077 123 4567"
              {...fieldA11y("phone")}
              className={inputClass(touched.phone ? errors.phone : "")}
            />
            {touched.phone && <FieldError id="reg-phone-error" msg={errors.phone} />}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => touch("password")}
                placeholder="8+ characters and a number"
                {...fieldA11y("password")}
                className={inputClass(touched.password ? errors.password : "") + " pr-12"}
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

            {/* Strength meter: four segments, like a fitness bar */}
            {form.password && (
              <div className="mt-2" aria-live="polite">
                <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                  {[25, 50, 75, 100].map((step) => (
                    <span key={step} className={`h-1.5 rounded-full transition-colors duration-300 ${
                      parseInt(strength.width) >= step ? strength.color : "bg-slate-100"
                    }`} />
                  ))}
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  strength.label === "Strong" ? "text-green-700"
                  : strength.label === "Good" ? "text-blue-700"
                  : strength.label === "Fair" ? "text-amber-700"
                  : "text-red-600"
                }`}>Password strength: {strength.label}</p>
              </div>
            )}
            {touched.password && <FieldError id="reg-password-error" msg={errors.password} />}
          </div>

          <Turnstile key={captchaKey} action="register" onToken={setCaptcha} />

          {serverError && (
            <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group w-full h-12 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-1 shadow-lg shadow-green-600/25"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? "Creating account..." : "Create account"}
            {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
          </button>

          <p className="text-xs text-slate-500 text-center">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-slate-700 underline">Terms</Link> and{" "}
            <Link href="/privacy" className="text-slate-700 underline">Privacy Policy</Link>.
          </p>
        </form>
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-green-700 font-semibold hover:text-green-800 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-[640px] bg-white rounded-3xl animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}

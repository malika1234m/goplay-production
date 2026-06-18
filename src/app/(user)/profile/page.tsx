"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2, User, Mail, Phone, Shield,
  CalendarCheck, CheckCircle, XCircle, Clock,
  Eye, EyeOff, KeyRound, CalendarDays, Zap,
  AlertCircle, ChevronRight, BadgeCheck,
} from "lucide-react";

type Tab = "personal" | "security";

interface UserProfile {
  name: string; email: string; phone: string | null;
  role: string; createdAt: string;
}
interface Stats {
  total: number; upcoming: number; completed: number; cancelled: number;
}

function initials(name: string) { return name?.[0]?.toUpperCase() ?? "U"; }
function avatarColor(name: string) {
  const palette = [
    "from-green-500 to-emerald-600",
    "from-blue-500 to-cyan-600",
    "from-violet-500 to-purple-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
  ];
  return palette[name.charCodeAt(0) % palette.length];
}

function InputField({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <input className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400" {...props} />
    </div>
  );
}

function PwField({ label, value, show, onChange, onToggle }: {
  label: string; value: string; show: boolean;
  onChange: (v: string) => void; onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
        <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
        <input type={show ? "text" : "password"} required value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400" />
        <button type="button" onClick={onToggle} className="text-slate-400 hover:text-slate-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const [tab,     setTab]     = useState<Tab>("personal");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [pForm,   setPForm]   = useState({ name: "", phone: "" });
  const [pSaving, setPSaving] = useState(false);
  const [pSaved,  setPSaved]  = useState(false);
  const [pError,  setPError]  = useState("");

  const [pwForm,   setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState("");
  const [showPw,   setShowPw]   = useState({ current: false, next: false, confirm: false });

  useEffect(() => {
    fetch("/api/user/profile").then((r) => r.json()).then((d) => {
      if (d.user) { setProfile(d.user); setPForm({ name: d.user.name ?? "", phone: d.user.phone ?? "" }); }
      if (d.stats) setStats(d.stats);
    }).finally(() => setLoading(false));
  }, []);

  const savePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name.trim() || pForm.name.trim().length < 2) { setPError("Full name must be at least 2 characters."); return; }
    if (pForm.name.trim().length > 50) { setPError("Full name must be under 50 characters."); return; }
    if (pForm.phone.trim()) {
      const cleaned = pForm.phone.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) { setPError("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)."); return; }
    }
    setPSaving(true); setPError("");
    try {
      const res  = await fetch("/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pForm) });
      const data = await res.json();
      if (!res.ok) { setPError(data.error ?? "Failed to save."); return; }
      setProfile((p) => p ? { ...p, name: pForm.name, phone: pForm.phone || null } : p);
      setPSaved(true); setTimeout(() => setPSaved(false), 3000);
    } catch {
      setPError("Network error. Please check your connection and try again.");
    } finally {
      setPSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    if (pwForm.next.length < 8)         { setPwError("Password must be at least 8 characters."); return; }
    if (!/[a-zA-Z]/.test(pwForm.next))  { setPwError("Password must contain at least one letter."); return; }
    if (!/[0-9]/.test(pwForm.next))     { setPwError("Password must contain at least one number."); return; }
    setPwSaving(true); setPwError("");
    try {
      const res  = await fetch("/api/user/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error ?? "Failed to change password."); return; }
      setPwForm({ current: "", next: "", confirm: "" });
      setPwSaved(true); setTimeout(() => setPwSaved(false), 4000);
    } catch {
      setPwError("Network error. Please check your connection and try again.");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96 text-slate-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading profile…</span>
    </div>
  );

  const name = profile?.name ?? "User";
  const memberSince = profile
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-slate-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Hero header ─────────────────────────────────────────── */}
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />

          <div className="px-6 sm:px-8 py-7">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className={`w-20 h-20 bg-gradient-to-br ${avatarColor(name)} rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-md shrink-0`}>
                {initials(name)}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{name}</h1>
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <BadgeCheck className="w-3 h-3" /> Player
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{profile?.email}</p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                  {profile?.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-300" /> {profile.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-slate-300" /> Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100">
            {[
              { label: "Total Bookings", value: stats?.total     ?? 0, icon: CalendarCheck, color: "text-green-600" },
              { label: "Upcoming",       value: stats?.upcoming  ?? 0, icon: Clock,         color: "text-blue-600"  },
              { label: "Completed",      value: stats?.completed ?? 0, icon: CheckCircle,   color: "text-emerald-600" },
              { label: "Cancelled",      value: stats?.cancelled ?? 0, icon: XCircle,       color: "text-red-500"   },
            ].map(({ label, value, icon: Icon, color }, i, arr) => (
              <div key={label} className={`px-6 py-5 text-center ${i < arr.length - 1 ? "border-r border-slate-100" : ""} ${i >= 2 ? "border-t sm:border-t-0 border-slate-100" : ""}`}>
                <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two-column body ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── LEFT: form card ─────────────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Tab nav */}
            <div className="flex border-b border-slate-100">
              {([
                { id: "personal" as Tab, label: "Personal Info", icon: User   },
                { id: "security" as Tab, label: "Security",      icon: Shield },
              ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    tab === id
                      ? "border-green-500 text-green-600 bg-green-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            <div className="p-7">
              {/* ── Personal Info ── */}
              {tab === "personal" && (
                <form onSubmit={savePersonal} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
                    <InputField icon={User} type="text" required value={pForm.name}
                      onChange={(e) => setPForm({ ...pForm, name: (e.target as HTMLInputElement).value })}
                      placeholder="Your full name" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email Address</label>
                    <div className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50">
                      <Mail className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="flex-1 text-sm text-slate-400">{profile?.email}</span>
                      <span className="text-[11px] text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-md font-medium">Read only</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed. Contact support if needed.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                    <InputField icon={Phone} type="tel" value={pForm.phone}
                      onChange={(e) => setPForm({ ...pForm, phone: (e.target as HTMLInputElement).value })}
                      placeholder="+94 77 123 4567" />
                    <p className="text-xs text-slate-400 mt-1.5">Used for booking confirmations and match notifications.</p>
                  </div>

                  {pError && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{pError}
                    </div>
                  )}

                  <button type="submit" disabled={pSaving}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                    {pSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      : pSaved
                      ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                      : "Save Changes"}
                  </button>
                </form>
              )}

              {/* ── Security ── */}
              {tab === "security" && (
                <form onSubmit={savePassword} className="space-y-5">
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5">
                    <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Use a strong password with at least 8 characters, mixing letters and numbers. Never share it with anyone.
                    </p>
                  </div>

                  <PwField label="Current Password" value={pwForm.current}
                    show={showPw.current} onChange={(v) => setPwForm({ ...pwForm, current: v })}
                    onToggle={() => setShowPw((s) => ({ ...s, current: !s.current }))} />
                  <PwField label="New Password" value={pwForm.next}
                    show={showPw.next} onChange={(v) => setPwForm({ ...pwForm, next: v })}
                    onToggle={() => setShowPw((s) => ({ ...s, next: !s.next }))} />
                  <PwField label="Confirm New Password" value={pwForm.confirm}
                    show={showPw.confirm} onChange={(v) => setPwForm({ ...pwForm, confirm: v })}
                    onToggle={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))} />

                  {pwError && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{pwError}
                    </div>
                  )}
                  {pwSaved && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 px-4 py-3 rounded-xl">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Password changed successfully.
                    </div>
                  )}

                  <button type="submit" disabled={pwSaving}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                    {pwSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : <><Shield className="w-4 h-4" /> Update Password</>}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── RIGHT: sidebar ──────────────────────────────────── */}
          <div className="space-y-4">

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Quick Links</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { href: "/my-bookings",            icon: CalendarDays, label: "My Bookings",  sub: "View all your reservations",   color: "text-blue-600 bg-blue-50"  },
                  { href: "/open-matches/my-matches",icon: Zap,         label: "My Matches",   sub: "Open match lobbies you joined", color: "text-green-600 bg-green-50" },
                  { href: "/dashboard",              icon: User,        label: "Dashboard",    sub: "Overview of your activity",    color: "text-slate-600 bg-slate-100" },
                ].map(({ href, icon: Icon, label, sub, color }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{label}</p>
                      <p className="text-[11px] text-slate-400 truncate">{sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Account info */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-800 mb-1">Account Info</p>
              <div className="space-y-2.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Account type</span>
                  <span className="font-medium text-slate-700 capitalize">{profile?.role?.toLowerCase().replace("_", " ") ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Member since</span>
                  <span className="font-medium text-slate-700">{memberSince}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone</span>
                  <span className={`font-medium ${profile?.phone ? "text-green-600" : "text-amber-600"}`}>
                    {profile?.phone ? "Added" : "Not set"}
                  </span>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Keep your number up to date</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                We send booking confirmations and open match alerts to your phone number.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Loader2, User, Mail, Phone, Shield, Building2,
  MapPin, AlignLeft, CheckCircle, Clock, Star,
  CalendarCheck, Eye, EyeOff, Save, KeyRound,
  Wallet, LayoutGrid,
} from "lucide-react";
import Link from "next/link";

type Tab = "personal" | "business" | "security";

interface Profile {
  name: string; email: string; phone: string | null; createdAt: string;
  groundOwnerProfile: {
    businessName: string | null; bio: string | null;
    address: string | null; city: string | null; phone: string | null;
  } | null;
}
interface Stats {
  totalGrounds: number; activeGrounds: number;
  pendingGrounds: number; totalBookings: number; totalReviews: number;
}

function initials(name: string) { return name?.[0]?.toUpperCase() ?? "G"; }
function avatarColor(name: string) {
  const palette = ["from-green-500 to-emerald-600","from-teal-500 to-cyan-600","from-blue-500 to-indigo-600","from-violet-500 to-purple-600","from-orange-500 to-amber-600"];
  return palette[name.charCodeAt(0) % palette.length];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function TextInput({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) {
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
    <Field label={label}>
      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
        <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
        <input type={show ? "text" : "password"} required value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400" />
        <button type="button" onClick={onToggle} className="text-slate-400 hover:text-slate-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </Field>
  );
}

export default function GroundOwnerProfilePage() {
  const [tab,     setTab]     = useState<Tab>("personal");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [pForm,   setPForm]   = useState({ name: "", phone: "" });
  const [bForm,   setBForm]   = useState({ businessName: "", bio: "", address: "", city: "" });
  const [pSaving, setPSaving] = useState(false);
  const [pSaved,  setPSaved]  = useState(false);
  const [pError,  setPError]  = useState("");

  const [pwForm,   setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState("");
  const [showPw,   setShowPw]   = useState({ current: false, next: false, confirm: false });

  useEffect(() => {
    fetch("/api/ground-owner/profile").then((r) => r.json()).then((d) => {
      if (d.user) {
        setProfile(d.user);
        const p = d.user.groundOwnerProfile;
        setPForm({ name: d.user.name ?? "", phone: d.user.phone ?? "" });
        setBForm({
          businessName: p?.businessName ?? "",
          bio:          p?.bio          ?? "",
          address:      p?.address      ?? "",
          city:         p?.city         ?? "",
        });
      }
      if (d.stats) setStats(d.stats);
    }).finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name.trim() || pForm.name.trim().length < 2) { setPError("Full name must be at least 2 characters."); return; }
    if (pForm.name.trim().length > 50) { setPError("Full name must be under 50 characters."); return; }
    if (pForm.phone.trim()) {
      const cleaned = pForm.phone.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) { setPError("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)."); return; }
    }
    if (bForm.businessName.trim().length > 100) { setPError("Business name must be under 100 characters."); return; }
    if (bForm.bio.trim().length > 500)           { setPError("Bio must be under 500 characters."); return; }
    setPSaving(true); setPError("");
    const res  = await fetch("/api/ground-owner/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pForm, ...bForm }),
    });
    const data = await res.json();
    setPSaving(false);
    if (!res.ok) { setPError(data.error ?? "Failed to save."); return; }
    setProfile((p) => p ? { ...p, name: pForm.name, phone: pForm.phone || null } : p);
    setPSaved(true); setTimeout(() => setPSaved(false), 3000);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    if (pwForm.next.length < 8)        { setPwError("Password must be at least 8 characters."); return; }
    if (!/[a-zA-Z]/.test(pwForm.next)) { setPwError("Password must contain at least one letter."); return; }
    if (!/[0-9]/.test(pwForm.next))    { setPwError("Password must contain at least one number."); return; }
    setPwSaving(true); setPwError("");
    const res  = await fetch("/api/user/password", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (!res.ok) { setPwError(data.error ?? "Failed to change password."); return; }
    setPwForm({ current: "", next: "", confirm: "" });
    setPwSaved(true); setTimeout(() => setPwSaved(false), 4000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96 text-slate-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading profile…</span>
    </div>
  );

  const name = profile?.name ?? "Owner";
  const businessName = profile?.groundOwnerProfile?.businessName;
  const city = profile?.groundOwnerProfile?.city;
  const memberSince = profile
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "personal", label: "Personal Info",  icon: User },
    { id: "business", label: "Business Info",  icon: Building2 },
    { id: "security", label: "Security",       icon: Shield },
  ];

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* ── Profile card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">

        {/* Banner */}
        <div className="bg-gradient-to-br from-green-700 to-emerald-500 px-5 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className={`w-20 h-20 bg-gradient-to-br ${avatarColor(name)} rounded-2xl flex items-center justify-center text-white text-3xl font-black ring-4 ring-white/30 shrink-0 shadow-lg`}>
              {initials(name)}
            </div>
            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-2xl font-bold leading-tight">{name}</h1>
              {businessName && (
                <p className="text-green-100 text-sm font-medium mt-0.5">{businessName}</p>
              )}
              <p className="text-green-200 text-sm mt-0.5">{profile?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white text-xs px-3 py-1 rounded-full font-semibold">
                  <Building2 className="w-3 h-3" />Ground Owner
                </span>
                {city && (
                  <span className="inline-flex items-center gap-1 bg-white/15 text-green-100 text-xs px-3 py-1 rounded-full">
                    <MapPin className="w-3 h-3" />{city}
                  </span>
                )}
                <span className="text-green-200 text-xs">Since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-7 pt-6 border-t border-white/20">
            {[
              { label: "Grounds",     value: stats?.totalGrounds   ?? 0, icon: Building2 },
              { label: "Active",      value: stats?.activeGrounds  ?? 0, icon: CheckCircle },
              { label: "Pending",     value: stats?.pendingGrounds ?? 0, icon: Clock },
              { label: "Bookings",    value: stats?.totalBookings  ?? 0, icon: CalendarCheck },
              { label: "Reviews",     value: stats?.totalReviews   ?? 0, icon: Star },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <Icon className="w-4 h-4 text-white/70 mx-auto mb-1" />
                <p className="text-white text-xl font-bold">{value}</p>
                <p className="text-green-200 text-xs mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/40">
          <Link href="/ground-owner/payouts"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-green-300 hover:bg-green-50 transition-all group">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors shrink-0">
              <Wallet className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 group-hover:text-green-700">Bank & Payouts</p>
              <p className="text-xs text-slate-400 truncate">Manage bank details</p>
            </div>
          </Link>
          <Link href="/ground-owner/grounds"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-green-300 hover:bg-green-50 transition-all group">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors shrink-0">
              <LayoutGrid className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 group-hover:text-green-700">My Grounds</p>
              <p className="text-xs text-slate-400 truncate">View & manage facilities</p>
            </div>
          </Link>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-slate-100 bg-slate-50/60">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors ${
                tab === id
                  ? "border-b-2 border-green-500 text-green-600 bg-white"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-7 max-w-md">
          {/* ── Personal Info ── */}
          {tab === "personal" && (
            <form onSubmit={saveProfile} className="flex flex-col gap-5">
              <Field label="Full Name">
                <TextInput icon={User} type="text" required value={pForm.name}
                  onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                  placeholder="Your full name" />
              </Field>

              <Field label="Email Address">
                <div className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50">
                  <Mail className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="flex-1 text-sm text-slate-400">{profile?.email}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Read only</span>
                </div>
              </Field>

              <Field label="Phone Number" hint="Used for approval and payout SMS notifications.">
                <TextInput icon={Phone} type="tel" value={pForm.phone}
                  onChange={(e) => setPForm({ ...pForm, phone: e.target.value })}
                  placeholder="+94 77 123 4567" />
              </Field>

              {pError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{pError}</p>}

              <button type="submit" disabled={pSaving}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors mt-1">
                {pSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {pSaved ? "Saved!" : pSaving ? "Saving…" : "Save Changes"}
              </button>
            </form>
          )}

          {/* ── Business Info ── */}
          {tab === "business" && (
            <form onSubmit={saveProfile} className="flex flex-col gap-5">
              <Field label="Business Name" hint="Shown on your public profile and facility listings.">
                <TextInput icon={Building2} type="text" value={bForm.businessName}
                  onChange={(e) => setBForm({ ...bForm, businessName: e.target.value })}
                  placeholder="e.g. Colombo Sports Hub" />
              </Field>

              <Field label="Business Address">
                <TextInput icon={MapPin} type="text" value={bForm.address}
                  onChange={(e) => setBForm({ ...bForm, address: e.target.value })}
                  placeholder="Street address" />
              </Field>

              <Field label="City">
                <TextInput icon={MapPin} type="text" value={bForm.city}
                  onChange={(e) => setBForm({ ...bForm, city: e.target.value })}
                  placeholder="e.g. Colombo" />
              </Field>

              <Field label="Bio">
                <div className="flex gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 transition-all bg-white">
                  <AlignLeft className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <textarea
                    value={bForm.bio}
                    onChange={(e) => setBForm({ ...bForm, bio: e.target.value })}
                    placeholder="Tell players about your facilities and what makes them special…"
                    rows={4}
                    className="flex-1 text-sm text-slate-900 outline-none bg-transparent placeholder:text-slate-400 resize-none"
                  />
                </div>
              </Field>

              {pError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{pError}</p>}

              <button type="submit" disabled={pSaving}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors mt-1">
                {pSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {pSaved ? "Saved!" : pSaving ? "Saving…" : "Save Business Info"}
              </button>
            </form>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <form onSubmit={savePassword} className="flex flex-col gap-5">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Choose a strong password with at least 8 characters. You&apos;ll need your current password to make changes.
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

              {pwError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{pwError}</p>}
              {pwSaved && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 px-4 py-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />Password changed successfully.
                </p>
              )}

              <button type="submit" disabled={pwSaving}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors mt-1">
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {pwSaving ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

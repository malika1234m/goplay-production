"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Mail, Phone, Lock, Shield, CheckCircle, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";

export default function AdminProfilePage() {
  const { data: session, update } = useSession();

  /* ── profile state ── */
  const [profile, setProfile]       = useState({ name: "", email: "", phone: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [profileMsg,     setProfileMsg]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ── password state ── */
  const [pw, setPw]               = useState({ current: "", newPw: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw,    setSavingPw]    = useState(false);
  const [pwMsg,       setPwMsg]       = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ── load profile ── */
  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile({
          name:  d.user?.name  ?? "",
          email: d.user?.email ?? "",
          phone: d.user?.phone ?? "",
        });
        setLoadingProfile(false);
      });
  }, []);

  /* ── save profile ── */
  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const res  = await fetch("/api/user/profile", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: profile.name, phone: profile.phone }),
    });
    const data = await res.json();
    setSavingProfile(false);
    if (res.ok) {
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
      await update({ name: data.user.name });
    } else {
      setProfileMsg({ type: "error", text: data.error ?? "Failed to update profile." });
    }
  };

  /* ── password requirements ── */
  const PW_REQS = [
    { label: "At least 8 characters",  met: pw.newPw.length >= 8 },
    { label: "At least one letter",    met: /[a-zA-Z]/.test(pw.newPw) },
    { label: "At least one number",    met: /\d/.test(pw.newPw) },
  ];
  const allMet       = PW_REQS.every((r) => r.met);
  const passwordsMatch = pw.newPw === pw.confirm && pw.newPw !== "";

  /* ── save password ── */
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet)         { setPwMsg({ type: "error", text: "Please meet all password requirements." }); return; }
    if (!passwordsMatch) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }

    setSavingPw(true);
    setPwMsg(null);
    const res  = await fetch("/api/user/password", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
    });
    const data = await res.json();
    setSavingPw(false);
    if (res.ok) {
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setPw({ current: "", newPw: "", confirm: "" });
    } else {
      setPwMsg({ type: "error", text: data.error ?? "Failed to change password." });
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your admin account details and password</p>
      </div>

      {/* Role badge */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{session?.user?.name}</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full mt-0.5">
            <Shield className="w-3 h-3" /> Super Admin
          </span>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" /> Account Information
        </h2>

        <form onSubmit={handleProfile} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email — read only */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email <span className="text-slate-400 font-normal">(cannot be changed)</span>
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm border border-slate-100 rounded-xl bg-slate-50 text-slate-500">
              <Mail className="w-4 h-4 shrink-0" /> {profile.email}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+94 77 000 0000"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {profileMsg && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${
              profileMsg.type === "success"
                ? "bg-green-50 border-green-100 text-green-700"
                : "bg-red-50 border-red-100 text-red-600"
            }`}>
              {profileMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="self-start flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {savingProfile ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" /> Change Password
        </h2>

        <form onSubmit={handlePassword} className="flex flex-col gap-4">
          {/* Current */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showCurrent ? "text" : "password"}
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showNew ? "text" : "password"}
                value={pw.newPw}
                onChange={(e) => setPw({ ...pw, newPw: e.target.value })}
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pw.newPw && (
              <ul className="mt-2 space-y-1">
                {PW_REQS.map((r) => (
                  <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? "text-green-600" : "text-slate-400"}`}>
                    <CheckCircle className={`w-3.5 h-3.5 ${r.met ? "text-green-500" : "text-slate-300"}`} />
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showConfirm ? "text" : "password"}
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                required
                className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                  pw.confirm
                    ? passwordsMatch
                      ? "border-green-300 focus:ring-green-500"
                      : "border-red-300 focus:ring-red-400"
                    : "border-slate-200 focus:ring-blue-500"
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pw.confirm && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {pwMsg && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${
              pwMsg.type === "success"
                ? "bg-green-50 border-green-100 text-green-700"
                : "bg-red-50 border-red-100 text-red-600"
            }`}>
              {pwMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingPw || !allMet || !passwordsMatch}
            className="self-start flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

    </div>
  );
}

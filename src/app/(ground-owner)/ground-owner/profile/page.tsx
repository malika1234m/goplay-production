"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2, MapPin } from "lucide-react";
import { tk, formatDay } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

interface Profile {
  name: string; email: string; phone: string | null; createdAt: string;
  groundOwnerProfile: {
    businessName: string | null; bio: string | null;
    address: string | null; city: string | null; phone: string | null;
  } | null;
}
interface Stats { totalGrounds: number; activeGrounds: number; pendingGrounds: number; totalBookings: number; totalReviews: number }
interface Setup { contact: boolean; business: boolean; ground: boolean; approved: boolean; photos: boolean; hours: boolean; method: boolean; payments: boolean; workers: boolean }

const PHONE_RE = /^(?:\+94|0)7[0-9]{8}$/;

/* ── Building blocks ─────────────────────────────────────────────────────── */

const inputCls =
  "w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-[15px] text-pitch-deep placeholder:text-slate-400 " +
  "outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/20 disabled:bg-slip disabled:text-slate-500";

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-pitch-deep mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** A settings section: what it is on the left, the fields on the right. */
function Section({ title, description, children, footer }: {
  title: string; description: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-rule">
      <div className="p-6 grid gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div>
          <h2 className="text-[17px] font-semibold text-pitch-deep">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">{children}</div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-rule bg-slip/60 px-6 py-3 rounded-b-xl">{footer}</div>
    </section>
  );
}

function SaveBar({ saving, saved, error, label }: { saving: boolean; saved: boolean; error: string; label: string }) {
  const { t } = useT();
  return (
    <>
      {error && <p className="mr-auto text-sm text-red-700" role="alert">{t(error)}</p>}
      {saved && !error && <p className="mr-auto flex items-center gap-1.5 text-sm text-pitch" role="status"><Check className="w-4 h-4" />{t("Saved")}</p>}
      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-pitch px-4 py-2 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}{label}
      </button>
    </>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  const { t } = useT();
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} className={`${inputCls} pr-11`} required />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("Hide password") : t("Show password")}
        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-pitch-deep">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const SETUP_STEPS: { key: keyof Setup; label: string; href: string; optional?: boolean }[] = [
  { key: "contact",  label: tk("Add your phone number"),        href: "#contact" },
  { key: "business", label: tk("Add your business details"),    href: "#business" },
  { key: "ground",   label: tk("List your first ground"),       href: "/ground-owner/grounds/new" },
  { key: "approved", label: tk("Get a ground approved"),        href: "/ground-owner/grounds" },
  { key: "photos",   label: tk("Add photos to every ground"),   href: "/ground-owner/grounds" },
  { key: "hours",    label: tk("Set opening hours"),            href: "/ground-owner/availability" },
  { key: "method",   label: tk("Choose how players pay"),       href: "/ground-owner/setup" },
  { key: "payments", label: tk("Add a bank account for online payments"), href: "/ground-owner/payment-details" },
  { key: "workers",  label: tk("Invite a ground worker"),       href: "/ground-owner/workers", optional: true },
];

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function GroundOwnerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [setup,   setSetup]   = useState<Setup | null>(null);
  const [failed,  setFailed]  = useState(false);
  const { t, tn, locale } = useT();

  const [contact,  setContact]  = useState({ name: "", phone: "" });
  const [business, setBusiness] = useState({ businessName: "", address: "", city: "", bio: "" });
  const [pw,       setPw]       = useState({ current: "", next: "", confirm: "" });

  const [state, setState] = useState<Record<"contact" | "business" | "password", { saving: boolean; saved: boolean; error: string }>>({
    contact:  { saving: false, saved: false, error: "" },
    business: { saving: false, saved: false, error: "" },
    password: { saving: false, saved: false, error: "" },
  });
  const patch = (k: keyof typeof state, v: Partial<(typeof state)["contact"]>) => setState((s) => ({ ...s, [k]: { ...s[k], ...v } }));

  async function load() {
    try {
      const res = await fetch("/api/ground-owner/profile", { cache: "no-store" });
      const d   = await res.json();
      if (!res.ok || !d.user) { setFailed(true); return; }
      setProfile(d.user);
      setStats(d.stats);
      setSetup(d.setup);
      const p = d.user.groundOwnerProfile;
      setContact({ name: d.user.name ?? "", phone: d.user.phone ?? "" });
      setBusiness({ businessName: p?.businessName ?? "", address: p?.address ?? "", city: p?.city ?? "", bio: p?.bio ?? "" });
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveDetails(which: "contact" | "business", e: React.FormEvent) {
    e.preventDefault();
    const name = contact.name.trim();
    if (which === "contact") {
      if (name.length < 2 || name.length > 50) return patch("contact", { error: t("Use a name between 2 and 50 characters."), saved: false });
      if (contact.phone.trim() && !PHONE_RE.test(contact.phone.replace(/[\s\-().]/g, "")))
        return patch("contact", { error: t("Use a Sri Lankan mobile number, like 077 123 4567."), saved: false });
    } else {
      if (business.businessName.trim().length > 100) return patch("business", { error: t("Keep the business name under 100 characters."), saved: false });
      if (business.bio.trim().length > 500)          return patch("business", { error: t("Keep the description under 500 characters."), saved: false });
    }
    patch(which, { saving: true, error: "", saved: false });
    try {
      const res  = await fetch("/api/ground-owner/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, ...business }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return patch(which, { saving: false, error: data.error ?? t("Couldn't save. Try again.") });
      patch(which, { saving: false, saved: true });
      load();
    } catch {
      patch(which, { saving: false, error: t("You're offline. Reconnect and try again.") });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm)                           return patch("password", { error: t("The new passwords don't match."), saved: false });
    if (pw.next.length < 8 || !/[a-zA-Z]/.test(pw.next) || !/[0-9]/.test(pw.next))
      return patch("password", { error: t("Use at least 8 characters with a letter and a number."), saved: false });
    patch("password", { saving: true, error: "", saved: false });
    try {
      const res  = await fetch("/api/user/password", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return patch("password", { saving: false, error: data.error ?? t("Couldn't change the password.") });
      setPw({ current: "", next: "", confirm: "" });
      patch("password", { saving: false, saved: true });
    } catch {
      patch("password", { saving: false, error: t("You're offline. Reconnect and try again.") });
    }
  }

  if (failed) return <p className="text-red-700">{t("Your profile didn't load. Refresh the page to try again.")}</p>;
  if (!profile || !stats || !setup) {
    return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  const p        = profile.groundOwnerProfile;
  const since    = formatDay(new Date(profile.createdAt), locale, { month: "long", year: "numeric" });
  const monogram = (p?.businessName || profile.name).split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const required = SETUP_STEPS.filter((s) => !s.optional);
  const doneCount = required.filter((s) => setup[s.key]).length;

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-pitch-deep">{t("Profile")}</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] items-start">
        {/* ── Identity, numbers, setup ── */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <div className="bg-white rounded-xl border border-rule p-6">
            <div className="grid place-items-center w-16 h-16 rounded-xl bg-pitch-deep text-white font-scoreboard text-[28px] font-semibold tracking-wide" aria-hidden>
              {monogram}
            </div>
            <p className="mt-4 text-lg font-semibold text-pitch-deep leading-snug">{p?.businessName || profile.name}</p>
            {p?.businessName && <p className="text-sm text-slate-600">{profile.name}</p>}
            <p className="mt-1 text-sm text-slate-500 break-all">{profile.email}</p>
            {p?.city && <p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin className="w-3.5 h-3.5" />{p.city}</p>}
            <p className="mt-4 pt-4 border-t border-rule text-[13px] text-slate-500">{t("Ground owner since {date}", { date: since })}</p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {([[tk("Grounds"), stats.totalGrounds], [tk("Bookings"), stats.totalBookings], [tk("Reviews"), stats.totalReviews]] as const).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slip py-2.5">
                  <dd className="font-scoreboard text-2xl font-semibold text-pitch-deep tabular-nums">{value}</dd>
                  <dt className="text-xs text-slate-500">{t(label)}</dt>
                </div>
              ))}
            </dl>
            {stats.pendingGrounds > 0 && (
              <p className="mt-3 text-[13px] text-deadline">{tn(stats.pendingGrounds, "{n} ground waiting for GoPlay approval", "{n} grounds waiting for GoPlay approval")}</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-rule p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-pitch-deep">{t("Setup")}</h2>
              <span className="text-sm text-slate-500 tabular-nums">{t("{done} of {total}", { done: doneCount, total: required.length })}</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slip overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount}>
              <div className="h-full bg-pitch rounded-full transition-[width] duration-500" style={{ width: `${(doneCount / required.length) * 100}%` }} />
            </div>
            <ol className="mt-4 flex flex-col gap-1">
              {SETUP_STEPS.map((s) => {
                const done = setup[s.key];
                return (
                  <li key={s.key}>
                    <Link href={s.href}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slip ${done ? "text-slate-400" : "text-pitch-deep"}`}>
                      <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${done ? "bg-pitch text-white" : "border-2 border-rule"}`} aria-hidden>
                        {done && <Check className="w-3 h-3" />}
                      </span>
                      <span className={done ? "line-through decoration-slate-300" : ""}>{t(s.label)}</span>
                      {s.optional && !done && <span className="ml-auto text-xs text-slate-400">{t("Optional")}</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* ── Settings ── */}
        <div className="flex flex-col gap-6">
          <form id="contact" onSubmit={(e) => saveDetails("contact", e)} className="scroll-mt-6">
            <Section title={t("Contact details")} description={t("How players reach you.")}
              footer={<SaveBar {...state.contact} label={t("Save contact details")} />}>
              <Field label={t("Full name")} htmlFor="name">
                <input id="name" className={inputCls} value={contact.name} autoComplete="name"
                  onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              </Field>
              <Field label={t("Email")} htmlFor="email" hint={t("Contact support to change it.")}>
                <input id="email" className={inputCls} value={profile.email} disabled />
              </Field>
              <Field label={t("Mobile number")} htmlFor="phone" hint={t("We text new bookings here.")}>
                <input id="phone" type="tel" className={inputCls} value={contact.phone} placeholder="077 123 4567" autoComplete="tel"
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </Field>
            </Section>
          </form>

          <form id="business" onSubmit={(e) => saveDetails("business", e)} className="scroll-mt-6">
            <Section title={t("Business")} description={t("Shown on your ground pages.")}
              footer={<SaveBar {...state.business} label={t("Save business details")} />}>
              <Field label={t("Business name")} htmlFor="businessName">
                <input id="businessName" className={inputCls} value={business.businessName} placeholder={t("e.g. Kandy Hills Sports")} autoComplete="organization"
                  onChange={(e) => setBusiness({ ...business, businessName: e.target.value })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <Field label={t("Address")} htmlFor="address">
                  <input id="address" className={inputCls} value={business.address} autoComplete="street-address"
                    onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
                </Field>
                <Field label={t("City")} htmlFor="city">
                  <input id="city" className={inputCls} value={business.city} autoComplete="address-level2"
                    onChange={(e) => setBusiness({ ...business, city: e.target.value })} />
                </Field>
              </div>
              <Field label={t("About your business")} htmlFor="bio" hint={`${business.bio.length} / 500`}>
                <textarea id="bio" rows={4} className={`${inputCls} resize-y`} value={business.bio} maxLength={500}
                  placeholder={t("What makes your grounds worth booking — surfaces, lights, parking, coaching…")}
                  onChange={(e) => setBusiness({ ...business, bio: e.target.value })} />
              </Field>
            </Section>
          </form>

          <form id="security" onSubmit={savePassword} className="scroll-mt-6">
            <Section title={t("Sign-in & security")} description={t("Your sign-in password.")}
              footer={<SaveBar {...state.password} label={t("Change password")} />}>
              <Field label={t("Current password")} htmlFor="pw-current">
                <PasswordInput id="pw-current" value={pw.current} autoComplete="current-password" onChange={(v) => setPw({ ...pw, current: v })} />
              </Field>
              <Field label={t("New password")} htmlFor="pw-new" hint={t("At least 8 characters, with a letter and a number.")}>
                <PasswordInput id="pw-new" value={pw.next} autoComplete="new-password" onChange={(v) => setPw({ ...pw, next: v })} />
              </Field>
              <Field label={t("Confirm new password")} htmlFor="pw-confirm">
                <PasswordInput id="pw-confirm" value={pw.confirm} autoComplete="new-password" onChange={(v) => setPw({ ...pw, confirm: v })} />
              </Field>
            </Section>
          </form>
        </div>
      </div>
    </div>
  );
}

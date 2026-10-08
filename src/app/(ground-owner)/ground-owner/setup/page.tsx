"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, ImagePlus, Loader2, ShieldCheck, Users } from "lucide-react";
import PaymentDetailsForm from "@/components/payments/PaymentDetailsForm";
import PaymentOptionsPicker, { type PayOpt } from "@/components/payments/PaymentOptionsPicker";
import { useT } from "@/i18n/I18nProvider";

interface Setup { contact: boolean; business: boolean; ground: boolean; approved: boolean; photos: boolean; hours: boolean; method: boolean; payments: boolean; workers: boolean }
interface Ground { id: string; name: string; status: string; photos: number; paymentOptions: PayOpt | null; hasAccount: boolean; openDays: number }
interface Profile { name: string; phone: string | null; groundOwnerProfile: { businessName: string | null; city: string | null; address: string | null; bio: string | null } | null }

type StepKey = "details" | "method" | "account" | "photos" | "hours" | "approval" | "team";


const inputCls = "w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-[15px] text-pitch-deep outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/20";

/** First-run guide for ground owners: everything needed before the first booking arrives. */
export default function SetupGuidePage() {
  const [setup,   setSetup]   = useState<Setup | null>(null);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [active,  setActive]  = useState<StepKey | null>(null);
  const { t, tn } = useT();

  const load = useCallback(async () => {
    const res = await fetch("/api/ground-owner/profile", { cache: "no-store" });
    const d   = await res.json();
    if (!res.ok) return;
    setSetup(d.setup);
    setGrounds(d.grounds ?? []);
    setProfile(d.user);
  }, []);

  useEffect(() => {
    load();
    // Coming back from the photos or hours page — pick up what changed
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (!setup || !profile) return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const needsAccount = grounds.some((g) => g.paymentOptions !== "ON_ARRIVAL_ONLY");
  const steps: { key: StepKey; title: string; done: boolean; optional?: boolean }[] = [
    { key: "details",  title: t("Contact details"),       done: setup.contact && setup.business },
    { key: "method",   title: t("How players pay"),            done: setup.method },
    ...(needsAccount ? [{ key: "account" as const, title: t("Bank account"), done: setup.payments }] : []),
    { key: "photos",   title: t("Photos"),      done: setup.photos },
    { key: "hours",    title: t("Opening hours"),              done: setup.hours },
    { key: "approval", title: t("GoPlay approval"),            done: setup.approved },
    { key: "team",     title: t("Workers"),           done: setup.workers, optional: true },
  ];
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const current = active ?? steps.find((s) => !s.done && !s.optional)?.key ?? "team";
  const idx = steps.findIndex((s) => s.key === current);
  const next = () => setActive(steps.slice(idx + 1).find((s) => !s.done)?.key ?? steps[Math.min(idx + 1, steps.length - 1)].key);
  const firstName = profile.name.split(" ")[0];

  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <h1 className="text-[28px] font-bold text-pitch-deep tracking-tight">
          {allDone ? t("You're all set, {name}", { name: firstName }) : t("Welcome, {name}", { name: firstName })}
        </h1>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 max-w-sm rounded-full bg-slip overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount}>
            <div className="h-full bg-pitch rounded-full transition-[width] duration-700" style={{ width: `${(doneCount / required.length) * 100}%` }} />
          </div>
          <span className="text-sm text-slate-600 tabular-nums">{t("{done}/{total} done", { done: doneCount, total: required.length })}</span>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)] items-start">
        {/* Stepper — these really are a sequence, so they're numbered */}
        <ol className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1">
          {steps.map((s, i) => {
            const on = s.key === current;
            return (
              <li key={s.key} className="shrink-0">
                <button type="button" onClick={() => setActive(s.key)} aria-current={on ? "step" : undefined}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${on ? "bg-white border border-rule shadow-sm" : "hover:bg-white/60"}`}>
                  <span className={`grid place-items-center w-7 h-7 rounded-full shrink-0 font-scoreboard text-[15px] font-semibold ${
                    s.done ? "bg-pitch text-white" : on ? "border-2 border-pitch text-pitch" : "border-2 border-rule text-slate-400"}`}>
                    {s.done ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={`${on ? "font-semibold text-pitch-deep" : s.done ? "text-slate-500" : "text-pitch-deep"} whitespace-nowrap md:whitespace-normal`}>
                    {s.title}{s.optional && <span className="block text-xs font-normal text-slate-400">{t("Optional")}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Current step */}
        <section className="bg-white rounded-xl border border-rule p-6 sm:p-8" aria-live="polite">
          {current === "details" && <DetailsStep profile={profile} done={setup.contact && setup.business} onSaved={() => { load(); next(); }} />}
          {current === "method" && <MethodStep grounds={grounds} onSaved={load} onNext={next} done={setup.method} />}
          {current === "account" && (
            <>
              <StepHead title={t("Bank account for online payments")}
                body={t("Players transfer here and send you the receipt.")} />
              {setup.payments
                ? <Done text={t("Bank account added.")} onNext={next} />
                : <div className="mt-6 max-w-xl"><PaymentDetailsForm mode="owner" bare onSaved={() => { load(); next(); }} /></div>}
            </>
          )}
          {current === "photos" && (
            <>
              <StepHead title={t("Add photos")}
                body={t("At least 3 per ground.")} />
              <GroundLinks grounds={grounds} isDone={(g) => g.photos > 0} doneLabel={(g) => tn(g.photos, "{n} photo", "{n} photos")}
                todoLabel={t("No photos yet")} action={t("Add photos")} href={(g) => `/ground-owner/grounds/${g.id}/edit`} Icon={ImagePlus} />
              {setup.photos && <Done text={t("Every ground has photos.")} onNext={next} />}
            </>
          )}
          {current === "hours" && (
            <>
              <StepHead title={t("Opening hours")}
                body={t("Set to 6 am – 10 pm every day.")} />
              <GroundLinks grounds={grounds} isDone={(g) => g.openDays > 0} doneLabel={(g) => tn(g.openDays, "Open {n} day a week", "Open {n} days a week")}
                todoLabel={t("No open days")} action={t("Edit hours")} href={() => "/ground-owner/availability"} Icon={Clock} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/ground-owner/availability" className="rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-pitch-deep hover:border-pitch">{t("Change hours")}</Link>
                <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep">
                  {t("Looks right")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          {current === "approval" && (
            <>
              <StepHead title={t("GoPlay approval")}
                body={t("Usually within one working day.")} />
              <ul className="mt-6 divide-y divide-rule border border-rule rounded-lg">
                {grounds.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                    <ShieldCheck className={`w-5 h-5 ${g.status === "ACTIVE" ? "text-pitch" : "text-slate-300"}`} />
                    <span className="flex-1 text-[15px] text-pitch-deep">{g.name}</span>
                    <span className={`text-sm ${g.status === "ACTIVE" ? "text-pitch font-semibold" : g.status === "REJECTED" ? "text-red-700" : "text-deadline"}`}>
                      {g.status === "ACTIVE" ? t("Live") : g.status === "PENDING" ? t("Being reviewed") : g.status === "REJECTED" ? t("Needs changes — check your email") : t("Hidden")}
                    </span>
                  </li>
                ))}
              </ul>
              {setup.approved && <Done text={t("You're live.")} onNext={next} />}
            </>
          )}
          {current === "team" && (
            <>
              <StepHead title={t("Add workers")}
                body={t("They can confirm bookings and check receipts.")} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/ground-owner/workers" className="inline-flex items-center gap-2 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep">
                  <Users className="w-4 h-4" /> {t("Add a worker")}
                </Link>
                <Link href="/ground-owner/bookings" className="rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-pitch-deep hover:border-pitch">
                  {allDone ? t("Go to Bookings") : t("Skip for now")}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Step pieces ──────────────────────────────────────────────────────────── */

function StepHead({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h2 className="text-[22px] font-semibold text-pitch-deep">{title}</h2>
      <p className="mt-2 text-slate-600 max-w-prose leading-relaxed">{body}</p>
    </>
  );
}

function Done({ text, onNext }: { text: string; onNext: () => void }) {
  const { t } = useT();
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg bg-pitch/5 border border-pitch/20 px-4 py-3">
      <p className="flex items-center gap-2 text-[15px] text-pitch-deep"><Check className="w-4 h-4 text-pitch" />{text}</p>
      <button onClick={onNext} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-pitch px-4 py-2 text-sm font-semibold text-white hover:bg-pitch-deep">
        {t("Next step")} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function GroundLinks({ grounds, isDone, doneLabel, todoLabel, action, href, Icon }: {
  grounds: Ground[]; isDone: (g: Ground) => boolean; doneLabel: (g: Ground) => string; todoLabel: string;
  action: string; href: (g: Ground) => string; Icon: typeof Clock;
}) {
  return (
    <ul className="mt-6 divide-y divide-rule border border-rule rounded-lg">
      {grounds.map((g) => {
        const ok = isDone(g);
        return (
          <li key={g.id} className="flex items-center gap-3 px-4 py-3">
            <Icon className={`w-5 h-5 shrink-0 ${ok ? "text-pitch" : "text-slate-300"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-pitch-deep truncate">{g.name}</p>
              <p className={`text-sm ${ok ? "text-slate-500" : "text-deadline"}`}>{ok ? doneLabel(g) : todoLabel}</p>
            </div>
            <Link href={href(g)} className="shrink-0 rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-pitch-deep hover:border-pitch">{action}</Link>
          </li>
        );
      })}
    </ul>
  );
}

function DetailsStep({ profile, done, onSaved }: { profile: Profile; done: boolean; onSaved: () => void }) {
  const p = profile.groundOwnerProfile;
  const [form, setForm] = useState({ phone: profile.phone ?? "", businessName: p?.businessName ?? "", city: p?.city ?? "" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const { t } = useT();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^(?:\+94|0)7[0-9]{8}$/.test(form.phone.replace(/[\s\-().]/g, ""))) { setError(t("Use a Sri Lankan mobile number, like 077 123 4567.")); return; }
    if (!form.businessName.trim() || !form.city.trim()) { setError(t("Add your business name and city.")); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/ground-owner/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profile.name, address: p?.address ?? "", bio: p?.bio ?? "", ...form }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? t("Couldn't save. Try again.")); return; }
    onSaved();
  }

  return (
    <form onSubmit={save}>
      <StepHead title={t("Your contact details")}
        body={t("We text new bookings to this number.")} />
      <div className="mt-6 grid gap-4 max-w-xl sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-medium text-pitch-deep">{t("Mobile number")}
          <input className={`${inputCls} mt-1.5`} type="tel" autoComplete="tel" placeholder="077 123 4567"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-pitch-deep">{t("Business name")}
          <input className={`${inputCls} mt-1.5`} autoComplete="organization" placeholder={t("e.g. Kandy Hills Sports")}
            value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-pitch-deep">{t("City")}
          <input className={`${inputCls} mt-1.5`} autoComplete="address-level2"
            value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>}
      <button type="submit" disabled={saving}
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}{t("Save and continue")} <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

function MethodStep({ grounds, done, onSaved, onNext }: { grounds: Ground[]; done: boolean; onSaved: () => void; onNext: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error,  setError]  = useState("");

  const { t } = useT();

  async function choose(g: Ground, value: PayOpt) {
    setSaving(g.id); setError("");
    const res = await fetch(`/api/ground-owner/grounds/${g.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentOptions: value }),
    });
    setSaving(null);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? t("Couldn't save. Try again.")); return; }
    onSaved();
  }

  return (
    <>
      <StepHead title={t("How players pay")}
        body={t("Players only see what you allow.")} />
      <div className="mt-6 flex flex-col gap-6">
        {grounds.map((g) => (
          <fieldset key={g.id}>
            <legend className="text-[15px] font-semibold text-pitch-deep mb-2 flex items-center gap-2">
              {g.name}{saving === g.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </legend>
            <PaymentOptionsPicker name={`pay-${g.id}`} value={g.paymentOptions} onChange={(v) => choose(g, v)} disabled={saving === g.id} />
          </fieldset>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>}
      {done && <Done text={t("Done for every ground.")} onNext={onNext} />}
    </>
  );
}

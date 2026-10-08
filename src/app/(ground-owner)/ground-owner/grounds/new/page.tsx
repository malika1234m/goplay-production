"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PaymentOptionsPicker, { type PayOpt } from "@/components/payments/PaymentOptionsPicker";
import {
  Loader2, MapPin, Users, CheckCircle, ImagePlus, X, Upload, Plus, Trash2, ChevronLeft,
} from "lucide-react";
import { tk } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

interface Category    { id: string; name: string; icon: string | null }
interface CourtDraft  { name: string; description: string }

const AMENITIES = [
  tk("Parking"), tk("Changing Rooms"), tk("Showers"), tk("Floodlights"),
  tk("Cafeteria"), tk("WiFi"), tk("Toilets"), tk("First Aid"),
  tk("Drinking Water"), tk("Equipment Rental"), tk("Seating / Spectator Area"),
  tk("Security / CCTV"), tk("Air Conditioning"), tk("Coaching Available"), tk("Scoreboard"),
];

/* ── Building blocks ── */
function Section({ title, description, optional, children }: {
  title: string; description: string; optional?: boolean; children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <section className="bg-white rounded-xl border border-rule p-6">
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-pitch-deep flex items-center gap-2">
          {title}{optional && <span className="text-xs font-normal text-slate-400">{t("Optional")}</span>}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, required, hint, children }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-pitch-deep">
          {label}{required && <span className="text-red-600 ml-0.5" aria-hidden>*</span>}
        </label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-[15px] text-pitch-deep placeholder:text-slate-400 outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/20";
const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
    on ? "border-pitch bg-pitch text-white" : "border-rule bg-white text-slate-700 hover:border-pitch/60"}`;

const PAY_LABEL: Record<PayOpt, string> = { ON_ARRIVAL_ONLY: tk("Pay at ground"), ONLINE_ONLY: tk("Pay online"), BOTH: tk("Pay at ground or online") };

export default function NewGroundPage() {
  const { t, tn } = useT();
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [categories,  setCategories]  = useState<Category[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");
  const [images,      setImages]      = useState<string[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver,    setDragOver]    = useState(false);

  const [courts,      setCourts]      = useState<CourtDraft[]>([]);
  const [courtName,   setCourtName]   = useState("");
  const [courtDesc,   setCourtDesc]   = useState("");
  const [courtError,  setCourtError]  = useState("");

  const [form, setForm] = useState({
    name:        "",
    description: "",
    address:     "",
    city:        "",
    hourlyRate:  "",
    capacity:    "",
    categoryIds: [] as string[],
    amenities:   [] as string[],
  });
  const [payOpt, setPayOpt] = useState<PayOpt | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  const set = (key: keyof typeof form, value: string | string[]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleCategory = (id: string) =>
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((x) => x !== id)
        : [...f.categoryIds, id],
    }));

  const toggleAmenity = (a: string) =>
    set("amenities", form.amenities.includes(a)
      ? form.amenities.filter((x) => x !== a)
      : [...form.amenities, a]);

  /* ── Image upload ── */
  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    if (images.length + arr.length > 8) { setUploadError(t("Maximum 8 images allowed.")); return; }
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("images", f));
      const res  = await fetch("/api/upload/ground-images", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? t("Upload failed.")); return; }
      setImages((prev) => [...prev, ...(data.urls as string[])]);
    } catch {
      setUploadError(t("Upload failed. Please try again."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));
  const handleDrop  = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  /* ── Courts ── */
  const addCourt = () => {
    const name = courtName.trim();
    setCourtError("");
    if (!name)             { setCourtError(t("Court name is required.")); return; }
    if (name.length < 2)   { setCourtError(t("Name must be at least 2 characters.")); return; }
    if (name.length > 60)  { setCourtError(t("Name must be under 60 characters.")); return; }
    if (courts.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCourtError(t("A court with that name already exists.")); return;
    }
    setCourts((prev) => [...prev, { name, description: courtDesc.trim() }]);
    setCourtName(""); setCourtDesc("");
  };
  const removeCourt = (idx: number) => setCourts((prev) => prev.filter((_, i) => i !== idx));

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim(), address = form.address.trim(), city = form.city.trim();
    if (!name || name.length < 3)          { setError(t("Ground name must be at least 3 characters.")); return; }
    if (name.length > 100)                 { setError(t("Ground name must be under 100 characters.")); return; }
    if (!address || address.length < 5)    { setError(t("Address must be at least 5 characters.")); return; }
    if (!city || city.length < 2)          { setError(t("City must be at least 2 characters.")); return; }
    if (form.categoryIds.length === 0)     { setError(t("Please select at least one sport category.")); return; }
    if (!payOpt)                           { setError(t("Choose how players pay for this ground.")); return; }
    const rate = Number(form.hourlyRate);
    if (!form.hourlyRate || rate < 1)   { setError(t("Hourly rate must be at least Rs. 1.")); return; }
    if (rate > 100000)                  { setError(t("Hourly rate cannot exceed Rs. 100,000.")); return; }
    if (form.capacity) {
      const cap = Number(form.capacity);
      if (cap < 1)   { setError(t("Capacity must be at least 1 player.")); return; }
      if (cap > 500) { setError(t("Capacity cannot exceed 500 players.")); return; }
    }
    setSubmitting(true); setError("");

    const res  = await fetch("/api/ground-owner/grounds", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name: form.name, description: form.description || undefined,
        address: form.address, city: form.city,
        hourlyRate:  Number(form.hourlyRate),
        capacity:    form.capacity ? Number(form.capacity) : undefined,
        categoryIds: form.categoryIds, amenities: form.amenities, images,
        paymentOptions: payOpt,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? t("Failed to submit ground.")); return;
    }

    if (courts.length > 0 && data.ground?.id) {
      for (const court of courts) {
        await fetch(`/api/ground-owner/grounds/${data.ground.id}/courts`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: court.name, description: court.description || null }),
        });
      }
    }

    setSubmitting(false); setSuccess(true);
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-pitch text-white"><CheckCircle className="w-8 h-8" /></span>
        <h1 className="mt-6 text-2xl font-bold text-pitch-deep">{t("{name} is with GoPlay for review", { name: form.name.trim() })}</h1>
        <p className="mt-2 text-slate-600">
          {t("We'll email and text you when it's live.")}
          {courts.length > 0 && ` ${tn(courts.length, "{n} court was added.", "{n} courts were added.")}`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => router.push("/ground-owner/setup")}
            className="rounded-lg bg-pitch px-5 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep">{t("Continue setup")}</button>
          <button onClick={() => router.push("/ground-owner/grounds")}
            className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-pitch-deep hover:border-pitch">{t("Back to my grounds")}</button>
        </div>
      </div>
    );
  }

  const chosenSports = categories.filter((c) => form.categoryIds.includes(c.id));
  const missing = [
    form.name.trim().length < 3 && t("Ground name"),
    chosenSports.length === 0 && t("At least one sport"),
    form.address.trim().length < 5 && t("Address"),
    form.city.trim().length < 2 && t("City"),
    !(Number(form.hourlyRate) >= 1) && t("Price per hour"),
    !payOpt && t("How players pay"),
  ].filter(Boolean) as string[];

  /* ── Form ── */
  return (
    <form onSubmit={handleSubmit} className="max-w-6xl" noValidate>
      <button type="button" onClick={() => router.push("/ground-owner/grounds")}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-pitch-deep">
        <ChevronLeft className="w-4 h-4" /> {t("My grounds")}
      </button>
      <header className="mt-3 mb-8">
        <h1 className="text-[28px] font-bold text-pitch-deep tracking-tight">{t("List a new ground")}</h1>
        <p className="mt-1 text-slate-600 max-w-prose">{t("GoPlay checks it before it goes live.")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="flex flex-col gap-6">
          <Section title={t("The basics")} description={t("What players search for.")}>
            <Field label={t("Ground name")} htmlFor="g-name" required hint={`${form.name.length}/100`}>
              <input id="g-name" className={inputCls} maxLength={100} value={form.name} placeholder={t("e.g. Kandy Hills Tennis Club")}
                onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={t("Sports")} required>
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {categories.map((c) => {
                  const on = form.categoryIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCategory(c.id)} aria-pressed={on} className={chip(on)}>
                      {c.icon && <span aria-hidden>{c.icon}</span>}{t(c.name)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("Description")} htmlFor="g-desc" hint={`${form.description.length}/1000`}>
              <textarea id="g-desc" rows={4} maxLength={1000} className={`${inputCls} resize-y`} value={form.description}
                placeholder={t("Surface, lighting, what makes it a good place to play…")}
                onChange={(e) => set("description", e.target.value)} />
            </Field>
          </Section>

          <Section title={t("Location")} description={t("Helps players find you.")}>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <Field label={t("Address")} htmlFor="g-addr" required>
                <input id="g-addr" className={inputCls} value={form.address} autoComplete="street-address" placeholder={t("Street and number")}
                  onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label={t("City")} htmlFor="g-city" required>
                <input id="g-city" className={inputCls} value={form.city} autoComplete="address-level2" placeholder={t("e.g. Kandy")}
                  onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title={t("Price and players")} description={t("One price for every court.")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("Price per hour")} htmlFor="g-rate" required>
                <div className="flex items-center rounded-lg border border-rule bg-white focus-within:border-pitch focus-within:ring-2 focus-within:ring-pitch/20">
                  <span className="pl-3.5 text-slate-500 text-[15px]">{t("Rs.")}</span>
                  <input id="g-rate" inputMode="numeric" className="w-full bg-transparent px-2 py-2.5 text-[15px] text-pitch-deep outline-none tabular-nums"
                    value={form.hourlyRate} placeholder="2,500" onChange={(e) => set("hourlyRate", e.target.value.replace(/[^\d]/g, ""))} />
                  <span className="pr-3.5 text-slate-400 text-sm whitespace-nowrap">{t("/ hour")}</span>
                </div>
              </Field>
              <Field label={t("Players at once")} htmlFor="g-cap" hint={t("Optional")}>
                <input id="g-cap" inputMode="numeric" className={inputCls} value={form.capacity} placeholder={t("e.g. {n}", { n: 22 })}
                  onChange={(e) => set("capacity", e.target.value.replace(/[^\d]/g, ""))} />
              </Field>
            </div>
          </Section>

          <Section title={t("How players pay")} description={t("Players only see what you allow.")}>
            <PaymentOptionsPicker name="paymentOptions" value={payOpt} onChange={setPayOpt} />
            {payOpt && payOpt !== "ON_ARRIVAL_ONLY" && (
              <p className="text-sm text-slate-600">
                {t("Online payments go to your bank account.")}{" "}
                <a href="/ground-owner/payment-details" target="_blank" className="font-medium text-pitch hover:underline">{t("Open Payment accounts")}</a>
              </p>
            )}
          </Section>

          <Section title={t("Photos")} description={t("The first photo is the cover.")}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-5 transition-colors ${dragOver ? "border-pitch bg-pitch/5" : "border-rule"}`}
            >
              <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
              {images.length === 0 ? (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center gap-2 py-6 text-slate-500 hover:text-pitch-deep">
                  {uploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                  <span className="text-[15px] font-medium text-pitch-deep">{uploading ? t("Uploading…") : t("Drop photos here, or choose from your computer")}</span>
                  <span className="text-sm">{t("Up to 8 photos, JPG or PNG, 5 MB each")}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((url, i) => (
                    <div key={url} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slip group">
                      <Image src={url} alt={t("Photo {n}", { n: i + 1 })} fill className="object-cover" sizes="200px" />
                      {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-pitch-deep/85 px-2 py-0.5 text-xs font-medium text-white">{t("Cover")}</span>}
                      <button type="button" onClick={() => removeImage(url)} aria-label={t("Remove photo {n}", { n: i + 1 })}
                        className="absolute right-2 top-2 grid place-items-center w-7 h-7 rounded-full bg-white/90 text-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {images.length < 8 && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="aspect-[4/3] rounded-lg border-2 border-dashed border-rule grid place-items-center text-slate-400 hover:border-pitch hover:text-pitch">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-sm"><ImagePlus className="w-5 h-5" />{t("Add photo")}</span>}
                    </button>
                  )}
                </div>
              )}
            </div>
            {uploadError && <p className="text-sm text-red-700">{t(uploadError)}</p>}
          </Section>

          <Section title={t("Courts")} optional description={t("Only if courts are booked separately.")}>
            {courts.length > 0 && (
              <ul className="divide-y divide-rule rounded-lg border border-rule">
                {courts.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid place-items-center w-7 h-7 rounded-md bg-slip font-scoreboard text-[15px] font-semibold text-pitch-deep">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-pitch-deep">{c.name}</p>
                      {c.description && <p className="text-sm text-slate-500 truncate">{c.description}</p>}
                    </div>
                    <button type="button" onClick={() => removeCourt(i)} aria-label={t("Remove {name}", { name: c.name })} className="p-1.5 text-slate-400 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] items-end">
              <Field label={t("Court name")} htmlFor="c-name">
                <input id="c-name" className={inputCls} value={courtName} placeholder={t("e.g. Court 1")}
                  onChange={(e) => setCourtName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCourt())} />
              </Field>
              <Field label={t("Note")} htmlFor="c-desc">
                <input id="c-desc" className={inputCls} value={courtDesc} placeholder={t("e.g. Clay, floodlit")}
                  onChange={(e) => setCourtDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCourt())} />
              </Field>
              <button type="button" onClick={addCourt}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-pitch-deep hover:border-pitch">
                <Plus className="w-4 h-4" /> {t("Add court")}
              </button>
            </div>
            {courtError && <p className="text-sm text-red-700">{t(courtError)}</p>}
          </Section>

          <Section title={t("Amenities")} optional description={t("What's on site.")}>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = form.amenities.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)} aria-pressed={on} className={chip(on)}>
                    {on && <CheckCircle className="w-3.5 h-3.5" />}{t(a)}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Live preview + submit */}
        <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
          <p className="text-sm font-medium text-slate-500">{t("How players will see it")}</p>
          <div className="bg-white rounded-xl border border-rule overflow-hidden">
            <div className="relative aspect-[16/10] bg-slip">
              {images[0]
                ? <Image src={images[0]} alt="" fill className="object-cover" sizes="320px" />
                : <span className="absolute inset-0 grid place-items-center text-sm text-slate-400"><ImagePlus className="w-6 h-6" /></span>}
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500">{chosenSports.map((c) => t(c.name)).join(", ") || t("Sports")}</p>
              <p className="mt-0.5 text-[17px] font-semibold text-pitch-deep leading-snug">{form.name.trim() || t("Your ground name")}</p>
              <p className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="w-3.5 h-3.5" />{form.city.trim() || t("City")}</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="font-scoreboard text-2xl font-semibold text-pitch-deep tabular-nums">
                  {t("Rs.")} {form.hourlyRate ? Number(form.hourlyRate).toLocaleString() : "—"}<span className="text-sm font-sans font-normal text-slate-400"> {t("/hr")}</span>
                </p>
                {form.capacity && <p className="flex items-center gap-1 text-sm text-slate-500"><Users className="w-3.5 h-3.5" />{form.capacity}</p>}
              </div>
              {payOpt && <p className="mt-2 text-xs font-medium text-pitch">{t(PAY_LABEL[payOpt])}</p>}
            </div>
          </div>

          {missing.length > 0 ? (
            <div className="rounded-lg bg-slip px-4 py-3">
              <p className="text-sm font-medium text-pitch-deep">{t("Still needed")}</p>
              <ul className="mt-1 text-sm text-slate-600 list-disc pl-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-pitch"><CheckCircle className="w-4 h-4" />{t("Ready to send for review")}</p>
          )}

          {error && <p className="text-sm text-red-700" role="alert">{t(error)}</p>}
          <button type="submit" disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-pitch px-5 py-3 text-[15px] font-semibold text-white hover:bg-pitch-deep disabled:opacity-60">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}{submitting ? t("Sending for review") : t("Send for review")}
          </button>
          <p className="text-xs text-slate-500">{t("Hours start at 6 am – 10 pm. Change them later.")}</p>
        </aside>
      </div>
    </form>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2, Building2, MapPin, DollarSign, Users, Tag,
  CheckCircle, ImagePlus, X, Upload, Grid3X3, Plus, Trash2,
  ChevronLeft, Sparkles,
} from "lucide-react";

interface Category    { id: string; name: string; icon: string | null }
interface CourtDraft  { name: string; description: string }

const AMENITIES = [
  "Parking", "Changing Rooms", "Showers", "Floodlights",
  "Cafeteria", "WiFi", "Toilets", "First Aid",
];

/* ── Reusable section card ── */
function Section({
  step, icon: Icon, title, badge, children,
}: {
  step:     number;
  icon:     React.ElementType;
  title:    string;
  badge?:   React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            {step}
          </span>
          <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-slate-500" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {/* Section body */}
      <div className="px-6 py-5 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

/* ── Field wrapper ── */
function Field({
  label, required, hint, children,
}: {
  label:    string;
  required?: boolean;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold text-slate-600">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300 transition-shadow";
const iconInputCls = "w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300 transition-shadow";

export default function NewGroundPage() {
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
    categoryId:  "",
    amenities:   [] as string[],
  });

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  const set = (key: keyof typeof form, value: string | string[]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleAmenity = (a: string) =>
    set("amenities", form.amenities.includes(a)
      ? form.amenities.filter((x) => x !== a)
      : [...form.amenities, a]);

  /* ── Image upload ── */
  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    if (images.length + arr.length > 8) { setUploadError("Maximum 8 images allowed."); return; }
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("images", f));
      const res  = await fetch("/api/upload/ground-images", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed."); return; }
      setImages((prev) => [...prev, ...(data.urls as string[])]);
    } catch {
      setUploadError("Upload failed. Please try again.");
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
    if (!name)             { setCourtError("Court name is required."); return; }
    if (name.length < 2)   { setCourtError("Name must be at least 2 characters."); return; }
    if (name.length > 60)  { setCourtError("Name must be under 60 characters."); return; }
    if (courts.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCourtError("A court with that name already exists."); return;
    }
    setCourts((prev) => [...prev, { name, description: courtDesc.trim() }]);
    setCourtName(""); setCourtDesc("");
  };
  const removeCourt = (idx: number) => setCourts((prev) => prev.filter((_, i) => i !== idx));

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim(), address = form.address.trim(), city = form.city.trim();
    if (!name || name.length < 3)       { setError("Ground name must be at least 3 characters."); return; }
    if (name.length > 100)              { setError("Ground name must be under 100 characters."); return; }
    if (!address || address.length < 5) { setError("Address must be at least 5 characters."); return; }
    if (!city || city.length < 2)       { setError("City must be at least 2 characters."); return; }
    if (!form.categoryId)               { setError("Please select a sport category."); return; }
    const rate = Number(form.hourlyRate);
    if (!form.hourlyRate || rate < 1)   { setError("Hourly rate must be at least Rs. 1."); return; }
    if (rate > 100000)                  { setError("Hourly rate cannot exceed Rs. 100,000."); return; }
    if (form.capacity) {
      const cap = Number(form.capacity);
      if (cap < 1)   { setError("Capacity must be at least 1 player."); return; }
      if (cap > 500) { setError("Capacity cannot exceed 500 players."); return; }
    }
    setSubmitting(true); setError("");

    const res  = await fetch("/api/ground-owner/grounds", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name: form.name, description: form.description || undefined,
        address: form.address, city: form.city,
        hourlyRate: Number(form.hourlyRate),
        capacity:   form.capacity ? Number(form.capacity) : undefined,
        categoryId: form.categoryId, amenities: form.amenities, images,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Failed to submit ground."); return;
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
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-green-50">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ground Submitted!</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-4">
          Your ground has been sent to the admin for review and will go live once approved.
        </p>
        {courts.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl mb-4">
            <Grid3X3 className="w-4 h-4 shrink-0" />
            {courts.length} court{courts.length > 1 ? "s" : ""} added
          </div>
        )}
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-xl mb-6">
          You&apos;ll receive a notification when your ground is approved.
        </p>
        <button
          onClick={() => router.push("/ground-owner/grounds")}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          Back to My Grounds
        </button>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-7">
        <button
          type="button"
          onClick={() => router.push("/ground-owner/grounds")}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> My Grounds
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Add New Ground</h1>
        <p className="text-slate-500 text-sm mt-1">
          Fill in the details below. Your ground will go live after admin approval.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── 1. Basic Information ── */}
        <Section step={1} icon={Building2} title="Basic Information">
          <Field label="Ground Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Colombo Cricket Ground"
              className={inputCls}
            />
          </Field>

          <Field label="Sport Category" required>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className={`${iconInputCls} bg-white`}
              >
                <option value="">Select a sport</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Description" hint="Optional">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe your facility, surfaces, rules, or anything players should know…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        {/* ── 2. Location ── */}
        <Section step={2} icon={MapPin} title="Location">
          <Field label="Street Address" required>
            <input
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. 45 Main Street, Kollupitiya"
              className={inputCls}
            />
          </Field>

          <Field label="City" required>
            <input
              type="text"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="e.g. Colombo"
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── 3. Pricing & Capacity ── */}
        <Section step={3} icon={DollarSign} title="Pricing & Capacity">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Hourly Rate (Rs.)" required>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Rs.</span>
                <input
                  type="number"
                  min={1}
                  value={form.hourlyRate}
                  onChange={(e) => set("hourlyRate", e.target.value)}
                  placeholder="2500"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-300 transition-shadow"
                />
              </div>
            </Field>

            <Field label="Max Capacity" hint="Optional">
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  placeholder="e.g. 22 players"
                  className={iconInputCls}
                />
              </div>
            </Field>
          </div>
          <p className="text-[11px] text-slate-400">
            Hourly rate applies to the whole facility. If you add multiple courts below, each court shares this rate.
          </p>
        </Section>

        {/* ── 4. Ground Photos ── */}
        <Section
          step={4}
          icon={ImagePlus}
          title="Ground Photos"
          badge={
            <span className="text-xs text-slate-400">
              {images.length}/8 uploaded
            </span>
          }
        >
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-green-400 bg-green-50"
                : "border-slate-200 hover:border-green-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-green-500" />
                <p className="text-sm font-medium">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-1">
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Drag & drop photos here</p>
                <p className="text-xs text-slate-400">or click to browse — JPEG, PNG, WebP · up to 5 MB each</p>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{uploadError}</p>
          )}

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={url} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                  <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="120px" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide">
                      COVER
                    </div>
                  )}
                </div>
              ))}
              {images.length < 8 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-green-300 hover:bg-green-50 flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-green-400 transition-all"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
          )}
        </Section>

        {/* ── 5. Amenities ── */}
        <Section
          step={5}
          icon={Sparkles}
          title="Amenities"
          badge={
            form.amenities.length > 0
              ? <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">{form.amenities.length} selected</span>
              : <span className="text-xs text-slate-400">Optional</span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const on = form.amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border transition-all ${
                    on
                      ? "bg-green-600 border-green-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700"
                  }`}
                >
                  {on && <CheckCircle className="w-3 h-3" />}
                  {a}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 6. Courts & Fields ── */}
        <Section
          step={6}
          icon={Grid3X3}
          title="Courts & Fields"
          badge={
            courts.length > 0
              ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{courts.length} added</span>
              : <span className="text-xs text-slate-400">Optional</span>
          }
        >
          <p className="text-xs text-slate-500 -mt-1">
            Add individual courts or fields so players can choose which one to book. Skip this if your facility has only one playing area — you can always add courts later.
          </p>

          {/* Court list */}
          {courts.length > 0 && (
            <div className="flex flex-col divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
              {courts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    {c.description
                      ? <p className="text-xs text-slate-400 truncate">{c.description}</p>
                      : <p className="text-xs text-slate-300 italic">No description</p>
                    }
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCourt(i)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add court row */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              {courts.length === 0 ? "Add a Court or Field" : "Add Another"}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={courtName}
                onChange={(e) => { setCourtName(e.target.value); setCourtError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCourt())}
                placeholder="Name  — e.g. Court A, Pitch 1"
                className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-300 transition-shadow"
              />
              <input
                type="text"
                value={courtDesc}
                onChange={(e) => setCourtDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCourt())}
                placeholder="Surface / notes  (optional)"
                className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-300 transition-shadow"
              />
              <button
                type="button"
                onClick={addCourt}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {courtError && (
              <p className="text-xs text-red-600 mt-2">{courtError}</p>
            )}
          </div>
        </Section>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm text-red-700">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Submit footer */}
        <div className="bg-white border border-slate-100 rounded-2xl px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/ground-owner/grounds")}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <>
                  <CheckCircle className="w-4 h-4" />
                  Submit for Approval
                  {courts.length > 0 && (
                    <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      + {courts.length} court{courts.length > 1 ? "s" : ""}
                    </span>
                  )}
                </>
            }
          </button>
        </div>

      </form>
    </div>
  );
}

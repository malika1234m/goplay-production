"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Building2, MapPin, DollarSign, Users, AlignLeft, Tag, CheckCircle, ImagePlus, X, Upload } from "lucide-react";

interface Category { id: string; name: string; icon: string | null }

const AMENITIES = ["Parking", "Changing Rooms", "Showers", "Floodlights", "Cafeteria", "WiFi", "Toilets", "First Aid"];

export default function NewGroundPage() {
  const router    = useRouter();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [categories,   setCategories]   = useState<Category[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState("");
  const [images,       setImages]       = useState<string[]>([]);   // uploaded URLs
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState("");
  const [dragOver,     setDragOver]     = useState(false);

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

  const toggleAmenity = (a: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x) => x !== a)
        : [...f.amenities, a],
    }));
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;
    if (images.length + fileArray.length > 8) {
      setUploadError("Maximum 8 images allowed.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fileArray.forEach((f) => fd.append("images", f));
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name    = form.name.trim();
    const address = form.address.trim();
    const city    = form.city.trim();
    if (!name || name.length < 3)         { setError("Ground name must be at least 3 characters."); return; }
    if (name.length > 100)                { setError("Ground name must be under 100 characters."); return; }
    if (!address || address.length < 5)   { setError("Address must be at least 5 characters."); return; }
    if (!city || city.length < 2)         { setError("City must be at least 2 characters."); return; }
    if (!form.categoryId)                 { setError("Please select a sport category."); return; }
    const rate = Number(form.hourlyRate);
    if (!form.hourlyRate || rate < 1)     { setError("Hourly rate must be at least Rs. 1."); return; }
    if (rate > 100000)                    { setError("Hourly rate cannot exceed Rs. 100,000."); return; }
    if (form.capacity) {
      const cap = Number(form.capacity);
      if (cap < 1)   { setError("Capacity must be at least 1 player."); return; }
      if (cap > 500) { setError("Capacity cannot exceed 500 players."); return; }
    }
    setSubmitting(true);
    setError("");

    const res  = await fetch("/api/ground-owner/grounds", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:        form.name,
        description: form.description || undefined,
        address:     form.address,
        city:        form.city,
        hourlyRate:  Number(form.hourlyRate),
        capacity:    form.capacity ? Number(form.capacity) : undefined,
        categoryId:  form.categoryId,
        amenities:   form.amenities,
        images,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to submit ground.");
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Ground Submitted!</h2>
        <p className="text-slate-500 text-sm mb-1 max-w-sm">
          Your ground has been sent to the admin for review. It will become active once approved.
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl mt-3 mb-6">
          You'll receive an SMS and notification when it's approved.
        </p>
        <button
          onClick={() => router.push("/ground-owner/grounds")}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Back to My Grounds
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add New Ground</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Submit your ground for admin review. It will be listed once approved.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Basic Information</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Ground Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Colombo Cricket Ground"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your ground, facilities, rules..."
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Sport Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Select a sport</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Location</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 45 Main Street, Kollupitiya"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g. Colombo"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Pricing & Capacity</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Hourly Rate (Rs.) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  required
                  min={1}
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  placeholder="e.g. 2500"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Capacity (players)</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="e.g. 22"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImagePlus className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Ground Photos</h2>
            <span className="text-xs text-slate-400 ml-1">(up to 8 images, 5 MB each)</span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
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
                <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                <p className="text-sm">Uploading images...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="w-8 h-8" />
                <p className="text-sm font-medium text-slate-600">Drag & drop photos here</p>
                <p className="text-xs">or click to browse — JPEG, PNG, WebP</p>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 mt-2">{uploadError}</p>
          )}

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={url} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <Image src={url} alt={`Preview ${i + 1}`} fill className="object-cover" sizes="120px" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1 left-1 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold">
                      COVER
                    </div>
                  )}
                </div>
              ))}
              {images.length < 8 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-green-300 flex items-center justify-center text-slate-300 hover:text-green-400 transition-colors"
                >
                  <ImagePlus className="w-6 h-6" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Amenities */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlignLeft className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Amenities</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const selected = form.amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    selected
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/ground-owner/grounds")}
            className="px-5 py-3 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}

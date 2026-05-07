"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import {
  Loader2, Building2, MapPin, DollarSign, Users,
  AlignLeft, ImagePlus, X, Upload, CheckCircle,
  ChevronLeft, AlertCircle,
} from "lucide-react";

interface Ground {
  id:          string;
  name:        string;
  description: string | null;
  address:     string;
  city:        string;
  hourlyRate:  number;
  capacity:    number | null;
  amenities:   string[];
  images:      string[];
  status:      string;
  category:    { id: string; name: string; icon: string | null };
}

const AMENITIES = ["Parking", "Changing Rooms", "Showers", "Floodlights", "Cafeteria", "WiFi", "Toilets", "First Aid"];

const STATUS_INFO: Record<string, { label: string; color: string; note: string }> = {
  PENDING:  { label: "Pending Review",  color: "bg-amber-50 border-amber-200 text-amber-800",  note: "This ground is awaiting admin approval. You can still update details and add photos — the admin will see your latest version." },
  ACTIVE:   { label: "Active",          color: "bg-green-50 border-green-200 text-green-800",  note: "This ground is live. Changes are saved immediately." },
  INACTIVE: { label: "Inactive",        color: "bg-slate-100 border-slate-200 text-slate-600", note: "This ground is currently inactive." },
  REJECTED: { label: "Rejected",        color: "bg-red-50 border-red-200 text-red-800",        note: "This ground was rejected by admin. Update the details and contact support." },
};

export default function EditGroundPage() {
  const router  = useRouter();
  const params  = useParams();
  const id      = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [ground,      setGround]      = useState<Ground | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");
  const [uploadError, setUploadError] = useState("");
  const [dragOver,    setDragOver]    = useState(false);

  const [form, setForm] = useState({
    name:        "",
    description: "",
    address:     "",
    city:        "",
    hourlyRate:  "",
    capacity:    "",
    amenities:   [] as string[],
  });
  const [images, setImages] = useState<string[]>([]);

  // Load ground data
  useEffect(() => {
    fetch(`/api/ground-owner/grounds/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ground) {
          const g: Ground = d.ground;
          setGround(g);
          setForm({
            name:        g.name,
            description: g.description ?? "",
            address:     g.address,
            city:        g.city,
            hourlyRate:  String(g.hourlyRate),
            capacity:    g.capacity ? String(g.capacity) : "",
            amenities:   g.amenities ?? [],
          });
          setImages(g.images ?? []);
        }
      })
      .catch(() => setError("Failed to load ground."))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleAmenity = (a: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    if (images.length + arr.length > 8) { setUploadError("Maximum 8 images allowed."); return; }
    setUploading(true); setUploadError("");
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name    = form.name.trim();
    const address = form.address.trim();
    const city    = form.city.trim();
    if (!name || name.length < 3)       { setError("Ground name must be at least 3 characters."); return; }
    if (name.length > 100)              { setError("Ground name must be under 100 characters."); return; }
    if (!address || address.length < 5) { setError("Address must be at least 5 characters."); return; }
    if (!city || city.length < 2)       { setError("City must be at least 2 characters."); return; }
    const rate = Number(form.hourlyRate);
    if (!form.hourlyRate || rate < 1)   { setError("Hourly rate must be at least Rs. 1."); return; }
    if (rate > 100000)                  { setError("Hourly rate cannot exceed Rs. 100,000."); return; }
    if (form.capacity) {
      const cap = Number(form.capacity);
      if (cap < 1)   { setError("Capacity must be at least 1 player."); return; }
      if (cap > 500) { setError("Capacity cannot exceed 500 players."); return; }
    }
    setSaving(true); setError("");

    const res = await fetch(`/api/ground-owner/grounds/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:        form.name,
        description: form.description || null,
        address:     form.address,
        city:        form.city,
        hourlyRate:  Number(form.hourlyRate),
        capacity:    form.capacity ? Number(form.capacity) : null,
        amenities:   form.amenities,
        images,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading ground...</span>
      </div>
    );
  }

  if (!ground) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-slate-600 font-medium">Ground not found</p>
        <button onClick={() => router.push("/ground-owner/grounds")} className="mt-4 text-sm text-green-600 hover:underline">
          Back to My Grounds
        </button>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[ground.status] ?? STATUS_INFO.INACTIVE;

  return (
    <div className="max-w-2xl flex flex-col gap-7">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/ground-owner/grounds")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to My Grounds
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Edit Ground</h1>
        <p className="text-slate-500 text-sm mt-0.5">{ground.category.icon} {ground.category.name}</p>
      </div>

      {/* Status banner */}
      <div className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${statusInfo.color}`}>
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">{statusInfo.label} — </span>{statusInfo.note}
        </div>
      </div>

      {/* Success toast */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" /> Changes saved successfully!
        </div>
      )}

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
              type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your ground, facilities, rules..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
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
              type="text" required value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text" required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
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
                  type="number" required min={1} value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Capacity (players)</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number" min={1} value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImagePlus className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Ground Photos</h2>
            <span className="text-xs text-slate-400 ml-1">(up to 8 images, 5 MB each)</span>
          </div>

          {/* Current images */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {images.map((url, i) => (
                <div key={url} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="120px" />
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

          {/* Drop zone — shown when no images or to add more */}
          {images.length === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-green-300 hover:bg-slate-50"
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                  <p className="text-sm">Uploading photos...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm font-medium text-slate-600">Drag & drop photos here</p>
                  <p className="text-xs">or click to browse — JPEG, PNG, WebP</p>
                </div>
              )}
            </div>
          )}

          {uploading && images.length > 0 && (
            <div className="flex items-center gap-2 text-slate-500 text-sm mt-2">
              <Loader2 className="w-4 h-4 animate-spin text-green-500" /> Uploading...
            </div>
          )}

          <input
            ref={fileRef} type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />

          {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
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
                  key={a} type="button" onClick={() => toggleAmenity(a)}
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
            type="submit" disabled={saving || uploading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

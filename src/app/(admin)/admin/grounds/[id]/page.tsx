"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, MapPin, Clock, Users, Star, Calendar, CheckCircle,
  XCircle, PauseCircle, Loader2, Phone, Mail, Building2, Tag,
  ImageIcon, ExternalLink, AlertCircle, AlertTriangle, Zap, Trash2,
} from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE:   { label: "Active",   bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  PENDING:  { label: "Pending",  bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  INACTIVE: { label: "Inactive", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  REJECTED: { label: "Rejected", bg: "bg-red-50",   text: "text-red-700",   dot: "bg-red-500" },
};

interface Availability {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

interface Ground {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  hourlyRate: number;
  capacity: number | null;
  amenities: string[];
  images: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  categories: { id: string; name: string; icon: string | null }[];
  owner: {
    id: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    user: { id: string; name: string; email: string; phone: string | null; createdAt: string };
  };
  availability: Availability[];
  _count: { bookings: number; reviews: number };
}

interface ActiveLobby {
  id: string;
  lobbyCode: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  spotsReserved: number;
  totalSpotsNeeded: number;
  category: { name: string; icon: string | null };
}

/* ── Map component — geocodes via Nominatim, embeds OSM iframe ── */
function MapEmbed({ address, city }: { address: string; city: string }) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    const query = encodeURIComponent(`${address}, ${city}, Sri Lanka`);
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { "User-Agent": "GoPlay/1.0" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data[0]) {
          setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [address, city]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}`)}`;

  if (loading) {
    return (
      <div className="h-64 bg-slate-50 rounded-xl flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading map…</span>
      </div>
    );
  }

  if (failed || !coords) {
    return (
      <div className="h-64 bg-slate-50 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400">
        <MapPin className="w-8 h-8 text-slate-300" />
        <p className="text-sm">Could not locate address on map</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Search on Google Maps
        </a>
      </div>
    );
  }

  const delta = 0.008;
  const bbox  = `${coords.lon - delta}%2C${coords.lat - delta}%2C${coords.lon + delta}%2C${coords.lat + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lon}`;

  return (
    <div className="space-y-2">
      <iframe
        src={embedUrl}
        className="w-full h-64 rounded-xl border border-slate-200"
        loading="lazy"
        title="Ground location map"
      />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
      >
        <ExternalLink className="w-3 h-3" />
        Open in Google Maps
      </a>
    </div>
  );
}

/* ── Lightbox image gallery ── */
function ImageGallery({ images }: { images: string[] }) {
  const [active, setActive]   = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!images.length) {
    return (
      <div className="h-64 bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
        <ImageIcon className="w-10 h-10 text-slate-200" />
        <p className="text-sm">No photos uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div
          className="relative h-72 rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in group"
          onClick={() => setLightbox(true)}
        >
          <Image src={images[active]} alt={`Photo ${active + 1}`} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {active + 1} / {images.length}
          </span>
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={src}
                onClick={() => setActive(i)}
                className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 ring-2 transition-all ${
                  i === active ? "ring-blue-500" : "ring-transparent hover:ring-slate-300"
                }`}
              >
                <Image src={src} alt={`Thumb ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] aspect-video">
            <Image src={images[active]} alt="Full size" fill className="object-contain" />
          </div>
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition"
                onClick={(e) => { e.stopPropagation(); setActive((a) => (a - 1 + images.length) % images.length); }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition"
                onClick={(e) => { e.stopPropagation(); setActive((a) => (a + 1) % images.length); }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ── Main page ── */
export default function AdminGroundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [ground,   setGround]   = useState<Ground | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [updating, setUpdating] = useState(false);
  const [toast,    setToast]    = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeLobbies,     setActiveLobbies]     = useState<ActiveLobby[]>([]);
  const [cancellingLobby,   setCancellingLobby]   = useState<string | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/grounds/${id}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load ground."); return; }
      setGround(data.ground);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadLobbies = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/open-matches?facilityId=${id}&status=COLLECTING`);
      if (res.ok) setActiveLobbies(await res.json());
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => { load(); loadLobbies(); }, [load, loadLobbies]);

  const cancelLobby = async (matchId: string) => {
    setCancellingLobby(matchId);
    try {
      const res  = await fetch("/api/admin/open-matches", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveLobbies((prev) => prev.filter((l) => l.id !== matchId));
        showToast("success", data.message ?? "Lobby cancelled.");
      } else {
        showToast("error", data.error ?? "Failed to cancel lobby.");
      }
    } finally {
      setCancellingLobby(null);
    }
  };

  const updateStatus = async (status: string, reason?: string) => {
    if (!ground) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/grounds/${id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("error", data.error ?? "Update failed."); return; }
      setGround((g) => g ? { ...g, status } : g);
      if (status === "INACTIVE" || status === "REJECTED") setActiveLobbies([]);
      const expiredNote = data.expiredLobbies > 0
        ? ` · ${data.expiredLobbies} ${data.expiredLobbies === 1 ? "lobby" : "lobbies"} cancelled & refunded`
        : "";
      showToast("success", `Ground ${status === "ACTIVE" ? "approved and is now live" : status === "REJECTED" ? "rejected" : "deactivated"}${expiredNote}.`);
      setRejectModal(false);
      setRejectReason("");
    } finally {
      setUpdating(false);
    }
  };

  /* ── Loading / error states ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading ground details…</span>
      </div>
    );
  }

  if (error || !ground) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-slate-500">
        <AlertCircle className="w-10 h-10 text-slate-300" />
        <p>{error || "Ground not found."}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[ground.status] ?? STATUS_CONFIG.INACTIVE;

  return (
    <div className="flex flex-col gap-6 max-w-6xl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{ground.name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              {ground.address}, {ground.city}
            </p>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>

          {ground.status !== "ACTIVE" && (
            <button
              onClick={() => updateStatus("ACTIVE")}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve Ground
            </button>
          )}

          {ground.status === "ACTIVE" && (
            <button
              onClick={() => activeLobbies.length > 0 ? setDeactivateConfirm(true) : updateStatus("INACTIVE")}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
              Deactivate
              {activeLobbies.length > 0 && (
                <span className="ml-0.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {activeLobbies.length}
                </span>
              )}
            </button>
          )}

          {ground.status !== "REJECTED" && ground.status !== "ACTIVE" && (
            <button
              onClick={() => setRejectModal(true)}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          )}
        </div>
      </div>

      {/* PENDING notice */}
      {ground.status === "PENDING" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            This ground is awaiting your review. Check the photos, details, and location below before approving or rejecting.
          </p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — images + map */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Photos */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Photos
              <span className="ml-2 text-slate-400 font-normal">({ground.images.length})</span>
            </h2>
            <ImageGallery images={ground.images} />
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700">Ground Details</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <DetailTile icon={<Tag className="w-4 h-4" />} label="Sports" value={(ground.categories ?? []).map((c) => `${c.icon ?? ""} ${c.name}`.trim()).join(", ") || "—"} />
              <DetailTile icon={<MapPin className="w-4 h-4" />} label="City" value={ground.city} />
              <DetailTile icon={<Clock className="w-4 h-4" />} label="Hourly Rate" value={`Rs. ${ground.hourlyRate.toLocaleString()}`} />
              {ground.capacity && (
                <DetailTile icon={<Users className="w-4 h-4" />} label="Capacity" value={`${ground.capacity} people`} />
              )}
              <DetailTile icon={<Star className="w-4 h-4" />} label="Reviews" value={String(ground._count.reviews)} />
              <DetailTile icon={<Calendar className="w-4 h-4" />} label="Bookings" value={String(ground._count.bookings)} />
            </div>

            {ground.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ground.description}</p>
              </div>
            )}

            {ground.amenities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {ground.amenities.map((a) => (
                    <span key={a} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Location + Map */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Location</h2>
              <span className="text-xs text-slate-400">{ground.address}, {ground.city}</span>
            </div>
            <MapEmbed address={ground.address} city={ground.city} />
          </div>
        </div>

        {/* Right column — owner + availability */}
        <div className="flex flex-col gap-6">

          {/* Owner card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Ground Owner</h2>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                {ground.owner.user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{ground.owner.user.name}</p>
                <p className="text-xs text-slate-400">Ground Owner</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <InfoRow icon={<Mail className="w-3.5 h-3.5" />} value={ground.owner.user.email} />
              {(ground.owner.user.phone || ground.owner.phone) && (
                <InfoRow icon={<Phone className="w-3.5 h-3.5" />} value={ground.owner.user.phone ?? ground.owner.phone!} />
              )}
              {(ground.owner.address || ground.owner.city) && (
                <InfoRow
                  icon={<Building2 className="w-3.5 h-3.5" />}
                  value={[ground.owner.address, ground.owner.city].filter(Boolean).join(", ")}
                />
              )}
            </div>

            <div className="pt-2 border-t border-slate-50">
              <p className="text-xs text-slate-400">
                Member since {new Date(ground.owner.user.createdAt).toLocaleDateString("en-LK", { year: "numeric", month: "long" })}
              </p>
            </div>
          </div>

          {/* Availability */}
          {ground.availability.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Weekly Schedule</h2>
              <div className="space-y-2">
                {ground.availability.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${slot.isOpen ? "text-slate-700" : "text-slate-400"}`}>
                      {DAY_NAMES[slot.dayOfWeek]}
                    </span>
                    {slot.isOpen ? (
                      <span className="text-slate-500">{slot.openTime} – {slot.closeTime}</span>
                    ) : (
                      <span className="text-slate-300">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Lobbies */}
          {activeLobbies.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">Active Lobbies</h2>
                <span className="text-[10px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  {activeLobbies.length}
                </span>
              </div>
              <p className="text-xs text-amber-700">
                These lobbies will be auto-cancelled if you deactivate this ground. All paid players will be refunded.
              </p>
              <div className="space-y-2.5">
                {activeLobbies.map((lobby) => (
                  <div key={lobby.id} className="bg-white rounded-xl border border-amber-100 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {lobby.category.icon} {lobby.category.name}
                          <span className="ml-1.5 text-[10px] text-slate-400 font-mono">#{lobby.lobbyCode}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(lobby.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })}
                          {" "}{lobby.preferredStartTime}–{lobby.preferredEndTime}
                        </p>
                      </div>
                      <button
                        onClick={() => cancelLobby(lobby.id)}
                        disabled={cancellingLobby === lobby.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
                      >
                        {cancellingLobby === lobby.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                        Cancel
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${Math.min(100, (lobby.spotsReserved / lobby.totalSpotsNeeded) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-amber-700 font-medium whitespace-nowrap">
                        {lobby.spotsReserved}/{lobby.totalSpotsNeeded} spots
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Timeline</h2>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(ground.createdAt).toLocaleDateString("en-LK")}</span>
              </div>
              <div className="flex justify-between">
                <span>Last updated</span>
                <span>{new Date(ground.updatedAt).toLocaleDateString("en-LK")}</span>
              </div>
              <div className="flex justify-between">
                <span>Ground ID</span>
                <span className="font-mono text-slate-400">{ground.id.slice(0, 12)}…</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deactivation warning modal */}
      {deactivateConfirm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Deactivate {ground.name}?</h3>
              <p className="text-sm text-slate-500">This action cannot be undone without re-approval.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {activeLobbies.length} active {activeLobbies.length === 1 ? "lobby" : "lobbies"} will be cancelled
              </p>
              <p className="text-xs text-amber-700 pl-5">
                All players with paid spots will be refunded and notified automatically.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeactivateConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Keep Active
              </button>
              <button
                onClick={() => { setDeactivateConfirm(false); updateStatus("INACTIVE"); }}
                disabled={updating}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reject Ground</h3>
            <p className="text-sm text-slate-500">
              Please provide a reason for rejecting <span className="font-medium text-slate-700">{ground.name}</span>.
              The owner will be notified.
            </p>
            {activeLobbies.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">{activeLobbies.length} active {activeLobbies.length === 1 ? "lobby" : "lobbies"}</span> will also be cancelled and all players refunded.
                </p>
              </div>
            )}
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient photos provided, address could not be verified…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectModal(false); setRejectReason(""); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus("REJECTED", rejectReason)}
                disabled={updating || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl">
      <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

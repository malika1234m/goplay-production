"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Plus, Pencil, Trash2, Loader2, AlertTriangle,
  CheckCircle, XCircle, GripVertical, Eye, EyeOff,
} from "lucide-react";

interface Court {
  id:          string;
  name:        string;
  description: string | null;
  isActive:    boolean;
  sortOrder:   number;
  _count:      { bookings: number };
}

interface FacilitySummary {
  name: string;
  city: string;
}

/* ── Court form modal ── */
interface CourtModalProps {
  court:    Court | null;
  onClose:  () => void;
  onSaved:  (court: Court) => void;
  facilityId: string;
}

function CourtModal({ court, onClose, onSaved, facilityId }: CourtModalProps) {
  const isEdit = !!court;
  const [name,        setName]        = useState(court?.name ?? "");
  const [description, setDescription] = useState(court?.description ?? "");
  const [isActive,    setIsActive]    = useState(court?.isActive ?? true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const handleSave = async () => {
    setError("");
    if (!name.trim()) { setError("Court name is required."); return; }
    if (name.trim().length < 2) { setError("Court name must be at least 2 characters."); return; }

    setSaving(true);
    const url    = isEdit
      ? `/api/ground-owner/grounds/${facilityId}/courts/${court!.id}`
      : `/api/ground-owner/grounds/${facilityId}/courts`;
    const method = isEdit ? "PUT" : "POST";

    const res  = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: name.trim(), description: description.trim() || null, isActive }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save court.");
    } else {
      onSaved(data.court);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div>
          <h3 className="text-base font-bold text-slate-900">{isEdit ? "Edit Court" : "Add Court"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEdit ? "Update court details below." : "Add a new court or field to this facility."}
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Court Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Court A, Main Field, Pitch 1"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Grass surface, floodlit, seats 200…"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300 resize-none"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Active</p>
            <p className="text-xs text-slate-400">Inactive courts won&apos;t be shown for booking</p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? "bg-indigo-600" : "bg-slate-200"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Add Court"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function CourtsManagementPage() {
  const params     = useParams<{ id: string }>();
  const facilityId = params.id;

  const [courts,   setCourts]   = useState<Court[]>([]);
  const [facility, setFacility] = useState<FacilitySummary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [modal,    setModal]    = useState<"add" | Court | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [courtsRes, facilityRes] = await Promise.all([
        fetch(`/api/ground-owner/grounds/${facilityId}/courts`),
        fetch(`/api/ground-owner/grounds/${facilityId}`),
      ]);
      const courtsData   = await courtsRes.json();
      const facilityData = await facilityRes.json();
      setCourts(courtsData.courts ?? []);
      if (facilityData.ground) {
        setFacility({ name: facilityData.ground.name, city: facilityData.ground.city });
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (court: Court) => {
    setToggling(court.id);
    const res  = await fetch(`/api/ground-owner/grounds/${facilityId}/courts/${court.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !court.isActive }),
    });
    const data = await res.json();
    setToggling(null);
    if (res.ok) {
      setCourts((prev) => prev.map((c) => c.id === court.id ? data.court : c));
    } else {
      setError(data.error ?? "Failed to update court.");
    }
  };

  const handleDelete = async (court: Court) => {
    if (!confirm(`Delete "${court.name}"? This cannot be undone.`)) return;
    setDeleting(court.id);
    setError("");
    const res  = await fetch(`/api/ground-owner/grounds/${facilityId}/courts/${court.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(null);
    if (res.ok) {
      setCourts((prev) => prev.filter((c) => c.id !== court.id));
    } else {
      setError(data.error ?? "Failed to delete court.");
    }
  };

  const handleSaved = (savedCourt: Court) => {
    setCourts((prev) => {
      const idx = prev.findIndex((c) => c.id === savedCourt.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedCourt;
        return next;
      }
      return [...prev, savedCourt];
    });
    setModal(null);
  };

  const activeCourts   = courts.filter((c) => c.isActive);
  const inactiveCourts = courts.filter((c) => !c.isActive);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/ground-owner/grounds" className="hover:text-slate-700 transition-colors">My Grounds</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{facility?.name ?? "…"}</span>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Courts & Fields</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/ground-owner/grounds"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Courts &amp; Fields</h1>
          <p className="text-slate-500 text-sm mt-1">
            {facility ? `${facility.name}, ${facility.city}` : "Loading…"}
            {" · "}
            {courts.length} court{courts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Court
        </button>
      </div>

      {/* Info callout */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-sm text-indigo-700">
        Courts let players choose a specific field or court when booking. If you have only one playing area, you don&apos;t need to add courts — bookings will cover the whole facility.
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading courts…</span>
        </div>
      ) : courts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
          <div className="text-5xl mb-4">🏟️</div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No courts yet</h3>
          <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
            Add courts or fields so players can choose which one to book.
          </p>
          <button
            onClick={() => setModal("add")}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add First Court
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Active courts */}
          {activeCourts.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green-600 px-1 mb-3">
                Active ({activeCourts.length})
              </p>
              <div className="flex flex-col gap-3">
                {activeCourts.map((court) => (
                  <CourtCard
                    key={court.id}
                    court={court}
                    deleting={deleting === court.id}
                    toggling={toggling === court.id}
                    onEdit={() => setModal(court)}
                    onDelete={() => handleDelete(court)}
                    onToggle={() => handleToggle(court)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive courts */}
          {inactiveCourts.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-3">
                Inactive ({inactiveCourts.length})
              </p>
              <div className="flex flex-col gap-3">
                {inactiveCourts.map((court) => (
                  <CourtCard
                    key={court.id}
                    court={court}
                    deleting={deleting === court.id}
                    toggling={toggling === court.id}
                    onEdit={() => setModal(court)}
                    onDelete={() => handleDelete(court)}
                    onToggle={() => handleToggle(court)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <CourtModal
          court={modal === "add" ? null : modal}
          facilityId={facilityId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ── Court card ── */
function CourtCard({
  court, deleting, toggling, onEdit, onDelete, onToggle,
}: {
  court:    Court;
  deleting: boolean;
  toggling: boolean;
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const hasActiveBookings = court._count.bookings > 0;

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${court.isActive ? "border-slate-100" : "border-slate-100 opacity-70"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1 text-slate-300 shrink-0 mt-1">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
            {court.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{court.name}</span>
              {!court.isActive && (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            {court.description && (
              <p className="text-xs text-slate-500 mt-0.5">{court.description}</p>
            )}
            {court._count.bookings > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {court._count.bookings} active booking{court._count.bookings !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggle}
            disabled={toggling}
            title={court.isActive ? "Deactivate" : "Activate"}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : court.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting || hasActiveBookings}
            title={hasActiveBookings ? "Has active bookings — deactivate instead" : "Delete"}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {hasActiveBookings && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Has active bookings — deactivate instead of deleting
        </div>
      )}

      {!court.isActive && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          Not shown to players when booking
        </div>
      )}
    </div>
  );
}

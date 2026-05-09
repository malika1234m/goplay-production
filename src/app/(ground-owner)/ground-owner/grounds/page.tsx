"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, MapPin, Star, Eye, Pencil, Trash2,
  CheckCircle, Clock, XCircle, Loader2, Grid3X3,
} from "lucide-react";

interface Ground {
  id:            string;
  name:          string;
  city:          string;
  address:       string;
  hourlyRate:    number;
  images:        string[];
  category:      string;
  categoryIcon:  string | null;
  status:        string;
  totalBookings: number;
  avgRating:     number | null;
  totalReviews:  number;
  courtCount:    number;
}

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
};

const statusConfig: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  ACTIVE:   { label: "Active",   style: "bg-green-50 text-green-700 border-green-100",  icon: CheckCircle },
  PENDING:  { label: "Pending",  style: "bg-amber-50 text-amber-700 border-amber-100",  icon: Clock },
  INACTIVE: { label: "Inactive", style: "bg-slate-100 text-slate-600 border-slate-200", icon: XCircle },
  REJECTED: { label: "Rejected", style: "bg-red-50 text-red-600 border-red-100",        icon: XCircle },
};

export default function GroundOwnerGrounds() {
  const [grounds,   setGrounds]   = useState<Ground[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetch("/api/ground-owner/grounds")
      .then((r) => r.json())
      .then((d) => setGrounds(d.grounds ?? []))
      .catch(() => setGrounds([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    setError("");
    const res  = await fetch(`/api/ground-owner/grounds/${id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(null);
    if (!res.ok) {
      setError(data.error ?? "Failed to delete ground.");
    } else {
      setGrounds((prev) => prev.filter((g) => g.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading grounds...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Grounds</h1>
          <p className="text-slate-500 text-sm mt-1">
            {grounds.length} {grounds.length === 1 ? "facility" : "facilities"} listed
          </p>
        </div>
        <Link
          href="/ground-owner/grounds/new"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Ground
        </Link>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",   value: grounds.length,                                       color: "text-slate-900" },
          { label: "Active",  value: grounds.filter((g) => g.status === "ACTIVE").length,  color: "text-green-600" },
          { label: "Pending", value: grounds.filter((g) => g.status === "PENDING").length, color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Grounds list */}
      {grounds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="text-6xl mb-4">🏟️</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No grounds yet</h3>
          <p className="text-slate-400 text-sm mb-6">Add your first ground to start receiving bookings.</p>
          <Link
            href="/ground-owner/grounds/new"
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Your First Ground
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grounds.map((g) => {
            const { label, style, icon: StatusIcon } = statusConfig[g.status] ?? statusConfig.PENDING;
            const icon = g.categoryIcon ?? categoryEmoji[g.category] ?? "🏟️";
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100 bg-green-50 flex items-center justify-center">
                    {g.images && g.images.length > 0 ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={g.images[0]}
                          alt={g.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <span className="text-4xl">{icon}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-slate-900">{g.name}</h3>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${style}`}>
                            <StatusIcon className="w-3 h-3" /> {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {g.city}
                          </span>
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                            {g.category}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/grounds/${g.id}`}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/ground-owner/grounds/${g.id}/courts`}
                          className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Manage Courts"
                        >
                          <Grid3X3 className="w-4 h-4" />
                          {g.courtCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                              {g.courtCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          href={`/ground-owner/grounds/${g.id}/edit`}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(g.id, g.name)}
                          disabled={deleting === g.id}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === g.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-5 mt-3 pt-3 border-t border-slate-50">
                      <div>
                        <p className="text-xs text-slate-400">Rate</p>
                        <p className="text-sm font-semibold text-slate-900">
                          Rs. {g.hourlyRate.toLocaleString()}/hr
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Courts</p>
                        <p className="text-sm font-semibold text-slate-900">{g.courtCount || "—"}</p>
                      </div>
                      {g.status === "ACTIVE" && (
                        <>
                          <div>
                            <p className="text-xs text-slate-400">Rating</p>
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <p className="text-sm font-semibold text-slate-900">
                                {g.avgRating ?? "—"}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Total Bookings</p>
                            <p className="text-sm font-semibold text-slate-900">{g.totalBookings}</p>
                          </div>
                        </>
                      )}
                      {g.status === "PENDING" && (
                        <p className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          Awaiting admin approval
                        </p>
                      )}
                      {g.status === "REJECTED" && (
                        <p className="text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          Rejected by admin
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

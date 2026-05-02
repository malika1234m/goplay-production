"use client";

import { useEffect, useState } from "react";
import { LocateFixed, RefreshCw, CheckCircle, XCircle, Loader2, Map } from "lucide-react";

interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

export default function AdminGeocodePage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/geocode");
    const d = await res.json();
    setFacilities(d.facilities ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function geocodeOne(id: string) {
    setGeocodingId(id);
    const res = await fetch("/api/admin/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: id }),
    });
    const d = await res.json();
    setGeocodingId(null);
    if (d.success) {
      showToast("Geocoded successfully.", true);
      setFacilities((prev) =>
        prev.map((f) => f.id === id ? { ...f, latitude: d.lat, longitude: d.lng } : f)
      );
    } else {
      showToast(d.error ?? "Could not geocode.", false);
    }
  }

  async function bulkGeocode() {
    setBulkLoading(true);
    const res = await fetch("/api/admin/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const d = await res.json();
    setBulkLoading(false);
    const ok = d.results?.filter((r: any) => r.success).length ?? 0;
    showToast(`Geocoded ${ok} facilities.`, ok > 0);
    load();
  }

  async function saveManual(id: string) {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng)) { showToast("Invalid coordinates.", false); return; }
    const res = await fetch("/api/admin/geocode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: id, latitude: lat, longitude: lng }),
    });
    const d = await res.json();
    if (d.success) {
      showToast("Saved.", true);
      setFacilities((prev) =>
        prev.map((f) => f.id === id ? { ...f, latitude: lat, longitude: lng } : f)
      );
      setEditId(null);
    } else {
      showToast(d.error ?? "Failed.", false);
    }
  }

  const missing = facilities.filter((f) => !f.latitude || !f.longitude).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <LocateFixed className="w-5 h-5 text-green-600" /> Geocode Facilities
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set latitude/longitude coordinates so facilities appear on the map.
            {missing > 0 && (
              <span className="ml-1 text-amber-600 font-medium">{missing} without coordinates.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {missing > 0 && (
            <button
              onClick={bulkGeocode}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60"
            >
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              Auto-geocode All Missing
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-green-500" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Facility</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Address</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Coordinates</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {facilities.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                  <td className="px-4 py-3 text-slate-500">{f.address}, {f.city}</td>
                  <td className="px-4 py-3">
                    {f.latitude && f.longitude ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> Not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === f.id ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input
                          type="number"
                          placeholder="Lat"
                          value={editLat}
                          onChange={(e) => setEditLat(e.target.value)}
                          className="w-24 text-xs border border-slate-200 rounded px-2 py-1"
                          step="any"
                        />
                        <input
                          type="number"
                          placeholder="Lng"
                          value={editLng}
                          onChange={(e) => setEditLng(e.target.value)}
                          className="w-24 text-xs border border-slate-200 rounded px-2 py-1"
                          step="any"
                        />
                        <button
                          onClick={() => saveManual(f.id)}
                          className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => geocodeOne(f.id)}
                          disabled={geocodingId === f.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-green-500 hover:text-green-600 text-slate-600 disabled:opacity-60"
                        >
                          {geocodingId === f.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <LocateFixed className="w-3 h-3" />}
                          Auto
                        </button>
                        <button
                          onClick={() => {
                            setEditId(f.id);
                            setEditLat(f.latitude?.toString() ?? "");
                            setEditLng(f.longitude?.toString() ?? "");
                          }}
                          className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                        >
                          Manual
                        </button>
                        {f.latitude && f.longitude && (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=15/${f.latitude}/${f.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-slate-300 text-slate-600 flex items-center gap-1"
                          >
                            <Map className="w-3 h-3" /> View
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

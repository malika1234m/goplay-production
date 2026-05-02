"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, CheckCircle, XCircle, Clock,
  User, Building2, MapPin, Phone, DollarSign, Users,
  ChevronDown, ChevronUp, Loader2, Eye,
} from "lucide-react";

interface Application {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  phone: string;
  address: string;
  city: string;
  facilityName: string;
  facilityAddress: string;
  facilityCity: string;
  proposedHourlyRate: number;
  capacity: number | null;
  amenities: string[];
  facilityDescription: string | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { name: string; email: string; phone: string | null };
  category: { name: string; icon: string | null };
}

interface Summary { pending: number; approved: number; rejected: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
};

function Modal({ app, onClose, onDone }: { app: Application; onClose: () => void; onDone: () => void }) {
  const [action, setAction]             = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setReason]    = useState("");
  const [adminNotes, setAdminNotes]     = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [approvedFacility, setApproved] = useState<{ id: string; name: string } | null>(null);

  const submit = async () => {
    if (!action) return;
    if (action === "reject" && !rejectionReason.trim()) { setError("Rejection reason is required."); return; }
    setLoading(true); setError("");
    const res = await fetch(`/api/admin/applications/${app.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason, adminNotes }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError((data.detail ?? data.error) ?? "Failed."); return; }
    if (action === "approve" && data.facilityId) {
      setApproved({ id: data.facilityId, name: data.facilityName });
    } else {
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Application Review</h2>
            <p className="text-sm text-slate-500">Submitted {new Date(app.createdAt).toLocaleDateString()}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[app.status]}`}>
            {app.status}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Applicant */}
          <section>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Applicant</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <User className="w-4 h-4 text-slate-400" />{app.user.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-4 h-4 text-slate-400 text-xs flex items-center justify-center">@</span>{app.user.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />{app.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400" />{app.address}, {app.city}
              </div>
            </div>
          </section>

          {/* Facility */}
          <section>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Proposed Facility</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Building2 className="w-4 h-4 text-slate-400" />{app.facilityName}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-base">{app.category.icon ?? "🏟️"}</span>{app.category.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />{app.facilityAddress}, {app.facilityCity}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <DollarSign className="w-4 h-4 text-slate-400" />Rs. {app.proposedHourlyRate}/hr
                </div>
                {app.capacity && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />{app.capacity} capacity
                  </div>
                )}
              </div>
              {app.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {app.amenities.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600">{a}</span>
                  ))}
                </div>
              )}
              {app.facilityDescription && (
                <p className="text-sm text-slate-600 leading-relaxed">{app.facilityDescription}</p>
              )}
            </div>
          </section>

          {/* Prior review info */}
          {app.status !== "PENDING" && (
            <section>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Review Decision</h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                {app.rejectionReason && <p><span className="font-medium">Reason:</span> {app.rejectionReason}</p>}
                {app.adminNotes      && <p><span className="font-medium">Notes:</span> {app.adminNotes}</p>}
                {app.reviewedAt      && <p className="text-slate-400">Reviewed on {new Date(app.reviewedAt).toLocaleDateString()}</p>}
              </div>
            </section>
          )}

          {/* Action area — only for PENDING */}
          {app.status === "PENDING" && (
            <section>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Decision</h3>

              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setAction(action === "approve" ? null : "approve")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    action === "approve"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-slate-200 text-slate-600 hover:border-green-300"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setAction(action === "reject" ? null : "reject")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                    action === "reject"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-600 hover:border-red-300"
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>

              {action === "reject" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this application is being rejected..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin notes (optional)</label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes (not shown to applicant)..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            </section>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          {/* Post-approval success panel */}
          {approvedFacility && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Application approved successfully!</p>
                  <p className="text-sm text-green-700 mt-1">
                    <span className="font-medium">&quot;{approvedFacility.name}&quot;</span> has been created and is waiting in Ground Management.
                    The owner has been asked to add photos. Review and activate the ground once they&apos;re uploaded.
                  </p>
                  <a
                    href="/admin/grounds"
                    className="inline-flex items-center gap-1.5 mt-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    Go to Ground Management →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => { onDone(); }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {approvedFacility ? "Done" : "Close"}
          </button>
          {app.status === "PENDING" && action && !approvedFacility && (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                action === "approve"
                  ? "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                  : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Processing..." : action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [summary, setSummary]           = useState<Summary>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Application | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("q", search.trim());
    const res  = await fetch(`/api/admin/applications?${params}`);
    const data = await res.json();
    setApplications(data.applications ?? []);
    setSummary(data.summary ?? { pending: 0, approved: 0, rejected: 0 });
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleDone = () => { setSelected(null); load(); };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Provider Applications</h1>
            <p className="text-sm text-slate-500">Review and approve ground owner applications</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Pending Review", count: summary.pending,  color: "yellow", icon: Clock       },
          { label: "Approved",       count: summary.approved, color: "green",  icon: CheckCircle },
          { label: "Rejected",       count: summary.rejected, color: "red",    icon: XCircle     },
        ].map(({ label, count, color, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(
              label === "Pending Review" ? "PENDING" :
              label === "Approved"       ? "APPROVED" : "REJECTED"
            )}
            className={`bg-white rounded-2xl border p-4 text-left hover:shadow-md transition-shadow ${
              statusFilter === (label === "Pending Review" ? "PENDING" : label === "Approved" ? "APPROVED" : "REJECTED")
                ? `border-${color}-400 ring-2 ring-${color}-200`
                : "border-slate-100"
            }`}
          >
            <div className={`w-9 h-9 bg-${color}-100 rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {(statusFilter || search) && (
          <button
            type="button"
            onClick={() => { setStatusFilter(""); setSearch(""); }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Applications list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No applications found</p>
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-base shrink-0">
                  {app.user.name[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{app.user.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[app.status]}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{app.user.email}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="text-base">{app.category.icon ?? "🏟️"}</span>{" "}
                    <span className="font-medium">{app.facilityName}</span> — {app.facilityCity}
                  </p>
                </div>

                {/* Date + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(app)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors"
                  >
                    {expandedId === app.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded quick view */}
              {expandedId === app.id && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div><span className="text-slate-400">Phone:</span> {app.phone}</div>
                  <div><span className="text-slate-400">City:</span> {app.city}</div>
                  <div><span className="text-slate-400">Rate:</span> Rs. {app.proposedHourlyRate}/hr</div>
                  <div><span className="text-slate-400">Facility:</span> {app.facilityAddress}</div>
                  {app.capacity && <div><span className="text-slate-400">Capacity:</span> {app.capacity}</div>}
                  {app.rejectionReason && (
                    <div className="col-span-full">
                      <span className="text-red-500">Rejected:</span> {app.rejectionReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selected && (
        <Modal app={selected} onClose={() => setSelected(null)} onDone={handleDone} />
      )}
    </div>
  );
}

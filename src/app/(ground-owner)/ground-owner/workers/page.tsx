"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Loader2, AlertTriangle, UserCheck, Copy, Check, Building2 } from "lucide-react";

interface Facility { id: string; name: string; city: string }
interface Worker   { id: string; userId: string; name: string; email: string; joinedAt: string }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
}

export default function WorkersPage() {
  const [facilities,  setFacilities]  = useState<Facility[]>([]);
  const [facilityId,  setFacilityId]  = useState("");
  const [workers,     setWorkers]     = useState<Worker[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [removing,    setRemoving]    = useState<string|null>(null);

  const [showInvite,  setShowInvite]  = useState(false);
  const [email,       setEmail]       = useState("");
  const [workerName,  setWorkerName]  = useState("");
  const [inviting,    setInviting]    = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [newPass,      setNewPass]      = useState<string|null>(null);
  const [promoted,     setPromoted]     = useState(false);
  const [copied,       setCopied]       = useState(false);

  // Load facilities
  useEffect(() => {
    fetch("/api/ground-owner/availability")
      .then((r) => r.json())
      .then((d) => {
        const list: Facility[] = d.facilities ?? [];
        setFacilities(list);
        if (list.length > 0) setFacilityId(list[0].id);
      });
  }, []);

  // Load workers when facility changes
  useEffect(() => {
    if (!facilityId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/ground-owner/workers?facilityId=${facilityId}`)
      .then(async (r) => {
        const text = await r.text();
        if (!text) return;
        const d = JSON.parse(text);
        if (r.ok) setWorkers(d.workers ?? []);
        else console.error("[workers]", d.error);
      })
      .finally(() => setLoading(false));
  }, [facilityId]);

  const invite = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setInviteError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setInviteError("Please enter a valid email address."); return; }
    if (workerName.trim() && workerName.trim().length < 2) { setInviteError("Worker name must be at least 2 characters."); return; }
    if (workerName.trim().length > 50) { setInviteError("Worker name must be under 50 characters."); return; }
    setInviteError(""); setInviting(true);
    try {
      const res  = await fetch("/api/ground-owner/workers",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ facilityId, email:email.trim(), name:workerName.trim()||undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setWorkers((prev) => [data.worker, ...prev]);
        setEmail(""); setWorkerName("");
        if (data.tempPassword) {
          setNewPass(data.tempPassword);
        } else if (!data.isNewAccount) {
          setPromoted(true);
        } else {
          setShowInvite(false);
        }
      } else {
        setInviteError(data.error ?? "Failed to add worker.");
      }
    } finally { setInviting(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} as a worker? They will lose access to the worker dashboard.`)) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/ground-owner/workers/${id}`,{method:"DELETE"});
      if (res.ok) setWorkers((prev) => prev.filter((w) => w.id!==id));
    } finally { setRemoving(null); }
  };

  const copyPass = () => {
    if (!newPass) return;
    navigator.clipboard.writeText(newPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedFacility = facilities.find((f) => f.id===facilityId);

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ground Workers</h1>
          <p className="text-slate-500 text-sm mt-0.5">Assign workers who can manage daily operations at your facility</p>
        </div>
        <button onClick={() => { setShowInvite(true); setNewPass(null); setPromoted(false); setInviteError(""); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" />Add Worker
        </button>
      </div>

      {/* Facility selector */}
      {facilities.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {facilities.map((f) => (
            <button key={f.id} onClick={() => setFacilityId(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                facilityId===f.id ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}>
              <Building2 className="w-3.5 h-3.5" />{f.name}
            </button>
          ))}
        </div>
      )}

      {/* What workers can/can't do */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">Worker Permissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
          <div>
            <p className="font-medium text-green-700 mb-1.5">Can do</p>
            {["View schedule & bookings","Add walk-in bookings","Block time slots / maintenance","View facility details"].map((s) => (
              <p key={s} className="text-slate-600 flex gap-1.5 items-start mb-1"><UserCheck className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />{s}</p>
            ))}
          </div>
          <div>
            <p className="font-medium text-red-600 mb-1.5">Cannot do</p>
            {["Edit facility profile or pricing","Manage availability schedule","View earnings or payouts","Add/remove other workers"].map((s) => (
              <p key={s} className="text-slate-600 flex gap-1.5 items-start mb-1"><AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />{s}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Workers list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Workers at {selectedFacility?.name ?? "—"}
            <span className="ml-2 text-slate-400 font-normal text-sm">({workers.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : workers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No workers assigned to this facility</p>
            <p className="text-xs text-slate-300 mt-1">Add a worker using the button above</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {workers.map((w) => (
              <div key={w.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-green-700">{w.name?.[0]?.toUpperCase() ?? "W"}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                    <p className="text-xs text-slate-400">{w.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 hidden sm:block">Added {timeAgo(w.joinedAt)}</span>
                  <button onClick={() => remove(w.id, w.name)} disabled={removing===w.id}
                    className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50" title="Remove worker">
                    {removing===w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite / New-pass modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {newPass ? (
              /* New account — show temp password */
              <div className="px-6 py-5 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Worker Added!</h3>
                <p className="text-sm text-slate-500 mb-4">
                  A new account was created. Share this temporary password — they'll be asked to change it on first login.
                </p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
                  <code className="flex-1 text-sm font-mono text-slate-800 text-left">{newPass}</code>
                  <button onClick={copyPass} className="text-slate-400 hover:text-slate-700 shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={() => { setShowInvite(false); setNewPass(null); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">
                  Done
                </button>
              </div>
            ) : promoted ? (
              /* Existing account promoted */
              <div className="px-6 py-5 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Worker Added!</h3>
                <p className="text-sm text-slate-500 mb-2">
                  This person already had a GoPlay account. Their role has been upgraded to Ground Worker.
                </p>
                <p className="text-xs text-slate-400 mb-5">
                  They need to log out and log back in to access the worker dashboard.
                </p>
                <button onClick={() => { setShowInvite(false); setPromoted(false); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
                  Done
                </button>
              </div>
            ) : (
              /* Invite form */
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base font-semibold text-slate-900">Add Worker</h3>
                  <button onClick={() => { setShowInvite(false); setInviteError(""); }}
                    className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                  <p className="text-xs text-slate-500">
                    If this email doesn't have an account, a new one will be created and a temporary password will be shown.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Email Address *</label>
                    <input type="email" placeholder="worker@email.com" value={email}
                      onChange={(e)=>setEmail(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Full Name (if new account)</label>
                    <input type="text" placeholder="e.g. Saman Perera" value={workerName}
                      onChange={(e)=>setWorkerName(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-300" />
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />{inviteError}
                    </p>
                  )}
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button onClick={() => { setShowInvite(false); setInviteError(""); }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button onClick={invite} disabled={inviting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl transition-colors">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Add Worker
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

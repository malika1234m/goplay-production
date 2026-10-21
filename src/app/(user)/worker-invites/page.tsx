"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, MailOpen, X } from "lucide-react";

interface Invite {
  id:        string;
  sentAt:    string;
  facility:  { id: string; name: string; city: string };
  ownerName: string;
}

// A ground owner can invite an existing player to be a worker; nothing changes until the player
// accepts here (or in the app). Accepting turns this account into a worker account for that ground.
export default function WorkerInvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState("");

  useEffect(() => {
    fetch("/api/worker-invites")
      .then((r) => r.json())
      .then((d) => setInvites(d.invites ?? []))
      .catch(() => setInvites([]));
  }, []);

  const answer = async (id: string, action: "accept" | "decline") => {
    setBusy(id); setError("");
    try {
      const res  = await fetch(`/api/worker-invites/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      if (action === "accept") {
        setDone(data.message);
        setInvites([]);
        setTimeout(() => router.push("/worker/dashboard"), 2500);
      } else {
        setInvites((prev) => (prev ?? []).filter((i) => i.id !== id));
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Worker invitations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ground owners can invite you to help run their ground. Nothing changes on your account unless you accept.
        </p>
      </div>

      {done && (
        <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">{done}</div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      )}

      {invites === null ? (
        <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
        </div>
      ) : invites.length === 0 && !done ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center">
          <MailOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">You have no invitations right now.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {invites.map((i) => (
            <li key={i.id} className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-green-700" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{i.facility.name}</p>
                  <p className="text-sm text-slate-500">{i.facility.city} · invited by {i.ownerName}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                If you accept, your account becomes a ground worker account for this ground: you&apos;ll manage its
                bookings from the worker dashboard here or in the GoPlay Owner app.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => answer(i.id, "accept")} disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                  {busy === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accept
                </button>
                <button onClick={() => answer(i.id, "decline")} disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                  <X className="w-4 h-4" /> Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

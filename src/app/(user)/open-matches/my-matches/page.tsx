"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Calendar, Clock, MapPin, Trophy, RotateCcw,
  Loader2, Zap, ChevronRight, Users, Plus,
} from "lucide-react";

interface SpotRecord {
  id: string;
  groupSize: number;
  status: string;
  paymentStatus: string;
  amountPaid: number;
  createdAt: string;
  match: {
    id: string;
    preferredDate: string;
    preferredStartTime: string;
    preferredEndTime: string;
    status: string;
    category: { name: string; icon: string };
    facility: { id: string; name: string; address: string; city: string };
    spots: { id: string; groupSize: number; user: { id: string; name: string; avatar: string | null } }[];
  };
}

const TABS = [
  { key: "all",     label: "All" },
  { key: "active",  label: "Active" },
  { key: "matched", label: "Matched" },
  { key: "past",    label: "Past" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const MATCH_BADGE: Record<string, string> = {
  COLLECTING: "bg-amber-100 text-amber-700",
  MATCHED:    "bg-green-100 text-green-700",
  EXPIRED:    "bg-slate-100 text-slate-500",
  CANCELLED:  "bg-red-100 text-red-600",
};
const MATCH_LABEL: Record<string, string> = {
  COLLECTING: "Filling…",
  MATCHED:    "Matched",
  EXPIRED:    "Expired",
  CANCELLED:  "Cancelled",
};

function filterSpots(spots: SpotRecord[], tab: TabKey) {
  if (tab === "active")  return spots.filter((s) => s.match.status === "COLLECTING");
  if (tab === "matched") return spots.filter((s) => s.match.status === "MATCHED");
  if (tab === "past")    return spots.filter((s) => ["EXPIRED", "CANCELLED"].includes(s.match.status));
  return spots;
}

export default function MyMatchesPage() {
  const { data: session } = useSession();
  const [spots,   setSpots]   = useState<SpotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<TabKey>("all");

  useEffect(() => {
    fetch("/api/user/open-matches")
      .then(async (r) => {
        if (!r.ok) { setError("Failed to load your matches. Please try again."); return; }
        const d = await r.json();
        setSpots(Array.isArray(d) ? d : []);
      })
      .catch(() => setError("Network error. Please check your connection."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterSpots(spots, tab);

  const counts: Record<TabKey, number> = {
    all:     spots.length,
    active:  spots.filter((s) => s.match.status === "COLLECTING").length,
    matched: spots.filter((s) => s.match.status === "MATCHED").length,
    past:    spots.filter((s) => ["EXPIRED", "CANCELLED"].includes(s.match.status)).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/open-matches" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Zap className="w-4 h-4 text-green-600" />
            <h1 className="font-bold text-slate-900">My Matches</h1>
          </div>
          {session?.user?.role === "USER" && (
            <Link href="/open-matches/create"
              className="flex items-center gap-1.5 text-xs text-green-700 font-medium hover:text-green-800 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New lobby
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Filter tabs with counts */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
              {counts[key] > 0 && (
                <span className={`text-[11px] px-1.5 rounded-full font-semibold ${
                  tab === key ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Zap className="w-6 h-6 text-slate-400" /></div>
            <p className="font-semibold text-slate-800 mb-1">
              {tab === "all" ? "No matches yet" : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} matches`}
            </p>
            <p className="text-sm text-slate-400 mb-5">
              {tab === "all" ? "Join an open lobby or start one to play with others." : "Try a different filter."}
            </p>
            {tab === "all" && (
              <Link href="/open-matches"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
                Browse open lobbies <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <Link key={s.id} href={`/open-matches/${s.match.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-green-300 hover:shadow-sm transition-all block group">

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center font-bold text-green-700 text-sm shrink-0">
                      {s.match.category.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{s.match.category.name}</span>
                        {s.match.status === "MATCHED" && <Trophy className="w-3.5 h-3.5 text-green-600" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{s.match.facility.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${MATCH_BADGE[s.match.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {s.match.status === "MATCHED" && <Trophy className="w-2.5 h-2.5 inline mr-0.5" />}
                      {MATCH_LABEL[s.match.status] ?? s.match.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-500 mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
                    <span className="truncate">{s.match.facility.address}, {s.match.facility.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-300" />
                    {new Date(s.match.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-300" />
                    {s.match.preferredStartTime} – {s.match.preferredEndTime}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-300" />
                    Your group: {s.groupSize} player{s.groupSize > 1 ? "s" : ""}
                  </div>
                </div>

                {s.status === "REFUNDED" && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-2">
                    <RotateCcw className="w-3 h-3" /> Refund processed
                  </div>
                )}

                {s.match.spots.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400">Players:</span>
                    <div className="flex items-center gap-0.5">
                      {s.match.spots.slice(0, 7).map((sp) => (
                        <div key={sp.id}
                          className="w-6 h-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-green-700"
                          title={sp.user.name}>
                          {sp.user.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {s.match.spots.length > 7 && (
                        <span className="text-[10px] text-slate-400 ml-0.5">+{s.match.spots.length - 7}</span>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-green-500 transition-colors ml-auto" />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

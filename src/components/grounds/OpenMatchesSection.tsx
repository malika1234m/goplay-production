"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Calendar, Clock, Users, ChevronRight, Loader2, Plus, ArrowRight, Building2 } from "lucide-react";

interface Lobby {
  id: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  totalSpotsNeeded: number;
  spotsReserved: number;
  status: string;
  serviceFeePct: number;
  expiresAt: string;
  category: { id: string; name: string; icon: string; minPlayers: number };
  spots: { id: string; user: { name: string } }[];
}

interface Props {
  facilityId: string;
  facilityName: string;
  hourlyRate: number;
}

export default function OpenMatchesSection({ facilityId, facilityName, hourlyRate }: Props) {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/grounds/${facilityId}/open-matches`)
      .then((r) => r.json())
      .then((d) => setLobbies(Array.isArray(d) ? d : []))
      .catch(() => setLobbies([]))
      .finally(() => setLoading(false));
  }, [facilityId]);

  const spotsLeft   = (l: Lobby) => l.totalSpotsNeeded - l.spotsReserved;
  const pctFilled   = (l: Lobby) => Math.round((l.spotsReserved / l.totalSpotsNeeded) * 100);
  const costPreview = (l: Lobby) => {
    const hrs   = (new Date(`1970-01-01T${l.preferredEndTime}`).getTime() -
                   new Date(`1970-01-01T${l.preferredStartTime}`).getTime()) / 3600000;
    const total = hourlyRate * hrs;
    return Math.round((total / l.totalSpotsNeeded) * (1 + l.serviceFeePct / 100 + 0.025));
  };

  return (
    <section id="open-matches" className="bg-white rounded-2xl border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-green-700" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">GoPlay Connect</h2>
            <p className="text-xs text-slate-400">Join an open match at {facilityName}</p>
          </div>
        </div>
        <Link href={`/open-matches?facilityId=${facilityId}`}
          className="text-xs text-green-700 font-medium hover:text-green-800 transition-colors flex items-center gap-1">
          See all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
        </div>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2"><Zap className="w-5 h-5 text-slate-400" /></div>
          <p className="text-sm font-medium text-slate-700 mb-1">No open lobbies yet</p>
          <p className="text-xs text-slate-400 mb-5">
            Start one and GoPlay will find players to fill the game with you.
          </p>
          <Link href={`/open-matches/create?facilityId=${facilityId}`}
            className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4" /> Start an Open Match
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {lobbies.map((l) => (
            <Link key={l.id} href={`/open-matches/${l.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-green-300 hover:bg-slate-50 transition-all group">

              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center font-bold text-green-700 text-sm shrink-0">
                {l.category.name.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">{l.category.name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    spotsLeft(l) === 1 ? "bg-red-50 text-red-600"     :
                    spotsLeft(l) <= 4  ? "bg-amber-50 text-amber-700" :
                                         "bg-green-50 text-green-700"
                  }`}>
                    {spotsLeft(l)} spot{spotsLeft(l) !== 1 ? "s" : ""} left
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(l.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {l.preferredStartTime} – {l.preferredEndTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {l.spotsReserved}/{l.totalSpotsNeeded}
                  </span>
                </div>

                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pctFilled(l)}%` }} />
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-green-700">~Rs. {costPreview(l).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">/person</p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors shrink-0" />
            </Link>
          ))}

          {/* CTA to start a new lobby */}
          <Link href={`/open-matches/create?facilityId=${facilityId}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors">
            <Plus className="w-4 h-4" /> Start a new open match here
          </Link>
        </div>
      )}
    </section>
  );
}

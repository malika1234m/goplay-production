"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Zap, MapPin, Clock, Users, ChevronRight, Loader2,
  Calendar, ArrowRight, Trophy, Plus, Building2, Search, X, ChevronLeft,
} from "lucide-react";

const SPORT_EMOJI: Record<string, string> = {
  "Badminton":        "🏸",
  "Basketball":       "🏀",
  "Billiards & Pool": "🎱",
  "Cricket":          "🏏",
  "Football":         "⚽",
  "Futsal":           "⚽",
  "Netball":          "🏐",
  "Pickleball":       "🏓",
  "Rugby":            "🏉",
  "Swimming":         "🏊",
  "Table Tennis":     "🏓",
  "Tennis":           "🎾",
  "Volleyball":       "🏐",
};

const GROUPS_PER_PAGE = 5;

interface Category { id: string; name: string; icon: string; minPlayers: number; }
interface Spot { id: string; groupSize: number; user: { id: string; name: string; avatar: string | null }; }
interface OpenMatch {
  id: string; lobbyCode: string | null;
  preferredDate: string; preferredStartTime: string; preferredEndTime: string;
  totalSpotsNeeded: number; spotsReserved: number; status: string; expiresAt: string;
  serviceFeePct: number;
  facility: { id: string; name: string; address: string; city: string; hourlyRate: number; images: string[] };
  category: Category;
  spots: Spot[];
}

export default function OpenMatchesPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [categories,  setCategories]  = useState<Category[]>([]);
  const [matches,     setMatches]     = useState<OpenMatch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeSport, setActiveSport] = useState<string>("");
  const [search,      setSearch]      = useState("");
  const [activeCity,  setActiveCity]  = useState("");
  const [page,        setPage]        = useState(1);

  const fetchMatches = useCallback(async (categoryId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.set("categoryId", categoryId);
      const res = await fetch(`/api/open-matches?${params}`);
      if (res.ok) setMatches((await res.json()) ?? []);
    } catch { /* keep current list */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
    fetchMatches();
  }, [fetchMatches]);

  const handleSportFilter = (id: string) => {
    const next = activeSport === id ? "" : id;
    setActiveSport(next);
    setSearch("");
    setActiveCity("");
    setPage(1);
    fetchMatches(next || undefined);
  };

  const cities = useMemo(
    () => [...new Set(matches.map((m) => m.facility.city).filter(Boolean))].sort(),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return matches.filter((m) => {
      if (activeCity && m.facility.city.toLowerCase() !== activeCity.toLowerCase()) return false;
      if (q &&
        !m.facility.name.toLowerCase().includes(q) &&
        !m.facility.city.toLowerCase().includes(q) &&
        !m.category.name.toLowerCase().includes(q) &&
        !(m.lobbyCode?.toLowerCase() === q)) return false;
      return true;
    });
  }, [matches, search, activeCity]);

  // Group by facility
  const allGroups = useMemo(
    () => Object.values(
      filteredMatches.reduce<Record<string, { facility: OpenMatch["facility"]; matches: OpenMatch[] }>>((acc, m) => {
        if (!acc[m.facility.id]) acc[m.facility.id] = { facility: m.facility, matches: [] };
        acc[m.facility.id].matches.push(m);
        return acc;
      }, {})
    ),
    [filteredMatches],
  );

  const totalPages   = Math.max(1, Math.ceil(allGroups.length / GROUPS_PER_PAGE));
  const safePage     = Math.min(page, totalPages);
  const pagedGroups  = allGroups.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE);

  // Reset to page 1 when filters change
  const handleCityFilter = (city: string) => { setActiveCity(activeCity === city ? "" : city); setPage(1); };
  const handleSearch     = (v: string) => { setSearch(v); setPage(1); };
  const clearFilters     = () => { setSearch(""); setActiveCity(""); setPage(1); };

  const spotsToTrigger = (m: OpenMatch) => Math.max(0, m.category.minPlayers - m.spotsReserved);
  const pctFilled      = (m: OpenMatch) => Math.min(100, Math.round((m.spotsReserved / m.category.minPlayers) * 100));
  const isFillingFast  = (m: OpenMatch) => pctFilled(m) >= 60 && m.spotsReserved < m.category.minPlayers;

  const costPreview = (m: OpenMatch) => {
    const hours = (new Date(`1970-01-01T${m.preferredEndTime}`).getTime() -
                   new Date(`1970-01-01T${m.preferredStartTime}`).getTime()) / 3600000;
    return Math.round((m.facility.hourlyRate * hours / m.category.minPlayers) * (1 + m.serviceFeePct / 100 + 0.025));
  };

  const hasFilters = !!(search.trim() || activeCity);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 to-green-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-green-300" />
            <span className="text-green-300 text-xs font-semibold uppercase tracking-widest">GoPlay Connect</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 leading-tight">
            Find Players.<br />Share Courts. Play Together.
          </h1>
          <p className="text-green-100 text-sm sm:text-base max-w-lg mb-4">
            Join open match lobbies at real grounds. GoPlay auto-books the facility once
            the minimum players join — you only pay your share.
          </p>

          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by ground, city, sport or lobby code…"
              className="w-full pl-10 pr-10 py-3 bg-white text-slate-800 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300 shadow-sm"
            />
            {search && (
              <button onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link href="/open-matches/my-matches"
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Trophy className="w-4 h-4" /> My Matches
            </Link>
            {session?.user?.role === "USER" && (
              <Link href="/open-matches/create"
                className="flex items-center justify-center gap-2 bg-white text-green-800 hover:bg-green-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> Start an Open Match
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: <MapPin className="w-4 h-4 text-green-600" />, title: "Pick a Ground",   desc: "Find a facility and open a match for any available time slot" },
              { icon: <Users  className="w-4 h-4 text-green-600" />, title: "Fill the Lobby",  desc: "Groups join until the sport minimum players threshold is met"  },
              { icon: <Zap    className="w-4 h-4 text-green-600" />, title: "GoPlay Books It", desc: "We auto-confirm the booking and share everyone's contacts"      },
            ].map((s) => (
              <div key={s.title} className="py-1.5">
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-1">{s.icon}</div>
                <p className="font-semibold text-slate-800 text-xs sm:text-sm">{s.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">

        {/* Filter card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Sport</p>
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <button
              onClick={() => handleSportFilter("")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeSport === ""
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-green-300"
              }`}>
              All Sports
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => handleSportFilter(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                  activeSport === c.id
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-green-300"
                }`}>
                {c.name}
                <span className={`${activeSport === c.id ? "text-green-100" : "text-slate-400"}`}>{c.minPlayers}p</span>
              </button>
            ))}
          </div>

          {cities.length > 1 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">City</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <button
                  onClick={() => handleCityFilter("")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeCity === ""
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}>
                  All Cities
                </button>
                {cities.map((city) => (
                  <button key={city} onClick={() => handleCityFilter(city)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                      activeCity === city
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}>
                    <MapPin className="w-2.5 h-2.5" /> {city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results header */}
        {!loading && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{filteredMatches.length}</span>{" "}
              open {filteredMatches.length === 1 ? "lobby" : "lobbies"}
              {activeCity && <> in <span className="font-semibold text-slate-700">{activeCity}</span></>}
              {allGroups.length > 0 && (
                <span className="text-slate-400 ml-2">
                  · Page {safePage} of {totalPages}
                </span>
              )}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : allGroups.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-800 text-lg mb-2">
              {hasFilters ? "No lobbies match your search" : "No open lobbies yet"}
            </h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              {hasFilters
                ? "Try adjusting your search term, sport, or city filter."
                : "Be the first! Browse a ground, pick a time slot, and start a lobby for others to join."}
            </p>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-colors text-sm">
                <X className="w-4 h-4" /> Clear filters
              </button>
            ) : session?.user?.role === "USER" ? (
              <Link href="/open-matches/create"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors text-sm">
                Start the first lobby <ArrowRight className="w-4 h-4" />
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {pagedGroups.map(({ facility, matches: fMatches }) => (
                <div key={facility.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  {/* Facility header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      {facility.images[0] ? (
                        <img src={facility.images[0]} alt={facility.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-green-700 font-bold shrink-0">
                          {facility.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{facility.name}</p>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3" /> {facility.address}, {facility.city}
                        </div>
                      </div>
                    </div>
                    <Link href={`/grounds/${facility.id}`}
                      className="shrink-0 text-xs text-green-700 font-medium hover:text-green-800 flex items-center gap-1 transition-colors">
                      View Ground <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Lobby rows */}
                  <div className="divide-y divide-slate-50">
                    {fMatches.map((m) => {
                      const toTrigger = spotsToTrigger(m);
                      const pct       = pctFilled(m);
                      const filling   = isFillingFast(m);
                      const urgent    = toTrigger > 0 && toTrigger <= 2;
                      const emoji     = SPORT_EMOJI[m.category.name] ?? m.category.name.charAt(0);
                      const dateStr   = new Date(m.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" });

                      return (
                        <Link key={m.id} href={`/open-matches/${m.id}`}
                          className="block sm:flex sm:items-center sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 transition-colors group hover:bg-slate-50/70">

                          <div className="flex items-start gap-3 sm:flex-1 sm:min-w-0">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-100 shadow-sm rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5 sm:mt-0">
                              {typeof emoji === "string" && emoji.length > 1 ? emoji : (
                                <span className="font-bold text-green-700 text-sm">{emoji}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                                  <span className="font-semibold text-slate-900 text-sm">{m.category.name}</span>
                                  {m.lobbyCode && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tracking-wider">
                                      #{m.lobbyCode}
                                    </span>
                                  )}
                                  {filling && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-orange-100 text-orange-700 flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5" /> Filling fast
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                                    toTrigger === 0 ? "bg-green-100 text-green-700"   :
                                    urgent          ? "bg-red-100 text-red-700"       :
                                    toTrigger <= 5  ? "bg-amber-100 text-amber-700"   :
                                                     "bg-slate-100 text-slate-500"
                                  }`}>
                                    {toTrigger === 0 ? "Ready to book!" : `${toTrigger} more to start`}
                                  </span>
                                </div>
                                <div className="sm:hidden text-right shrink-0">
                                  <p className="text-sm font-bold text-green-700">~Rs. {costPreview(m).toLocaleString()}</p>
                                  <p className="text-[10px] text-slate-400">/person at min</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Calendar className="w-3 h-3 text-slate-400" />{dateStr}
                                </span>
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3 text-slate-400" />{m.preferredStartTime} – {m.preferredEndTime}
                                </span>
                                <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                                  toTrigger === 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                                }`}>
                                  <Users className="w-3 h-3" />{m.spotsReserved}/{m.category.minPlayers} joined
                                </span>
                                <span className="sm:hidden text-[11px] text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />{dateStr} · {m.preferredStartTime}–{m.preferredEndTime}
                                </span>
                                <span className={`sm:hidden text-[11px] flex items-center gap-1 font-medium ${
                                  toTrigger === 0 ? "text-green-600" : "text-slate-500"
                                }`}>
                                  <Users className="w-3 h-3" />{m.spotsReserved}/{m.category.minPlayers} joined
                                </span>
                              </div>

                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    toTrigger === 0 ? "bg-green-500" :
                                    urgent          ? "bg-red-400"   :
                                    filling         ? "bg-orange-400" :
                                                      "bg-green-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1.5 sm:shrink-0">
                            <div className="flex items-center gap-0.5">
                              {m.spots.slice(0, 4).map((s) => (
                                <div key={s.id}
                                  className="w-6 h-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-green-700"
                                  title={s.user.name}>
                                  {s.user.name.charAt(0)}
                                </div>
                              ))}
                              {m.spots.length > 4 && (
                                <span className="text-[10px] text-slate-400 ml-0.5">+{m.spots.length - 4}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-700">~Rs. {costPreview(m).toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">/person at min</p>
                            </div>
                          </div>
                          <ChevronRight className="hidden sm:block w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors shrink-0" />
                        </Link>
                      );
                    })}
                  </div>

                  {session?.user?.role === "USER" && (
                    <button
                      onClick={() => router.push(`/open-matches/create?facilityId=${facility.id}`)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 transition-colors py-3 border-t border-slate-50">
                      <Plus className="w-3.5 h-3.5" /> Start a new lobby at this ground
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={safePage === 1}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-green-300 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`w-9 h-9 rounded-xl text-sm font-semibold transition-colors ${
                        p === safePage
                          ? "bg-green-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-700"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={safePage === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-green-300 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Page summary */}
            {totalPages > 1 && (
              <p className="text-center text-xs text-slate-400 mt-3">
                Showing {(safePage - 1) * GROUPS_PER_PAGE + 1}–{Math.min(safePage * GROUPS_PER_PAGE, allGroups.length)} of {allGroups.length} venues
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

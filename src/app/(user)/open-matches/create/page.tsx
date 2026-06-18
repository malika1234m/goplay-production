"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, ChevronRight, ChevronLeft, Loader2, MapPin,
  Calendar, Clock, Users, Zap, CheckCircle2, AlertCircle, Search, X, Building2,
  CreditCard, ShieldCheck,
} from "lucide-react";

interface Category { id: string; name: string; icon: string; minPlayers: number; maxPlayers: number | null; allowOpenMatch: boolean; }
interface GroundResult {
  id: string; name: string; address: string; city: string;
  hourlyRate: number; images: string[];
  categories: Category[];
}
interface Facility extends GroundResult {
  capacity: number | null;
  availability: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
}

function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function addMins(t: string, mins: number) {
  const total = toMins(t) + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const DURATIONS = [1, 1.5, 2, 2.5, 3, 4];
const PAYHERE_FEE_PCT = 2.5;

function CreatePageInner() {
  const router        = useRouter();
  const params        = useSearchParams();
  const { data: ses } = useSession();

  const preselectedId = params.get("facilityId") ?? "";

  const [step,          setStep]          = useState(1);
  const [facility,      setFacility]      = useState<Facility | null>(null);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");

  const [groundQuery,   setGroundQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<GroundResult[]>([]);
  const [searching,     setSearching]     = useState(false);

  const [facilityId,       setFacilityId]       = useState(preselectedId);
  const [categoryId,       setCategoryId]       = useState("");
  const [totalSpotsNeeded, setTotalSpotsNeeded] = useState(2);
  const [date,             setDate]             = useState("");
  const [startTime,        setStartTime]        = useState("");
  const [duration,         setDuration]         = useState(1);
  const [groupSize,        setGroupSize]        = useState(1);

  // Availability slots fetched for the selected date — used to show booked/lobby slots
  const [availSlots, setAvailSlots] = useState<{ start: string; end: string; available: boolean; openMatch?: { id: string; categoryName: string } }[]>([]);

  useEffect(() => {
    if (ses && ses.user?.role !== "USER") router.replace("/");
  }, [ses, router]);

  useEffect(() => {
    if (!groundQuery.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/grounds?q=${encodeURIComponent(groundQuery.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.grounds ?? []);
        }
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [groundQuery]);

  const loadFacility = useCallback(async (id: string) => {
    if (!id) { setFacility(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/grounds/${id}`);
      const d   = await res.json();
      const g   = d.ground ?? d;
      setFacility(g);
      setCategories(g.categories ?? []);
    } catch { setFacility(null); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadFacility(facilityId); }, [facilityId, loadFacility]);

  // Fetch booked/lobby slots for the selected date
  useEffect(() => {
    if (!facilityId || !date) { setAvailSlots([]); return; }
    fetch(`/api/grounds/${facilityId}/availability?date=${date}`)
      .then((r) => r.json())
      .then((d) => setAvailSlots(d.slots ?? []))
      .catch(() => setAvailSlots([]));
  }, [facilityId, date]);

  function selectGround(g: GroundResult) {
    setFacilityId(g.id);
    setGroundQuery("");
    setSearchResults([]);
    setCategoryId("");
    setDate("");
    setStartTime("");
    setDuration(1);
  }

  function clearGround() {
    setFacilityId("");
    setFacility(null);
    setCategories([]);
    setCategoryId("");
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const effectiveMax = selectedCategory
    ? (facility?.capacity && facility.capacity > selectedCategory.minPlayers
        ? facility.capacity
        : selectedCategory.minPlayers)
    : 2;
  const dayOfWeek        = date ? new Date(date + "T00:00:00").getDay() : -1;
  const todayAvail       = facility?.availability?.find((a) => a.dayOfWeek === dayOfWeek && a.isOpen);
  const endTime          = startTime ? addMins(startTime, duration * 60) : "";
  const totalCost        = facility ? facility.hourlyRate * duration : 0;
  const perPersonBase    = totalSpotsNeeded > 0 ? totalCost / totalSpotsNeeded : 0;
  const perPerson        = selectedCategory && startTime
    ? Math.round(perPersonBase * (1 + 0.18 + PAYHERE_FEE_PCT / 100))
    : 0;
  const myGroupCost = perPerson * groupSize;

  // Build blocked ranges from the availability API response
  const blockedRanges = useMemo(() => {
    return availSlots
      .filter((s) => !s.available)
      .map((s) => ({
        start: toMins(s.start),
        end: toMins(s.end),
        openMatch: s.openMatch,
      }));
  }, [availSlots]);

  type SlotStatus = "available" | "unavailable" | "lobby";
  const timeSlots = useMemo(() => {
    if (!todayAvail) return [];
    const result: { time: string; status: SlotStatus; lobbyId?: string; categoryName?: string }[] = [];
    const close = toMins(todayAvail.closeTime);
    let cur = toMins(todayAvail.openTime);
    while (cur < close) {
      const t = `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
      const end = cur + duration * 60;
      if (end > close) {
        result.push({ time: t, status: "unavailable" });
        cur += 30;
        continue;
      }
      let status: SlotStatus = "available";
      let lobbyId: string | undefined;
      let categoryName: string | undefined;
      for (const range of blockedRanges) {
        if (range.start < end && range.end > cur) {
          if (range.openMatch) {
            status = "lobby";
            lobbyId = range.openMatch.id;
            categoryName = range.openMatch.categoryName;
          } else {
            status = "unavailable";
          }
          break;
        }
      }
      result.push({ time: t, status, lobbyId, categoryName });
      cur += 30;
    }
    return result;
  }, [todayAvail, duration, blockedRanges]);

  const minDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();
  const maxDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 60);
    return d.toISOString().split("T")[0];
  })();

  async function handleSubmit() {
    if (!facilityId || !categoryId || !date || !startTime) {
      setError("Please fill in all fields."); return;
    }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/open-matches", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ facilityId, categoryId, preferredDate: date, preferredStartTime: startTime, preferredEndTime: endTime, groupSize, totalSpotsNeeded }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.lobbyId) {
          router.push(`/open-matches/${data.lobbyId}`);
        } else {
          setError(data.error ?? "Failed to create lobby.");
        }
        setSubmitting(false);
        return;
      }

      // Submit hidden form to PayHere — page navigates away, spinner stays
      const p = data.payHereParams;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = p.checkout_url;

      const fields = [
        "merchant_id", "return_url", "cancel_url", "notify_url",
        "order_id", "items", "currency", "amount",
        "first_name", "last_name", "email", "phone",
        "address", "city", "country", "hash",
      ] as const;

      for (const key of fields) {
        const input = document.createElement("input");
        input.type  = "hidden";
        input.name  = key;
        input.value = String(p[key] ?? "");
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const stepLabels = ["Pick Ground", "Sport & Time", "Review & Start"];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/open-matches" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Zap className="w-4 h-4 text-green-600" />
            <span className="font-bold text-slate-900">Start an Open Match</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-0">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const done   = step > n;
              const active = step === n;
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      done || active ? "bg-green-600 text-white" : "bg-slate-200 text-slate-400"
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`text-xs font-medium hidden sm:inline ${active ? "text-green-700" : done ? "text-slate-500" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${done ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* ── STEP 1: Pick ground ─────────────────────────────────── */}
        {step === 1 && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">

            {/* LEFT: search */}
            <div className="lg:col-span-3 space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-xl mb-1">Where do you want to play?</h2>
              <p className="text-sm text-slate-400">Search for a ground by name or city.</p>
            </div>

            {facility && !loading ? (
              <div className="bg-white rounded-2xl border-2 border-green-400 ring-2 ring-green-100 overflow-hidden">
                {facility.images?.[0] && (
                  <img src={facility.images[0]} alt={facility.name} className="w-full h-44 object-cover" />
                )}
                <div className="p-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">{facility.name}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3" /> {facility.address}, {facility.city}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Rs. {facility.hourlyRate?.toLocaleString() ?? "—"}/hr</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(facility.categories ?? []).map((c) => (
                          <span key={c.id} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={clearGround}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors mt-0.5">
                    <X className="w-3.5 h-3.5" /> Change
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={groundQuery}
                    onChange={(e) => setGroundQuery(e.target.value)}
                    placeholder="Search ground name or city…"
                    autoFocus
                    className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {groundQuery && (
                    <button onClick={() => { setGroundQuery(""); setSearchResults([]); }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {searching && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((g) => (
                      <button key={g.id} onClick={() => selectGround(g)}
                        className="w-full bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-green-300 hover:shadow-sm transition-all group flex items-center gap-3">
                        {g.images[0] ? (
                          <img src={g.images[0]} alt={g.name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl shrink-0">
                            {g.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{g.name}</p>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{g.address}, {g.city}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Rs. {g.hourlyRate.toLocaleString()}/hr</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {!searching && groundQuery.trim() && searchResults.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">No grounds found</p>
                    <p className="text-xs text-slate-400 mb-4">Try a different name or city.</p>
                    <Link href="/grounds"
                      className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium hover:underline">
                      Browse all grounds <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                {!groundQuery.trim() && !loading && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 mb-1">Type a name or city above to search</p>
                    <Link href="/grounds"
                      className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium hover:underline mt-1">
                      Browse all grounds <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setStep(2); setError(""); }}
                disabled={!facility}
                className="flex items-center gap-2 bg-green-600 text-white font-semibold px-7 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            </div>{/* end left col */}

            {/* RIGHT: how it works panel */}
            <div className="hidden lg:block lg:col-span-2">
              <div className="lg:sticky lg:top-24 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="font-semibold text-slate-800">How Open Matches Work</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { step: "1", icon: MapPin,      title: "Pick a ground",    desc: "Choose any active facility that supports the sport you want to play." },
                      { step: "2", icon: Clock,       title: "Set sport & time", desc: "Select your sport, a date, and the time slot that works for you." },
                      { step: "3", icon: Users,       title: "Set your group",   desc: "Tell us how many players you're bringing. Others fill the rest." },
                      { step: "4", icon: CheckCircle2,title: "GoPlay books it",  desc: "Once full, we auto-confirm the court and share everyone's contacts." },
                    ].map(({ step: s, icon: Icon, title, desc }) => (
                      <div key={s} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {s}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Icon className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <p className="text-sm font-semibold text-slate-800">{title}</p>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-green-800 mb-2">Zero risk</p>
                  <p className="text-xs text-green-700 leading-relaxed">
                    You&apos;re only charged if the lobby fills completely. If it expires without enough players, you get a full refund — no questions asked.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── STEP 2: Sport + date/time ─── two-column layout ────── */}
        {step === 2 && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">

            {/* LEFT: form fields */}
            <div className="lg:col-span-3 space-y-5">
              <div>
                <h2 className="font-bold text-slate-900 text-xl mb-1">What are you playing?</h2>
                <p className="text-sm text-slate-400">Choose a sport and pick your preferred time slot.</p>
              </div>

              {/* Sport */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Sport</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((c) => {
                    const disabled = !c.allowOpenMatch;
                    return (
                      <button key={c.id}
                        onClick={() => {
                          if (disabled) return;
                          setCategoryId(c.id);
                          setTotalSpotsNeeded(c.minPlayers);
                          setGroupSize(1);
                        }}
                        disabled={disabled}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all text-left ${
                          disabled
                            ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                            : categoryId === c.id
                            ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                            : "border-slate-200 hover:border-green-300"
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${disabled ? "bg-slate-100 text-slate-400" : "bg-green-100 text-green-700"}`}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {disabled ? "Individual only" : c.maxPlayers && c.maxPlayers !== c.minPlayers ? `${c.minPlayers} or ${c.maxPlayers} players` : `${c.minPlayers} players`}
                          </p>
                        </div>
                        {categoryId === c.id && <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Lobby size stepper — range is minPlayers → facility capacity */}
                {selectedCategory && effectiveMax > selectedCategory.minPlayers && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Total players in lobby</p>
                    <div className="flex items-center justify-center gap-5 mb-2">
                      <button
                        onClick={() => { setTotalSpotsNeeded(Math.max(selectedCategory.minPlayers, totalSpotsNeeded - 1)); setGroupSize(1); }}
                        disabled={totalSpotsNeeded <= selectedCategory.minPlayers}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 text-lg transition-colors">−</button>
                      <span className="w-10 text-center font-bold text-2xl text-slate-900">{totalSpotsNeeded}</span>
                      <button
                        onClick={() => { setTotalSpotsNeeded(Math.min(effectiveMax, totalSpotsNeeded + 1)); setGroupSize(1); }}
                        disabled={totalSpotsNeeded >= effectiveMax}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 text-lg transition-colors">+</button>
                    </div>
                    <p className="text-xs text-center text-slate-400">Min {selectedCategory.minPlayers} · Max {effectiveMax} (facility capacity)</p>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <label className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" /> Date
                </label>
                <input type="date" min={minDate} max={maxDate} value={date}
                  onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {date && !todayAvail && facility && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
                    {facility.name} is closed on this day. Please pick another date.
                  </p>
                )}
              </div>

              {/* Duration */}
              {date && todayAvail && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" /> Duration
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button key={d} onClick={() => { setDuration(d); setStartTime(""); }}
                        className={`px-5 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                          duration === d
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-green-400"
                        }`}>
                        {d % 1 === 0 ? `${d}h` : `${d}h`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time slots */}
              {date && todayAvail && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" /> Start Time
                    </p>
                    <span className="text-xs text-slate-400">
                      Open {todayAvail.openTime}–{todayAvail.closeTime}
                    </span>
                  </div>

                  {startTime && (
                    <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-sm font-semibold text-green-800">{startTime}</span>
                      <span className="text-slate-400 text-sm">→</span>
                      <span className="text-sm font-semibold text-green-800">{endTime}</span>
                      <span className="text-xs text-green-700 ml-1">({duration}h session)</span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {timeSlots.map((slot) => {
                      if (slot.status === "lobby") {
                        return (
                          <a
                            key={slot.time}
                            href={`/open-matches/${slot.lobbyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 rounded-xl text-center border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-all"
                            title={`${slot.categoryName} open match lobby — tap to join`}
                          >
                            <p className="text-xs font-semibold text-amber-700 leading-tight">{slot.time}</p>
                            <p className="text-[9px] text-amber-600 leading-tight">⚡ Join lobby</p>
                          </a>
                        );
                      }
                      if (slot.status === "unavailable") {
                        return (
                          <div
                            key={slot.time}
                            className="py-2 rounded-xl text-center border border-slate-100 bg-slate-50 cursor-not-allowed"
                            title="Already booked"
                          >
                            <p className="text-xs font-medium text-slate-300 leading-tight">{slot.time}</p>
                            <p className="text-[9px] text-slate-300 leading-tight">Booked</p>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={slot.time}
                          onClick={() => setStartTime(slot.time)}
                          className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                            startTime === slot.time
                              ? "bg-green-600 text-white border-green-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:bg-green-50"
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>

                  {timeSlots.every((s) => s.status === "unavailable") && (
                    <p className="text-xs text-slate-400 mt-3 text-center">
                      No {duration}h slots available on this day. Try a shorter duration.
                    </p>
                  )}

                  {/* Slot legend */}
                  {timeSlots.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" /> Available
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="w-3 h-3 rounded bg-slate-50 border border-slate-100 inline-block" /> Booked
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" /> Open match lobby
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!date && (
                <p className="text-sm text-slate-400 text-center py-2">Pick a date above to see available slots.</p>
              )}

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-slate-600 font-medium px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors text-sm">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => {
                    if (!categoryId) { setError("Please select a sport."); return; }
                    if (!date)       { setError("Please pick a date."); return; }
                    if (!startTime)  { setError("Please select a start time."); return; }
                    setError(""); setStep(3);
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white font-semibold px-7 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* RIGHT: sticky ground summary + cost preview */}
            <div className="hidden lg:block lg:col-span-2 mt-0">
              <div className="lg:sticky lg:top-24 space-y-4">
                {facility && (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    {facility.images[0] && (
                      <img src={facility.images[0]} alt={facility.name} className="w-full h-36 object-cover" />
                    )}
                    <div className="p-4">
                      <p className="font-bold text-slate-900">{facility.name}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3 h-3" /> {facility.address}, {facility.city}
                      </div>
                      <p className="text-xs font-medium text-green-700 mt-2">Rs. {facility.hourlyRate.toLocaleString()}/hr</p>
                    </div>
                  </div>
                )}

                {selectedCategory && startTime && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-3">Cost Preview</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Court × {duration}h</span>
                        <span>Rs. {totalCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Split by {totalSpotsNeeded}</span>
                        <span>Rs. {Math.round(perPersonBase).toLocaleString()}/person</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>Tax & service</span>
                        <span>+ Rs. {Math.round(perPersonBase * 0.18).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-green-800 pt-2 border-t border-green-200 text-base">
                        <span>~Per person</span>
                        <span>Rs. {perPerson.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-green-700 mt-3">Paid upfront · refunded if lobby expires</p>
                  </div>
                )}

                {!(selectedCategory && startTime) && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cost Preview</p>
                    <p className="text-sm text-slate-400">Select a sport and time to see the cost estimate.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & group size ─── two-column layout ───── */}
        {step === 3 && facility && selectedCategory && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">

            {/* LEFT: summary */}
            <div className="lg:col-span-3 space-y-5">
              <div>
                <h2 className="font-bold text-slate-900 text-xl mb-1">Review your lobby</h2>
                <p className="text-sm text-slate-400">Confirm the details before going live.</p>
              </div>

              {/* Summary card */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {facility.images?.[0] && (
                  <img src={facility.images[0]} alt={facility.name} className="w-full h-44 object-cover" />
                )}
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0">
                      {selectedCategory.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base">{selectedCategory.name} at {facility.name}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3" /> {facility.address}, {facility.city}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{startTime} – {endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                      <Users className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{totalSpotsNeeded} players total</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 leading-relaxed">
                <strong className="block mb-1">How it works</strong>
                Pay now to launch the lobby — your spot is secured immediately. Others join and pay their own
                spots. Once all {totalSpotsNeeded} spots are filled, GoPlay auto-books the court.
                <span className="block mt-1 font-medium">Full refund if the lobby expires without enough players.</span>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-2 text-slate-600 font-medium px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors text-sm">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                {/* Submit button duplicated here for mobile */}
                <button onClick={handleSubmit} disabled={submitting}
                  className="lg:hidden flex items-center gap-2 bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                    : <><CreditCard className="w-4 h-4" /> Pay &amp; Start</>}
                </button>
              </div>
            </div>

            {/* RIGHT: sticky group size + cost + submit */}
            <div className="lg:col-span-2 mt-5 lg:mt-0">
              <div className="lg:sticky lg:top-24 space-y-4">

                {/* Group size */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <p className="text-sm font-semibold text-slate-700 mb-1">How many are you bringing?</p>
                  <p className="text-xs text-slate-400 mb-5">Including yourself. Others will join to fill the remaining spots.</p>
                  <div className="flex items-center justify-center gap-5 mb-2">
                    <button onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                      className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xl transition-colors">−</button>
                    <span className="w-12 text-center font-bold text-3xl text-slate-900">{groupSize}</span>
                    <button onClick={() => setGroupSize(Math.min(totalSpotsNeeded - 1, groupSize + 1))}
                      className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xl transition-colors">+</button>
                  </div>
                  <p className="text-xs text-slate-400 text-center">max {totalSpotsNeeded - 1} spots</p>
                </div>

                {/* Cost breakdown */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Court (Rs. {facility.hourlyRate.toLocaleString()} × {duration}h)</span>
                      <span>Rs. {totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Split by {totalSpotsNeeded} players</span>
                      <span>Rs. {Math.round(perPersonBase).toLocaleString()}/person</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Tax & service charge</span>
                      <span>+ Rs. {Math.round(perPersonBase * 0.18).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Payment processing fee</span>
                      <span>+ Rs. {Math.round(perPersonBase * PAYHERE_FEE_PCT / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100">
                      <span>Your group ({groupSize})</span>
                      <span className="text-green-700">Rs. {myGroupCost.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    Payment collected upfront to secure your spot. Full refund if the lobby expires.
                  </p>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Secure payment
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Refund guaranteed
                  </div>
                </div>

                {/* Start Lobby CTA */}
                <button onClick={handleSubmit} disabled={submitting}
                  className="hidden lg:flex w-full items-center justify-center gap-2 bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 disabled:opacity-50 transition-colors text-base">
                  {submitting
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment…</>
                    : <><CreditCard className="w-5 h-5" /> Pay Rs. {myGroupCost.toLocaleString()} &amp; Start Lobby</>}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateLobbyPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>}>
      <CreatePageInner />
    </Suspense>
  );
}

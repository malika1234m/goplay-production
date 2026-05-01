"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, XCircle, Loader2, Save } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DaySchedule {
  dayOfWeek: number;
  isOpen:    boolean;
  openTime:  string;
  closeTime: string;
}

interface Facility {
  id:     string;
  name:   string;
  city:   string;
  status: string;
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  isOpen:    i >= 1 && i <= 5, // Mon–Fri open by default
  openTime:  "08:00",
  closeTime: "22:00",
}));

export default function AvailabilityPage() {
  const [facilities,   setFacilities]   = useState<Facility[]>([]);
  const [facilityId,   setFacilityId]   = useState("");
  const [schedule,     setSchedule]     = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [loadingPage,  setLoadingPage]  = useState(true);
  const [loadingSched, setLoadingSched] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  // Load facilities list
  useEffect(() => {
    fetch("/api/ground-owner/availability")
      .then((r) => r.json())
      .then((data) => {
        const list: Facility[] = data.facilities ?? [];
        setFacilities(list);
        if (list.length > 0) setFacilityId(list[0].id);
      })
      .finally(() => setLoadingPage(false));
  }, []);

  // Load schedule when facility changes
  useEffect(() => {
    if (!facilityId) return;
    setLoadingSched(true);
    fetch(`/api/ground-owner/availability?facilityId=${facilityId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.schedule && data.schedule.length > 0) {
          // Merge returned schedule with defaults (fill missing days)
          const merged = DEFAULT_SCHEDULE.map((def) => {
            const found = data.schedule.find((s: DaySchedule) => s.dayOfWeek === def.dayOfWeek);
            return found ? { ...def, ...found } : def;
          });
          setSchedule(merged);
        } else {
          setSchedule(DEFAULT_SCHEDULE.map((d) => ({ ...d })));
        }
      })
      .finally(() => setLoadingSched(false));
  }, [facilityId]);

  const toggle = (day: number) =>
    setSchedule((prev) =>
      prev.map((d) => d.dayOfWeek === day ? { ...d, isOpen: !d.isOpen } : d)
    );

  const setTime = (day: number, field: "openTime" | "closeTime", val: string) =>
    setSchedule((prev) =>
      prev.map((d) => d.dayOfWeek === day ? { ...d, [field]: val } : d)
    );

  const saveSchedule = async () => {
    if (!facilityId) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/ground-owner/availability", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ facilityId, schedule }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const openDays   = schedule.filter((d) => d.isOpen).length;
  const closedDays = 7 - openDays;

  if (loadingPage) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
          <p className="text-slate-500 text-sm mt-0.5">Set your weekly opening hours per ground</p>
        </div>
        <button
          onClick={saveSchedule}
          disabled={saving || !facilityId}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Schedule"}
        </button>
      </div>

      {facilities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
          <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No grounds found. Add a ground first.</p>
        </div>
      ) : (
        <>
          {/* Ground selector */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Ground</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full sm:w-auto text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.city}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{openDays}</p>
              <p className="text-xs text-slate-500 mt-1">Open Days / Week</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-3">
                <XCircle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{closedDays}</p>
              <p className="text-xs text-slate-500 mt-1">Closed Days / Week</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {openDays > 0
                  ? (() => {
                      const open = schedule.filter((d) => d.isOpen);
                      const avg  = open.reduce((s, d) => {
                        const [oh, om] = d.openTime.split(":").map(Number);
                        const [ch, cm] = d.closeTime.split(":").map(Number);
                        return s + (ch * 60 + cm) - (oh * 60 + om);
                      }, 0) / open.length;
                      return `${Math.floor(avg / 60)}h`;
                    })()
                  : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Avg Hours / Open Day</p>
            </div>
          </div>

          {/* Weekly schedule editor */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50">
              <h2 className="text-base font-semibold text-slate-900">Weekly Schedule</h2>
            </div>

            {loadingSched ? (
              <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading schedule…</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {schedule.map((day) => (
                  <div key={day.dayOfWeek} className="px-6 py-4 flex flex-wrap items-center gap-4">
                    {/* Day name */}
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-medium text-slate-900">{DAYS[day.dayOfWeek]}</p>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggle(day.dayOfWeek)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
                        day.isOpen ? "bg-green-500" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          day.isOpen ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className={`text-sm ${day.isOpen ? "text-green-600 font-medium" : "text-slate-400"}`}>
                      {day.isOpen ? "Open" : "Closed"}
                    </span>

                    {/* Time pickers */}
                    {day.isOpen && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-slate-500">From</label>
                          <input
                            type="time"
                            value={day.openTime}
                            onChange={(e) => setTime(day.dayOfWeek, "openTime", e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-slate-500">To</label>
                          <input
                            type="time"
                            value={day.closeTime}
                            onChange={(e) => setTime(day.dayOfWeek, "closeTime", e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {(() => {
                            const [oh, om] = day.openTime.split(":").map(Number);
                            const [ch, cm] = day.closeTime.split(":").map(Number);
                            const mins = (ch * 60 + cm) - (oh * 60 + om);
                            return mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ""}`.trim() : "";
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

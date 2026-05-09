"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";

interface Props {
  openTime?:  string;
  closeTime?: string;
  startTime:  string;
  endTime:    string;
  onChange:   (start: string, end: string) => void;
  accent?:    "blue" | "green";
}

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMins(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh} ${ap}` : `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
function durationLabel(hrs: number) {
  if (hrs < 1) return `${hrs * 60}m`;
  if (hrs % 1 === 0) return `${hrs}h`;
  const h = Math.floor(hrs);
  return `${h}h 30m`;
}

export function TimeRangePicker({
  openTime, closeTime, startTime, endTime, onChange, accent = "blue",
}: Props) {
  const openMins  = openTime  ? toMins(openTime)  : 6  * 60;
  const closeMins = closeTime ? toMins(closeTime) : 23 * 60;

  // 30-min slots within operating window
  const slots = useMemo(() => {
    const s: string[] = [];
    for (let m = openMins; m <= closeMins - 30; m += 30) s.push(fromMins(m));
    return s;
  }, [openMins, closeMins]);

  const startMins     = startTime ? toMins(startTime) : -1;
  const endMins       = endTime   ? toMins(endTime)   : -1;
  const currentDurHrs = startMins >= 0 && endMins > startMins
    ? (endMins - startMins) / 60
    : null;

  const validDurations = DURATION_OPTIONS.filter(
    (d) => startMins >= 0 && startMins + d * 60 <= closeMins,
  );

  function selectStart(slot: string) {
    const slotMins = toMins(slot);
    const keepDur  = currentDurHrs && currentDurHrs > 0 ? currentDurHrs : 1;
    const newEnd   = slotMins + keepDur * 60 <= closeMins
      ? fromMins(slotMins + keepDur * 60)
      : fromMins(closeMins);
    onChange(slot, newEnd);
  }

  function selectDuration(hrs: number) {
    if (startMins < 0 || startMins + hrs * 60 > closeMins) return;
    onChange(startTime, fromMins(startMins + hrs * 60));
  }

  const active  = accent === "green"
    ? "bg-green-600 text-white border-green-600 shadow-sm"
    : "bg-blue-600 text-white border-blue-600 shadow-sm";
  const idle    = accent === "green"
    ? "border-slate-200 text-slate-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
    : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700";
  const summary = accent === "green"
    ? "bg-green-50 border-green-100 text-green-700"
    : "bg-blue-50 border-blue-100 text-blue-700";

  return (
    <div className="space-y-4">
      {/* Start time grid */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Start time
        </p>
        {slots.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No slots available for this day.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => selectStart(slot)}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  slot === startTime ? active : idle
                }`}
              >
                {fmt12(slot)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration chips */}
      {startTime && validDurations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2.5">Duration</p>
          <div className="grid grid-cols-4 gap-2">
            {validDurations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => selectDuration(d)}
                className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                  currentDurHrs === d ? active : idle
                }`}
              >
                {durationLabel(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary bar */}
      {startTime && endTime && endMins > startMins && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${summary}`}>
          <p className="text-sm font-bold">
            {fmt12(startTime)} – {fmt12(endTime)}
          </p>
          {currentDurHrs !== null && (
            <span className="text-xs font-semibold opacity-70">
              {durationLabel(currentDurHrs)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

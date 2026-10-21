"use client";

import { useEffect, useState } from "react";

// Kick-off clock on the sign-in scoreboard: the time in Colombo, ticking each minute.
// Renders a placeholder until mounted, so server and browser HTML match.

const colomboTime = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Colombo" });

export default function ScoreboardClock({ compact = false }: { compact?: boolean }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(colomboTime());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  if (compact) {
    return (
      <span className="rounded-lg bg-black/40 px-2.5 py-1 font-scoreboard text-lg font-bold tabular-nums text-amber-300 ring-1 ring-white/10"
        aria-label={time ? `Colombo time ${time}` : undefined}>
        {time ?? "--:--"}
      </span>
    );
  }

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl bg-black/45 ring-1 ring-white/15 shadow-lg shadow-black/30">
      <div className="px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-200/80">Kick-off · Colombo</p>
        <p className="font-scoreboard text-4xl font-bold tabular-nums leading-none text-amber-300" aria-live="off">
          {time ?? "--:--"}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-1 border-l border-white/10 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-200/80">Bookings</p>
        <p className="font-scoreboard text-xl font-bold leading-none">24/7</p>
      </div>
    </div>
  );
}

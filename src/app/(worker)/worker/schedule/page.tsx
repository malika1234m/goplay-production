"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Loader2,
} from "lucide-react";

interface AvailDay  { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }
interface BookingEv { id: string; bookingDate: string; startTime: string; endTime: string; status: string; playerName: string; totalAmount: number; isPhoneBooking?: boolean }
interface BlockedEv { id: string; date: string; startTime: string | null; endTime: string | null; reason: string | null }

const HOUR_H = 56;
const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const DAYS_S = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const toMins = (t: string) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const pad2   = (n: number) => n.toString().padStart(2,"0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const getWeekStart = (d: Date) => { const r = new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; };
const fmtTime = (t: string) => { const [h,m] = t.split(":").map(Number); const ap = h<12?"AM":"PM"; const hh = h%12||12; return m===0?`${hh} ${ap}`:`${hh}:${pad2(m)} ${ap}`; };

function getMonthGrid(year: number, month: number): (Date|null)[] {
  const first = new Date(year,month,1);
  const last  = new Date(year,month+1,0).getDate();
  const cells: (Date|null)[] = Array(first.getDay()).fill(null);
  for (let d=1; d<=last; d++) cells.push(new Date(year,month,d));
  while (cells.length%7!==0) cells.push(null);
  return cells;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      {[
        { color:"bg-green-500",  label:"Confirmed" },
        { color:"bg-purple-400", label:"Phone booking" },
        { color:"bg-amber-400",  label:"Pending" },
        { color:"bg-red-400",    label:"Blocked hours" },
        { color:"bg-orange-400", label:"Full-day closed" },
        { color:"bg-slate-200",  label:"Outside hours" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
          {label}
        </div>
      ))}
    </div>
  );
}

function WeekView({ weekStart, availByDow, bookingsByDate, blockedByDate }: {
  weekStart: Date; availByDow: Map<number,AvailDay>;
  bookingsByDate: Map<string,BookingEv[]>; blockedByDate: Map<string,BlockedEv[]>;
}) {
  const today = dateKey(new Date());
  const days  = Array.from({ length:7 }, (_,i) => addDays(weekStart,i));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex border-b border-slate-100">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const key = dateKey(day); const dow = day.getDay();
            const sched = availByDow.get(dow); const isToday = key===today;
            return (
              <div key={key} className={`flex-1 px-2 py-2.5 text-center border-l border-slate-100 ${isToday?"bg-blue-50":""}`}>
                <p className={`text-xs font-medium ${isToday?"text-blue-600":"text-slate-400"}`}>{DAYS_S[dow]}</p>
                <p className={`text-lg font-bold leading-tight ${isToday?"text-blue-700":"text-slate-800"}`}>{day.getDate()}</p>
                {sched?.isOpen
                  ? <p className="text-[10px] text-slate-400">{fmtTime(sched.openTime)}–{fmtTime(sched.closeTime)}</p>
                  : <p className="text-[10px] text-red-400">Closed</p>
                }
              </div>
            );
          })}
        </div>
        <div className="relative flex" style={{ height: 24*HOUR_H }}>
          <div className="w-14 shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 text-[10px] text-slate-300 -translate-y-2" style={{ top: h*HOUR_H }}>
                {h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key   = dateKey(day); const dow = day.getDay();
            const sched = availByDow.get(dow);
            const bkList = bookingsByDate.get(key) ?? [];
            const blList = blockedByDate.get(key)  ?? [];
            const fullDayBlock = blList.find((b) => !b.startTime || !b.endTime);
            const openMins  = sched?.isOpen ? toMins(sched.openTime)  : null;
            const closeMins = sched?.isOpen ? toMins(sched.closeTime) : null;
            return (
              <div key={key} className="flex-1 border-l border-slate-100 relative">
                {HOURS.map((h) => <div key={h} className="absolute w-full border-t border-slate-50" style={{ top: h*HOUR_H }} />)}
                {sched?.isOpen && openMins!=null && closeMins!=null ? (
                  <>
                    {openMins > 0 && <div className="absolute inset-x-0 bg-slate-100 opacity-60 z-0" style={{ top:0, height:(openMins/60)*HOUR_H }} />}
                    {closeMins < 24*60 && <div className="absolute inset-x-0 bg-slate-100 opacity-60 z-0" style={{ top:(closeMins/60)*HOUR_H, bottom:0 }} />}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-slate-100 opacity-60 z-0" />
                )}
                {fullDayBlock && (
                  <div className="absolute inset-1 rounded-lg bg-orange-100 border border-orange-200 z-10 flex items-center justify-center">
                    <p className="text-xs font-medium text-orange-600 text-center px-1">{fullDayBlock.reason ?? "Closed"}</p>
                  </div>
                )}
                {!fullDayBlock && blList.filter((b) => b.startTime && b.endTime).map((b) => {
                  const top = (toMins(b.startTime!)/60)*HOUR_H;
                  const h   = ((toMins(b.endTime!)-toMins(b.startTime!))/60)*HOUR_H;
                  return (
                    <div key={b.id} className="absolute inset-x-1 rounded-md bg-red-100 border border-red-200 z-10 overflow-hidden px-1.5 pt-0.5"
                      style={{ top, height: Math.max(h,18) }} title={b.reason ? `Blocked: ${b.reason}` : "Maintenance"}>
                      <p className="text-[10px] font-medium text-red-600 leading-tight truncate">{b.startTime}–{b.endTime}{b.reason && ` · ${b.reason}`}</p>
                    </div>
                  );
                })}
                {!fullDayBlock && bkList.map((bk) => {
                  const top   = (toMins(bk.startTime)/60)*HOUR_H;
                  const h     = ((toMins(bk.endTime)-toMins(bk.startTime))/60)*HOUR_H;
                  const ok    = bk.status === "CONFIRMED";
                  const phone = bk.isPhoneBooking;
                  return (
                    <div key={bk.id} className={`absolute inset-x-1 rounded-md z-20 overflow-hidden px-1.5 pt-0.5 border ${
                      phone
                        ? "bg-purple-100 border-purple-300"
                        : ok ? "bg-green-100 border-green-300" : "bg-amber-50 border-amber-300"
                    }`} style={{ top, height: Math.max(h,20) }} title={`${phone?"📞 ":""}${bk.playerName} · Rs. ${bk.totalAmount.toLocaleString()}`}>
                      <div className="flex items-center gap-0.5">
                        {phone && <span className="text-[9px] leading-none">📞</span>}
                        <p className={`text-[10px] font-semibold leading-tight truncate ${phone?"text-purple-700":ok?"text-green-700":"text-amber-700"}`}>{bk.startTime}–{bk.endTime}</p>
                      </div>
                      <p className={`text-[9px] leading-tight truncate ${phone?"text-purple-600":ok?"text-green-600":"text-amber-600"}`}>{bk.playerName}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthView({ year, month, availByDow, bookingsByDate, blockedByDate }: {
  year: number; month: number; availByDow: Map<number,AvailDay>;
  bookingsByDate: Map<string,BookingEv[]>; blockedByDate: Map<string,BlockedEv[]>;
}) {
  const today = dateKey(new Date());
  const cells = getMonthGrid(year, month);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_S.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="border-b border-r border-slate-50 min-h-[88px]" />;
          const key = dateKey(day); const dow = day.getDay();
          const sched = availByDow.get(dow);
          const bkList = bookingsByDate.get(key) ?? [];
          const blList = blockedByDate.get(key)  ?? [];
          const fullBlock = blList.find((b) => !b.startTime || !b.endTime);
          const partials  = blList.filter((b) => b.startTime && b.endTime);
          const confirmed = bkList.filter((b) => b.status==="CONFIRMED" && !b.isPhoneBooking).length;
          const phone     = bkList.filter((b) => b.isPhoneBooking).length;
          const pending   = bkList.filter((b) => b.status==="PENDING").length;
          const isToday   = key===today;
          const isClosed  = !sched?.isOpen;
          return (
            <div key={key} className={`border-b border-r border-slate-100 min-h-[88px] p-1.5 ${isClosed||fullBlock?"bg-slate-50":"bg-white"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${isToday?"bg-blue-600 text-white":"text-slate-700"}`}>
                {day.getDate()}
              </div>
              {isClosed && !fullBlock && <span className="text-[9px] text-slate-400 font-medium">Closed</span>}
              {fullBlock && <div className="rounded text-[9px] font-medium text-orange-700 bg-orange-100 px-1 py-0.5 mb-0.5 truncate">{fullBlock.reason ?? "Closed"}</div>}
              {partials.length > 0 && <div className="rounded text-[9px] font-medium text-red-600 bg-red-50 px-1 py-0.5 mb-0.5">{partials.length} block{partials.length>1?"s":""}</div>}
              {confirmed > 0 && <div className="rounded text-[9px] font-medium text-green-700 bg-green-100 px-1 py-0.5 mb-0.5">{confirmed} confirmed</div>}
              {phone > 0     && <div className="rounded text-[9px] font-medium text-purple-700 bg-purple-100 px-1 py-0.5 mb-0.5">📞 {phone} phone</div>}
              {pending > 0   && <div className="rounded text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5">{pending} pending</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkerSchedulePage() {
  const [view,      setView]      = useState<"week"|"month">("week");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [monthDate, setMonthDate] = useState(() => { const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),1); });
  const [avail,     setAvail]     = useState<AvailDay[]>([]);
  const [bookings,  setBookings]  = useState<BookingEv[]>([]);
  const [blocked,   setBlocked]   = useState<BlockedEv[]>([]);
  const [loading,   setLoading]   = useState(false);

  const { from, to } = useMemo(() => {
    if (view==="week") return { from: dateKey(weekStart), to: dateKey(addDays(weekStart,6)) };
    const y = monthDate.getFullYear(); const m = monthDate.getMonth();
    const pad = (n:number) => n.toString().padStart(2,"0");
    const lastDay = new Date(y,m+1,0).getDate();
    return { from:`${y}-${pad(m+1)}-01`, to:`${y}-${pad(m+1)}-${pad(lastDay)}` };
  }, [view,weekStart,monthDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/worker/schedule?from=${from}&to=${to}`);
      const d = await r.json();
      setAvail(d.availability ?? []);
      setBookings(d.bookings  ?? []);
      setBlocked(d.blocked    ?? []);
    } finally { setLoading(false); }
  }, [from,to]);

  useEffect(() => { load(); }, [load]);

  const availByDow     = useMemo(() => { const m=new Map<number,AvailDay>(); avail.forEach((a)=>m.set(a.dayOfWeek,a)); return m; }, [avail]);
  const bookingsByDate = useMemo(() => { const m=new Map<string,BookingEv[]>(); bookings.forEach((b)=>{ const k=dateKey(new Date(b.bookingDate)); if(!m.has(k))m.set(k,[]); m.get(k)!.push(b); }); return m; }, [bookings]);
  const blockedByDate  = useMemo(() => { const m=new Map<string,BlockedEv[]>(); blocked.forEach((b)=>{ const k=dateKey(new Date(b.date)); if(!m.has(k))m.set(k,[]); m.get(k)!.push(b); }); return m; }, [blocked]);

  const prevWeek  = () => setWeekStart((d) => addDays(d,-7));
  const nextWeek  = () => setWeekStart((d) => addDays(d,7));
  const todayWeek = () => setWeekStart(getWeekStart(new Date()));
  const prevMonth = () => setMonthDate((d) => new Date(d.getFullYear(),d.getMonth()-1,1));
  const nextMonth = () => setMonthDate((d) => new Date(d.getFullYear(),d.getMonth()+1,1));
  const todayMonth = () => { const n=new Date(); setMonthDate(new Date(n.getFullYear(),n.getMonth(),1)); };

  const headerLabel = view==="week" ? (() => {
    const end=addDays(weekStart,6); const s=weekStart;
    return s.getMonth()===end.getMonth()
      ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${end.getDate()}, ${s.getFullYear()}`
      : `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  })() : `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
        <p className="text-slate-500 text-sm mt-0.5">Bookings and maintenance for your facility</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(["week","month"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view===v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {v==="week" ? <CalendarDays className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={view==="week"?prevWeek:prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-semibold text-slate-800 min-w-[200px] text-center">{headerLabel}</span>
          <button onClick={view==="week"?nextWeek:nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>
          <button onClick={view==="week"?todayWeek:todayMonth} className="ml-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Today</button>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      <Legend />

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {view==="week"
          ? <WeekView weekStart={weekStart} availByDow={availByDow} bookingsByDate={bookingsByDate} blockedByDate={blockedByDate} />
          : <MonthView year={monthDate.getFullYear()} month={monthDate.getMonth()} availByDow={availByDow} bookingsByDate={bookingsByDate} blockedByDate={blockedByDate} />
        }
      </div>
    </div>
  );
}

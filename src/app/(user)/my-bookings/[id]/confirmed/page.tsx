"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Clock, Loader2, Mail, MapPin, Navigation, Phone, Send, Trophy } from "lucide-react";

interface ConfirmedBooking {
  id:            string;
  bookingDate:   string;
  startTime:     string;
  endTime:       string;
  totalHours:    number;
  totalAmount:   number;
  contactNumber: string | null;
  contactEmail:  string | null;
  court:         { name: string } | null;
  facility:      { name: string; address: string; city: string; image: string | null };
}

// Confetti burst around the check mark — fixed positions so server and client render the same
const CONFETTI = [
  { x: -120, y: -70, c: "#4ade80", r: 20 },  { x: 110, y: -80, c: "#facc15", r: -30 },
  { x: -90, y: 60, c: "#ffffff", r: 45 },    { x: 130, y: 40, c: "#4ade80", r: 10 },
  { x: -150, y: -10, c: "#facc15", r: 60 },  { x: 150, y: -20, c: "#ffffff", r: -50 },
  { x: -40, y: -110, c: "#86efac", r: 30 },  { x: 50, y: -115, c: "#4ade80", r: -15 },
  { x: -60, y: 100, c: "#facc15", r: 70 },   { x: 70, y: 95, c: "#86efac", r: -60 },
];

/** "20261110T100000" in Sri Lanka time, for the calendar file */
function icsStamp(bookingDate: string, hhmm: string) {
  return `${bookingDate.slice(0, 10).replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
}

function downloadIcs(b: ConfirmedBooking) {
  const where = [b.facility.name, b.facility.address, b.facility.city].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GoPlay//Booking//EN", "BEGIN:VEVENT",
    `UID:${b.id}@goplay.lk`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Colombo:${icsStamp(b.bookingDate, b.startTime)}`,
    `DTEND;TZID=Asia/Colombo:${icsStamp(b.bookingDate, b.endTime)}`,
    `SUMMARY:${b.facility.name}${b.court ? ` — ${b.court.name}` : ""}`,
    `LOCATION:${where.replace(/,/g, "\\,")}`,
    `DESCRIPTION:GoPlay booking #${b.id.slice(0, 8).toUpperCase()}. Pay Rs. ${b.totalAmount.toLocaleString()} at the ground.`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `goplay-${b.id.slice(0, 8)}.ics` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Landing page after a pay-on-arrival booking clears its email code — a match ticket. */
export default function BookingConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch(`/api/user/bookings/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "We couldn't find this booking.");
        else setBooking(data.booking);
      })
      .catch(() => setError("You're offline. Reconnect and refresh the page."));
  }, [id]);

  if (error) return <p className="max-w-xl mx-auto py-16 text-center text-red-700">{error}</p>;
  if (!booking) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const d       = new Date(booking.bookingDate);
  const dow     = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  const day     = d.toLocaleDateString("en-US", { day: "2-digit", timeZone: "UTC" });
  const month   = d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
  const where   = [booking.facility.address, booking.facility.city].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.facility.name}, ${where}`)}`;
  const hours   = `${booking.totalHours} ${booking.totalHours === 1 ? "hour" : "hours"}`;

  const steps = [
    { icon: Send,   title: "Booking sent",       body: "Your email is verified and the ground has your request.", state: "done" },
    { icon: Clock,  title: "Ground confirms",    body: "Usually within a few hours — we'll notify you the moment they do.", state: "now" },
    { icon: Trophy, title: "Play & pay at the ground", body: `Bring Rs. ${booking.totalAmount.toLocaleString()} in cash on ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}.`, state: "later" },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto -mt-2 pb-8">
      <style>{`
        @keyframes gp-pop{0%{transform:scale(.3);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        @keyframes gp-ring{0%{transform:scale(.8);opacity:.7}100%{transform:scale(1.9);opacity:0}}
        @keyframes gp-burst{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(var(--r));opacity:0}}
        @keyframes gp-rise{0%{transform:translateY(24px);opacity:0}100%{transform:none;opacity:1}}
        @media (prefers-reduced-motion: reduce){.gp-anim,.gp-anim *{animation:none!important;opacity:1!important}}
      `}</style>

      {/* Hero */}
      <section className="gp-anim relative overflow-hidden rounded-3xl bg-pitch-deep text-white pt-14 pb-36">
        <svg aria-hidden className="absolute inset-0 w-full h-full opacity-[0.09]" preserveAspectRatio="none" viewBox="0 0 400 200">
          <g fill="none" stroke="#fff" strokeWidth="1.2">
            <rect x="20" y="15" width="360" height="170" /><line x1="200" y1="15" x2="200" y2="185" />
            <circle cx="200" cy="100" r="34" /><rect x="20" y="60" width="44" height="80" /><rect x="336" y="60" width="44" height="80" />
          </g>
        </svg>
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-green-500/20 blur-3xl" />

        <div className="relative mx-auto w-28 h-28">
          <span className="absolute inset-0 rounded-full bg-green-400/40" style={{ animation: "gp-ring 1.6s ease-out .4s infinite" }} />
          {CONFETTI.map((p, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 w-2 h-3.5 -ml-1 -mt-1.5 rounded-sm"
              style={{ background: p.c, ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, ["--r" as string]: `${p.r * 6}deg`,
                       animation: `gp-burst 1.3s cubic-bezier(.2,.7,.3,1) ${0.25 + i * 0.03}s both` }} />
          ))}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-[0_0_0_10px_rgba(74,222,128,0.15),0_20px_40px_-10px_rgba(34,197,94,0.6)]"
            style={{ animation: "gp-pop .6s cubic-bezier(.2,.8,.3,1.2) both" }}>
            <Check className="w-14 h-14" strokeWidth={3.5} />
          </div>
        </div>

        <p className="relative mt-7 text-center text-xs font-bold tracking-[0.35em] text-green-300" style={{ animation: "gp-rise .5s ease-out .35s both" }}>YOU&apos;RE ON THE BOOKS</p>
        <h1 className="relative mt-2 text-center font-scoreboard text-5xl sm:text-6xl font-extrabold uppercase tracking-tight" style={{ animation: "gp-rise .5s ease-out .45s both" }}>
          Booking completed
        </h1>
        <p className="relative mt-3 px-6 text-center text-sm text-green-100/80 max-w-md mx-auto" style={{ animation: "gp-rise .5s ease-out .55s both" }}>
          The ground has your booking and will confirm it shortly.
        </p>
      </section>

      {/* Ticket */}
      <div className="gp-anim relative -mt-28 px-4" style={{ animation: "gp-rise .6s ease-out .65s both" }}>
        <article className="mx-auto max-w-xl rounded-3xl bg-white shadow-[0_30px_60px_-20px_rgba(15,42,29,0.35)] overflow-hidden">
          <div className="relative h-36 bg-gradient-to-br from-pitch to-pitch-deep">
            {booking.facility.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={booking.facility.image} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <span className="absolute top-3 right-3 rounded-full bg-amber-400 text-amber-950 text-[11px] font-extrabold tracking-wider px-2.5 py-1">PENDING CONFIRMATION</span>
            <div className="absolute bottom-3 left-5 right-5 text-white">
              <h2 className="font-scoreboard text-2xl font-bold uppercase leading-tight">{booking.facility.name}</h2>
              <p className="flex items-center gap-1.5 text-xs text-white/80"><MapPin className="w-3.5 h-3.5" />{where}</p>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-5 px-5 pt-5">
            <div className="rounded-2xl bg-pitch-deep text-white text-center px-4 py-3 min-w-[92px]">
              <p className="text-[11px] font-bold tracking-widest text-green-300">{dow}</p>
              <p className="font-scoreboard text-5xl font-extrabold leading-none">{day}</p>
              <p className="text-[11px] font-bold tracking-widest text-white/70">{month}</p>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-baseline gap-2 font-scoreboard font-bold text-slate-900">
                <span className="text-3xl">{booking.startTime}</span>
                <span className="text-slate-300 text-xl">→</span>
                <span className="text-3xl">{booking.endTime}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-green-50 text-pitch text-xs font-semibold px-2.5 py-1">{hours}</span>
                {booking.court && <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1">{booking.court.name}</span>}
              </div>
            </div>
          </div>

          {/* Perforation */}
          <div className="relative my-5 h-6" aria-hidden>
            <span className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-slate-50" />
            <span className="absolute -right-3 top-0 w-6 h-6 rounded-full bg-slate-50" />
            <span className="absolute left-5 right-5 top-1/2 border-t-2 border-dashed border-rule" />
          </div>

          <div className="px-5 pb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-400">BOOKING</p>
              <p className="font-mono font-bold text-slate-900">#{booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold tracking-wider text-slate-400">PAY AT GROUND</p>
              <p className="font-scoreboard text-2xl font-extrabold text-pitch leading-none">Rs. {booking.totalAmount.toLocaleString()}</p>
            </div>
            {booking.contactNumber && (
              <p className="flex items-center gap-2 text-slate-600 min-w-0"><Phone className="w-4 h-4 text-slate-400 shrink-0" />{booking.contactNumber}</p>
            )}
            {booking.contactEmail && (
              <p className="flex items-center gap-2 text-slate-600 min-w-0 justify-end"><Mail className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{booking.contactEmail}</span></p>
            )}
          </div>
        </article>

        {/* Actions */}
        <div className="mx-auto max-w-xl mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => downloadIcs(booking)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-rule px-4 py-3 text-sm font-semibold text-slate-800 hover:border-pitch hover:text-pitch transition-colors">
            <CalendarPlus className="w-4 h-4" /> Add to calendar
          </button>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-rule px-4 py-3 text-sm font-semibold text-slate-800 hover:border-pitch hover:text-pitch transition-colors">
            <Navigation className="w-4 h-4" /> Get directions
          </a>
        </div>

        {/* What happens next */}
        <section className="mx-auto max-w-xl mt-8">
          <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 mb-4">WHAT HAPPENS NEXT</h3>
          <ol className="relative space-y-5">
            <span aria-hidden className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-rule" />
            {steps.map(({ icon: Icon, title, body, state }) => (
              <li key={title} className="relative flex gap-4">
                <span className={`relative z-10 w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                  state === "done" ? "bg-pitch text-white" : state === "now" ? "bg-amber-100 text-deadline ring-4 ring-amber-50" : "bg-white text-slate-400 border-2 border-rule"}`}>
                  {state === "done" ? <Check className="w-5 h-5" strokeWidth={3} /> : <Icon className="w-[18px] h-[18px]" />}
                  {state === "now" && <span className="absolute inset-0 rounded-full bg-amber-300/50 animate-ping" />}
                </span>
                <div className="pt-1.5">
                  <p className={`font-semibold ${state === "later" ? "text-slate-500" : "text-slate-900"}`}>{title}</p>
                  <p className="text-sm text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="mx-auto max-w-xl mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/my-bookings" className="flex-1 text-center bg-pitch hover:bg-green-800 text-white text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors">View my bookings</Link>
          <Link href="/grounds" className="flex-1 text-center text-pitch hover:bg-green-50 text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors">Book another ground</Link>
        </div>
      </div>
    </div>
  );
}

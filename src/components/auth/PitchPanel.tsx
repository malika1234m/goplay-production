import Link from "next/link";
import Image from "next/image";
import ScoreboardClock from "./ScoreboardClock";

// The sign-in side panel: a floodlit pitch at night with a scoreboard. Pure SVG and CSS — no images
// to load — and the floodlight sweep stops for people who prefer reduced motion (globals.css).

function PitchLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3">
        <rect x="40" y="40" width="520" height="820" rx="4" />
        <line x1="40" y1="450" x2="560" y2="450" />
        <circle cx="300" cy="450" r="86" />
        <circle cx="300" cy="450" r="4" fill="rgba(255,255,255,0.3)" />
        <rect x="160" y="40" width="280" height="140" />
        <rect x="225" y="40" width="150" height="56" />
        <path d="M245 180 A 70 70 0 0 0 355 180" />
        <rect x="160" y="720" width="280" height="140" />
        <rect x="225" y="804" width="150" height="56" />
        <path d="M245 720 A 70 70 0 0 1 355 720" />
      </g>
    </svg>
  );
}

/** Full panel beside the form on wide screens. */
export function PitchPanel() {
  return (
    <aside className="auth-pitch relative hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between overflow-hidden px-12 py-12 text-white">
      <PitchLines className="absolute inset-0 h-full w-full" />
      <span className="auth-floodlight auth-floodlight-left" aria-hidden="true" />
      <span className="auth-floodlight auth-floodlight-right" aria-hidden="true" />

      <Link href="/" className="relative flex items-center gap-3 self-start rounded-xl">
        <Image src="/logo.jpeg" alt="" width={44} height={44} className="rounded-xl bg-white object-contain" />
        <span className="text-2xl font-bold">Go<span className="text-green-300">Play</span></span>
        <span className="sr-only">GoPlay home</span>
      </Link>

      <div className="relative space-y-6">
        <ScoreboardClock />
        <h2 className="font-scoreboard text-6xl xl:text-7xl font-bold uppercase leading-[0.9] tracking-tight text-balance">
          Your next game<br />starts <span className="text-amber-300">here.</span>
        </h2>
      </div>
    </aside>
  );
}

/** Slim version above the form on phones and tablets. */
export function PitchBanner() {
  return (
    <div className="auth-pitch relative overflow-hidden px-5 pb-14 pt-5 text-white lg:hidden">
      <PitchLines className="absolute inset-0 h-full w-full opacity-70" />
      <span className="auth-floodlight auth-floodlight-right" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-md items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl">
          <Image src="/logo.jpeg" alt="" width={36} height={36} className="rounded-lg bg-white object-contain" />
          <span className="text-xl font-bold">Go<span className="text-green-300">Play</span></span>
          <span className="sr-only">GoPlay home</span>
        </Link>
        <ScoreboardClock compact />
      </div>
    </div>
  );
}

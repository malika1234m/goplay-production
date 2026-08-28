"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AD_SLOTS, type AdSlotName } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

type Props = {
  /** Slot key from the registry in `@/lib/ads`. */
  name: AdSlotName;
  /** "auto" for responsive display units, "fluid" for in-feed/in-article. */
  format?: "auto" | "fluid" | "horizontal" | "rectangle" | "vertical";
  /** Required by in-feed units (data-ad-layout-key). */
  layoutKey?: string;
  className?: string;
  /** Optional "Advertisement" caption above the unit. */
  label?: boolean;
};

/**
 * A single AdSense unit, addressed by registry key.
 *
 * Renders nothing when the publisher ID or this slot's ID is missing, so the
 * site stays clean before AdSense approval and each position can be enabled
 * independently. In development it renders a labelled placeholder instead —
 * real ads never fill on localhost, so the reserved space would otherwise be
 * invisible while working on a page.
 */
export default function AdSlot({
  name,
  format = "auto",
  layoutKey,
  className = "",
  label = true,
}: Props) {
  const pathname = usePathname();
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const slot = AD_SLOTS[name]?.id;

  useEffect(() => {
    if (!CLIENT || !slot) return;
    if (pushed.current) return;

    const el = insRef.current;
    // AdSense stamps this attribute once a unit is filled; pushing twice throws.
    if (!el || el.getAttribute("data-adsbygoogle-status")) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // Loader blocked (ad blocker / CSP) — leave the slot empty.
    }
  }, [pathname, slot]);

  if (process.env.NODE_ENV !== "production" && (!CLIENT || !slot)) {
    const def = AD_SLOTS[name];
    return (
      <div className={`w-full ${className}`}>
        <div className="border-2 border-dashed border-amber-300 bg-amber-50/60 rounded-xl py-10 px-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1">
            Ad slot · dev preview · {def?.tier ?? "?"} value
          </p>
          <p className="text-xs text-amber-700/80">
            {def?.label ?? name} — {slot ? "waiting for NEXT_PUBLIC_ADSENSE_CLIENT" : "slot ID not set"}
          </p>
        </div>
      </div>
    );
  }

  if (!CLIENT || !slot) return null;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 text-center">
          Advertisement
        </p>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
        {...(format === "auto" ? { "data-full-width-responsive": "true" } : {})}
        {...(process.env.NODE_ENV !== "production" ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}

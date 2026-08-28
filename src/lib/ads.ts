/**
 * Ad slot registry.
 *
 * Every AdSense unit on the site is declared here once. Pages reference a slot
 * by key (`<AdSlot name="grounds_infeed" />`) rather than reading env vars
 * inline, so the full inventory is visible in one place and a slot can be
 * turned off by clearing a single variable.
 *
 * The env reads MUST stay written out literally — Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time by textual substitution, so a
 * computed lookup like `process.env[key]` would silently resolve to undefined.
 *
 * Placement rules this inventory follows:
 *  - Nothing on a page where money changes hands (booking form, payment).
 *  - Nothing in the ground-owner, worker or admin portals — those are business
 *    tools people run their venue on, not consumer surfaces.
 *  - At most two units per page, always below the primary action.
 */

export interface AdSlotDef {
  /** AdSense ad unit ID (data-ad-slot). Undefined = slot disabled. */
  id?: string;
  /** Shown in the dev placeholder to identify the position. */
  label: string;
  /** Rough revenue expectation, for the docs and for prioritising setup. */
  tier: "high" | "medium" | "low";
}

export const AD_SLOTS = {
  // ── Highest value: in-content, above the fold on long pages ──────────────
  grounds_infeed: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_GROUNDS_INFEED,
    label: "Browse grounds — in-feed, after row 2",
    tier:  "high",
  },
  ground_sidebar: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_GROUND_SIDEBAR,
    label: "Ground page — in content, between amenities and courts",
    tier:  "high",
  },
  home_mid: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_MID,
    label: "Homepage — between sports and features",
    tier:  "high",
  },
  grounds_empty: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_GROUNDS_EMPTY,
    label: "Browse grounds — no results",
    tier:  "high",
  },

  // ── Medium: end-of-content units on pages people return to ───────────────
  open_matches: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_OPEN_MATCHES,
    label: "Open matches — below lobby list",
    tier:  "medium",
  },
  my_bookings: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_MY_BOOKINGS,
    label: "My bookings — below list",
    tier:  "medium",
  },
  booking_success: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOOKING_SUCCESS,
    label: "Booking confirmed — below details",
    tier:  "medium",
  },

  // ── Low: bottom-of-page leaderboards and low-traffic pages ───────────────
  grounds_footer: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_GROUNDS_LIST,
    label: "Browse grounds — below results",
    tier:  "low",
  },
  ground_footer: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_GROUND_DETAIL,
    label: "Ground page — below content",
    tier:  "low",
  },
  home_lower: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
    label: "Homepage — after How it works",
    tier:  "low",
  },
  info_page: {
    id:    process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFO,
    label: "Info pages — about, support, policies",
    tier:  "low",
  },
} as const satisfies Record<string, AdSlotDef>;

export type AdSlotName = keyof typeof AD_SLOTS;

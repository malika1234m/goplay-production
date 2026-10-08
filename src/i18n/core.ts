// Translation core shared by server and client code.
//
// Keys are the English text itself: t("Bookings") returns "Bookings" in English and the
// Sinhala entry from ./si when the language is "si". Anything without a Sinhala entry falls
// back to English, so a screen is never blank while translation is in progress.
// Placeholders use {name}: t("{n} to review", { n: 3 }).

import si from "./si";

export type Lang = "en" | "si";
export type Vars = Record<string, string | number>;
export type T  = (key: string, vars?: Vars) => string;
export type TN = (n: number, one: string, other: string, vars?: Vars) => string;

export const LANG_COOKIE = "goplay_lang";
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "si", label: "සිංහල",   short: "සිං" },
];

export const isLang = (v: unknown): v is Lang => v === "en" || v === "si";

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, si };

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function makeT(lang: Lang): T {
  const dict = DICTS[lang];
  return (key, vars) => fill(dict?.[key] ?? key, vars);
}

/** Count-aware variant: tn(n, "{n} booking", "{n} bookings"). n is passed as a var automatically. */
export function makeTN(lang: Lang): TN {
  const t = makeT(lang);
  return (n, one, other, vars) => t(n === 1 ? one : other, { n: n.toLocaleString(), ...vars });
}

/** BCP 47 locale for dates and numbers. */
export const localeOf = (lang: Lang) => (lang === "si" ? "si-LK" : "en-GB");

/** Marks a string defined outside a component (nav items, option lists) as a translation key.
 *  It returns the English text unchanged; translate it with t(key) where it's rendered. */
export const tk = (s: string) => s;

// Browsers ship little or no Sinhala date data (Chrome prints English, Node prints CLDR
// abbreviations), so Sinhala dates are built here from fixed names and render the same
// on the server and in every browser.
const SI_MONTHS       = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];
const SI_MONTHS_SHORT = ["ජන", "පෙබ", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝ", "සැප්", "ඔක්", "නොවැ", "දෙසැ"];
const SI_DAYS         = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
const SI_DAYS_SHORT   = ["ඉරි", "සඳු", "අඟ", "බදා", "බ්‍රහ", "සිකු", "සෙන"];

/** Drop-in for date.toLocaleDateString(locale, opts) that is consistent for Sinhala. */
export function formatDay(d: Date | string | number, locale: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = d instanceof Date ? d : new Date(d);
  if (!locale.startsWith("si")) return date.toLocaleDateString(locale, opts);
  const m = opts.month === "long" ? SI_MONTHS[date.getMonth()]
          : opts.month ? SI_MONTHS_SHORT[date.getMonth()] : "";
  const w = opts.weekday === "long" ? SI_DAYS[date.getDay()]
          : opts.weekday ? SI_DAYS_SHORT[date.getDay()] : "";
  const parts = [opts.year ? String(date.getFullYear()) : "", m, opts.day ? String(date.getDate()) : ""].filter(Boolean).join(" ");
  if (!opts.month && !opts.day && !opts.year) return w || date.toLocaleDateString("en-GB");
  return w ? `${parts}, ${w}` : parts;
}

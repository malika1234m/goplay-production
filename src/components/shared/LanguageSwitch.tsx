"use client";

import { LANGS } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

/** EN | සිං toggle. tone="dark" for the slate sidebars, "light" for white headers. */
export default function LanguageSwitch({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const { lang, setLang, t } = useT();
  const wrap = tone === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";
  const on   = tone === "dark" ? "bg-slate-600 text-white" : "bg-slate-900 text-white";
  const off  = tone === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900";

  return (
    <div role="radiogroup" aria-label={t("Language")} className={`inline-flex rounded-lg border p-0.5 ${wrap} ${className}`}>
      {LANGS.map((l) => (
        <button key={l.code} role="radio" aria-checked={lang === l.code} lang={l.code} title={l.label}
          onClick={() => lang !== l.code && setLang(l.code)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${lang === l.code ? on : off}`}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

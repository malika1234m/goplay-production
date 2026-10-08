"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isLang, LANG_COOKIE, localeOf, makeT, makeTN, type Lang, type T, type TN } from "./core";

interface I18n { lang: Lang; locale: string; t: T; tn: TN; setLang: (l: Lang) => void }

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setState] = useState<Lang>(initial);
  const router = useRouter();

  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem(LANG_COOKIE, l); } catch { /* storage blocked — the cookie still works */ }
    document.documentElement.lang = l;
    setState(l);
    router.refresh();   // re-render server components in the new language
  }, [router]);

  // The cookie drives server rendering. If it was cleared but this browser remembers a
  // choice, put it back so the next page renders in the right language.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LANG_COOKIE); } catch { return; }
    if (isLang(saved) && saved !== initial && !document.cookie.includes(`${LANG_COOKIE}=`)) setLang(saved);
  }, [initial, setLang]);

  const value = useMemo(() => ({ lang, locale: localeOf(lang), t: makeT(lang), tn: makeTN(lang), setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useT must be used inside I18nProvider");
  return v;
}

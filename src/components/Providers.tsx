"use client";

import { SessionProvider } from "next-auth/react";
import NextTopLoader from "nextjs-toploader";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/core";

export default function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider initial={lang}>
        <NextTopLoader
          color="#22c55e"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #22c55e, 0 0 5px #22c55e"
        />
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}

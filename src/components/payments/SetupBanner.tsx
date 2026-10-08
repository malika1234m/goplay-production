"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

/** Dashboard nudge into the setup guide until every required step is done. */
export default function SetupBanner() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/ground-owner/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.setup) return;
        const s = d.setup as Record<string, boolean>;
        const online = (d.grounds ?? []).some((g: { paymentOptions: string | null }) => g.paymentOptions !== "ON_ARRIVAL_ONLY");
        const keys = ["contact", "business", "method", ...(online ? ["payments"] : []), "photos", "hours", "approved"];
        setProgress({ done: keys.filter((k) => s[k]).length, total: keys.length });
      })
      .catch(() => {});
  }, []);

  if (!progress || progress.done === progress.total) return null;
  return (
    <Link href="/ground-owner/setup"
      className="flex items-center gap-4 rounded-xl border border-pitch/30 bg-pitch/5 px-5 py-4 hover:bg-pitch/10 focus-visible:outline-2 focus-visible:outline-pitch">
      <span className="font-scoreboard text-[28px] leading-none font-semibold text-pitch-deep tabular-nums">
        {progress.done}<span className="text-slate-400">/{progress.total}</span>
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold text-pitch-deep">{t("Finish setup")}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-pitch">{t("Continue")} <ArrowRight className="w-4 h-4" /></span>
    </Link>
  );
}

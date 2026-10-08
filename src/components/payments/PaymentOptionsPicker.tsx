"use client";

import { Banknote, Check, Landmark, Shuffle } from "lucide-react";
import { tk } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

export type PayOpt = "ON_ARRIVAL_ONLY" | "ONLINE_ONLY" | "BOTH";

export const PAY_CHOICES: { value: PayOpt; title: string; body: string; Icon: typeof Banknote }[] = [
  { value: "ON_ARRIVAL_ONLY", title: tk("Pay at ground"), body: tk("Cash on arrival"),                   Icon: Banknote },
  { value: "ONLINE_ONLY",     title: tk("Online only"),       body: tk("Bank transfer first"),              Icon: Landmark },
  { value: "BOTH",            title: tk("Both"),              body: tk("Player chooses"),           Icon: Shuffle },
];

/** How a ground takes payment — three cards, one choice. */
export default function PaymentOptionsPicker({ name, value, onChange, disabled }: {
  name: string; value: PayOpt | null; onChange: (v: PayOpt) => void; disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
      {PAY_CHOICES.map((c) => {
        const on = value === c.value;
        return (
          <label key={c.value}
            className={`relative flex flex-col gap-1.5 rounded-lg border p-4 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-pitch/40 ${
              on ? "border-pitch bg-pitch/5 ring-1 ring-pitch" : "border-rule bg-white hover:border-pitch/50"} ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
            <input type="radio" name={name} value={c.value} checked={on} onChange={() => onChange(c.value)} className="sr-only" />
            <span className="flex items-center gap-2 text-[15px] font-semibold text-pitch-deep">
              <c.Icon className="w-4 h-4 text-pitch" />{t(c.title)}
              {on && <Check className="w-4 h-4 text-pitch ml-auto" />}
            </span>
            <span className="text-[13px] text-slate-600 leading-snug">{t(c.body)}</span>
          </label>
        );
      })}
    </div>
  );
}

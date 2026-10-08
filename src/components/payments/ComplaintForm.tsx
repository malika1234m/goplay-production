"use client";

import { useState } from "react";
import { Loader2, MessageSquareWarning } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

/** Lets a player dispute a rejected receipt. Exactly one of bookingId / spotId. */
export default function ComplaintForm({
  bookingId,
  spotId,
  onSubmitted,
}: {
  bookingId?:  string;
  spotId?:     string;
  onSubmitted: () => void;
}) {
  const [open,       setOpen]       = useState(false);
  const [message,    setMessage]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const { t } = useT();

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const res  = await fetch("/api/complaints", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ bookingId, spotId, message }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? t("Could not submit the complaint.")); return; }
    onSubmitted();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold py-2.5 rounded-xl transition-colors"
      >
        <MessageSquareWarning className="w-4 h-4" /> {t("Raise a complaint")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-amber-200 bg-amber-50 rounded-xl p-3">
      <p className="text-xs text-amber-900">
        {t("Tell the GoPlay team what happened — e.g. the date, time and bank you paid from. We'll check with the ground.")}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("I transferred the full amount on…")}
        className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
      {error && <p className="text-xs text-red-600">{t(error)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 text-sm font-medium text-slate-600 py-2 rounded-lg hover:bg-white">
          {t("Cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || message.trim().length < 10}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {t("Submit complaint")}
        </button>
      </div>
    </div>
  );
}

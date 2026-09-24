"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";

const LK_MOBILE_RE = /^(?:\+94|0)7[0-9]{8}$/;

/** Contact number for a paid open-match action, pre-filled from the player's profile. */
export function useContactNumber() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => { if (d.user?.phone) setValue((v) => v || d.user.phone); })
      .catch(() => {});
  }, []);

  /** Returns true when the number is usable; otherwise shows the error under the field. */
  function validate(): boolean {
    const cleaned = value.replace(/[\s\-().]/g, "");
    if (!cleaned) { setError("A contact number is required."); return false; }
    if (!LK_MOBILE_RE.test(cleaned)) { setError("Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)."); return false; }
    setError("");
    return true;
  }

  return { value: value.trim(), setValue, error, setError, validate, raw: value };
}

export default function ContactNumberField({ contact }: { contact: ReturnType<typeof useContactNumber> }) {
  const { raw, setValue, error, setError } = contact;
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        Contact Number <span className="text-red-500">*</span>
      </label>
      <div className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border focus-within:ring-2 transition ${
        error ? "border-red-300 focus-within:ring-red-300" : "border-slate-200 focus-within:ring-green-500"
      }`}>
        <Phone className={`w-4 h-4 shrink-0 ${error ? "text-red-400" : "text-slate-400"}`} />
        <input
          type="tel"
          value={raw}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          placeholder="+94 77 123 4567"
          className="bg-transparent w-full outline-none text-sm text-slate-900 placeholder-slate-400"
        />
      </div>
      {error
        ? <p className="text-xs text-red-500 mt-1">{error}</p>
        : <p className="text-xs text-slate-400 mt-1">Needed for payment. Saved to your profile if you don&apos;t have one yet.</p>}
    </div>
  );
}

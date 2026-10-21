"use client";

import { useEffect, useRef } from "react";

/**
 * Accessible behaviour for a hand-built modal: Escape closes it, focus moves into the dialog when
 * it opens and back to what was focused before when it closes. Spread `panelProps` on the dialog box.
 */
export function useDialog(onClose: () => void, label: string) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers usually pass an inline function; keep the latest without re-running the effect below,
  // which would pull focus back to the dialog on every render
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return {
    panelProps: {
      ref:          panelRef,
      role:         "dialog" as const,
      "aria-modal": true,
      "aria-label": label,
      tabIndex:     -1,
    },
  };
}

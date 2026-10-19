"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget. Invisible for most people — it only shows a checkbox when
// Cloudflare wants an interaction. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is
// set, and the server skips the check until TURNSTILE_SECRET_KEY is set, so forms keep working.

const SITE_KEY   = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Is the bot check switched on for this site? Forms wait for a token only when it is. */
export const turnstileEnabled = !!SITE_KEY;

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true, defer: true });
    s.onload  = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("Turnstile failed to load")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Tokens are single-use: remount it (change its `key`) after every submit so the next
 * attempt gets a fresh token.
 */
export default function Turnstile({ onToken, action }: { onToken: (token: string | null) => void; action?: string }) {
  const box  = useRef<HTMLDivElement>(null);
  const cb   = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey:            SITE_KEY,
          action,
          appearance:         "interaction-only",
          theme:              "light",
          size:               "flexible",
          callback:           (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback":   () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => { cancelled = true; if (id) window.turnstile?.remove(id); };
  }, [action]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="flex justify-center [&:empty]:hidden" />;
}

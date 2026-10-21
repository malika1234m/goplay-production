"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Sign in | Create account" switch on top of the form card: two pages that feel like one place.
const TABS = [
  { href: "/login",    label: "Sign in" },
  { href: "/register", label: "Create account" },
];

export default function AuthTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Menu, X, ChevronDown, User, LogOut, LayoutDashboard, Building2 } from "lucide-react";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dashboardHref =
    session?.user?.role === "GROUND_OWNER" ? "/ground-owner/dashboard" :
    session?.user?.role === "ADMIN"        ? "/admin/dashboard"         : "/dashboard";

  const profileHref =
    session?.user?.role === "GROUND_OWNER" ? "/ground-owner/profile" : "/profile";

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.jpeg" alt="GoPlay" width={36} height={36} className="rounded-lg object-contain" />
            <span className="text-xl font-bold text-slate-900">
              Go<span className="text-green-600">Play</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/grounds" className="text-slate-600 hover:text-green-600 text-sm font-medium transition-colors">
              Browse Grounds
            </Link>
            <Link href="/#how-it-works" className="text-slate-600 hover:text-green-600 text-sm font-medium transition-colors">
              How It Works
            </Link>
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors"
                >
                  <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <span className="max-w-[100px] truncate">{session.user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-100 shadow-lg py-1 z-50">
                    <Link
                      href={dashboardHref}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <LayoutDashboard className="w-4 h-4 text-slate-400" />
                      Dashboard
                    </Link>
                    <Link
                      href={profileHref}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      Profile
                    </Link>
                    {session?.user?.role === "USER" && (
                      <Link
                        href="/become-provider"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50"
                      >
                        <Building2 className="w-4 h-4 text-green-500" />
                        Join as Provider
                      </Link>
                    )}
                    <hr className="my-1 border-slate-100" />
                    <button
                      onClick={() => { setDropdownOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-700 hover:text-green-600 transition-colors px-4 py-2"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-3">
          <Link href="/grounds" className="text-sm font-medium text-slate-700 py-2" onClick={() => setMenuOpen(false)}>
            Browse Grounds
          </Link>
          <Link href="/#how-it-works" className="text-sm font-medium text-slate-700 py-2" onClick={() => setMenuOpen(false)}>
            How It Works
          </Link>
          {session ? (
            <>
              <Link href={dashboardHref} className="text-sm font-medium text-slate-700 py-2" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              {session.user?.role === "USER" && (
                <Link href="/become-provider" className="text-sm font-medium text-green-700 py-2" onClick={() => setMenuOpen(false)}>
                  Join as Provider
                </Link>
              )}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm font-medium text-red-600 text-left py-2">
                Sign out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login" className="text-center text-sm font-medium border border-slate-200 rounded-xl py-2.5 text-slate-700" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link href="/register" className="text-center text-sm font-medium bg-green-600 text-white rounded-xl py-2.5" onClick={() => setMenuOpen(false)}>
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

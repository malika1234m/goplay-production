import Link from "next/link";
import { CalendarCheck, Clock, CheckCircle, XCircle, ChevronRight, MapPin, Star, Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

async function getUserStats(userId: string) {
  const [bookings, recent] = await Promise.all([
    db.facilityBooking.findMany({
      where: { userId },
      select: { status: true },
    }),
    db.facilityBooking.findMany({
      where: { userId },
      include: {
        facility: { select: { name: true, city: true, category: { select: { name: true, icon: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const stats = {
    total:     bookings.length,
    upcoming:  bookings.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
    cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
  };

  return { stats, recent };
}

const statusStyles: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border border-amber-100",
  CONFIRMED: "bg-green-50 text-green-700 border border-green-100",
  COMPLETED: "bg-slate-100 text-slate-600 border border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border border-red-100",
};

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
};

export default async function UserDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { stats, recent } = await getUserStats(session.user.id);

  const statCards = [
    { label: "Total Bookings", value: stats.total,     icon: CalendarCheck, color: "bg-blue-50 text-blue-600" },
    { label: "Upcoming",       value: stats.upcoming,  icon: Clock,         color: "bg-amber-50 text-amber-600" },
    { label: "Completed",      value: stats.completed, icon: CheckCircle,   color: "bg-green-50 text-green-600" },
    { label: "Cancelled",      value: stats.cancelled, icon: XCircle,       color: "bg-red-50 text-red-600" },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, {session.user.name?.split(" ")[0]}!
          </p>
        </div>
        <Link
          href="/grounds"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shrink-0"
        >
          Book a Ground
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">Recent Bookings</h2>
          <Link
            href="/my-bookings"
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="text-5xl mb-3">🏟️</div>
            <p className="text-sm font-medium text-slate-700 mb-1">No bookings yet</p>
            <p className="text-xs text-slate-400 mb-5">
              Your upcoming and past bookings will appear here.
            </p>
            <Link
              href="/grounds"
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors inline-block"
            >
              Browse Grounds
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((b) => {
              const icon =
                b.facility.category.icon ??
                categoryEmoji[b.facility.category.name] ??
                "🏟️";
              return (
                <div key={b.id} className="flex items-center gap-4 px-4 sm:px-6 py-4 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{b.facility.name}</p>
                    <div className="flex flex-wrap items-center gap-x-1 text-xs text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {b.facility.city}
                      <span className="mx-1">·</span>
                      {new Date(b.bookingDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      <span className="mx-1">·</span>
                      {b.startTime} – {b.endTime}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[b.status]}`}>
                      {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      Rs. {b.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/grounds"
          className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-2xl p-6 hover:from-green-700 hover:to-green-800 transition-all"
        >
          <MapPin className="w-8 h-8 mb-3 opacity-80" />
          <h3 className="font-semibold text-lg">Browse Grounds</h3>
          <p className="text-green-100 text-sm mt-1">Find and book a ground near you</p>
        </Link>
        <Link
          href="/my-bookings"
          className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all"
        >
          <CalendarCheck className="w-8 h-8 mb-3 text-green-600" />
          <h3 className="font-semibold text-lg text-slate-900">My Bookings</h3>
          <p className="text-slate-500 text-sm mt-1">View and manage all your bookings</p>
        </Link>
      </div>

      {/* Become a provider banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Own a sports ground?</h3>
            <p className="text-slate-400 text-sm mt-0.5">List your facility on GoPlay and start receiving bookings from players across Sri Lanka.</p>
          </div>
        </div>
        <Link
          href="/become-provider"
          className="shrink-0 bg-green-500 hover:bg-green-400 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Join as Provider
        </Link>
      </div>
    </div>
  );
}

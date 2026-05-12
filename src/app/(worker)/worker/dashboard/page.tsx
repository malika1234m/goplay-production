"use client";

import { useState, useEffect } from "react";
import { Building2, CalendarCheck, Clock, Grid3X3, Loader2, MapPin, Tag, User } from "lucide-react";

interface Facility {
  id: string; name: string; address: string; city: string;
  hourlyRate: number; categories: string[]; ownerName: string;
  courts: { id: string; name: string }[];
  availability: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
}
interface Booking {
  id: string; startTime: string; endTime: string; status: string;
  totalAmount: number; playerName: string; specialRequests: string | null;
  courtName: string | null;
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function WorkerDashboard() {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/worker/facility").then((r) => r.json()).catch(() => ({ error: "Network error." })),
      fetch(`/api/worker/bookings?date=${new Date().toISOString().split("T")[0]}`).then((r) => r.json()).catch(() => ({ bookings: [] })),
    ]).then(([facData, bkData]) => {
      if (facData.error) { setError(facData.error); return; }
      setFacility(facData.facility);
      setBookings(bkData.bookings ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
      <Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading…</span>
    </div>
  );

  if (error || !facility) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">{error || "No facility assigned."}</p>
        <p className="text-slate-400 text-xs mt-1">Contact your facility owner to get assigned.</p>
      </div>
    </div>
  );

  const todayDow   = new Date().getDay();
  const todaySched = facility.availability.find((a) => a.dayOfWeek === todayDow);
  const confirmed  = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pending    = bookings.filter((b) => b.status === "PENDING").length;
  const revenue    = bookings.filter((b) => b.status === "CONFIRMED").reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Today's overview for {facility.name}</p>
      </div>

      {/* Facility card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{facility.name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{facility.address}, {facility.city}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Tag className="w-3 h-3" />{Array.isArray(facility.categories) ? facility.categories.join(", ") : facility.categories}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3 h-3" />Owner: {facility.ownerName}
              </span>
              {facility.courts.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-indigo-600">
                  <Grid3X3 className="w-3 h-3" />
                  {facility.courts.length} court{facility.courts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">Hourly rate</p>
            <p className="text-lg font-bold text-slate-900">Rs. {facility.hourlyRate.toLocaleString()}</p>
          </div>
        </div>

        {/* Today hours */}
        <div className={`mt-4 rounded-xl px-4 py-3 flex items-center gap-3 ${
          todaySched?.isOpen ? "bg-blue-50" : "bg-slate-50"
        }`}>
          <Clock className={`w-4 h-4 ${todaySched?.isOpen ? "text-blue-500" : "text-slate-400"}`} />
          {todaySched?.isOpen ? (
            <p className="text-sm text-blue-700 font-medium">
              Open today · {todaySched.openTime} – {todaySched.closeTime}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Closed today</p>
          )}
        </div>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-2xl font-bold text-slate-900">{confirmed}</p>
          <p className="text-xs text-slate-500 mt-1">Confirmed Today</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-2xl font-bold text-amber-600">{pending}</p>
          <p className="text-xs text-slate-500 mt-1">Pending Today</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-2xl font-bold text-slate-900">Rs. {revenue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Today's Revenue</p>
        </div>
      </div>

      {/* Today's bookings */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Today's Bookings
            <span className="ml-2 text-slate-400 font-normal text-sm">({bookings.length})</span>
          </h2>
          <a href="/worker/bookings" className="text-xs text-blue-600 hover:underline">View all →</a>
        </div>

        {bookings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CalendarCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No bookings today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {bookings.map((b) => (
              <div key={b.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full shrink-0 ${
                    b.status === "CONFIRMED" ? "bg-green-400" :
                    b.status === "PENDING"   ? "bg-amber-400" : "bg-slate-200"
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {b.startTime} – {b.endTime}
                    </p>
                    <p className="text-xs text-slate-400">
                      {b.specialRequests?.startsWith("[Walk-in]")
                        ? b.specialRequests.replace("[Walk-in] ", "Walk-in · ")
                        : b.playerName}
                    </p>
                    {b.courtName && (
                      <span className="mt-0.5 inline-flex items-center text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                        {b.courtName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">Rs. {b.totalAmount.toLocaleString()}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    b.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                    b.status === "PENDING"   ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly schedule */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">Weekly Schedule</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {facility.availability.map((a) => (
            <div key={a.dayOfWeek} className={`px-6 py-3 flex items-center justify-between ${
              a.dayOfWeek === todayDow ? "bg-blue-50" : ""
            }`}>
              <span className={`text-sm font-medium ${a.dayOfWeek === todayDow ? "text-blue-700" : "text-slate-700"}`}>
                {DAYS[a.dayOfWeek]}
                {a.dayOfWeek === todayDow && <span className="ml-2 text-[10px] bg-blue-200 text-blue-700 rounded px-1.5 py-0.5">Today</span>}
              </span>
              {a.isOpen ? (
                <span className="text-xs text-slate-500">{a.openTime} – {a.closeTime}</span>
              ) : (
                <span className="text-xs text-slate-400">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

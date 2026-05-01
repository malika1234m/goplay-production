"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, MapPin } from "lucide-react";

export default function GroundsSearch({
  defaultQ = "",
  defaultCity = "",
}: {
  defaultQ?: string;
  defaultCity?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ]       = useState(defaultQ);
  const [city, setCity] = useState(defaultCity);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q)    params.set("q", q);    else params.delete("q");
    if (city) params.set("city", city); else params.delete("city");
    router.push(`/grounds?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mt-5">
      <div className="flex items-center gap-3 flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ground name..."
          className="bg-transparent text-slate-900 placeholder-slate-400 text-sm w-full outline-none"
        />
      </div>
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl sm:w-48 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition">
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="bg-transparent text-slate-900 placeholder-slate-400 text-sm w-full outline-none"
        />
      </div>
      <button
        type="submit"
        className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Search
      </button>
    </form>
  );
}

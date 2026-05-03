"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search, MapPin } from "lucide-react";

export default function HomeSearch() {
  const router = useRouter();
  const [q, setQ]       = useState("");
  const [city, setCity] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim())    params.set("q",    q.trim());
    if (city.trim()) params.set("city", city.trim());
    router.push(`/grounds${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-2xl"
    >
      <div className="flex items-center gap-3 flex-1 px-4 py-2 bg-slate-50 rounded-xl">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by sport or ground name..."
          className="bg-transparent text-slate-900 placeholder-slate-400 text-sm w-full outline-none"
        />
      </div>
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl sm:w-44">
        <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
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
        className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shrink-0"
      >
        Search
      </button>
    </form>
  );
}

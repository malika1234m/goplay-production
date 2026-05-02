import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Search, MapPin, Star, Clock, Shield, ChevronRight,
  Zap, Users, CheckCircle, LifeBuoy, Building2,
} from "lucide-react";

const categories = [
  { name: "Cricket",    emoji: "🏏", color: "bg-orange-50 text-orange-700 border-orange-100" },
  { name: "Football",   emoji: "⚽", color: "bg-green-50 text-green-700 border-green-100" },
  { name: "Basketball", emoji: "🏀", color: "bg-amber-50 text-amber-700 border-amber-100" },
  { name: "Tennis",     emoji: "🎾", color: "bg-lime-50 text-lime-700 border-lime-100" },
  { name: "Badminton",  emoji: "🏸", color: "bg-sky-50 text-sky-700 border-sky-100" },
  { name: "Volleyball", emoji: "🏐", color: "bg-purple-50 text-purple-700 border-purple-100" },
];

const features = [
  {
    icon: Search,
    title: "Find Nearby Grounds",
    desc: "Search by sport, city, or price range. Real-time availability.",
  },
  {
    icon: Zap,
    title: "Instant Booking",
    desc: "Book a slot in under 2 minutes. No phone calls, no waiting.",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    desc: "Your booking is confirmed instantly. Easy refunds if cancelled.",
  },
];

const steps = [
  { num: "01", title: "Search", desc: "Enter your sport and city to browse available grounds." },
  { num: "02", title: "Select a slot", desc: "Pick the date and time that works for you." },
  { num: "03", title: "Book & Play", desc: "Confirm your booking and head to the ground. That's it." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-950 text-white py-14 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 sm:mb-6">
              Book Sports Grounds{" "}
              <span className="text-green-400">Instantly</span>
            </h1>
            <p className="text-base sm:text-xl text-slate-300 mb-8 sm:mb-10 leading-relaxed">
              Find the best cricket, football, tennis and more grounds near you.
              Real-time availability, instant confirmation.
            </p>

            {/* Search bar */}
            <div className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-2xl">
              <div className="flex items-center gap-3 flex-1 px-4 py-2 bg-slate-50 rounded-xl">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by sport or ground name..."
                  className="bg-transparent text-slate-900 placeholder-slate-400 text-sm w-full outline-none"
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl sm:w-44">
                <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="City"
                  className="bg-transparent text-slate-900 placeholder-slate-400 text-sm w-full outline-none"
                />
              </div>
              <Link
                href="/grounds"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shrink-0 text-center"
              >
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Browse by Sport</h2>
            <p className="text-slate-500 mt-1 text-sm">Find grounds for your favourite sport</p>
          </div>
          <Link href="/grounds" className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 shrink-0">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/grounds?category=${cat.name.toLowerCase()}`}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${cat.color} hover:shadow-md transition-all hover:-translate-y-0.5`}
            >
              <span className="text-3xl">{cat.emoji}</span>
              <span className="text-sm font-medium">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900">Why GoPlay?</h2>
            <p className="text-slate-500 mt-2 text-sm">Everything you need to book the perfect game</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900">How It Works</h2>
          <p className="text-slate-500 mt-2 text-sm">Book a ground in 3 simple steps</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.num} className="flex flex-col items-center text-center relative">
              <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg shadow-green-200">
                {step.num}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-0.5 bg-slate-200" />
              )}
              <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Support strip */}
      <section className="bg-white border-y border-slate-100 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center shrink-0">
                <LifeBuoy className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Have questions? We have answers.</p>
                <p className="text-sm text-slate-500 mt-0.5">From booking your first ground to running a full facility — our support center covers it all.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/support#become-owner"
                className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-green-500 hover:text-green-600 transition-colors bg-white"
              >
                <Building2 className="w-4 h-4" /> Facility Owner Guide
              </Link>
              <Link
                href="/support"
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                Support Center <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — Ground Owner */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Own a Sports Ground?</h2>
          <p className="text-green-100 mb-8 text-lg">
            List your facility on GoPlay and reach thousands of players in your city.
            Free to join, easy to manage.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register?role=ground_owner"
              className="bg-white text-green-700 font-semibold px-8 py-3 rounded-xl hover:bg-green-50 transition-colors"
            >
              List Your Ground — Free
            </Link>
            <Link
              href="/grounds"
              className="border border-white/50 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              Browse as Player
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-green-100 text-sm">
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> No listing fee</span>
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Easy dashboard</span>
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> 24/7 support</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

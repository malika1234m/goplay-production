import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HomeSearch from "@/components/home/HomeSearch";
import HeroImageSlider from "@/components/home/HeroImageSlider";
import ListGroundButton from "@/components/home/ListGroundButton";
import {
  Search, Star, Clock, Shield, ChevronRight,
  Zap, Users, CheckCircle, LifeBuoy, Building2,
} from "lucide-react";

const categories = [
  { name: "Cricket",    image: "/sports/cricket.png"    },
  { name: "Football",   image: "/sports/football.png"   },
  { name: "Basketball", image: "/sports/basketball.png" },
  { name: "Tennis",     image: "/sports/tennis.png"     },
  { name: "Badminton",  image: "/sports/badminton.png"  },
  { name: "Volleyball", image: "/sports/volleyball.png" },
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
      <section className="relative overflow-hidden text-white py-12 sm:py-20 lg:py-24 px-4 min-h-[480px] sm:min-h-[580px] flex items-center">

        {/* Full-bleed background slider */}
        <div className="absolute inset-0">
          <HeroImageSlider />
        </div>

        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/70 to-green-950/60" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6">
              Book Sports Grounds{" "}
              <span className="text-green-400">Instantly</span>
            </h1>
            <p className="text-sm sm:text-xl text-slate-300 mb-6 sm:mb-10 leading-relaxed">
              Find the best cricket, football, tennis and more grounds near you.
              Real-time availability, instant confirmation.
            </p>
            <HomeSearch />
          </div>
        </div>

      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Browse by Sport</h2>
            <p className="text-slate-500 mt-1 text-xs sm:text-sm">Find grounds for your favourite sport</p>
          </div>
          <Link href="/grounds" className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 shrink-0">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {/* Mobile: 3-column grid — compact, all 6 visible in 2 rows */}
        <div className="sm:hidden grid grid-cols-3 gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/grounds?category=${cat.name.toLowerCase()}`}
              className="relative overflow-hidden rounded-xl aspect-[2/3] shadow-md active:opacity-90 transition-opacity"
            >
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                sizes="33vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-2 py-2">
                <span className="text-white text-xs font-bold tracking-wide drop-shadow">
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop: horizontal floating scroll */}
        <div className="hidden sm:flex gap-4 overflow-x-auto py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/grounds?category=${cat.name.toLowerCase()}`}
              className="group relative flex-shrink-0 w-52 h-72 overflow-hidden rounded-2xl shadow-lg transition-all duration-300 ease-out hover:scale-110 hover:shadow-2xl hover:z-10 z-0"
            >
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                sizes="208px"
                className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-4 py-4">
                <span className="text-white text-base font-bold tracking-wide drop-shadow">
                  {cat.name}
                </span>
                <p className="text-white/70 text-xs mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Book a slot →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Why GoPlay?</h2>
            <p className="text-slate-500 mt-2 text-sm">Everything you need to book the perfect game</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:shadow-md transition-shadow flex sm:flex-col items-start gap-4 sm:gap-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center sm:mb-4 shrink-0">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1 sm:mb-2">{title}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">How It Works</h2>
          <p className="text-slate-500 mt-2 text-sm">Book a ground in 3 simple steps</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          {steps.map((step, i) => (
            <div key={step.num} className="flex flex-col items-center text-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white text-lg sm:text-2xl font-bold mb-3 sm:mb-4 shadow-lg shadow-green-200">
                {step.num}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-0.5 bg-slate-200" />
              )}
              <h3 className="text-xs sm:text-base font-semibold text-slate-900 mb-1 sm:mb-2">{step.title}</h3>
              <p className="hidden sm:block text-sm text-slate-500 leading-relaxed max-w-xs">{step.desc}</p>
              <p className="sm:hidden text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Support strip */}
      <section className="bg-white border-y border-slate-100 py-8 sm:py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center shrink-0">
                <LifeBuoy className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm sm:text-base">Have questions? We have answers.</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">From booking your first ground to running a full facility — our support center covers it all.</p>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
              <Link
                href="/support#become-owner"
                className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-green-500 hover:text-green-600 transition-colors bg-white"
              >
                <Building2 className="w-4 h-4" /> Facility Owner Guide
              </Link>
              <Link
                href="/support"
                className="flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                Support Center <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — Ground Owner */}
      <section className="relative overflow-hidden min-h-[580px] sm:min-h-[640px] flex items-center px-4">
        {/* background image */}
        <Image
          src="/sports/goplay-ground.png"
          alt="GoPlay Sports Ground"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />
        {/* light green overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/60 to-green-800/40" />

        <div className="relative z-10 w-full max-w-3xl mx-auto text-center text-white px-2 sm:px-0">
          {/* frosted card behind all content */}
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl sm:rounded-3xl px-5 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14 ring-1 ring-white/10 shadow-2xl">

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-5 drop-shadow-lg">
              Own a Sports Ground?
            </h2>
            <p className="text-white text-sm sm:text-lg lg:text-xl font-medium mb-6 sm:mb-10 leading-relaxed drop-shadow">
              List your facility on GoPlay and reach thousands of players in your city.
              Free to join, easy to manage.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 sm:mb-10">
              <ListGroundButton />
              <Link
                href="/grounds"
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/60 text-white font-bold px-8 sm:px-10 py-3 sm:py-4 rounded-xl transition-colors text-sm sm:text-base"
              >
                Browse as Player
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-2 sm:gap-y-3 text-white font-semibold text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 sm:gap-2 drop-shadow"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> No listing fee</span>
              <span className="flex items-center gap-1.5 sm:gap-2 drop-shadow"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> Easy dashboard</span>
              <span className="flex items-center gap-1.5 sm:gap-2 drop-shadow"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> 24/7 support</span>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Target, Users, Zap, ShieldCheck, MapPin, Mail, Phone } from "lucide-react";

export const metadata = { title: "About Us — GoPlay" };

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full mb-6 uppercase tracking-widest">
            Our Story
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight">
            Making Sports Accessible <br className="hidden sm:block" />
            <span className="text-green-400">Across Sri Lanka</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto">
            GoPlay was built on a simple belief — finding and booking a sports ground should be as easy
            as ordering food online. We connect players with facilities, so more people can play more often.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-8">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-5">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Our Mission</h2>
            <p className="text-slate-600 leading-relaxed">
              To make sports grounds discoverable, bookable, and manageable for everyone — from weekend
              players looking for a court to facility owners who want to grow their business without the paperwork.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-5">
              <Zap className="w-6 h-6 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Our Vision</h2>
            <p className="text-slate-600 leading-relaxed">
              A Sri Lanka where every sports enthusiast can find a ground near them in under 60 seconds,
              and every facility owner can run a fully digital operation — bookings, payments, and staff — from one dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-slate-50 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">What We Stand For</h2>
            <p className="text-slate-500 max-w-xl mx-auto">The principles that guide everything we build.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, title: "Community First", desc: "We build for players, coaches, and ground owners — the real backbone of Sri Lankan sport.", color: "blue" },
              { icon: ShieldCheck, title: "Trust & Safety", desc: "Every transaction is secure. Every booking is confirmed. No surprises, no hidden fees.", color: "green" },
              { icon: Zap, title: "Simplicity", desc: "If it takes more than three taps, we haven't done our job. Simplicity is our north star.", color: "amber" },
              { icon: MapPin, title: "Local Focus", desc: "We're built for Sri Lanka — our language, our grounds, our sport culture.", color: "purple" },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  color === "blue"   ? "bg-blue-50"   :
                  color === "green"  ? "bg-green-50"  :
                  color === "amber"  ? "bg-amber-50"  : "bg-purple-50"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    color === "blue"   ? "text-blue-600"   :
                    color === "green"  ? "text-green-600"  :
                    color === "amber"  ? "text-amber-600"  : "text-purple-600"
                  }`} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "500+", label: "Bookings Made" },
            { value: "20+",  label: "Facilities Listed" },
            { value: "9",    label: "Cities Covered" },
            { value: "4.8★", label: "Average Rating" },
          ].map(({ value, label }) => (
            <div key={label} className="bg-slate-50 rounded-2xl border border-slate-100 py-8 px-4">
              <p className="text-3xl font-extrabold text-green-600 mb-1">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Get in Touch</h2>
          <p className="text-green-100 mb-8">Have a question, partnership idea, or want to list your facility? We'd love to hear from you.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm font-medium">
            <a href="mailto:malikanishnatha4@gmail.com" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-3 rounded-xl transition-colors">
              <Mail className="w-4 h-4" /> malikanishnatha4@gmail.com
            </a>
            <a href="tel:+94740984416" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-3 rounded-xl transition-colors">
              <Phone className="w-4 h-4" /> +94 74 098 4416
            </a>
          </div>
          <div className="mt-8">
            <Link href="/support" className="inline-block bg-white text-green-700 font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors">
              Visit Support Center
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

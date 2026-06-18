import Link from "next/link";
import {
  LifeBuoy, UserPlus, Building2, Users,
  Mail, Phone, Zap,
} from "lucide-react";

export const metadata = { title: "Support Center — GoPlay" };

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">
        {number}
      </div>
      <div className="pt-1">
        <p className="font-semibold text-slate-900 mb-1">{title}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="bg-slate-50 min-h-screen">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <LifeBuoy className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Support Center</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto">
            Everything you need to know about using GoPlay — from booking your first ground to managing a full facility operation.
          </p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-3 text-sm font-medium">
          {[
            { href: "#become-owner",    label: "Become a Facility Owner" },
            { href: "#add-workers",     label: "Add Workers" },
            { href: "#players",         label: "For Players" },
            { href: "#goplay-connect",  label: "GoPlay Connect" },
            { href: "#contact",         label: "Contact" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="shrink-0 px-4 py-1.5 rounded-full text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors">
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">

        {/* ── Become a Facility Owner ── */}
        <section id="become-owner">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">How to Become a Facility Owner</h2>
              <p className="text-sm text-slate-500">Get your sports ground listed on GoPlay in 4 steps.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step
              number={1}
              title="Create a GoPlay Account"
              desc="Go to goplay.lk/register and create a regular player account with your name, email, phone, and password."
            />
            <Step
              number={2}
              title="Apply as a Provider"
              desc={`Log in and go to your dashboard. Scroll to the bottom and click "Join as Provider". Fill in a 3-step application form with your personal details and facility information.`}
            />
            <Step
              number={3}
              title="Get Approved"
              desc="Once approved, your facility status changes from Pending to Active and it becomes publicly visible on the Browse Grounds page. You will receive an email notification when this happens."
            />
            <Step
              number={4}
              title="Start Receiving Bookings"
              desc="Players can now find and book your facility online. All bookings appear in your Ground Owner Dashboard under the Bookings section. You can also add walk-in bookings manually."
            />
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-800">
            <strong>Tip:</strong> Adding high-quality photos and filling in all amenities significantly increases your booking rate. Facilities with 3+ photos get 2× more views.
          </div>
        </section>

        {/* ── Add Workers ── */}
        <section id="add-workers">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Adding Workers to Your Facility</h2>
              <p className="text-sm text-slate-500">Assign ground-level staff who can manage bookings on-site.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step
              number={1}
              title="The Worker Creates Their Account"
              desc="Your staff member registers a regular player account at goplay.lk/register. Once their account exists, you can link them to your facility from your dashboard."
            />
            <Step
              number={2}
              title="You Assign Them to Your Facility"
              desc={`In your Ground Owner Dashboard, go to Settings → Workers. Enter the worker's registered email address and click "Add Worker". The worker is immediately linked to your facility.`}
            />
            <Step
              number={3}
              title="Worker Logs In and Starts Working"
              desc="The worker logs in and sees the facility data on their Worker Dashboard. They can view the daily schedule, add walk-in bookings, and see upcoming sessions — but cannot modify facility settings."
            />
          </div>
        </section>

        {/* ── For Players ── */}
        <section id="players">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">For Players — How to Book</h2>
              <p className="text-sm text-slate-500">From browsing to playing in 4 easy steps.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step number={1} title="Find a Ground" desc={`Go to Browse Grounds, filter by sport, city, or use "Near Me" to find facilities close to your location. Click on any ground to see photos, pricing, reviews, and opening hours.`} />
            <Step number={2} title="Choose a Time Slot" desc="On the facility page, select the date you want. Available hourly slots are shown in green — blocked or booked slots are greyed out. Click a slot to select it." />
            <Step number={3} title="Pay & Confirm" desc="Enter your contact number and any special requests. Proceed to payment via PayHere (card or online banking). Your booking is confirmed instantly." />
            <Step number={4} title="Show Up & Play" desc="Your confirmed booking appears under My Bookings in your dashboard. Show up at the facility at your booked time. Staff can verify your booking by name or booking reference." />
          </div>
        </section>

        {/* ── GoPlay Connect ── */}
        <section id="goplay-connect">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">GoPlay Connect — Open Matches</h2>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">New</span>
              </div>
              <p className="text-sm text-slate-500">Play without a full team — we find the players for you.</p>
            </div>
          </div>

          {/* What is it */}
          <div className="bg-green-50 border border-green-100 rounded-2xl px-7 py-6 mb-6">
            <p className="text-slate-700 text-sm leading-relaxed">
              <strong className="text-slate-900">GoPlay Connect</strong> lets you create or join an <em>open match lobby</em> for any sport.
              Once enough players have reserved spots to fill the court, GoPlay automatically confirms the booking for everyone in the lobby.
              You don't need to know anyone in advance — just pick your sport, ground, and time, and we find your teammates.
            </p>
          </div>

          {/* How to join a lobby */}
          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7 mb-6">
            <h3 className="text-base font-semibold text-slate-900 -mb-2">How to Join an Open Match</h3>
            <Step
              number={1}
              title="Browse Open Lobbies"
              desc={`Click "Find a Match" in the navigation bar. You'll see all active lobbies filtered by sport, city, and date. You can also find lobbies directly on a facility's booking page — they show as green banners on the time slot grid.`}
            />
            <Step
              number={2}
              title="Reserve Your Spot"
              desc="Open a lobby and tap Join. Select how many spots you need (1 for solo, more for a group arriving together). Your spot is reserved instantly and you'll receive a confirmation notification."
            />
            <Step
              number={3}
              title="Wait for the Lobby to Fill"
              desc="Other players will join as the lobby fills. You'll get notified as spots are taken. If the lobby doesn't fill before the expiry deadline, it expires automatically and no payment is collected."
            />
            <Step
              number={4}
              title="Court Auto-Booked — Just Show Up"
              desc="The moment the last spot is taken, GoPlay automatically confirms the court booking for everyone in the lobby. You'll receive a notification with the full booking details. Just show up and play."
            />
          </div>

          {/* How to create a lobby */}
          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7 mb-6">
            <h3 className="text-base font-semibold text-slate-900 -mb-2">How to Create an Open Match Lobby</h3>
            <Step
              number={1}
              title="Go to Find a Match"
              desc={`From the navigation bar, click "Find a Match". On the Open Matches page, click "Create a Lobby".`}
            />
            <Step
              number={2}
              title="Pick Your Details"
              desc="Select the sport, facility, date, and preferred time slot. The system will show you how many players are needed to fill a standard match for that sport. You can also set a custom number of spots."
            />
            <Step
              number={3}
              title="Reserve Your Own Spot"
              desc="As the creator, you automatically reserve at least one spot. Your lobby becomes visible to other players instantly and they can join from the Browse Lobbies page or the facility's booking calendar."
            />
            <Step
              number={4}
              title="Share the Lobby"
              desc="Copy the lobby link and share it with friends or your sports group to fill it faster. GoPlay also surfaces your lobby to players searching for that sport in the same area."
            />
          </div>

          <div className="mt-4">
            <Link
              href="/open-matches"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" /> Browse Open Lobbies
            </Link>
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-white p-10 text-center">
          <h2 className="text-2xl font-bold mb-2">Still Need Help?</h2>
          <p className="text-green-100 text-sm mb-8 max-w-md mx-auto">
            Can't find what you're looking for? Our support team is here to help you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:official.goplay.support@gmail.com"
              className="flex items-center gap-2 bg-white text-green-700 font-semibold px-5 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm"
            >
              <Mail className="w-4 h-4" /> official.goplay.support@gmail.com
            </a>
            <a
              href="tel:+94740984416"
              className="flex items-center gap-2 bg-white/10 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              <Phone className="w-4 h-4" /> +94 74 098 4416
            </a>
          </div>
          <p className="mt-6 text-xs text-green-200">Monday – Friday · 9 AM – 6 PM Sri Lanka Time</p>
        </section>

      </div>
    </div>
  );
}

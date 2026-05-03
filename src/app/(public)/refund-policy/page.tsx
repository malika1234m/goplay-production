import Link from "next/link";
import { RefreshCcw } from "lucide-react";

export const metadata = { title: "Refund & Return Policy — GoPlay" };

const LAST_UPDATED = "3 May 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <RefreshCcw className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Refund &amp; Return Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10">

          <p className="text-sm text-slate-600 leading-relaxed mb-10">
            This Refund &amp; Return Policy explains how GoPlay handles cancellations and refunds for
            sports ground bookings made through <strong>goplay.lk</strong>. Please read this carefully
            before making a booking. By completing a booking you agree to the terms below.
          </p>

          <Section title="1. Nature of Our Service">
            <p>
              GoPlay is an online booking platform for sports grounds. All bookings are for a specific
              facility, date, and time slot. Because bookings reserve a physical time slot, our refund
              policy reflects the time-sensitive nature of these reservations.
            </p>
          </Section>

          <Section title="2. Cash on Arrival Bookings">
            <p>
              If you selected <strong>Cash on Arrival</strong> as your payment method, no payment is
              taken through GoPlay. You pay directly at the facility on the day of your booking.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>No refund is applicable as no payment was collected online.</li>
              <li>If you cancel a cash booking, your slot is simply released with no financial impact.</li>
              <li>You can cancel a pending cash booking at any time from your GoPlay dashboard.</li>
            </ul>
          </Section>

          <Section title="3. Online Payment Bookings">
            <p>
              If you paid online through GoPlay via PayHere, the following refund terms apply based
              on when you cancel:
            </p>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Cancellation Time</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3">More than 24 hours before the booking</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Full refund</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3">Between 12 and 24 hours before the booking</td>
                    <td className="px-4 py-3 text-amber-700 font-medium">50% refund</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Less than 12 hours before the booking</td>
                    <td className="px-4 py-3 text-red-600 font-medium">No refund</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3">Cancelled by the facility owner</td>
                    <td className="px-4 py-3 text-green-700 font-medium">Full refund</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="4. How to Cancel a Booking">
            <p>To cancel a booking:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Log in to your GoPlay account at <strong>goplay.lk</strong></li>
              <li>Go to <strong>My Bookings</strong></li>
              <li>Find the booking and click <strong>Cancel Booking</strong></li>
              <li>The refund (if applicable) will be processed automatically</li>
            </ul>
            <p>
              You will receive an email confirmation of your cancellation. If you are unable to cancel
              through the platform, contact our support team immediately.
            </p>
          </Section>

          <Section title="5. Refund Processing">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Approved refunds are processed within <strong>5–7 business days</strong></li>
              <li>Refunds are returned to the original payment method used at checkout</li>
              <li>GoPlay will send a confirmation email once the refund has been initiated</li>
              <li>Depending on your bank, it may take an additional 3–5 days to appear in your account</li>
            </ul>
          </Section>

          <Section title="6. Facility Owner Cancellations">
            <p>
              If a facility owner cancels a confirmed booking, you are entitled to a <strong>full
              refund</strong> regardless of how close to the booking date the cancellation occurs.
              GoPlay will initiate the refund immediately and notify you by email.
            </p>
          </Section>

          <Section title="7. No-Show Policy">
            <p>
              If you do not show up for a confirmed booking without cancelling in advance, the booking
              will be marked as completed and no refund will be issued. We encourage all players to
              cancel as early as possible to free up the slot for other players.
            </p>
          </Section>

          <Section title="8. Disputes">
            <p>
              If you believe a refund has been incorrectly denied or not received within the stated
              timeframe, please contact our support team with your booking ID and we will investigate
              within 3 business days.
            </p>
          </Section>

          <Section title="9. Contact Us">
            <p>For any refund-related queries, reach out to our support team:</p>
            <ul className="list-none space-y-1.5">
              <li>📧 <a href="mailto:malikanishnatha4@gmail.com" className="text-green-600 hover:underline">malikanishnatha4@gmail.com</a></li>
              <li>🌐 <Link href="/support" className="text-green-600 hover:underline">goplay.lk/support</Link></li>
            </ul>
          </Section>

        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-green-600 transition-colors">Privacy Policy</Link>
          <span className="mx-3">·</span>
          <Link href="/terms" className="hover:text-green-600 transition-colors">Terms of Service</Link>
          <span className="mx-3">·</span>
          <Link href="/support" className="hover:text-green-600 transition-colors">Support Center</Link>
        </div>
      </div>
    </div>
  );
}

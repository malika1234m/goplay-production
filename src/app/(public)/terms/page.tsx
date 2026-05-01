import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = { title: "Terms of Service — GoPlay" };

const LAST_UPDATED = "1 May 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <FileText className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10">

          <p className="text-sm text-slate-600 leading-relaxed mb-10">
            Please read these Terms of Service carefully before using GoPlay. By accessing or using our platform,
            you agree to be bound by these terms. If you do not agree, please do not use GoPlay.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>By creating an account or making a booking on GoPlay, you confirm that you are at least 18 years of age (or have the consent of a parent/guardian) and that you accept these Terms of Service in full.</p>
          </Section>

          <Section title="2. User Accounts">
            <p>You are responsible for maintaining the confidentiality of your account credentials. You must not share your account with others or allow unauthorized access. GoPlay reserves the right to suspend or terminate accounts that violate these terms.</p>
            <p>You agree to provide accurate and up-to-date information during registration. Providing false information may result in immediate account termination.</p>
          </Section>

          <Section title="3. Booking Policy">
            <p><strong>Confirmed bookings:</strong> A booking is confirmed once payment is completed (online) or marked as confirmed by the facility (walk-in). You will receive an email/notification confirmation.</p>
            <p><strong>Cancellations by users:</strong> Cancellation policies are set by individual facilities. Please review the facility's cancellation terms before booking. GoPlay is not liable for any facility-imposed cancellation fees.</p>
            <p><strong>No-shows:</strong> If you do not show up for a confirmed booking, the booking amount may be forfeited depending on the facility's policy.</p>
            <p><strong>Modifications:</strong> Time-slot changes are subject to availability and must be made within the platform. GoPlay does not guarantee availability of alternative slots.</p>
          </Section>

          <Section title="4. Payments">
            <p>All prices displayed on GoPlay are in Sri Lankan Rupees (LKR) inclusive of applicable taxes. Payments are processed securely via PayHere. GoPlay does not store card or bank account information.</p>
            <p>In the event of a payment failure, your booking will not be confirmed. Please retry or contact support.</p>
            <p><strong>Refunds:</strong> Refund eligibility is determined by the facility's cancellation policy and, where applicable, the GoPlay refund policy. Approved refunds are processed within 5–7 business days.</p>
          </Section>

          <Section title="5. Facility Owner Obligations">
            <p>By listing a facility on GoPlay, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide accurate and truthful information about your facility, pricing, and availability</li>
              <li>Honor all confirmed bookings made through the platform</li>
              <li>Maintain the facility in a safe and clean condition suitable for the listed sports</li>
              <li>Promptly notify GoPlay of any changes that affect bookings (closures, pricing changes, etc.)</li>
              <li>Comply with all applicable local laws, permits, and safety regulations</li>
            </ul>
            <p>GoPlay reserves the right to suspend or remove any facility listing that receives consistent negative reviews, unresolved complaints, or violates these terms.</p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Make fraudulent or speculative bookings</li>
              <li>Use the platform for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the platform</li>
              <li>Post false, misleading, or defamatory reviews</li>
              <li>Engage in abusive, threatening, or discriminatory behavior toward other users, facility staff, or GoPlay staff</li>
              <li>Scrape, copy, or redistribute platform data without permission</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>All content on the GoPlay platform — including the logo, design, code, and text — is the property of GoPlay and protected by copyright. You may not reproduce, distribute, or create derivative works without written permission.</p>
            <p>By uploading photos or content to GoPlay, you grant us a non-exclusive, royalty-free license to display that content on our platform.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>GoPlay acts as an intermediary platform connecting players with facility owners. We are not responsible for:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The condition or safety of any listed facility</li>
              <li>Disputes between users and facility owners</li>
              <li>Injuries, damages, or losses sustained at a facility</li>
              <li>Service interruptions or data loss beyond our reasonable control</li>
            </ul>
            <p>To the fullest extent permitted by law, GoPlay's total liability for any claim shall not exceed the amount paid by you for the specific booking giving rise to the claim.</p>
          </Section>

          <Section title="9. Termination">
            <p>GoPlay may suspend or terminate your access at any time for violation of these terms. You may close your account at any time by contacting us. Termination does not affect any bookings already confirmed prior to the termination date.</p>
          </Section>

          <Section title="10. Governing Law">
            <p>These Terms of Service are governed by and construed in accordance with the laws of Sri Lanka. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Sri Lanka.</p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>We may update these Terms from time to time. We will notify registered users by email at least 7 days before significant changes take effect. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these Terms of Service:</p>
            <ul className="list-none space-y-1.5">
              <li>📧 <a href="mailto:malikanishnatha4@gmail.com" className="text-green-600 hover:underline">malikanishnatha4@gmail.com</a></li>
              <li>📞 <a href="tel:+94740984416" className="text-green-600 hover:underline">+94 74 098 4416</a></li>
            </ul>
          </Section>

        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-green-600 transition-colors">Privacy Policy</Link>
          <span className="mx-3">·</span>
          <Link href="/support" className="hover:text-green-600 transition-colors">Support Center</Link>
        </div>
      </div>
    </div>
  );
}

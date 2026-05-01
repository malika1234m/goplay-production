import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Privacy Policy — GoPlay" };

const LAST_UPDATED = "1 May 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10">

          <p className="text-sm text-slate-600 leading-relaxed mb-10">
            GoPlay ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy
            explains what data we collect, how we use it, and your rights regarding that data when you use our
            platform at <strong>goplay.lk</strong>.
          </p>

          <Section title="1. Information We Collect">
            <p><strong>Account information:</strong> When you register, we collect your name, email address, phone number, and password (stored as a secure hash).</p>
            <p><strong>Booking information:</strong> When you make a booking, we collect the date, time, facility, payment method, and any special requests you provide.</p>
            <p><strong>Payment information:</strong> We do not store card details. Payments are processed securely through PayHere. We only store transaction reference numbers and status.</p>
            <p><strong>Usage data:</strong> We collect standard server logs including IP address, browser type, pages visited, and timestamps to help diagnose issues and improve the service.</p>
            <p><strong>Location data:</strong> If you use the "Near Me" feature, your browser shares your approximate GPS coordinates with us temporarily to show nearby facilities. This is not stored on our servers.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Create and manage your account</li>
              <li>Process and confirm bookings</li>
              <li>Send booking confirmation and reminder notifications</li>
              <li>Enable facility owners and workers to manage their operations</li>
              <li>Resolve disputes and provide customer support</li>
              <li>Improve platform features and performance</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do <strong>not</strong> sell your personal data to third parties.</p>
          </Section>

          <Section title="3. Sharing Your Information">
            <p>We share your information only in the following limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Facility owners and workers:</strong> When you book a ground, the facility owner and their assigned workers can see your name, contact number, and booking details.</li>
              <li><strong>Payment processors:</strong> PayHere receives the minimum required data to process your payment.</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or to protect the rights and safety of our users.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <p>We retain your account data for as long as your account is active. Booking records are archived after 2 years but retained for financial and legal compliance purposes. You may request deletion of your account at any time (see Section 7).</p>
          </Section>

          <Section title="5. Cookies">
            <p>We use session cookies to keep you logged in and preference cookies to remember your settings. We do not use advertising or tracking cookies from third parties. You can disable cookies in your browser settings, but some features of the platform may not function correctly.</p>
          </Section>

          <Section title="6. Security">
            <p>We use industry-standard security measures including HTTPS encryption, hashed passwords, and access-controlled databases. While we take every reasonable precaution, no system is completely immune to breaches. We will notify you promptly if your data is ever compromised.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:malikanishnatha4@gmail.com" className="text-green-600 hover:underline">malikanishnatha4@gmail.com</a>.</p>
          </Section>

          <Section title="8. Third-Party Links">
            <p>Our platform may contain links to external websites (e.g. Google Maps directions). We are not responsible for the privacy practices of those websites and encourage you to review their policies separately.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify registered users by email and update the "Last updated" date at the top of this page. Continued use of GoPlay after changes constitutes your acceptance of the updated policy.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>If you have any questions or concerns about this Privacy Policy, please reach out:</p>
            <ul className="list-none space-y-1.5">
              <li>📧 <a href="mailto:malikanishnatha4@gmail.com" className="text-green-600 hover:underline">malikanishnatha4@gmail.com</a></li>
              <li>📞 <a href="tel:+94740984416" className="text-green-600 hover:underline">+94 74 098 4416</a></li>
            </ul>
          </Section>

        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <Link href="/terms" className="hover:text-green-600 transition-colors">Terms of Service</Link>
          <span className="mx-3">·</span>
          <Link href="/support" className="hover:text-green-600 transition-colors">Support Center</Link>
        </div>
      </div>
    </div>
  );
}

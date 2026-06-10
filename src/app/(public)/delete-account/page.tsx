import Link from "next/link";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Delete Account — GoPlay" };

const LAST_UPDATED = "10 June 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Delete Your Account</h1>
          <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10">

          <p className="text-sm text-slate-600 leading-relaxed mb-10">
            GoPlay ("we", "our", or "us") lets you request deletion of your account and the personal
            data associated with it at any time. This page explains how to make a request, what data
            is removed, and what is retained.
          </p>

          <Section title="1. How to Request Account Deletion">
            <p>To request deletion of your GoPlay account:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Send an email to <a href="mailto:official.goplay.support@gmail.com" className="text-green-600 hover:underline">official.goplay.support@gmail.com</a> from the email address registered on your account.</li>
              <li>Use the subject line <strong>&quot;Account Deletion Request&quot;</strong>.</li>
              <li>Include your full name and registered phone number so we can verify your identity.</li>
              <li>We will confirm your request by email and process the deletion within <strong>30 days</strong>.</li>
            </ol>
          </Section>

          <Section title="2. What Gets Deleted">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your name, email address, phone number, and password</li>
              <li>Your profile and business details (for facility owners and workers)</li>
              <li>Saved preferences and notification settings</li>
            </ul>
          </Section>

          <Section title="3. What We Retain (and Why)">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Booking and payment records:</strong> retained for up to 2 years after account deletion to comply with financial and legal record-keeping obligations.</li>
              <li><strong>Reviews:</strong> any reviews you&apos;ve posted are anonymized (your name removed) rather than deleted, so facility ratings remain accurate for other users.</li>
            </ul>
          </Section>

          <Section title="4. Deleting Specific Data Without Closing Your Account">
            <p>
              If you&apos;d like specific data removed without deleting your whole account — for example,
              a single review or your saved location — email{" "}
              <a href="mailto:official.goplay.support@gmail.com" className="text-green-600 hover:underline">official.goplay.support@gmail.com</a>{" "}
              describing what you&apos;d like removed, and we&apos;ll process it within 30 days.
            </p>
          </Section>

          <Section title="5. Contact Us">
            <p>For any account deletion queries, reach out to our support team:</p>
            <ul className="list-none space-y-1.5">
              <li>📧 <a href="mailto:official.goplay.support@gmail.com" className="text-green-600 hover:underline">official.goplay.support@gmail.com</a></li>
              <li>📞 <a href="tel:+94740984416" className="text-green-600 hover:underline">+94 74 098 4416</a></li>
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

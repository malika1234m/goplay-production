import Link from "next/link";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-green-950 via-teal-950 to-blue-950 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image src="/logo.jpeg" alt="GoPlay" width={36} height={36} className="rounded-lg object-contain bg-white" />
              <span className="text-xl font-bold text-white">
                Go<span className="text-green-400">Play</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs text-slate-400">
              The easiest way to find and book sports grounds near you. Play more, worry less.
            </p>
            <div className="flex flex-col gap-2 mt-6 text-sm">
              <a href="mailto:official.goplay.support@gmail.com" className="flex items-center gap-2 hover:text-green-400 transition-colors">
                <Mail className="w-4 h-4 text-blue-400" /> official.goplay.support@gmail.com
              </a>
              <a href="tel:+94740984416" className="flex items-center gap-2 hover:text-green-400 transition-colors">
                <Phone className="w-4 h-4 text-blue-400" /> +94 74 098 4416
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-green-400 text-sm font-semibold mb-4 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/grounds" className="hover:text-green-400 transition-colors">Browse Grounds</Link></li>
              <li><Link href="/register" className="hover:text-green-400 transition-colors">Create Account</Link></li>
              <li><Link href="/register?role=ground_owner" className="hover:text-green-400 transition-colors">List Your Ground</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-blue-400 text-sm font-semibold mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link href="/support" className="hover:text-blue-400 transition-colors">Support Center</Link></li>
              <li><Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 text-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500">
          <p>© {new Date().getFullYear()} GoPlay. All rights reserved.</p>
          <p className="text-xs">Made with ♥ for Sri Lankan sports lovers</p>
        </div>
      </div>
    </footer>
  );
}

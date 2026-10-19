import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdSenseScript from "@/components/ads/AdSenseScript";
import { EnglishOnly } from "@/i18n/I18nProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1"><EnglishOnly>{children}</EnglishOnly></main>
      <Footer />
      {/* Loaded on public pages only — never on dashboards or the payment flow. */}
      <AdSenseScript />
    </div>
  );
}

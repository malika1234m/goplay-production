import Script from "next/script";

/**
 * Loads the AdSense loader script. Renders nothing until
 * NEXT_PUBLIC_ADSENSE_CLIENT is set, so the site is unchanged
 * until the AdSense account is approved.
 */
export default function AdSenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;

  return (
    <Script
      id="adsbygoogle-init"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}

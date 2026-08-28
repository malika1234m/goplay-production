/**
 * Loads the AdSense loader script. Renders nothing until
 * NEXT_PUBLIC_ADSENSE_CLIENT is set, so the site is unchanged
 * until the AdSense account is approved.
 *
 * This is a plain <script> rather than next/script on purpose. With
 * `strategy="afterInteractive"` Next emits only a <link rel="preload"> in the
 * served HTML and injects the real tag client-side after hydration — ads still
 * load, but AdSense site verification looks for the snippet in the HTML and
 * can fail. React hoists `<script async src>` into <head> and de-duplicates it
 * across the layouts that render this, which is exactly what AdSense wants.
 */
export default function AdSenseScript() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
    />
  );
}

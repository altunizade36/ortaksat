import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web-only HTML shell (expo-router). Native apps ignore this file entirely.
 * Adds SEO/social meta, Turkish locale, and a centered responsive "app shell"
 * so the marketplace looks like a real web product on desktop instead of
 * stretching full-bleed.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#00866F" />

        <title>ortaksat — Ortak satışla kazan</title>
        <meta
          name="description"
          content="ortaksat: ilanını aç, ortakların referans linkiyle paylaşsın, satışta komisyon kazan. Emlak, telefon, bilgisayar, inşaat, bisiklet ve daha fazlası tek platformda."
        />
        <meta name="keywords" content="ortak satış, referans, komisyon, ilan, emlak, ikinci el, satıcı, affiliate" />

        {/* Open Graph — referans linkleri sosyal medyada paylaşıldığında zengin önizleme */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ortaksat" />
        <meta property="og:title" content="ortaksat — Ortak satışla kazan" />
        <meta
          property="og:description"
          content="İlanını aç, ortakların paylaşsın, satışta komisyon kazan. Tek platformda ortak satış."
        />
        <meta property="og:locale" content="tr_TR" />
        <meta property="og:url" content="https://ortaksat.com" />
        <meta property="og:image" content="https://ortaksat.com/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ortaksat — Ortak satışla kazan" />
        <meta name="twitter:description" content="İlanını aç, ortakların paylaşsın, satışta komisyon kazan." />
        <meta name="twitter:image" content="https://ortaksat.com/og-cover.png" />

        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />

        {/* Crisp web typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveShell }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveShell = `
:root { color-scheme: light; }
* { -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background:
    radial-gradient(1200px 600px at 18% -10%, rgba(0,134,111,0.10), transparent 60%),
    radial-gradient(900px 500px at 110% 10%, rgba(255,122,89,0.08), transparent 55%),
    #EEF1F4;
  min-height: 100vh;
}

/* Center the whole app into a responsive shell on tablet/desktop */
#root {
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  background: #FFFFFF;
  box-shadow: 0 24px 70px rgba(16,24,40,0.10);
}
@media (min-width: 760px) {
  #root {
    max-width: 1180px;
    min-height: 100vh;
    border-left: 1px solid rgba(16,24,40,0.06);
    border-right: 1px solid rgba(16,24,40,0.06);
  }
}

/* Polished custom scrollbar on desktop */
@media (min-width: 760px) {
  * { scrollbar-width: thin; scrollbar-color: rgba(0,134,111,0.35) transparent; }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-thumb { background: rgba(0,134,111,0.30); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(0,134,111,0.50); background-clip: content-box; }
  *::-webkit-scrollbar-track { background: transparent; }
}

/* Make pressables feel interactive on web */
[role="button"], a { cursor: pointer; }
`;

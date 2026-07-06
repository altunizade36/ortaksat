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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* PWA: service worker kaydı (yüklenebilir uygulama) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}"
          }}
        />

        {/* Analytics — Vercel Web Analytics + Speed Insights. Birinci taraf, çerezsiz,
            KVKK/GDPR dostu. Vercel panelinde "Web Analytics" ve "Speed Insights"
            açık olmalı (ücretsiz). window.va/si kuyruğu script yüklenene kadar tutar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};" +
              "window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments);};"
          }}
        />
        <script defer src="/_vercel/insights/script.js" />
        <script defer src="/_vercel/speed-insights/script.js" />

        {/* İlk veri çağrısı gecikmesin: Supabase kaynağına erken bağlan. */}
        <link rel="preconnect" href="https://akyzzdwbzgsnhdircuce.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://akyzzdwbzgsnhdircuce.supabase.co" />

        {/* Crisp web typography — render'ı bloklamadan yükle (FCP hızlanır).
            Sistem yazı tipiyle çizilir, Inter gelince yumuşakça geçer (display=swap).
            Stylesheet'i inline script async ekler; JS yoksa <noscript> devreye girer. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: fontLoader }} />
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap"
            rel="stylesheet"
          />
        </noscript>

        {/* Yapısal veri: kuruluş + site araması (Google sitelinks arama kutusu) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveShell }} />
      </head>
      <body>
        {children}
        {/* Açılış ekranı — JS/veri yüklenene kadar boş beyaz sıçrama yerine markalı,
            yumuşak bir yükleme gösterir; uygulama hazır olunca kaybolur. */}
        <div id="boot-splash" aria-hidden="true">
          <div className="bs-inner">
            <div className="bs-logo">Ortak<span>Sat</span></div>
            <div className="bs-spin" />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </body>
    </html>
  );
}

// Açılış ekranını, JS bundle yüklenip hidrasyon/reflow bittikten SONRA kaldırır —
// böylece react-native-web'in ilk layout sıçraması kullanıcıya görünmez.
const bootScript =
  "(function(){var s=document.getElementById('boot-splash');if(!s)return;" +
  "var d=false;function done(){if(d||!s)return;d=true;s.style.opacity='0';s.style.pointerEvents='none';setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},400);}" +
  "function ready(){requestAnimationFrame(function(){requestAnimationFrame(done);});}" +
  "if(document.readyState==='complete'){ready();}else{window.addEventListener('load',ready);}" +
  "setTimeout(done,6000);})();";

// Inter'i render-bloklamadan yükle: <link media="print"> ekle, yüklenince media='all'.
const fontLoader =
  "(function(){var l=document.createElement('link');" +
  "l.rel='stylesheet';l.media='print';" +
  "l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap';" +
  "l.onload=function(){l.media='all';};document.head.appendChild(l);})();";

const orgJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "OrtakSat",
      url: "https://ortaksat.com",
      logo: "https://ortaksat.com/apple-touch-icon.png",
      description: "Ortak satış pazaryeri: ilanını aç, ortakların referans linkiyle paylaşsın, satışta komisyon kazan."
    },
    {
      "@type": "WebSite",
      name: "OrtakSat",
      url: "https://ortaksat.com",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://ortaksat.com/explore?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
  ]
});

const responsiveShell = `
:root { color-scheme: light; }
* { -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; }

/* Açılış ekranı (boot splash) — markalı yumuşak yükleme */
#boot-splash {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  background: #F4F6F8;
  transition: opacity .38s ease;
}
#boot-splash .bs-inner { display: flex; flex-direction: column; align-items: center; gap: 20px; }
#boot-splash .bs-logo { font-size: 26px; font-weight: 900; letter-spacing: -0.3px; color: #0F172A; }
#boot-splash .bs-logo span { color: #00866F; }
#boot-splash .bs-spin {
  width: 30px; height: 30px; border-radius: 999px;
  border: 3px solid rgba(0,134,111,0.18); border-top-color: #00866F;
  animation: bs-rot .7s linear infinite;
}
@keyframes bs-rot { to { transform: rotate(360deg); } }
@media (prefers-color-scheme: dark) {
  #boot-splash { background: #0B1220; }
  #boot-splash .bs-logo { color: #E5E9EE; }
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: #F4F6F8;
  min-height: 100vh;
}

/* Full-bleed website: the app fills the entire viewport width, edge to edge,
   with no side gutters. Individual reading/form pages still cap their own
   content width internally; browsing/grid pages span the full screen. */
#root {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  background: #F4F6F8;
}

/* Polished custom scrollbar on desktop */
@media (min-width: 760px) {
  * { scrollbar-width: thin; scrollbar-color: rgba(0,134,111,0.35) transparent; }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-thumb { background: rgba(0,134,111,0.30); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(0,134,111,0.50); background-clip: content-box; }
  *::-webkit-scrollbar-track { background: transparent; }
}

/* Doğal odak: tarayıcının çirkin kare focus çerçevesini kaldır.
   Arama kutusuna içine tıklanınca yumuşak yeşil bir kenarlık ver. */
input, textarea, [role="search"] { outline: none !important; }
input:focus, textarea:focus, input:focus-visible, textarea:focus-visible { outline: none !important; box-shadow: none !important; }
[role="search"]:focus-within { border-color: rgba(0,134,111,0.55) !important; box-shadow: 0 0 0 3px rgba(0,134,111,0.12) !important; }

/* Make pressables feel interactive on web */
[role="button"], a { cursor: pointer; }
[role="button"] { transition: transform .12s ease, filter .12s ease, box-shadow .15s ease; }
@media (hover: hover) {
  [role="button"]:hover { filter: brightness(1.03); }
}

/* Listing cards lift on hover (data-card set via RNW dataSet) */
[data-card="listing"] {
  transition: transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s ease, border-color .18s ease;
  will-change: transform;
}
@media (hover: hover) {
  [data-card="listing"]:hover {
    transform: translateY(-5px);
    box-shadow: 0 18px 36px rgba(16,24,40,0.16) !important;
    border-color: rgba(0,134,111,0.45) !important;
  }
}

/* Entrance animation for hero / sections (data-reveal) */
@keyframes os-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
[data-reveal] { animation: os-rise .55s cubic-bezier(.2,.7,.3,1) both; }
[data-reveal="2"] { animation-delay: .08s; }
[data-reveal="3"] { animation-delay: .16s; }

/* Soft pulse for live/primary accents */
@keyframes os-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .55; }
}
[data-pulse] { animation: os-pulse 1.8s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  [data-reveal], [data-pulse], [data-card="listing"] { animation: none !important; transition: none !important; }
}

/* Desktop landing hero background */
[data-hero-bg] {
  background:
    radial-gradient(700px 380px at 92% -30%, rgba(229,75,75,0.30), transparent 60%),
    radial-gradient(600px 360px at 0% 120%, rgba(255,255,255,0.14), transparent 55%),
    linear-gradient(135deg, #00866F 0%, #075E54 100%) !important;
}
`;

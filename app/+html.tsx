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
        <meta name="theme-color" content="#0EA5B7" />

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
        <meta property="og:url" content="https://www.ortaksat.com" />
        <meta property="og:image" content="https://www.ortaksat.com/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ortaksat — Ortak satışla kazan" />
        <meta name="twitter:description" content="İlanını aç, ortakların paylaşsın, satışta komisyon kazan." />
        <meta name="twitter:image" content="https://www.ortaksat.com/og-cover.png" />

        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* PWA: service worker kaydı + OTOMATİK GÜNCELLEME. Eskiden yalnız register vardı;
            yeni sürüm deploy edilince kullanıcı eski JS'te takılı kalıyordu (önbellek). Artık
            yeni SW devralınca (controllerchange) sayfa BİR KEZ yenilenir → herkes otomatik güncel
            sürüme geçer. İlk ziyarette (önceden controller yoktu) yenileme YOK; refreshing bayrağı
            döngüyü engeller. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){if(!('serviceWorker' in navigator))return;var had=!!navigator.serviceWorker.controller;var refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(refreshing)return;if(!had){had=true;return;}refreshing=true;window.location.reload();});window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(reg){try{reg.update();}catch(e){}}).catch(function(){});});})();"
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
        {/* VERİ ÖN-ÇEKİMİ: ilan beslemesi isteği, JS bundle inip çalışana kadar (ölçüm: ~1,07sn)
            HİÇ başlamıyordu → ilk kart 1,67sn'de, masaüstü LCP ~2,8sn. Bu satır-içi script
            belge ayrıştırılırken (~50ms) isteği başlatır; store hazır olduğunda yanıt çoktan
            yoldadır (bkz. loadMarketplaceSnapshot). Anon anahtar zaten herkese açık (bundle'da). */}
        <script dangerouslySetInnerHTML={{ __html: prefetchScript }} />
        {/* JS kapalıysa iskelet ekranı gizle — içerik DOM'da zaten var (SEO/crawler güvenli). */}
        <noscript dangerouslySetInnerHTML={{ __html: "<style>#boot-splash{display:none!important}</style>" }} />
      </head>
      <body>
        {children}
        {/* Açılış ekranı — JS/veri yüklenene kadar boş beyaz sıçrama yerine markalı,
            yumuşak bir yükleme gösterir; uygulama hazır olunca kaybolur. */}
        <div id="boot-splash" aria-hidden="true">
          <div className="bs-bar">
            <div className="bs-logo">Ortak<span>Sat</span></div>
            <div className="bs-search" />
          </div>
          <div className="bs-nav" />
          <div className="bs-body">
            <div className="bs-side" />
            <div className="bs-main">
              <div className="bs-hero" />
              <div className="bs-grid">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </body>
    </html>
  );
}

// Iskelet ekrani, React GERCEK duzeni basana kadar durur. Kaldirma tetigi artik
// window.load DEGIL, kok duzenin <html class="app-ready"> isaretidir (bkz app/_layout.tsx):
// SSG taslagi (yanlis duzen/ikonsuz/kartsiz) kullaniciya HIC gorunmez. 8sn guvenlik agi.
const SB_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PROFILE_COLS = "id,full_name,avatar_url,bio,verified_phone,verified_identity,verified_instagram,rating,response_rate,role,status,successful_sales,follower_count";

// Sorgular loadMarketplaceSnapshot ile AYNI olmalı; ayrışırsa ön-çekim sessizce atlanır
// (store normal yolundan çeker) — yani yanlış veri riski yok, sadece hız kazancı kaybolur.
const prefetchScript = SB_URL && SB_KEY
  ? "(function(){try{" +
    "var u=" + JSON.stringify(SB_URL + "/rest/v1") + ",k=" + JSON.stringify(SB_KEY) + ";" +
    "var h={apikey:k,Authorization:'Bearer '+k,Accept:'application/json'};" +
    "var g=function(q){return fetch(u+q,{headers:h}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});};" +
    "window.__osPrefetch={" +
    "listings:g('/listing_public_cards?select=*&status=eq.active&order=created_at.desc&limit=90')," +
    "profiles:g('/profiles?select=" + PROFILE_COLS + "&limit=200')" +
    "};}catch(e){}})();"
  : "";

const bootScript =
  "(function(){var s=document.getElementById('boot-splash');if(!s)return;" +
  "var d=false;function done(){if(d)return;d=true;s.style.opacity='0';s.style.pointerEvents='none';" +
  "setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},260);}" +
  "if(document.documentElement.classList.contains('app-ready')){done();return;}" +
  "var mo=new MutationObserver(function(){if(document.documentElement.classList.contains('app-ready')){mo.disconnect();done();}});" +
  "mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});" +
  "setTimeout(function(){mo.disconnect();done();},8000);})();";

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
      alternateName: ["Ortaksat", "ortak sat", "Ortak Sat", "ortaksat.com"],
      url: "https://www.ortaksat.com",
      logo: "https://www.ortaksat.com/apple-touch-icon.png",
      description: "Ortak satış pazaryeri: ilanını aç, ortakların referans linkiyle paylaşsın, satışta komisyon kazan."
    },
    {
      "@type": "WebSite",
      name: "OrtakSat",
      alternateName: ["Ortaksat", "ortak sat"],
      url: "https://www.ortaksat.com",
      inLanguage: "tr-TR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://www.ortaksat.com/explore?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
  ]
});

const responsiveShell = `
:root { color-scheme: light; }
* { -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; }
/* iOS Safari yatay/dikey döndürmede metni şişirmesin; app gibi sabit kalsın. */
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
/* Mobil tarayıcıda input odağında iOS'un otomatik yakınlaştırmasını engelle:
   16px altındaki alanlar odaklanınca sayfa zıplar. Telefonlarda tabanı 16px yap. */
@media (max-width: 480px) {
  input, textarea, select { font-size: 16px !important; }
}
/* Butonlarda iOS uzun-basış "kopyala/paylaş" balonunu kapat — app hissi. */
[role="button"], button { -webkit-touch-callout: none; }

/* İSKELET EKRAN — SSG taslağının üstünü örter.
   Statik export'ta sunucu HTML'i ekran genişliğini bilemez: masaüstünde bile dar düzen,
   ikonsuz ve kartsız bir taslak basılıyor; React 150-250ms sonra gerçek sayfayı geçiriyor.
   Kullanıcı bunu "arkada saçma sapan sayfalar" olarak görüyordu. Çözüm: taslağı hiç
   göstermemek — yerine sitenin ÇERÇEVESİNE benzeyen bir iskelet, ve React gerçek düzeni
   basınca (html.app-ready) yumuşak geçiş. */
#boot-splash {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; flex-direction: column;
  background: #F0FDFF;
  transition: opacity .26s ease;
  overflow: hidden;
}
#boot-splash .bs-bar {
  display: flex; align-items: center; gap: 14px;
  height: 64px; padding: 0 14px;
  background: #FFFFFF; border-bottom: 1px solid #E3EAEF;
}
#boot-splash .bs-logo { font-size: 19px; font-weight: 900; letter-spacing: -0.3px; color: #0F172A; white-space: nowrap; }
#boot-splash .bs-logo span { color: #0EA5B7; }
#boot-splash .bs-search { flex: 1; max-width: 620px; height: 38px; border-radius: 999px; background: #EEF3F6; }
#boot-splash .bs-nav { display: none; }
#boot-splash .bs-body { display: flex; flex: 1; gap: 14px; padding: 12px; }
#boot-splash .bs-side { display: none; }
#boot-splash .bs-main { display: flex; flex: 1; flex-direction: column; gap: 12px; min-width: 0; }
#boot-splash .bs-hero { height: 132px; border-radius: 16px; background: #DFF4F7; }
#boot-splash .bs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
#boot-splash .bs-grid i { display: block; height: 132px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E8EEF2; }

/* Geniş web: gerçek düzende sol filtre paneli + geniş grid var — iskelet de onu taklit etsin,
   böylece iskeletten içeriğe geçişte hiçbir şey yerinden oynamaz. */
@media (min-width: 1024px) {
  #boot-splash .bs-bar { height: 70px; padding: 0 24px; }
  #boot-splash .bs-logo { font-size: 22px; }
  #boot-splash .bs-nav { display: block; height: 46px; background: #FFFFFF; border-bottom: 1px solid #E3EAEF; }
  #boot-splash .bs-body { gap: 18px; padding: 16px 24px; max-width: 1280px; width: 100%; margin: 0 auto; }
  #boot-splash .bs-side { display: block; width: 248px; flex: none; border-radius: 16px; background: #FFFFFF; border: 1px solid #E8EEF2; }
  #boot-splash .bs-hero { height: 252px; }
  #boot-splash .bs-grid { grid-template-columns: repeat(4, 1fr); }
  #boot-splash .bs-grid i { height: 208px; }
}

/* Nefes alan hafif parlama — "donmuş" değil "yükleniyor" hissi. */
#boot-splash .bs-search, #boot-splash .bs-hero, #boot-splash .bs-side, #boot-splash .bs-grid i, #boot-splash .bs-nav {
  animation: bs-pulse 1.4s ease-in-out infinite;
}
@keyframes bs-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .62; } }
@media (prefers-reduced-motion: reduce) {
  #boot-splash .bs-search, #boot-splash .bs-hero, #boot-splash .bs-side, #boot-splash .bs-grid i, #boot-splash .bs-nav { animation: none; }
}

/* React gerçek düzeni bastı → iskelet yumuşakça kalkar. */
html.app-ready #boot-splash { opacity: 0; pointer-events: none; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: #F0FDFF;
  min-height: 100vh;
  min-height: 100dvh; /* iOS adres çubuğu açılıp kapanınca içerik zıplamaz/kesilmez */
}

/* Full-bleed website: the app fills the entire viewport width, edge to edge,
   with no side gutters. Individual reading/form pages still cap their own
   content width internally; browsing/grid pages span the full screen. */
#root {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  background: #F0FDFF;
}

/* Polished custom scrollbar on desktop */
@media (min-width: 760px) {
  * { scrollbar-width: thin; scrollbar-color: rgba(14,165,183,0.35) transparent; }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-thumb { background: rgba(14,165,183,0.30); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(14,165,183,0.50); background-clip: content-box; }
  *::-webkit-scrollbar-track { background: transparent; }
}

/* Web sanallaştırma: ekran DIŞI ilan kartlarının layout/paint'ini tarayıcı atlar
   (content-visibility:auto → off-screen'de contain:size). Dış sarmalayıcının width'i
   açık (px) olduğundan yalnız yükseklik intrinsic'ten gelir; contain-intrinsic-size:auto
   ilk render'dan sonra kartın GERÇEK boyutunu hatırlar (kaydırma zıplaması yok). Tek kural,
   tüm kart yüzeylerini (explore/home/index/store/ortak/favoriler) kapsar; native yok sayar. */
[data-vcard] {
  content-visibility: auto;
  contain-intrinsic-size: auto 340px;
}
/* Kart olmayan ağır satır listeleri (mesaj konuşmaları, kategori/tablo satırları) için
   aynı off-screen atlama; satır yüksekliği ~88px tahmini (kaydırma zıplaması olmadan). */
[data-vrow] {
  content-visibility: auto;
  contain-intrinsic-size: auto 88px;
}

/* Doğal odak: tarayıcının çirkin kare focus çerçevesini kaldır.
   Arama kutusuna içine tıklanınca yumuşak yeşil bir kenarlık ver. */
input, textarea, [role="search"] { outline: none !important; }
/* Fare ile tıklamada temiz (çerçeve yok); KLAVYE ile gezinmede (:focus-visible)
   erişilebilir turkuaz odak halkası — erişilebilirlik için görünür odak şart. */
input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }
input:focus-visible, textarea:focus-visible { outline: none !important; box-shadow: 0 0 0 3px rgba(14,165,183,0.35) !important; }
[role="search"]:focus-within { border-color: rgba(14,165,183,0.55) !important; box-shadow: 0 0 0 3px rgba(14,165,183,0.12) !important; }

/* Make pressables feel interactive on web — premium turkuaz his */
[role="button"], a { cursor: pointer; }
[role="button"] { transition: transform .14s cubic-bezier(.2,.7,.3,1), filter .14s ease, box-shadow .18s ease; }
@media (hover: hover) {
  [role="button"]:hover { filter: brightness(1.035); box-shadow: 0 6px 18px rgba(14,165,183,0.16); }
  [role="button"]:active { filter: brightness(0.98); box-shadow: none; }
}

/* Kartlar hover'da zarifçe kalkar + turkuaz gölge (data-card RNW dataSet ile: listing/category/blog) */
[data-card] {
  transition: transform .2s cubic-bezier(.2,.7,.3,1), box-shadow .2s ease, border-color .18s ease;
  will-change: transform;
}
@media (hover: hover) {
  [data-card]:hover {
    transform: translateY(-5px);
    box-shadow: 0 16px 34px rgba(14,165,183,0.20) !important;
    border-color: rgba(14,165,183,0.55) !important;
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
  [data-reveal], [data-pulse], [data-card] { animation: none !important; transition: none !important; }
}

/* Desktop landing hero background */
[data-hero-bg] {
  background:
    radial-gradient(700px 380px at 92% -30%, rgba(229,75,75,0.30), transparent 60%),
    radial-gradient(600px 360px at 0% 120%, rgba(255,255,255,0.14), transparent 55%),
    linear-gradient(135deg, #0EA5B7 0%, #0891B2 100%) !important;
}
`;

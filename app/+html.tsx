import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web-only HTML shell (expo-router). Native apps ignore this file entirely.
 * Adds SEO/social meta, Turkish locale, and a centered responsive "app shell"
 * so the marketplace looks like a real web product on desktop instead of
 * stretching full-bleed.
 */
export default function Root({ children }: PropsWithChildren) {
  // SDK 58: CSS/JS bundle etiketlerini expo-router artık HTML'e kendisi eklemiyor — kök belge
  // bunları bağlamdan alıp basmak ZORUNDA (bodyNodes atlanırsa uygulama hidrasyon yapmaz).
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="tr" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0645C9" />

        <title>ortaksat — Ortak satışla kazan</title>
        <meta
          name="description"
          content="ortaksat: ilanını aç, ortaklar kendi yöntemiyle tanıtsın, satışta komisyon kazan. Emlak, telefon, bilgisayar, inşaat, bisiklet ve daha fazlası tek platformda."
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
        {/* iOS "Ana Ekrana Ekle" → uygulama gibi standalone açılış + durum çubuğu stili.
            manifest display:standalone iOS 16.4+'da yeter ama daha eski iOS bu meta'lara bakar.
            status-bar "default" = çakışmasız (siyah metin, opak alan); black-translucent header'ı
            durum çubuğu altına iterdi. mobile-web-app-capable = standart (Android/Chrome) eşdeğeri. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OrtakSat" />
        <meta name="mobile-web-app-capable" content="yes" />
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

        {/* RIZAYA BAĞLI BETİKLER — KVKK / Kurul Çerez Rehberi.
            Analitik (Vercel Web Analytics + Speed Insights; çerezsiz) ve pazarlama (Meta Pixel; yalnız
            EXPO_PUBLIC_META_PIXEL_ID tanımlıysa) betikleri belgeye DOĞRUDAN yazılmaz: aşağıdaki satır-içi betik,
            kullanıcının kayıtlı tercihini (localStorage → ortaksat.cookieConsent.v1) okur ve yalnız izin verilen
            kategorileri yükler. Tercih yoksa ya da "Reddet" seçildiyse HİÇBİRİ yüklenmez. Bant: components/cookie-consent.tsx.
            <noscript> piksel görseli kaldırıldı: JS kapalıyken rıza alınamaz, izinsiz istek atılmamalı. */}
        <script dangerouslySetInnerHTML={{ __html: consentScript }} />

        {/* İlk veri çağrısı gecikmesin: Supabase kaynağına erken bağlan. */}
        <link rel="preconnect" href="https://akyzzdwbzgsnhdircuce.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://akyzzdwbzgsnhdircuce.supabase.co" />

        {/* Yazı tipi (Inter) KENDİ ALAN ADIMIZDAN sunulur (/fonts/*.woff2; @font-face aşağıdaki stilde).
            Eskiden fonts.googleapis.com'dan yükleniyordu: her ziyaretçinin IP adresi izin alınmadan Google'a
            (yurt dışı) gidiyordu. Artık üçüncü tarafa istek yok; ayrıca bir DNS+TLS turu kazanılır.
            Sistem yazı tipiyle çizilir, Inter gelince yumuşakça geçer (font-display: swap). */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

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
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {/* Açılış ekranı — JS/veri yüklenene kadar boş beyaz sıçrama yerine markalı,
            yumuşak bir yükleme gösterir; uygulama hazır olunca kaybolur. */}
        <div id="boot-splash" aria-hidden="true">
          <div className="bs-bar">
            {/* Logo iskelette de OLMALI: yoksa uygulama mount olunca ikon sonradan belirip
                başlığı ittiriyordu (yenilemede kayma). Sabit 40×40 → düzen kaymaz. */}
            <img className="bs-mark" src="/logo-mark.png" width={40} height={40} alt="" />
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
        {bodyNodes}
      </body>
    </html>
  );
}

// Iskelet ekrani, React GERCEK duzeni basana kadar durur. Kaldirma tetigi artik
// window.load DEGIL, kok duzenin <html class="app-ready"> isaretidir (bkz app/_layout.tsx):
// SSG taslagi (yanlis duzen/ikonsuz/kartsiz) kullaniciya HIC gorunmez. 8sn guvenlik agi.
const SB_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Meta Pixel base kodu — YALNIZCA env var set olduğunda üretilir (aksi halde "" → head'e
// hiçbir script düşmez). Pixel ID herkese açık bir tanımlayıcıdır (istemci kodunda görünür,
// gizli değil). Standart Meta snippet'i: fbevents.js'i async yükler, init eder, PageView sayar.
const META_PIXEL_ID = (process.env.EXPO_PUBLIC_META_PIXEL_ID ?? "").trim();
const metaPixelScript = /^\d{5,20}$/.test(META_PIXEL_ID)
  ? "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
    "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;" +
    "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
    "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}" +
    "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
    "fbq('init'," + JSON.stringify(META_PIXEL_ID) + ");fbq('track','PageView');"
  : "";

// RIZA KAPISI: tercih anahtarı ve sürümü lib/cookie-consent.ts ile AYNI olmalı (COOKIE_CONSENT_KEY / _VERSION).
// window.__osConsent(c): c.analytics → Vercel betikleri, c.marketing → Meta Pixel; her kategori en çok bir kez yüklenir.
// Sayfa açılışında kayıtlı tercih varsa uygulanır; bant "Kabul Et" / "Seçimimi Kaydet" ile aynı işlevi çağırır.
const consentScript =
  "(function(){var K='ortaksat.cookieConsent.v1',V=1,L={};" +
  "function add(u){var s=document.createElement('script');s.defer=true;s.src=u;document.head.appendChild(s);}" +
  "function apply(c){if(!c||c.v!==V)return;" +
  "if(c.analytics===true&&!L.a){L.a=1;" +
  "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};" +
  "window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments);};" +
  "add('/_vercel/insights/script.js');add('/_vercel/speed-insights/script.js');}" +
  (metaPixelScript ? "if(c.marketing===true&&!L.m){L.m=1;" + metaPixelScript + "}" : "") +
  "}" +
  "window.__osConsent=apply;" +
  "try{var r=window.localStorage.getItem(K);if(r)apply(JSON.parse(r));}catch(e){}" +
  "})();";
// KRİTİK: PUBLIC_PROFILE_COLUMNS (lib/supabase-data.ts) ile BİREBİR aynı kolonlar olmalı.
// Ayrışırsa prefetch ATLANMAZ — takePrefetched bu 13-kolonu döndürür, loadMarketplaceSnapshot
// ERKEN döner ve taze 17-kolon fetch HİÇ çalışmaz → marketplace kullanıcılarında yeni alanlar
// (createdAt/city/expertiseCategories) SESSİZCE eksik kalır (store profilinde üye-tarihi/konum/
// uzmanlık görünmedi). Yeni public profil kolonu eklerken BURAYI da güncelle. Hepsi anon-SELECT'e açık.
const PROFILE_COLS = "id,full_name,avatar_url,bio,verified_phone,verified_identity,verified_instagram,rating,response_rate,role,status,successful_sales,follower_count,invite_code,expertise_categories,city,created_at";
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

const orgJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "OrtakSat",
      alternateName: ["Ortaksat", "ortak sat", "Ortak Sat", "ortaksat.com"],
      url: "https://www.ortaksat.com",
      logo: "https://www.ortaksat.com/apple-touch-icon.png",
      description: "Ortak satış pazaryeri: ilanını aç, ortaklar kendi yöntemiyle tanıtsın, satışta komisyon kazan.",
      // Marka bilinirliği / Google knowledge-panel için: gerçek destek e-postası +
      // hizmet bölgesi. sameAs (sosyal profil) EKLENMEDİ — henüz gerçek hesap yok;
      // sahte/kırık link Google güvenini düşürür. Hesap açılınca sameAs eklenecek.
      email: "destek@ortaksat.com",
      areaServed: { "@type": "Country", name: "Türkiye" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "destek@ortaksat.com",
        availableLanguage: ["Turkish", "English"]
      }
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
/* Inter — kendi alan adımızdan (public/fonts). Değişken yazı tipi: 400–900 tek dosyada.
   İki alt küme: latin (temel) ve latin-ext (ğ, ş, İ, ı dahil genişletilmiş Latin); tarayıcı yalnız gerekeni indirir.
   Inter, SIL Open Font License 1.1 ile lisanslıdır (kendi sunucundan dağıtım serbest). */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url(/fonts/inter-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url(/fonts/inter-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* CLS KORUMASI: Inter yüklenene kadar bu metrik-EŞLENMİŞ yedek çizilir (Arial tabanı, size-adjust/
   override'lar Inter metriklerine ayarlı) → Inter display=swap ile gelince yazı metrikleri DEĞİŞMEZ
   → reflow/layout-shift OLMAZ (ana sayfa CLS 0.108 → ~good). Inter yine gösterilir (design korunur). */
@font-face {
  font-family: 'InterFallback';
  src: local('Arial');
  ascent-override: 90.20%;
  descent-override: 22.48%;
  line-gap-override: 0.00%;
  size-adjust: 107.40%;
}
* { -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; }
/* iOS Safari yatay/dikey döndürmede metni şişirmesin; app gibi sabit kalsın. */
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
/* Mobil tarayıcıda input odağında iOS'un otomatik yakınlaştırmasını engelle:
   16px altındaki alanlar odaklanınca sayfa zıplar. Telefonlarda tabanı 16px yap.
   EŞİK 1023px: mobil layout eşiğiyle (WIDE_WEB_BREAKPOINT = 1024, lib/layout.ts) AYNI olmalı —
   eskiden 760px'ti; yatay tutulan iPhone (812–932px) mobil layout alıp bu kuralın DIŞINDA
   kalıyor, 16px altı alanlar (sohbet yazma kutusu, teklif notu…) odakta zoom yapıyordu. */
@media (max-width: 1023px) {
  input, textarea, select { font-size: 16px !important; }
}
/* Butonlarda iOS uzun-basış "kopyala/paylaş" balonunu kapat — app hissi. */
[role="button"], button { -webkit-touch-callout: none; }
/* Yakın konumlu çip/buton sıralarında hızlı çift-dokunuş kazara sayfa-zoom'unu
   tetiklemesin; dokunmalar ~300ms gecikmesiz anında işlensin (app gibi). */
[role="button"], button, a { touch-action: manipulation; }

/* İSKELET EKRAN — SSG taslağının üstünü örter.
   Statik export'ta sunucu HTML'i ekran genişliğini bilemez: masaüstünde bile dar düzen,
   ikonsuz ve kartsız bir taslak basılıyor; React 150-250ms sonra gerçek sayfayı geçiriyor.
   Kullanıcı bunu "arkada saçma sapan sayfalar" olarak görüyordu. Çözüm: taslağı hiç
   göstermemek — yerine sitenin ÇERÇEVESİNE benzeyen bir iskelet, ve React gerçek düzeni
   basınca (html.app-ready) yumuşak geçiş. */
#boot-splash {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; flex-direction: column;
  background: #F7FAFC;
  transition: opacity .26s ease;
  overflow: hidden;
}
#boot-splash .bs-bar {
  display: flex; align-items: center; gap: 14px;
  height: 64px; padding: 0 14px;
  background: #FFFFFF; border-bottom: 1px solid #E3EAEF;
}
#boot-splash .bs-mark { width: 40px; height: 40px; flex: none; display: block; }
#boot-splash .bs-logo { font-size: 19px; font-weight: 900; letter-spacing: -0.3px; color: #0F172A; white-space: nowrap; }
#boot-splash .bs-logo span { color: #0645C9; }
#boot-splash .bs-search { flex: 1; max-width: 620px; height: 38px; border-radius: 999px; background: #EEF3F6; }
#boot-splash .bs-nav { display: none; }
#boot-splash .bs-body { display: flex; flex: 1; gap: 14px; padding: 12px; }
#boot-splash .bs-side { display: none; }
#boot-splash .bs-main { display: flex; flex: 1; flex-direction: column; gap: 12px; min-width: 0; }
#boot-splash .bs-hero { height: 132px; border-radius: 16px; background: #E5F0FF; }
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
  font-family: 'Inter', 'InterFallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: #F7FAFC;
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
  background: #E5F0FF;
}

/* Polished custom scrollbar on desktop */
@media (min-width: 760px) {
  * { scrollbar-width: thin; scrollbar-color: rgba(6,69,201,0.35) transparent; }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-thumb { background: rgba(6,69,201,0.30); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(6,69,201,0.50); background-clip: content-box; }
  *::-webkit-scrollbar-track { background: transparent; }
}

/* Web sanallaştırma: ekran DIŞI ilan kartlarının layout/paint'ini tarayıcı atlar
   (content-visibility:auto → off-screen'de contain:size). Dış sarmalayıcının width'i
   açık (px) olduğundan yalnız yükseklik intrinsic'ten gelir; contain-intrinsic-size:auto
   ilk render'dan sonra kartın GERÇEK boyutunu hatırlar (kaydırma zıplaması yok). Tek kural,
   tüm kart yüzeylerini (explore/home/index/store/ortak/favoriler) kapsar; native yok sayar. */
[data-vcard] {
  content-visibility: visible;
}
@media (min-width: 760px) {
  [data-vcard] {
    content-visibility: auto;
    contain-intrinsic-size: auto 340px;
  }
}
/* Kart olmayan ağır satır listeleri (mesaj konuşmaları, kategori/tablo satırları) için
   aynı off-screen atlama; satır yüksekliği ~88px tahmini (kaydırma zıplaması olmadan). */
[data-vrow] {
  content-visibility: auto;
  contain-intrinsic-size: auto 88px;
}

/* CLS FIX — Blog düzeni artık JS (isWideWeb) yerine CSS media-query ile responsive.
   Neden: useIsWideWeb() #418'i önlemek için mount'a kadar false döner → SSG masaüstü
   ziyaretçiye MOBİL düzeni bake eder, ~1sn sonra masaüstüne reflow → CLS 0.72 (kötü).
   CSS media ile SSG HTML her genişlikte doğru → reflow YOK (CLS ~0), #418 de yok
   (DOM aynı; yalnız CSS viewport'a göre değişir). Taban (mobil) = dikey/tam-genişlik. */
[data-blog-featimg] { width: 100%; }
@media (min-width: 760px) {
  [data-blog-wrap]     { flex-direction: row !important; }
  [data-blog-feat]     { flex-direction: row !important; }
  [data-blog-feattext] { flex: 1.1 1 0% !important; justify-content: center !important; }
  [data-blog-side]     { width: 320px !important; flex: 0 0 320px !important; }
  [data-blog-featimg]  { width: auto !important; min-width: 0 !important; }
}

/* CLS FIX — İlan kart grid'i CSS-grid ile (JS responsiveGrid yerine). Kart genişliği
   JS'le hesaplanınca SSG(sunucu-genişlik) ↔ istemci(gerçek-genişlik) farkı → mount'ta
   grid reflow → alttaki bölümler zıplar (CLS). CSS auto-fill sütun sayısını KONTEYNER
   genişliğinden hesaplar → SSG'de doğru, reflow YOK. Kartlar hücreyi doldurur (width:auto). */
[data-card-grid] {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr); /* telefon: her zaman 2 sütun (responsiveGrid minColumns:2 ile aynı) */
  gap: 12px;
  align-items: start;
}
@media (min-width: 500px) {
  /* tablet+: konteyner genişliğine göre otomatik sütun (minCardWidth 176 ile aynı) */
  [data-card-grid] { grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); }
}
[data-card-grid] > * { width: auto !important; min-width: 0 !important; }

/* Doğal odak: tarayıcının çirkin kare focus çerçevesini kaldır.
   Arama kutusuna içine tıklanınca yumuşak yeşil bir kenarlık ver. */
input, textarea, [role="search"] { outline: none !important; }
/* Fare ile tıklamada temiz (çerçeve yok); KLAVYE ile gezinmede (:focus-visible)
   erişilebilir turkuaz odak halkası — erişilebilirlik için görünür odak şart. */
input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }
input:focus-visible, textarea:focus-visible { outline: none !important; box-shadow: 0 0 0 3px rgba(6,69,201,0.35) !important; }
[role="search"]:focus-within { border-color: rgba(6,69,201,0.55) !important; box-shadow: 0 0 0 3px rgba(6,69,201,0.12) !important; }

/* Make pressables feel interactive on web — premium turkuaz his */
[role="button"], a { cursor: pointer; }
[role="button"] { transition: transform .14s cubic-bezier(.2,.7,.3,1), filter .14s ease, box-shadow .18s ease; }
@media (hover: hover) {
  [role="button"]:hover { filter: brightness(1.035); box-shadow: 0 6px 18px rgba(6,69,201,0.16); }
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
    box-shadow: 0 16px 34px rgba(6,69,201,0.20) !important;
    border-color: rgba(6,69,201,0.55) !important;
  }
  /* İlan ızgarasında kartın yukarı sıçraması komşu kartların çizgisini bozuyor.
     Sabit geometriyi koru; etkileşim geri bildirimi gölge ve kenarlıkla sürsün. */
  [data-card="listing"]:hover { transform: none; }
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
    linear-gradient(135deg, #075BEB 0%, #0645C9 100%) !important;
}
`;

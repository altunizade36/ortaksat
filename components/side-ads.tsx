import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { ADSENSE_CLIENT, ADSENSE_SIDE_SLOT, adsConfigured } from "@/lib/ads-config";
import { onCookieConsentChange, readCookieConsent } from "@/lib/cookie-consent";
import { isMobileApp } from "@/lib/mobile-app";
import { useStore } from "@/lib/use-store";

/**
 * YAN (DİKEY) REKLAM ALANLARI — yalnız geniş masaüstü ekranında, sayfa içeriğinin (1280 px) DIŞINDA kalan
 * sağ ve sol boşlukta. İçeriğe yer açmaz, hiçbir şeyi itmez: boşluk yetmiyorsa (yaklaşık 1650 px'ten dar ekran)
 * hiç çizilmez. Telefonda, tablette ve uygulamanın içinde reklam yoktur.
 *
 * Görünme koşullarının HEPSİ gerekir:
 *  - kimlikler tanımlı (lib/ads-config.ts) ve sunucu anahtarı açık (platform_settings.ads_enabled),
 *  - ziyaretçi "Hedefleme ve Reklam" iznini vermiş (izin yoksa reklam betiği tarayıcıya HİÇ yüklenmez),
 *  - sayfa içerik sayfası (ana sayfa, keşfet, ilan, kategori, blog, mağaza, ortak vitrini). Giriş, ilan verme,
 *    mesajlar, hesap, yönetim ve hukuki sayfalarda reklam gösterilmez.
 *
 * Otomatik reklamlar kullanılmaz (Google'ın sayfanın içine kendiliğinden reklam yerleştirmesi): yalnız bu iki alan.
 * Reklam gelmezse alan boş ve görünmez kalır ("Reklam" etiketi de çizilmez).
 *
 * Başlık bileşeninin içinde çizilir (kök düzende değil): böylece hesap menüsü gibi başlıktan açılan pencereler
 * reklamın ÜSTÜNDE kalır.
 */

const AD_HEIGHT = 600;
/** Reklam ile sayfa içeriği / ekran kenarı arasında bırakılan en az boşluk. */
const AD_MARGIN = 12;
const AD_ROUTES = new Set(["", "index", "explore", "listing", "ilan", "kategori", "kategoriler", "blog", "store", "magaza", "ortak", "ortaklar"]);

function isAdRoute(pathname: string | null | undefined): boolean {
  const first = (pathname ?? "").split("/").filter(Boolean)[0] ?? "";
  return AD_ROUTES.has(first);
}

function loadAdScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("script[data-os-ads]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADSENSE_CLIENT);
  script.setAttribute("data-os-ads", "1");
  document.head.appendChild(script);
}

/** Reklam gösterilebilir mi (izin + anahtar + kimlik). Sunucu çıktısında ve ilk çizimde her zaman false. */
function useAdsAllowed(): boolean {
  const { platformSettings } = useStore();
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || isMobileApp) return;
    setConsented(readCookieConsent()?.marketing === true);
    return onCookieConsentChange((consent) => setConsented(consent.marketing === true));
  }, []);
  return Platform.OS === "web" && !isMobileApp && adsConfigured && platformSettings.adsEnabled === true && consented;
}

export function SideAdRails() {
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const allowed = useAdsAllowed();

  const gutter = (width - PAGE_MAX_WIDTH) / 2;
  const adWidth = gutter >= 300 + AD_MARGIN * 2 ? 300 : gutter >= 160 + AD_MARGIN * 2 ? 160 : 0;
  const show = allowed && adWidth > 0 && height >= AD_HEIGHT + 150 && isAdRoute(pathname);

  useEffect(() => { if (show) loadAdScript(); }, [show]);

  if (!show) return null;
  const side = Math.round((gutter - adWidth) / 2);
  const top = Math.max(150, Math.round((height - AD_HEIGHT) / 2));
  return (
    <>
      <View testID="side-ad-left" pointerEvents="box-none" style={{ left: side, position: "fixed" as never, top, width: adWidth, zIndex: 1 }}>
        <AdUnit key={adWidth} width={adWidth} />
      </View>
      <View testID="side-ad-right" pointerEvents="box-none" style={{ position: "fixed" as never, right: side, top, width: adWidth, zIndex: 1 }}>
        <AdUnit key={adWidth} width={adWidth} />
      </View>
    </>
  );
}

function AdUnit({ width }: { width: number }) {
  const ref = useRef<HTMLModElement | null>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;
    const read = () => setFilled(element.getAttribute("data-ad-status") === "filled");
    const observer = new MutationObserver(read);
    observer.observe(element, { attributeFilter: ["data-ad-status"], attributes: true });
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch { /* reklam engelleyici / betik yüklenemedi: alan boş kalır */ }
    return () => observer.disconnect();
  }, []);
  return (
    // Reklam gelene kadar (ya da hiç gelmezse) görünmez ve tıklanamaz: boş çerçeve / yalnız etiket kalmaz.
    <View pointerEvents={filled ? "auto" : "none"} style={{ gap: 4, opacity: filled ? 1 : 0 }}>
      <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 0.4, textAlign: "center" }}>Reklam</Text>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "inline-block", height: AD_HEIGHT, width }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SIDE_SLOT}
      />
    </View>
  );
}

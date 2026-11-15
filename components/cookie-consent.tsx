import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { onOpenCookiePreferences, readCookieConsent, saveCookieConsent } from "@/lib/cookie-consent";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { metaPixelEnabled } from "@/lib/meta-pixel";
import { isMobileApp } from "@/lib/mobile-app";

/**
 * ÇEREZ BANDI + ÇEREZ TERCİHLERİ PANELİ (yalnız web; uygulamada çerez yok).
 *
 * Düzen (2026-11-15): büyük ilan sitelerindeki alışılmış yapı — ekranın altında tam genişlikte bir bant
 * (kısa açıklama + aynı görünümde üç düğme) ve "Tercihleri Yönet" ile açılan, kategorileri solda sekme
 * (dar ekranda açılır başlık) olarak gösteren bir panel. Metinler ve kategoriler OrtakSat'ın GERÇEK
 * kullanımına göredir (lib/cookie-consent.ts, app/+html.tsx, app/cerez-politikasi.tsx ile aynı envanter).
 *
 * KVKK Kurulu Çerez Rehberi'ne göre:
 *  - Zorunlu olmayan her şey varsayılan KAPALI; ön-işaretli seçenek yok.
 *  - "Reddet" ile "Kabul Et" AYNI görünürlükte ve tek tıkla (bantta da panelde de).
 *  - Bant siteyi kilitlemez (çerez duvarı değil): kullanıcı seçim yapmadan da gezebilir; seçim yapılana
 *    kadar analitik/pazarlama betikleri YÜKLENMEZ.
 *  - Tercih, alt bilgideki "Çerez Tercihleri"nden her an değiştirilebilir / geri alınabilir.
 *
 * SSG/hidrasyon: bant yalnız mount SONRASI çizilir (sunucu HTML'inde yok) → #418 uyuşmazlığı ve LCP etkisi olmaz;
 * position:fixed olduğu için düzen kaymaz (CLS 0).
 */

type CategoryKey = "privacy" | "necessary" | "functional" | "analytics" | "marketing";
type Category = {
  key: CategoryKey;
  title: string;
  paragraphs: string[];
  /** Kategorideki kayıt/araçlar ("Kayıt ayrıntıları" altında listelenir). */
  items?: string[];
  /** Anahtar yerine gösterilen sabit durum etiketi. */
  fixed?: string;
  /** İzne bağlı kategori: anahtarın değeri ve değiştiricisi. */
  toggle?: { value: boolean; onChange: (next: boolean) => void };
};

const BAND_BG = "rgba(7,24,66,0.97)";

export function CookieConsent() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const tr = useCallback((value: string) => translateCopy(value, language), [language]);
  const [mode, setMode] = useState<"hidden" | "banner" | "preferences">("hidden");
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [active, setActive] = useState<CategoryKey>("privacy");

  const openPreferences = useCallback(() => {
    const current = readCookieConsent();
    setAnalytics(current?.analytics === true);
    setMarketing(current?.marketing === true);
    setActive("privacy");
    setMode("preferences");
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || isMobileApp) return;
    if (!readCookieConsent()) setMode("banner");
    return onOpenCookiePreferences(openPreferences);
  }, [openPreferences]);

  // Paneli kapatmak tercihi DEĞİŞTİRMEZ: daha önce karar verilmişse gizlenir, verilmemişse banda dönülür.
  const closePreferences = useCallback(() => setMode(readCookieConsent() ? "hidden" : "banner"), []);

  // Esc ile kapatma (yalnız panel açıkken).
  useEffect(() => {
    if (Platform.OS !== "web" || mode !== "preferences" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closePreferences(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, closePreferences]);

  // BANT YÜKSEKLİĞİ → CSS DEĞİŞKENİ (--os-cookie-h). Sayfaların altına sabitlenen çubuklar (ilan sayfasındaki
  // "Mesaj gönder / Ortak Ol") bu kadar yukarı kalkar. Eskiden bant o çubuğun TAM ÜSTÜNE biniyordu: siteye ilk kez
  // gelen mobil ziyaretçi, çerez seçimi yapmadan satıcıya ulaşma düğmelerini HİÇ göremiyordu (2026-11-14 denetimi).
  const [bandHeight, setBandHeight] = useState(0);
  const lift = mode === "banner" ? bandHeight : 0;
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    if (lift > 0) root.style.setProperty("--os-cookie-h", `${lift}px`);
    else root.style.removeProperty("--os-cookie-h");
    return () => { root.style.removeProperty("--os-cookie-h"); };
  }, [lift]);

  if (Platform.OS !== "web" || isMobileApp || mode === "hidden") return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    saveCookieConsent({ analytics: choice.analytics, marketing: metaPixelEnabled ? choice.marketing : false });
    setMode("hidden");
  };
  const rejectAll = () => decide({ analytics: false, marketing: false });
  const acceptAll = () => decide({ analytics: true, marketing: true });
  const narrow = width > 0 && width < 640;

  // ------------------------------------------------------------------ BANT
  if (mode === "banner") {
    const tiny = width > 0 && width < 350;
    return (
      <View
        testID="cookie-consent"
        accessibilityRole={"dialog" as never}
        accessibilityLabel={tr("Çerez tercihleri")}
        style={{ backgroundColor: BAND_BG, borderTopColor: "rgba(255,255,255,0.14)", borderTopWidth: 1, bottom: 0, left: 0, position: "fixed" as never, right: 0, zIndex: 9000 }}
      >
        <View
          // Yalnız dar ekranda (alt düğme çubuğu olan düzen) yükseklik bildirilir.
          onLayout={(event) => { const next = narrow ? Math.ceil(event.nativeEvent.layout.height) + 1 : 0; setBandHeight((prev) => (prev === next ? prev : next)); }}
          style={{ alignSelf: "center", gap: narrow ? 10 : 12, maxWidth: 1280, paddingHorizontal: narrow ? 12 : 24, paddingVertical: narrow ? 12 : 16, width: "100%" }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: narrow ? 12.5 : 13.5, lineHeight: narrow ? 18 : 20 }}>
            {metaPixelEnabled
              ? tr("OrtakSat'ın çalışması için zorunlu kayıtları kullanırız. İzin verirsen ziyaret ve sayfa hızı istatistikleri için analitik araçlarını, reklamlarımızın etkisini ölçmek için de reklam ölçümü çerezlerini çalıştırırız. İzin vermezsen bunlar tarayıcına hiç yüklenmez.")
              : tr("OrtakSat'ın çalışması için zorunlu kayıtları kullanırız. İzin verirsen ziyaret ve sayfa hızı istatistikleri için analitik araçlarını da çalıştırırız. İzin vermezsen bunlar tarayıcına hiç yüklenmez.")}
            {narrow ? " " : null}
            {narrow ? <Link href={"/cerez-politikasi" as Href} style={{ color: "#9CC2FF", fontWeight: "700", textDecorationLine: "underline" }}>{tr("Çerez Politikası")}</Link> : null}
          </Text>
          {!narrow ? (
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, lineHeight: 20 }}>
              {tr("Tercihlerini panelden yönetebilir, ayrıntılı bilgi için")}{" "}
              <Link href={"/cerez-politikasi" as Href} style={{ color: "#9CC2FF", fontWeight: "700", textDecorationLine: "underline" }}>{tr("Çerez Politikası")}</Link>
              {tr("'nı inceleyebilirsin.")}
            </Text>
          ) : null}
          {/* Üç seçenek de bilinçli olarak AYNI görünüm ve AYNI boyutta (rehber: kabul / reddet / tercihler eşit olmalı). */}
          <View style={{ alignItems: "center", flexDirection: "row", gap: narrow ? 6 : 16, justifyContent: "flex-end" }}>
            <BandButton label={tr(tiny ? "Reddet" : "Tümünü Reddet")} onPress={rejectAll} testID="cookie-reject" narrow={narrow} tiny={tiny} />
            <BandButton label={tr(tiny ? "Tercihler" : "Tercihleri Yönet")} onPress={openPreferences} testID="cookie-manage" narrow={narrow} tiny={tiny} />
            <BandButton label={tr(tiny ? "Kabul Et" : "Tümünü Kabul Et")} onPress={acceptAll} testID="cookie-accept" narrow={narrow} tiny={tiny} />
          </View>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------------ TERCİH PANELİ
  const categories: Category[] = [
    {
      key: "privacy",
      title: tr("Gizliliğin"),
      paragraphs: [
        tr("Bir internet sitesini ziyaret ettiğinde site, tarayıcında çerez ya da yerel depolama kaydı gibi küçük bilgiler saklayabilir. OrtakSat'ta bu kayıtların bir kısmı sitenin çalışması için zorunludur; bir kısmı ise yalnızca sen izin verirsen kullanılır."),
        tr("Bu kayıtlar çoğunlukla seni doğrudan tanımlamaz; oturumunun açık kalmasını, tercihlerinin hatırlanmasını ve sitenin nasıl kullanıldığını anlamamızı sağlar."),
        tr("Zorunlu olmayan kategoriler varsayılan olarak kapalıdır. Başlıklardan her kategorinin ne işe yaradığını görebilir, izin vermek istediklerini açabilirsin. İzin vermemen siteyi kullanmanı kısıtlamaz; kararını dilediğin an sayfanın altındaki \"Çerez Tercihleri\" bağlantısından değiştirebilirsin.")
      ]
    },
    {
      key: "necessary",
      title: tr("Zorunlu Kayıtlar"),
      fixed: tr("Her zaman etkin"),
      paragraphs: [
        tr("Bu kayıtlar sitenin çalışması için gereklidir ve kapatılamaz. Giriş yapman, oturumunun açık kalması, güvenlik denetimleri, form göndermen ve bu çerez tercihinin hatırlanması bunlara bağlıdır."),
        tr("Tarayıcının ayarlarından bu kayıtları silebilirsin; ancak o zaman oturumun kapanır ve sitenin bazı bölümleri çalışmaz.")
      ],
      items: [
        tr("Oturum bilgisi: giriş yaptığında oluşur, çıkış yaptığında silinir."),
        tr("\"Beni hatırla\" ve dil tercihin."),
        tr("Çerez tercihin ve verildiği tarih: her ziyarette yeniden sorulmaması için."),
        tr("Google ya da Apple ile giriş öncesinde verdiğin sözleşme onayının kaydı."),
        tr("Hata kurtarma kayıtları: yalnızca sekme açıkken tutulur."),
        tr("Görüntülenme sayaçlarının şişirilmesini önleyen, her gün yenilenen rastgele anahtar."),
        tr("Çevrimdışı sayfa ve logo için tarayıcı önbelleği.")
      ]
    },
    {
      key: "functional",
      title: tr("İşlevsel Kayıtlar"),
      fixed: tr("Özelliği kullanınca"),
      paragraphs: [
        tr("Yalnızca ilgili özelliği kullandığında oluşur ve cihazında kalır; reklam ya da profilleme için kullanılmaz. Özelliği kullanmazsan bu kayıtlar hiç oluşmaz."),
        tr("Tarayıcının site verilerini temizleyerek bu kayıtları dilediğin an silebilirsin.")
      ],
      items: [
        tr("Son gezdiğin ilanlar ve kategoriler, son aramaların ve kayıtlı aramaların."),
        tr("Karşılaştırma listen ve mesaj kutusu görünüm tercihlerin."),
        tr("Yarım kalan ilan ve başvuru taslakların."),
        tr("Ortak satış atfı: bir ortağın bağlantısıyla geldiysen, ilanı hangi ortağın önerdiği bilgisi (en fazla 30 gün)."),
        tr("Davet kodu: bir davet bağlantısıyla geldiysen, giriş yapana kadar.")
      ]
    },
    {
      key: "analytics",
      title: tr("Performans ve Analitik"),
      toggle: { value: analytics, onChange: setAnalytics },
      paragraphs: [
        tr("Sitenin kaç kez ziyaret edildiğini, hangi sayfaların kullanıldığını ve sayfaların ne kadar hızlı açıldığını ölçmemizi sağlar; böylece siteyi iyileştirebiliriz."),
        tr("Bu araçlar cihazına çerez yerleştirmez ve seni kişisel olarak tanımlamaz. İzin vermezsen tarayıcına hiç yüklenmez.")
      ],
      items: [
        tr("Vercel Web Analytics: ziyaret ve sayfa görüntüleme istatistikleri."),
        tr("Vercel Speed Insights: sayfa hızı ölçümü.")
      ]
    },
    metaPixelEnabled
      ? {
          key: "marketing",
          title: tr("Hedefleme ve Reklam"),
          toggle: { value: marketing, onChange: setMarketing },
          paragraphs: [
            tr("Reklam kampanyalarımızın işe yarayıp yaramadığını ölçmek için kullanılır. İzin verirsen cihazına reklam ölçümü çerezleri yerleştirilir ve ziyaret bilgilerin yurt dışındaki reklam sağlayıcısına iletilir."),
            tr("İzin vermezsen bu araç tarayıcına hiç yüklenmez; iznini geri aldığında araç durdurulur ve çerezleri silinir.")
          ],
          items: [tr("Meta (Facebook / Instagram) Pixel: _fbp ve _fbc çerezleri, yaklaşık 90 gün.")]
        }
      : {
          key: "marketing",
          title: tr("Hedefleme ve Reklam"),
          fixed: tr("Şu an kullanılmıyor"),
          paragraphs: [
            tr("Şu anda bu kategoride çalışan bir araç yok: sitede reklam ağı, hedefleme pikseli ya da siteler arası izleme bulunmuyor."),
            tr("İleride reklam ölçümü kullanmaya başlarsak önce bu panelden iznini isteriz; izin vermediğin sürece hiçbir reklam aracı yüklenmez.")
          ]
        }
  ];
  const current = categories.find((c) => c.key === active) ?? categories[0];

  const footer = (
    <View style={{ backgroundColor: "#FFFFFF", borderTopColor: "#DCE5F8", borderTopWidth: 1, flexDirection: narrow ? "column" : "row", gap: 8, justifyContent: "space-between", padding: narrow ? 12 : 16 }}>
      {/* Üç düğme de AYNI görünümde: seçimi kaydetmek, hepsini reddetmek ve hepsine izin vermek eşit kolaylıkta. */}
      <PanelButton label={tr("Seçimlerimi Onayla")} onPress={() => decide({ analytics, marketing })} testID="cookie-save" narrow={narrow} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PanelButton label={tr("Tümünü Reddet")} onPress={rejectAll} testID="cookie-reject" narrow={narrow} grow={narrow} />
        <PanelButton label={tr("Tümüne İzin Ver")} onPress={acceptAll} testID="cookie-accept" narrow={narrow} grow={narrow} />
      </View>
    </View>
  );

  return (
    <View
      testID="cookie-consent"
      accessibilityRole={"dialog" as never}
      aria-modal
      accessibilityLabel={tr("Çerez tercihleri")}
      style={{ alignItems: "center", backgroundColor: "rgba(7,18,45,0.62)", bottom: 0, justifyContent: "center", left: 0, padding: narrow ? 8 : 16, position: "fixed" as never, right: 0, top: 0, zIndex: 9000 }}
    >
      <View testID="cookie-panel" style={{ backgroundColor: "#FFFFFF", borderRadius: 14, boxShadow: "0 18px 60px rgba(4,14,40,0.4)" as never, height: narrow ? undefined : 600, maxHeight: "92vh" as never, maxWidth: 880, overflow: "hidden", width: "100%" }}>
        {/* Başlık */}
        <View style={{ alignItems: "center", borderBottomColor: "#DCE5F8", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: narrow ? 12 : 18, paddingVertical: 12 }}>
          <Image source={require("../assets/brand-head-blue.png")} style={{ height: 30, width: 30 }} contentFit="contain" accessibilityLabel="OrtakSat" />
          <Text style={{ color: "#09275E", fontSize: 17, fontWeight: "900" }}>Ortak<Text style={{ color: colors.primary }}>Sat</Text></Text>
          <Text accessibilityRole="header" numberOfLines={1} style={{ color: "#09275E", flex: 1, fontSize: narrow ? 15 : 17, fontWeight: "800", minWidth: 0 }}>{tr("Çerez Tercihleri")}</Text>
          <Pressable testID="cookie-close" accessibilityRole="button" accessibilityLabel={tr("Kapat")} onPress={closePreferences} hitSlop={8} style={({ pressed }) => ({ alignItems: "center", borderRadius: 999, height: 36, justifyContent: "center", opacity: pressed ? 0.6 : 1, width: 36 })}>
            <MaterialCommunityIcons name="close" size={22} color="#33425F" />
          </Pressable>
        </View>

        {narrow ? (
          // Dar ekran: kategoriler açılır başlık olarak alt alta.
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
            {categories.map((category) => {
              const open = category.key === active;
              return (
                <View key={category.key} style={{ borderColor: open ? colors.primary : "#DCE5F8", borderRadius: 10, borderWidth: 1, overflow: "hidden" }}>
                  <Pressable
                    testID={`cookie-tab-${category.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() => setActive(category.key)}
                    style={{ alignItems: "center", backgroundColor: open ? "#FFFFFF" : "#F3F6FC", flexDirection: "row", gap: 8, minHeight: 48, paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: "#09275E", flex: 1, fontSize: 14, fontWeight: "800", minWidth: 0 }}>{category.title}</Text>
                    <CategoryStatus category={category} tr={tr} compact />
                    <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color="#4A5A7A" />
                  </Pressable>
                  {open ? <View style={{ paddingBottom: 12, paddingHorizontal: 12 }}><CategoryBody category={category} tr={tr} /></View> : null}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          // Geniş ekran: solda sekmeler, sağda seçili kategorinin açıklaması.
          <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
            <View style={{ backgroundColor: "#F3F6FC", borderRightColor: "#DCE5F8", borderRightWidth: 1, width: 250 }}>
              {categories.map((category) => {
                const selected = category.key === active;
                return (
                  <Pressable
                    key={category.key}
                    testID={`cookie-tab-${category.key}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setActive(category.key)}
                    style={{ backgroundColor: selected ? "#FFFFFF" : "transparent", borderBottomColor: "#DCE5F8", borderBottomWidth: 1, borderLeftColor: selected ? colors.primary : "transparent", borderLeftWidth: 5, justifyContent: "center", minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 }}
                  >
                    <Text style={{ color: "#09275E", fontSize: 14, fontWeight: selected ? "900" : "700", lineHeight: 19 }}>{category.title}</Text>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, padding: 22 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
                <Text accessibilityRole="header" style={{ color: "#09275E", flex: 1, fontSize: 16, fontWeight: "900", minWidth: 0 }}>{current.title}</Text>
                <CategoryStatus category={current} tr={tr} />
              </View>
              <CategoryBody key={current.key} category={current} tr={tr} />
            </ScrollView>
          </View>
        )}

        {footer}
      </View>
    </View>
  );
}

/** Kategorinin durumu: sabit etiket ("Her zaman etkin") ya da izin anahtarı. */
function CategoryStatus({ category, tr, compact }: { category: Category; tr: (value: string) => string; compact?: boolean }) {
  if (category.toggle) {
    const { value, onChange } = category.toggle;
    return (
      // RN-web Switch'in turkuaz topuz tuzağı yüzünden özel anahtar (marka mavisi).
      <Pressable
        testID={`cookie-switch-${category.key}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        aria-checked={value}
        accessibilityLabel={`${category.title}: ${value ? tr("İzin verildi") : tr("İzin verilmedi")}`}
        onPress={() => onChange(!value)}
        hitSlop={6}
        style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: 32 }}
      >
        {compact ? null : <Text style={{ color: value ? colors.primaryDark : "#4A5A7A", fontSize: 12.5, fontWeight: "700" }}>{value ? tr("İzin verildi") : tr("İzin verilmedi")}</Text>}
        <View style={{ backgroundColor: value ? colors.primary : "#8A96AE", borderRadius: 999, height: 26, justifyContent: "center", padding: 3, width: 48 }}>
          <View style={{ alignSelf: value ? "flex-end" : "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} />
        </View>
      </Pressable>
    );
  }
  if (!category.fixed) return null;
  return <Text style={{ color: colors.primaryDark, fontSize: compact ? 11.5 : 13, fontWeight: "800" }}>{category.fixed}</Text>;
}

/** Kategorinin açıklaması, kayıt ayrıntıları ve (Gizliliğin sekmesinde) politika bağlantıları. */
function CategoryBody({ category, tr }: { category: Category; tr: (value: string) => string }) {
  const [details, setDetails] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      {category.paragraphs.map((paragraph) => (
        <Text key={paragraph} style={{ color: "#33425F", fontSize: 13.5, lineHeight: 20 }}>{paragraph}</Text>
      ))}
      {category.items?.length ? (
        <View style={{ gap: 6 }}>
          <Pressable testID={`cookie-details-${category.key}`} accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails((value) => !value)} style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 30 }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>{details ? tr("Kayıt ayrıntılarını gizle") : tr("Kayıt ayrıntılarını görüntüle")}</Text>
          </Pressable>
          {details ? category.items.map((item) => (
            <View key={item} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 13, lineHeight: 19 }}>•</Text>
              <Text style={{ color: "#33425F", flex: 1, fontSize: 13, lineHeight: 19, minWidth: 0 }}>{item}</Text>
            </View>
          )) : null}
        </View>
      ) : null}
      {category.key === "privacy" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <PolicyLink href={"/cerez-politikasi" as Href} label={tr("Çerez Politikası")} />
          <PolicyLink href={"/kvkk" as Href} label={tr("KVKK Aydınlatma Metni")} />
        </View>
      ) : null}
    </View>
  );
}

function PolicyLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={{ justifyContent: "center", minHeight: 30 }}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

/** Bant düğmesi: koyu bant üzerinde beyaz çerçeveli, üçü de aynı boyda. */
function BandButton({ label, onPress, testID, narrow, tiny }: { label: string; onPress: () => void; testID: string; narrow: boolean; tiny: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center", backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "transparent", borderColor: "#FFFFFF", borderRadius: 6, borderWidth: 1,
        // Dar ekranda üçü satırı eşit paylaşır (flexBasis 0), geniş ekranda sabit ve eşit genişlik.
        flexBasis: narrow ? 0 : undefined, flexGrow: narrow ? 1 : 0, justifyContent: "center", minHeight: 40, minWidth: 0,
        paddingHorizontal: narrow ? 4 : 12, width: narrow ? undefined : 210
      })}
    >
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: narrow ? (tiny ? 12 : 12.5) : 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** Panel düğmesi: üçü de aynı dolu mavi görünümde. */
function PanelButton({ label, onPress, testID, narrow, grow }: { label: string; onPress: () => void; testID: string; narrow: boolean; grow?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center", backgroundColor: colors.primary, borderRadius: 6, flexBasis: grow ? 0 : undefined, flexGrow: grow ? 1 : 0, justifyContent: "center",
        minHeight: 44, minWidth: 0, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, width: narrow ? undefined : 190
      })}
    >
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: narrow ? 13.5 : 14, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

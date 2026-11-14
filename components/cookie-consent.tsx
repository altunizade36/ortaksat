import { Link, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { onOpenCookiePreferences, readCookieConsent, saveCookieConsent } from "@/lib/cookie-consent";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { metaPixelEnabled } from "@/lib/meta-pixel";
import { isMobileApp } from "@/lib/mobile-app";

/**
 * ÇEREZ ONAY BANDI + TERCİH PANELİ (yalnız web; uygulamada çerez yok).
 *
 * KVKK Kurulu Çerez Rehberi'ne göre:
 *  - Zorunlu olmayan her şey varsayılan KAPALI; ön-işaretli seçenek yok.
 *  - "Reddet" ile "Kabul Et" AYNI görünürlükte ve tek tıkla.
 *  - Bant siteyi kilitlemez (çerez duvarı değil): kullanıcı seçim yapmadan da gezebilir; seçim yapılana
 *    kadar analitik/pazarlama betikleri YÜKLENMEZ.
 *  - Tercih, alt bilgideki "Çerez Tercihleri"nden her an değiştirilebilir / geri alınabilir.
 *
 * SSG/hidrasyon: bant yalnız mount SONRASI çizilir (sunucu HTML'inde yok) → #418 uyuşmazlığı ve LCP etkisi olmaz;
 * position:fixed olduğu için düzen kaymaz (CLS 0).
 */
export function CookieConsent() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const tr = useCallback((value: string) => translateCopy(value, language), [language]);
  const [mode, setMode] = useState<"hidden" | "banner" | "preferences">("hidden");
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || isMobileApp) return;
    const stored = readCookieConsent();
    if (!stored) setMode("banner");
    return onOpenCookiePreferences(() => {
      const current = readCookieConsent();
      setAnalytics(current?.analytics === true);
      setMarketing(current?.marketing === true);
      setMode("preferences");
    });
  }, []);

  if (Platform.OS !== "web" || isMobileApp || mode === "hidden") return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    saveCookieConsent({ analytics: choice.analytics, marketing: metaPixelEnabled ? choice.marketing : false });
    setMode("hidden");
  };
  const narrow = width > 0 && width < 640;

  // İlk karşılama: ince, tek sıralık bant (dar ekranda metin + tek sıra düğme). Ayrıntılı açıklama ve
  // kategori anahtarları yalnız "Tercihleri Yönet"e basılınca ya da alt bilgiden açılan panelde gösterilir.
  if (mode === "banner") {
    const stacked = width > 0 && width < 820;
    return (
      <View
        testID="cookie-consent"
        accessibilityRole={"dialog" as never}
        accessibilityLabel={tr("Çerez tercihleri")}
        style={{
          position: "fixed" as never, bottom: narrow ? 8 : 14, left: narrow ? 8 : 16, right: narrow ? 8 : 16, zIndex: 9000,
          alignItems: "center", pointerEvents: "box-none"
        }}
      >
        <View style={{
          alignItems: stacked ? "stretch" : "center", backgroundColor: "#FFFFFF", borderColor: "#DCE5F8", borderRadius: 14, borderWidth: 1,
          boxShadow: "0 6px 22px rgba(9,39,94,0.13)" as never, flexDirection: stacked ? "column" : "row", gap: stacked ? 8 : 14,
          maxWidth: 1040, paddingHorizontal: stacked ? 12 : 16, paddingVertical: stacked ? 10 : 8, width: "100%"
        }}>
          <Text style={{ color: "#33425F", flex: stacked ? undefined : 1, fontSize: 13, lineHeight: 18, minWidth: 0 }}>
            {metaPixelEnabled
              ? tr("Zorunlu kayıtların dışında, yalnız izin verirsen analitik ve reklam ölçümü araçlarını çalıştırırız.")
              : tr("Zorunlu kayıtların dışında, yalnız izin verirsen analitik araçlarını çalıştırırız.")}
            {" "}
            <Link href={"/cerez-politikasi" as Href} style={{ color: colors.primaryDark, fontWeight: "700", textDecorationLine: "underline" }}>{tr("Ayrıntılar")}</Link>
          </Text>
          {/* Üç seçenek de bilinçli olarak AYNI görünüm ve AYNI boyutta (rehber: kabul / reddet / tercihler eşit olmalı). */}
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <SlimButton label={tr("Tercihler")} onPress={() => setMode("preferences")} testID="cookie-manage" grow={stacked} />
            <SlimButton label={tr("Reddet")} onPress={() => decide({ analytics: false, marketing: false })} testID="cookie-reject" grow={stacked} />
            <SlimButton label={tr("Kabul Et")} onPress={() => decide({ analytics: true, marketing: true })} testID="cookie-accept" grow={stacked} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="cookie-consent"
      accessibilityRole={"dialog" as never}
      accessibilityLabel={tr("Çerez tercihleri")}
      style={{
        position: "fixed" as never, bottom: narrow ? 8 : 16, left: narrow ? 8 : 16, right: narrow ? 8 : 16, zIndex: 9000,
        alignItems: "center", pointerEvents: "box-none"
      }}
    >
      <View style={{
        backgroundColor: "#FFFFFF", borderColor: "#D5DFF5", borderRadius: 16, borderWidth: 1, maxWidth: 760, width: "100%",
        padding: narrow ? 14 : 18, boxShadow: "0 12px 40px rgba(9,39,94,0.22)" as never, maxHeight: "86vh" as never
      }}>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ color: "#09275E", fontSize: 16, fontWeight: "800" }}>
            {tr("Çerez tercihlerin")}
          </Text>
          <Text style={{ color: "#33425F", fontSize: 13.5, lineHeight: 20 }}>
            {metaPixelEnabled
              ? tr("OrtakSat'ın çalışması için zorunlu olan oturum, güvenlik ve tercih kayıtlarını kullanırız; bunlar için izin gerekmez. İzin verirsen site kullanımını ölçen analitik araçlarını ve reklam ölçümü çerezlerini de çalıştırırız. İzin vermezsen bunlar hiç yüklenmez ve siteyi aynı şekilde kullanmaya devam edersin.")
              : tr("OrtakSat'ın çalışması için zorunlu olan oturum, güvenlik ve tercih kayıtlarını kullanırız; bunlar için izin gerekmez. İzin verirsen site kullanımını ölçen analitik araçlarını da çalıştırırız. İzin vermezsen bunlar hiç yüklenmez ve siteyi aynı şekilde kullanmaya devam edersin.")}
          </Text>

          {mode === "preferences" ? (
            <View style={{ gap: 8 }}>
              <Category
                title={tr("Zorunlu kayıtlar")}
                description={tr("Giriş oturumun, güvenlik, dil seçimin ve bu çerez tercihin gibi sitenin çalışması için gerekli kayıtlar. Kapatılamaz.")}
                fixedLabel={tr("Her zaman açık")}
              />
              <Category
                title={tr("Analitik ölçüm")}
                description={tr("Ziyaret ve sayfa hızı istatistikleri (Vercel Web Analytics ve Speed Insights). Çerez yerleştirmez ve seni kişisel olarak tanımlamaz; yalnız izin verirsen çalışır.")}
                value={analytics}
                onChange={setAnalytics}
                onLabel={tr("İzin verildi")}
                offLabel={tr("İzin verilmedi")}
              />
              {metaPixelEnabled ? (
                <Category
                  title={tr("Pazarlama ve reklam ölçümü")}
                  description={tr("Reklamlarımızın etkisini ölçmek için Meta (Facebook / Instagram) Pixel. Cihazına çerez yerleştirir ve verileri yurt dışındaki Meta sunucularına iletir; yalnız açık rızanla çalışır.")}
                  value={marketing}
                  onChange={setMarketing}
                  onLabel={tr("İzin verildi")}
                  offLabel={tr("İzin verilmedi")}
                />
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            <PolicyLink href={"/cerez-politikasi" as Href} label={tr("Çerez Politikası")} />
            <Text style={{ color: "#9AABD0", fontSize: 12.5, lineHeight: 28 }}>·</Text>
            <PolicyLink href={"/kvkk" as Href} label={tr("KVKK Aydınlatma Metni")} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
            {/* Üç düğme de bilinçli olarak AYNI renk, boyut ve puntoda (rehber: kabul / reddet / tercihler eşit görünürlükte olmalı). */}
            <ChoiceButton label={tr("Reddet")} onPress={() => decide({ analytics: false, marketing: false })} testID="cookie-reject" narrow={narrow} />
            <ChoiceButton label={tr("Kabul Et")} onPress={() => decide({ analytics: true, marketing: true })} testID="cookie-accept" narrow={narrow} />
            <ChoiceButton label={tr("Seçimimi Kaydet")} onPress={() => decide({ analytics, marketing })} testID="cookie-save" narrow={narrow} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function PolicyLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={{ justifyContent: "center", minHeight: 28 }}>
        <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "700", textDecorationLine: "underline" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function SlimButton({ label, onPress, testID, grow }: { label: string; onPress: () => void; testID: string; grow: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center", backgroundColor: pressed ? "#EEF3FF" : "#FFFFFF", borderColor: "#B9C8EC", borderRadius: 10, borderWidth: 1,
        // Üç düğme AYNI GENİŞLİKTE: dar ekranda satırı eşit paylaşır (flexBasis 0), geniş ekranda sabit genişlik.
        // İçeriğe göre genişlerse "Reddet" ile "Kabul Et" farklı boyda kalıyordu (rehber: eşit büyüklük).
        flexBasis: grow ? 0 : undefined, flexGrow: grow ? 1 : 0, justifyContent: "center", minHeight: grow ? 40 : 34, minWidth: 0,
        paddingHorizontal: grow ? 6 : 10, width: grow ? undefined : 104
      })}
    >
      <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function ChoiceButton({ label, onPress, subtle, testID, narrow }: { label: string; onPress: () => void; subtle?: boolean; testID: string; narrow: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5,
        flexGrow: 1, flexBasis: narrow ? "46%" : 0, minWidth: 0,
        backgroundColor: subtle ? "#FFFFFF" : colors.primary, borderColor: subtle ? "#C5D3F2" : colors.primary
      }}
    >
      <Text numberOfLines={1} style={{ color: subtle ? colors.primaryDark : "#FFFFFF", fontSize: 14, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function Category(props: {
  title: string; description: string; fixedLabel?: string;
  value?: boolean; onChange?: (next: boolean) => void; onLabel?: string; offLabel?: string;
}) {
  const { title, description, fixedLabel, value, onChange, onLabel, offLabel } = props;
  return (
    <View style={{ backgroundColor: "#F5F8FF", borderColor: "#DCE5F8", borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <Text style={{ color: "#09275E", flex: 1, fontSize: 14, fontWeight: "800", minWidth: 0 }}>{title}</Text>
        {fixedLabel ? (
          <Text style={{ color: "#4A5A7A", fontSize: 12, fontWeight: "700" }}>{fixedLabel}</Text>
        ) : (
          // RN-web Switch'in turkuaz topuz tuzağı yüzünden özel anahtar (marka mavisi).
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value === true }}
            aria-checked={value === true}
            accessibilityLabel={`${title}: ${value ? onLabel : offLabel}`}
            onPress={() => onChange?.(!value)}
            style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: 32 }}
          >
            <Text style={{ color: value ? colors.primaryDark : "#4A5A7A", fontSize: 12, fontWeight: "700" }}>{value ? onLabel : offLabel}</Text>
            <View style={{ backgroundColor: value ? colors.primary : "#B8C4DC", borderRadius: 999, height: 24, justifyContent: "center", padding: 2, width: 44 }}>
              <View style={{ alignSelf: value ? "flex-end" : "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} />
            </View>
          </Pressable>
        )}
      </View>
      <Text style={{ color: "#33425F", fontSize: 12.5, lineHeight: 18 }}>{description}</Text>
    </View>
  );
}

import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { BlogCover } from "@/components/blog-cover";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { ContentPageView } from "@/components/content-page-view";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { getPost, type BlogPost } from "@/lib/blog";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * NASIL ÇALIŞIR — platformun GERÇEK akışını anlatır (2026-11-15'te yeniden kuruldu: eski sayfa üç kısa kutu ve dört
 * sorudan ibaretti, masaüstünde yarım ekran boş kalıyordu; yeşil / mor / turuncu çipler marka renklerinin dışındaydı).
 *
 * İçerik kuralı: buradaki her cümle uygulamada gerçekten olan bir şeyi anlatır — OrtakSat para tutmaz ve komisyon
 * kesmez, zorunlu bağlantı/takip yoktur, komisyon şartları ortak katılınca kilitlenir, satışı satıcı kaydeder,
 * ödemeyi satıcı doğrudan ortağa yapar ve iki taraf onaylar. Akış değişirse bu sayfa da güncellenmelidir.
 * Renk kuralı: yalnız marka mavisi + lacivert + nötr tonlar (yeşil, mor, turuncu yok).
 */
const STEPS: Array<{ n: string; icon: IconName; title: string; body: string }> = [
  { n: "1", icon: "store-plus-outline", title: "İlanını ver ya da bir ilan seç", body: "Satıcıysan ürününü ücretsiz yayınla ve ortağa vereceğin komisyonu belirle. Ortaksan komisyonu sana uyan bir ilan seç." },
  { n: "2", icon: "handshake-outline", title: "Ortaklığı kur", body: "Ortak ilana başvurur, satıcı kabul eder. Kabul anında komisyon şartları iki taraf için de kilitlenir." },
  { n: "3", icon: "bullhorn-outline", title: "Ortak ürünü tanıtır", body: "Ortak ürünü kendi çevresinde ve sosyal medyasında, kendi yöntemiyle tanıtır. Zorunlu bağlantı ya da takip kodu yoktur." },
  { n: "4", icon: "cash-check", title: "Satış olur, komisyon ödenir", body: "Satıcı satışı kaydeder, komisyonu doğrudan ortağa öder. İki taraf ödemeyi onaylar; süreç kayıt altında kalır." }
];

type RoleKey = "seller" | "partner" | "buyer";
const ROLES: Record<RoleKey, { label: string; icon: IconName; lead: string; steps: string[]; cta: { label: string; href: "/create" | "/partner" | "/explore" } }> = {
  seller: {
    label: "Satıcıyım",
    icon: "storefront-outline",
    lead: "Ürünün senin; satışı ortakların büyütür. İlan vermek ücretsizdir ve komisyonu yalnız satış olursa ödersin.",
    steps: [
      "Ürününü fotoğraflarıyla ücretsiz yayınla; fiyatını sen belirle.",
      "Ortağa vereceğin komisyonu seç: yüzde ya da sabit tutar. İstersen komisyonsuz, normal ilan da verebilirsin.",
      "Ortaklığı kime açacağına karar ver: herkese açık, senin onayınla ya da yalnız davet ettiklerine.",
      "Gelen başvuruları incele; ortağın profilini, puanını ve geçmişini gör, kabul et ya da reddet.",
      "Satış gerçekleşince satışı ilgili ortağa kaydet; komisyon tutarı anlaşmadaki şarta göre hesaplanır.",
      "Komisyonu ortağa doğrudan öde ve \"ödedim\" olarak işaretle. Ortak onaylayınca işlem tamamlanır."
    ],
    cta: { label: "Ücretsiz İlan Ver", href: "/create" }
  },
  partner: {
    label: "Ortak olmak istiyorum",
    icon: "account-group-outline",
    lead: "Ürünün olmasına gerek yok. Güvendiğin bir ilanı çevrene tanıtırsın, satış olursa anlaştığın komisyonu kazanırsın.",
    steps: [
      "Ortaklığa açık ilanları incele; her ilanda satışta kazanacağın tutar açıkça yazar.",
      "İlana ortak ol. Açık ilanlarda hemen başlarsın, onaylı ilanlarda satıcının kabulünü beklersin.",
      "Ürünü kendi yönteminle tanıt. Paylaşımının bir tanıtım olduğunu ve satıcının adını belirtmeyi unutma.",
      "Bulduğun müşteriyi ortaklık ekranından ekle; görüşme ilerledikçe aşamasını işaretle.",
      "Satıcı satışı kaydedince komisyonun \"Kazançlar\" bölümünde görünür.",
      "Ödemeyi satıcıdan doğrudan alırsın; \"aldım\" diye onaylarsın. Sorun olursa anlaşmazlık bildirebilirsin."
    ],
    cta: { label: "Ortaklık Fırsatlarını Gör", href: "/partner" }
  },
  buyer: {
    label: "Alıcıyım",
    icon: "shopping-outline",
    lead: "Senin için sıradan bir ilan sitesi gibidir. Ürünün fiyatı ortak olsa da olmasa da aynıdır; ek bir ücret ödemezsin.",
    steps: [
      "Kategorilerden ya da aramadan ürünü bul; fotoğrafları, özellikleri ve satıcının profilini incele.",
      "Satıcıya mesaj at, soru sor ya da teklif ver.",
      "Ödeme ve teslimatı satıcıyla aranızda kararlaştırın. OrtakSat ödeme almaz ve kargo yapmaz.",
      "Ürünü görmeden ödeme yapma; kapora isteyenlere dikkat et. Şüpheli ilanı tek dokunuşla bildir.",
      "Alışverişten sonra satıcıyı değerlendir; yorumun herkese açık olur."
    ],
    cta: { label: "İlanları Keşfet", href: "/explore" }
  }
};

const TIMELINE: Array<{ icon: IconName; title: string; who: string }> = [
  { icon: "send-outline", title: "Başvuru", who: "Ortak" },
  { icon: "check-decagram-outline", title: "Kabul ve şartların kilitlenmesi", who: "Satıcı" },
  { icon: "account-plus-outline", title: "Müşteri bildirimi", who: "Ortak" },
  { icon: "receipt-text-outline", title: "Satış kaydı", who: "Satıcı" },
  { icon: "bank-transfer-out", title: "Komisyon ödemesi", who: "Satıcı" },
  { icon: "check-all", title: "\"Aldım\" onayı", who: "Ortak" }
];

const TRUST: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "lock-check-outline", title: "Anlaşma kilitlenir", body: "Ortak ilana katıldığı anda komisyon şartları kaydedilir. Satıcı ilanı sonradan değiştirse de mevcut ortağın komisyonu değişmez." },
  { icon: "timeline-check-outline", title: "Her adım kayıtlı", body: "Başvuru, kabul, müşteri, satış ve ödeme adımları tarihleriyle tutulur; iki taraf aynı işlem geçmişini görür." },
  { icon: "shield-account-outline", title: "Doğrulama ve yorumlar", body: "Telefon ve kimlik doğrulaması profilde rozetle görünür. Satıcı ortağı, ortak satıcıyı değerlendirir; yorumlar herkese açıktır." },
  { icon: "scale-balance", title: "Anlaşmazlık bildirimi", body: "Komisyon ödenmediyse ya da kayıt yanlışsa ortak, satış kaydı üzerinden anlaşmazlık bildirebilir; durum iki tarafın panelinde görünür. Çözülmezse destek talebi açılabilir." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "OrtakSat ücretli mi, komisyon kesiyor mu?", a: "Hayır. Üyelik ve ilan vermek ücretsizdir. OrtakSat satıştan pay almaz, ödeme almaz ve para tutmaz. Komisyon yalnız satıcı ile ortak arasındadır ve satıcı tarafından doğrudan ortağa ödenir." },
  { q: "Ortak, ürünü nasıl satar? Bağlantı mı kullanılır?", a: "Zorunlu bir referans bağlantısı, kod ya da takip sistemi yoktur. Ortak ürünü sosyal medyasında, çevresinde ya da müşterilerine istediği yöntemle tanıtır. Kolaylık olsun diye ilanın bağlantısını paylaşabilir; satış ve komisyon, satıcı ile ortak arasındaki anlaşmaya dayanır." },
  { q: "Komisyon ne zaman ve nasıl ödenir?", a: "Satış gerçekleşince satıcı satışı ilgili ortağa kaydeder; tutar anlaşmadaki orana ya da sabit tutara göre hesaplanır ve ortağın panelinde görünür. Ödemeyi satıcı, aranızda kararlaştırdığınız yoldan (ör. havale) doğrudan ortağa yapar ve \"ödedim\" diye işaretler; ortak \"aldım\" diye onaylar." },
  { q: "Satıcı komisyonu sonradan düşürebilir mi?", a: "Mevcut ortak için hayır. Ortak katıldığı anda geçerli olan komisyon şartı o ortaklığa kilitlenir. Satıcı ilandaki komisyonu değiştirirse yeni şart yalnız sonradan katılan ortaklara uygulanır." },
  { q: "Komisyon vermek zorunda mıyım?", a: "Hayır. Satıcı isterse komisyonsuz, normal bir ilan verir; ilan yine aramalarda ve kategorilerde görünür. Komisyon belirlemek, ilanı ortaklara açmak isteyen satıcı içindir." },
  { q: "Satıcı komisyonu ödemezse ne olur?", a: "Ortak, satış kaydı üzerinden anlaşmazlık bildirebilir ve destek talebi açabilir; incelemede başvuru, kabul, satış ve ödeme kayıtları esas alınır. OrtakSat ödemeyi garanti etmez ve taraflar adına tahsilat yapmaz; ancak kayıtlar ve herkese açık değerlendirmeler güvenilmez tarafı görünür kılar." },
  { q: "Alıcı ortaklık sistemini kullanmak zorunda mı?", a: "Hayır. Alıcı ürünü inceler, satıcıyla mesajlaşır ve doğrudan satıcıdan alır. Ürünün fiyatı ortak olsa da olmasa da aynıdır; ortaklık yalnız satıcı ile satış ortağı arasındadır." },
  { q: "Paylaşım yaparken nelere dikkat etmeliyim?", a: "Komisyon karşılığı yapılan paylaşım bir reklamdır. Paylaşımın başında bunun bir tanıtım olduğunu ve satıcının adını belirtmelisin; uygulamadaki \"Paylaş\" düğmesi bu ifadeyi metne kendisi ekler. Ürün hakkında doğrulanmamış vaatlerde bulunma." }
];

// Satıcı, ortak ve alıcı için birer blog yazısı (adres değişirse eksik olan sessizce düşer, bölüm boş kalırsa gizlenir).
const GUIDES: BlogPost[] = [
  "urununu-ucretsiz-nasil-sattirirsin-ortak-satis-rehberi",
  "sifir-sermaye-ile-ek-gelir-ortak-satis-nasil-yapilir",
  "ikinci-el-alirken-dolandiriciliktan-korunma"
].map((slug) => getPost(slug)).filter((post): post is BlogPost => Boolean(post));

export default function HowItWorksPage() {
  return <ContentPageView slug="nasil-calisir" fallback={<HowItWorksStatic />} />;
}

function HowItWorksStatic() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const tr = (value: string) => translateCopy(value, language);
  const [roleKey, setRoleKey] = useState<RoleKey>("seller");
  const role = ROLES[roleKey];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Head><title>{tr("Nasıl Çalışır? — Ortak sat, komisyon kazan | OrtakSat")}</title><meta name="description" content={tr("OrtakSat nasıl çalışır: ilan ver, ortak satışa aç, komisyonu belirle. Ortaklar ürününü tanıtır, satışta komisyon kazanır. Aracı platform — ödeme taraflar arasında.")} /></Head>

      <View style={{ alignSelf: "center", gap: isWideWeb ? 34 : 26, maxWidth: PAGE_MAX_WIDTH, paddingHorizontal: isWideWeb ? 20 : 16, paddingTop: 16, width: "100%" }}>
        {/* ---- Giriş ---- */}
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 28 : 12, paddingHorizontal: isWideWeb ? 36 : 18, paddingVertical: isWideWeb ? 30 : 20 }}>
          <Mascot name="laptop" size={isWideWeb ? 150 : 96} priority panel panelColor="#FFFFFF" />
          <View style={{ alignItems: isWideWeb ? "flex-start" : "center", flex: 1, gap: 12, minWidth: 0 }}>
            <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: isWideWeb ? 34 : 24, fontWeight: "900", lineHeight: isWideWeb ? 40 : 30, textAlign: isWideWeb ? "left" : "center" }}>{tr("OrtakSat nasıl çalışır?")}</Text>
            <Text style={{ color: colors.muted, fontSize: isWideWeb ? 16 : 14, fontWeight: "600", lineHeight: isWideWeb ? 25 : 21, maxWidth: 640, textAlign: isWideWeb ? "left" : "center" }}>{tr("Satıcı ürününü ücretsiz yayınlar ve komisyonunu belirler. Ortaklar ürünü kendi çevresinde tanıtır; satış olursa komisyonu satıcıdan alır. OrtakSat aracıdır: para tutmaz, satıştan pay almaz.")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: isWideWeb ? "flex-start" : "center" }}>
              <CtaLink href="/create" icon="store-plus-outline" label={tr("İlan Ver")} primary />
              <CtaLink href="/partner" icon="handshake-outline" label={tr("Ortak Satıcı Ol")} />
            </View>
          </View>
        </View>

        {/* ---- Dört adım ---- */}
        <View style={{ gap: 14 }}>
          <SectionTitle sub={tr("İlandan komisyon ödemesine kadar olan yol.")}>{tr("Dört adımda ortak satış")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {STEPS.map((step) => (
              <View key={step.n} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: isWideWeb ? 250 : "100%", flexGrow: 1, gap: 10, minWidth: 0, padding: 18 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{step.n}</Text>
                  </View>
                  <MaterialCommunityIcons name={step.icon} size={24} color={colors.primaryDark} />
                </View>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900", lineHeight: 21 }}>{tr(step.title)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{tr(step.body)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---- Örnek: para kimde kalır ---- */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 16, padding: isWideWeb ? 26 : 18 }}>
          <SectionTitle sub={tr("Fiyatı 35.000 TL olan bir ürün ve 3.000 TL komisyon için.")}>{tr("Bir örnekle: para kimde kalır?")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {([
              { icon: "shopping-outline", who: "Alıcı", amount: "35.000 TL öder", note: "Ürünün fiyatı aynıdır; ek ücret yok." },
              { icon: "storefront-outline", who: "Satıcı", amount: "32.000 TL kalır", note: "Komisyonu yalnız satış olursa öder." },
              { icon: "account-group-outline", who: "Ortak", amount: "3.000 TL kazanır", note: "Satıcıdan doğrudan alır." },
              { icon: "hand-coin-outline", who: "OrtakSat", amount: "0 TL", note: "Pay almaz, parayı tutmaz." }
            ] as Array<{ icon: IconName; who: string; amount: string; note: string }>).map((row) => (
              <View key={row.who} style={{ backgroundColor: colors.primarySoft, borderRadius: 14, flexBasis: isWideWeb ? 220 : "47%", flexGrow: 1, gap: 4, minWidth: 0, padding: 14 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                  <MaterialCommunityIcons name={row.icon} size={18} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{tr(row.who)}</Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: isWideWeb ? 21 : 17, fontWeight: "900" }}>{tr(row.amount)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{tr(row.note)}</Text>
              </View>
            ))}
          </View>
          <Link href="/ortak-kazanc" asChild>
            <Pressable accessibilityRole="link" style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5 }}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{tr("Kendi rakamlarınla hesapla")}</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
            </Pressable>
          </Link>
        </View>

        {/* ---- Rol seçimi: adım adım ---- */}
        <View style={{ gap: 14 }}>
          <SectionTitle sub={tr("Rolünü seç; senin için sırasıyla ne yapacağını gör.")}>{tr("Sen hangisisin?")}</SectionTitle>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(ROLES) as RoleKey[]).map((key) => {
              const on = key === roleKey;
              return (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setRoleKey(key)}
                  style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", flexGrow: isWideWeb ? 0 : 1, gap: 8, justifyContent: "center", minHeight: 46, paddingHorizontal: 18 }}>
                  <MaterialCommunityIcons name={ROLES[key].icon} size={19} color={on ? "#FFFFFF" : colors.primaryDark} />
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 14, fontWeight: "900" }}>{tr(ROLES[key].label)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, padding: isWideWeb ? 26 : 18 }}>
            <Text style={{ color: colors.ink, fontSize: isWideWeb ? 16 : 14.5, fontWeight: "700", lineHeight: isWideWeb ? 25 : 22, maxWidth: 820 }}>{tr(role.lead)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {role.steps.map((text, index) => (
                <View key={text} style={{ alignItems: "flex-start", flexBasis: isWideWeb ? "47%" : "100%", flexDirection: "row", flexGrow: 1, gap: 11, minWidth: 0 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 26, justifyContent: "center", marginTop: 1, width: 26 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{index + 1}</Text>
                  </View>
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 21, minWidth: 0 }}>{tr(text)}</Text>
                </View>
              ))}
            </View>
            <View style={{ alignSelf: "flex-start" }}><CtaLink href={role.cta.href} icon={role.icon} label={tr(role.cta.label)} primary /></View>
          </View>
        </View>

        {/* ---- Komisyon süreci ---- */}
        <View style={{ gap: 14 }}>
          <SectionTitle sub={tr("Her adımı kimin attığı bellidir; hepsi tarihleriyle kaydedilir.")}>{tr("Bir ortaklığın yolculuğu")}</SectionTitle>
          <View style={{ flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 0 : 0 }}>
            {TIMELINE.map((item, index) => (
              <View key={item.title} style={{ alignItems: isWideWeb ? "center" : "flex-start", flex: isWideWeb ? 1 : undefined, flexDirection: isWideWeb ? "column" : "row", gap: isWideWeb ? 8 : 12, minWidth: 0 }}>
                <View style={{ alignItems: "center", alignSelf: "stretch", flexDirection: isWideWeb ? "row" : "column", width: isWideWeb ? undefined : 44 }}>
                  {isWideWeb ? <View style={{ backgroundColor: index === 0 ? "transparent" : colors.line, flex: 1, height: 2 }} /> : null}
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 44, justifyContent: "center", width: 44 }}>
                    <MaterialCommunityIcons name={item.icon} size={21} color="#FFFFFF" />
                  </View>
                  {isWideWeb
                    ? <View style={{ backgroundColor: index === TIMELINE.length - 1 ? "transparent" : colors.line, flex: 1, height: 2 }} />
                    : index < TIMELINE.length - 1 ? <View style={{ backgroundColor: colors.line, flex: 1, minHeight: 22, width: 2 }} /> : null}
                </View>
                <View style={{ alignItems: isWideWeb ? "center" : "flex-start", flex: isWideWeb ? undefined : 1, gap: 2, minWidth: 0, paddingBottom: isWideWeb ? 0 : 18, paddingHorizontal: isWideWeb ? 6 : 0, paddingTop: isWideWeb ? 0 : 9 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900", lineHeight: 18, textAlign: isWideWeb ? "center" : "left" }}>{tr(item.title)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{tr(item.who)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ---- Güven ---- */}
        <View style={{ gap: 14 }}>
          <SectionTitle sub={tr("Para platformdan geçmez; güveni kayıtlar ve açık değerlendirmeler sağlar.")}>{tr("Güveni ne sağlıyor?")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {TRUST.map((item) => (
              <View key={item.title} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: isWideWeb ? 280 : "100%", flexGrow: 1, gap: 8, minWidth: 0, padding: 18 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={colors.primaryDark} />
                </View>
                <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{tr(item.title)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{tr(item.body)}</Text>
              </View>
            ))}
          </View>
          <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 14, flexDirection: "row", gap: 10, padding: 14 }}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 20, minWidth: 0 }}>{tr("OrtakSat bir aracı platformdur: ödeme almaz, para tutmaz, kargo yapmaz ve ödemeyi garanti etmez. Ödeme ve teslimat şartlarını taraflar kendi aralarında belirler.")}{" "}
              <Link href="/guvenli-alisveris" style={{ color: colors.primaryDark, fontWeight: "900", textDecorationLine: "underline" }}>{tr("Güvenli alışveriş rehberi")}</Link>
            </Text>
          </View>
        </View>

        {/* ---- Sık sorulan sorular ---- */}
        <View style={{ gap: 12 }}>
          <SectionTitle>{tr("Sık sorulan sorular")}</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {FAQ.map((item) => (
              <View key={item.q} style={{ flexBasis: isWideWeb ? "48%" : "100%", flexGrow: 1, minWidth: 0 }}>
                <Accordion title={tr(item.q)} icon="comment-question-outline">
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{tr(item.a)}</Text>
                </Accordion>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, justifyContent: "center", marginTop: 4 }}>
            <TextLink href="/sss" label={tr("Tüm sorular")} />
            <TextLink href="/ortak-satis-nedir" label={tr("Ortak satış nedir?")} />
            <TextLink href="/blog" label={tr("Blog: rehberler ve ipuçları")} />
          </View>
        </View>

        {/* ---- Rehberler: her role bir yazı ---- */}
        {GUIDES.length > 0 ? (
          <View style={{ gap: 14 }}>
            <SectionTitle sub={tr("Daha ayrıntılı okumak isteyenler için blogdan üç yazı.")}>{tr("Rehberlerle derinleş")}</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {GUIDES.map((post) => (
                <Link key={post.slug} href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel={post.title} dataSet={{ card: "blog" }} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: isWideWeb ? 280 : "100%", flexDirection: isWideWeb ? "column" : "row", flexGrow: 1, minWidth: 0, overflow: "hidden" }}>
                    <View style={{ height: isWideWeb ? 120 : 96, width: isWideWeb ? "100%" : 96 }}>
                      <BlogCover post={post} variant={isWideWeb ? "card" : "thumb"} />
                    </View>
                    <View style={{ flex: 1, gap: 5, justifyContent: "center", minWidth: 0, padding: 14 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{post.category}</Text>
                      <Text numberOfLines={3} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800", lineHeight: 20 }}>{post.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{post.readMin} {tr("dk okuma")}</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---- Kapanış ---- */}
        <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: 14, justifyContent: "space-between", marginBottom: 26, paddingHorizontal: isWideWeb ? 30 : 18, paddingVertical: isWideWeb ? 24 : 20 }}>
          <View style={{ flex: isWideWeb ? 1 : undefined, gap: 4, minWidth: 0 }}>
            <Text style={{ color: "#FFFFFF", fontSize: isWideWeb ? 21 : 18, fontWeight: "900", textAlign: isWideWeb ? "left" : "center" }}>{tr("Hazırsan başla — birlikte kazan.")}</Text>
            <Text style={{ color: "#D7E2F6", fontSize: 13.5, fontWeight: "600", textAlign: isWideWeb ? "left" : "center" }}>{tr("Üyelik ve ilan vermek ücretsiz.")}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <CtaLink href="/create" icon="plus-circle-outline" label={tr("İlan Ver")} onDark primary />
            <CtaLink href="/partner" icon="account-multiple-plus-outline" label={tr("Ortak Ol")} onDark />
          </View>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 2 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 21, fontWeight: "900", lineHeight: 27 }}>{children}</Text>
      {sub ? <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{sub}</Text> : null}
    </View>
  );
}

/** Düğme görünümlü bağlantı. Stil SABİT nesnedir (Link asChild + işlev stil web'de arka planı düşürüyor). */
function CtaLink({ href, icon, label, primary, onDark }: { href: "/create" | "/partner" | "/explore"; icon: IconName; label: string; primary?: boolean; onDark?: boolean }) {
  const filled = primary ? (onDark ? "#FFFFFF" : colors.primary) : onDark ? "rgba(255,255,255,0.14)" : "#FFFFFF";
  const ink = primary ? (onDark ? colors.primaryDark : "#FFFFFF") : onDark ? "#FFFFFF" : colors.primaryDark;
  const border = primary ? filled : onDark ? "rgba(255,255,255,0.5)" : colors.primary;
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={{ alignItems: "center", backgroundColor: filled, borderColor: border, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 20 }}>
        <MaterialCommunityIcons name={icon} size={18} color={ink} />
        <Text style={{ color: ink, fontSize: 14.5, fontWeight: "900" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function TextLink({ href, label }: { href: "/sss" | "/ortak-satis-nedir" | "/blog"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
        <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{label}</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
      </Pressable>
    </Link>
  );
}

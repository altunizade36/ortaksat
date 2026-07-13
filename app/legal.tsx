import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { LegalLibrary } from "@/components/legal-library";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";


export default function LegalScreen() {
  const { language } = useLanguage();
  const legalParams = useLocalSearchParams<{ doc?: string }>();
  const initialDoc = typeof legalParams.doc === "string" ? legalParams.doc : undefined;
  const {
    authError,
    backendMode,
    createSupportTicket,
    currentUser,
    recordLegalConsent,
    requestAccountDeletion
  } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const isWideWeb = useIsWideWeb();
  const [subject, setSubject] = useState("Destek talebi");
  const [message, setMessage] = useState("Merhaba, Ortaksat hesabım veya ilan sürecim hakkında destek istiyorum.");
  const [deleteReason, setDeleteReason] = useState("Hesabımı ve kişisel verilerimi silmek istiyorum.");
  const [category, setCategory] = useState("Genel");
  const [priority, setPriority] = useState("Normal");

  async function acceptAll() {
    const results = await Promise.all([
      recordLegalConsent("privacy"),
      recordLegalConsent("terms"),
      recordLegalConsent("kvkk"),
      recordLegalConsent("seller_rules")
    ]);
    Alert.alert(
      translateCopy(results.every(Boolean) ? "Rıza kaydedildi" : "Giriş gerekli", language),
      translateCopy(results.every(Boolean)
        ? "Yasal metin onayların canlı hesaba kaydedildi."
        : "Rıza kaydı için e-posta ile giriş yapmalısın.", language)
    );
  }

  async function sendSupport() {
    const ok = await createSupportTicket(subject, message);
    Alert.alert(translateCopy(ok ? "Destek talebi alındı" : "Gönderilemedi", language), translateCopy(ok ? "Talebin destek kuyruğuna eklendi." : "Canlı hesapla giriş yapıp konu ve mesaj yazmalısın.", language));
  }

  async function requestDeletion() {
    const ok = await requestAccountDeletion(deleteReason);
    Alert.alert(translateCopy(ok ? "Silme talebi alındı" : "Talep açılamadı", language), translateCopy(ok ? "Hesap silme talebin kayıt altına alındı." : "Bu işlem için canlı hesapla giriş yapmalısın.", language));
  }

  if (isWideWeb) {
    const faqs: Array<{ q: string; a: string }> = [
      { q: "OrtakSat komisyon oranları nasıl belirlenir?", a: "Komisyon oranını ilanı açan satıcı, ürün başına yüzde veya sabit tutar olarak kendisi belirler. Ortak, paylaşmadan önce kazancını ilanda görür." },
      { q: "Kişisel verilerim nasıl korunuyor?", a: "Verileriniz 6698 sayılı KVKK kapsamında işlenir ve korunur. Detaylar için KVKK Aydınlatma Metni'ni inceleyebilirsiniz." },
      { q: "Son yapılan satıştan sonra iptal edebilir miyim?", a: "Satış ve iade koşulları satıcı ile alıcı arasında belirlenir. Anlaşmazlık durumunda Güven Merkezi üzerinden kayıt açabilirsiniz." },
      { q: "Hesabımı silersem verilerim ne olur?", a: "Hesap silme talebiniz KVKK kapsamında en geç 30 gün içinde sonuçlandırılır ve kişisel verileriniz kalıcı olarak silinir." },
      { q: "Hangi içerikler yasaklıdır?", a: "Sahte/taklit ürünler, yasa dışı ürünler, yanıltıcı içerik, spam ve marka ihlali yasaktır. Tam liste Yasaklı İçerikler sekmesindedir." },
      { q: "Uygunsuzluk durumunda nasıl destek alırım?", a: "Aşağıdaki formdan bir destek talebi oluşturabilir veya bir ilanı/kullanıcıyı Güven Merkezi üzerinden bildirebilirsiniz. Talebiniz kayıt altına alınır ve incelenir." }
    ];
    // Şu an yalnızca uygulama içi destek talebi aktiftir (telefon/WhatsApp hattı yoktur).
    const channels: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string; cta: string; tint: string; color: string }> = [
      { icon: "ticket-confirmation-outline", title: "Destek Talebi", sub: "Aşağıdaki formdan oluşturun", cta: "Talep Oluştur", tint: colors.infoSoft, color: colors.info },
      { icon: "flag-outline", title: "İlan / Kullanıcı Bildirimi", sub: "Güven Merkezi üzerinden bildirin", cta: "Güven Merkezi", tint: colors.accentSoft, color: colors.accent }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ gap: 16, paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
            <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Yasal ve Destek Merkezi</Text>
          </View>

          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "900" }}>Yasal ve Destek Merkezi</Text>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", maxWidth: 620 }}>Platform kuralları, KVKK, komisyon süreçleri, destek talepleri, uyuşmazlık çözüm yöntemleri ve hesap işlemlerinizle ilgili tüm bilgilere buradan ulaşabilirsiniz.</Text>
            </View>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 16, height: 70, justifyContent: "center", width: 90 }}>
              <MaterialCommunityIcons name="shield-lock" size={36} color={colors.primaryDark} />
            </View>
          </View>

          <LegalDisclaimer title="Ortaksat aracı bir platformdur — ödeme/komisyon/kargo işlemez" />

          {/* Gruplu hukuki belge kütüphanesi (tek kaynak: legal-content) */}
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Sözleşmeler ve Politikalar</Text>
          <LegalLibrary initialKey={initialDoc} />

          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
            {/* Main content */}
            <View style={{ flex: 1, gap: 18, minWidth: 0 }}>
              {/* Support + data request row */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 320, flexGrow: 1, gap: 12, minWidth: 0, padding: 20 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Destek Talebi Oluştur</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Yaşadığınız sorun veya talebiniz için bize ulaşın. En kısa sürede dönüş yapacağız.</Text>
                  <DeskField label="Konu" value={subject} onChangeText={setSubject} placeholder="Talebinizi kısa bir özetle" />
                  <View style={{ flexDirection: "row", gap: 12, zIndex: 20 }}>
                    <View style={{ flex: 1, zIndex: 20 }}><DeskSelect label="Kategori" value={category} options={["Genel", "İlan & Ortaklık", "Komisyon", "Güvenlik", "Hesap", "Teknik"]} onSelect={setCategory} /></View>
                    <View style={{ flex: 1, zIndex: 10 }}><DeskSelect label="Öncelik" value={priority} options={["Düşük", "Normal", "Yüksek"]} onSelect={setPriority} /></View>
                  </View>
                  <DeskField label="Mesajınız" value={message} onChangeText={setMessage} multiline placeholder="Lütfen talebinizi detaylı olarak açıklayın." />
                  <Pressable onPress={() => void sendSupport()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingVertical: 12 }}>
                    <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Talebi Gönder</Text>
                  </Pressable>
                </View>

                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 320, flexGrow: 1, gap: 12, minWidth: 0, padding: 20 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Hesap Silme / Veri Talebi</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Hesabınızı silmek veya kişisel verilerinizle ilgili talepte bulunmak için aşağıdaki seçenekleri kullanabilirsiniz.</Text>
                  {[
                    { icon: "shield-remove-outline" as const, t: "Hesabınız silindiğinde tüm verileriniz kalıcı olarak silinir." },
                    { icon: "timer-sand" as const, t: "KVKK kapsamında talepleriniz en geç 30 gün içinde sonuçlandırılır." },
                    { icon: "file-document-outline" as const, t: "Veri görüntüleme, düzeltme ve taşıma taleplerini KVKK sayfasından oluşturabilirsiniz." }
                  ].map((r) => (
                    <View key={r.t} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                      <MaterialCommunityIcons name={r.icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{r.t}</Text>
                    </View>
                  ))}
                  <View style={{ alignItems: "flex-start", backgroundColor: colors.warningSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
                    <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Bu işlem geri alınamaz. Devam etmeden önce lütfen koşulları dikkatle okuyun.</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Link href="/kvkk" asChild>
                      <Pressable style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Veri Talebi Oluştur</Text></Pressable>
                    </Link>
                    <Pressable onPress={() => void requestDeletion()} style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}><Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>Hesabımı Sil</Text></Pressable>
                  </View>
                </View>
              </View>

              {/* FAQ */}
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Sık sorulan yasal sorular</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flex: 1, gap: 12, minWidth: 280 }}>
                    {faqs.filter((_, i) => i % 2 === 0).map((f) => <Accordion key={f.q} title={f.q}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 20 }}>{f.a}</Text></Accordion>)}
                  </View>
                  <View style={{ flex: 1, gap: 12, minWidth: 280 }}>
                    {faqs.filter((_, i) => i % 2 === 1).map((f) => <Accordion key={f.q} title={f.q}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 20 }}>{f.a}</Text></Accordion>)}
                  </View>
                </View>
              </View>
            </View>

            {/* Right sidebar */}
            <View style={{ gap: 16, width: 300 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Destek kanallarımız</Text>
                {channels.map((c) => (
                  <View key={c.title} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                    <View style={{ alignItems: "center", backgroundColor: c.tint, borderRadius: 10, height: 38, justifyContent: "center", width: 38 }}>
                      <MaterialCommunityIcons name={c.icon} size={19} color={c.color} />
                    </View>
                    <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{c.title}</Text>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{c.sub}</Text>
                    </View>
                    <View style={{ borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{c.cta}</Text></View>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Destek nasıl işler?</Text>
                <SupportStep icon="pencil-outline" text="Aşağıdaki formdan destek talebini oluştur." />
                <SupportStep icon="content-save-check-outline" text="Talebin kayıt altına alınır ve sırayla incelenir." />
                <SupportStep icon="flag-outline" text="Bir ilan/kullanıcı için Güven Merkezi'nden bildirim açabilirsin." />
                <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>Şu an telefon/canlı destek hattı bulunmuyor; en hızlı ve kayıtlı yol destek talebidir.</Text>
              </View>

              <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <MaterialCommunityIcons name="shield-check" size={20} color={colors.primaryDark} />
                  <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>Güvenliğiniz önceliğimiz</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Kişisel verileriniz 6698 sayılı KVKK kapsamında korunur. Detaylı bilgi için KVKK Aydınlatma Metni'ni inceleyebilirsiniz.</Text>
                <Link href="/kvkk" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 11 }}><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>KVKK Aydınlatma Metni'ni İncele</Text></Pressable>
                </Link>
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 860, marginHorizontal: "auto", padding: 16, paddingBottom: 90, width: "100%" }}>
        <Seo title="Yasal & Destek — Sözleşmeler, KVKK, gizlilik | OrtakSat" description="OrtakSat yasal belgeleri: kullanım şartları, aracılık sözleşmesi, KVKK aydınlatma, gizlilik ve çerez politikası, yasaklı ürünler. Tümü tek sayfada." path="/legal" />
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label="KVKK / Gizlilik" tone="success" />
            <StatusPill label={isLiveAccount ? "Canlı hesap" : "Ön izleme"} tone={isLiveAccount ? "success" : "warning"} />
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
            {translateCopy("Yasal ve destek merkezi", language)}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {language === "en" ? "Ortaksat does not take payments and is not the seller of products in the first version. The app provides intermediary technology infrastructure for listings, partnership applications, messages, leads, and commission tracking records." : "Ortaksat ilk sürümde ödeme almaz ve ürünlerin satıcısı değildir. Uygulama; ilan, ortaklık başvurusu, mesaj, talep ve komisyon takip kayıtları için aracı teknoloji altyapısı sağlar."}
          </Text>
          {authError ? (
            <Text selectable style={{ color: colors.accent, fontSize: 13, lineHeight: 19 }}>
              {authError}
            </Text>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Yasal metin özeti" />
          <LegalRow icon="shield-account" title="KVKK aydınlatma" body="E-posta, profil, ilan, ortaklık, talep, mesaj, bildirim, yorum ve komisyon kayıtları hizmeti çalıştırmak, güvenliği sağlamak ve destek vermek için işlenir." />
          <LegalRow icon="file-document-check" title="Aracı platform şartı" body="Ortaksat aracı bir ilan/iletişim platformudur; ürün sahibi, satıcısı, ödeme kuruluşu veya teslimat tarafı değildir. Ödeme almaz, para tutmaz, komisyon kesmez, kargo/teslimat yapmaz; cüzdan, bakiye veya emanet (güvenli ödeme) sistemi yoktur. Ürün doğruluğu, fiyat, stok, teslimat, iade ve komisyon ödemesi tamamen ilgili kullanıcıların sorumluluğundadır." />
          <LegalRow icon="account-cash" title="Komisyon takip modeli" body="Uygulama para tutmaz ve dağıtmaz; satıştan kesinti yapmaz. Gösterilen komisyon yalnızca tarafların kendi belirlediği bilgidir. Ödeme satıcı ile ortak arasında, uygulama dışında yapılır; uygulama yalnızca kaydı tutar." />
          <LegalRow icon="lock-check" title="Gizlilik ve güvenlik" body="Gizli sunucu anahtarları mobil uygulamada tutulmaz. Kullanıcı verileri oturum, yetki ve dosya erişim kurallarıyla korunur." />
          <LegalRow icon="store-check" title="İlan ve paylaşım kuralları" body="Yanıltıcı fiyat, sahte stok, sahte ürün, spam paylaşım, marka ihlali, yasaklı ürün ve dolandırıcılık şüphesi moderasyona taşınır; hesap ve ilan kısıtlanabilir." />
          <PrimaryButton onPress={() => void acceptAll()}>Metinleri Okudum ve Kabul Ediyorum</PrimaryButton>
        </Card>

        <View style={{ gap: 10 }}>
          <SectionTitle title="Sözleşmeler ve Politikalar" />
          <LegalLibrary initialKey={initialDoc} />
        </View>

        <Card>
          <SectionTitle title="Destek talebi" />
          <Field label="Konu" value={subject} onChangeText={setSubject} />
          <Field label="Mesaj" value={message} onChangeText={setMessage} multiline />
          <PrimaryButton onPress={() => void sendSupport()}>Destek Talebi Gönder</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Hesap silme talebi" />
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {language === "en" ? "Store rules require that users can create an account/data deletion request inside the app. The request enters moderation and support flow." : "Mağaza kuralları gereği kullanıcı uygulama içinden hesap/veri silme talebi oluşturabilmelidir. Talep moderasyon ve destek sürecine düşer."}
          </Text>
          <Field label="Talep nedeni" value={deleteReason} onChangeText={setDeleteReason} multiline />
          <PrimaryButton tone="danger" onPress={() => void requestDeletion()}>Hesap Silme Talebi Aç</PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DeskField({ label, value, onChangeText, multiline, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: multiline ? 96 : 46, paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function DeskSelect({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6, position: "relative", zIndex: open ? 1000 : 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700" }}>{value}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, left: 0, position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, top: 74, zIndex: 1000 }}>
            {options.map((o) => (
              <Pressable key={o} onPress={() => { onSelect(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", paddingHorizontal: 12, paddingVertical: 10 })}>
                <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function SupportStep({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 32, justifyContent: "center", width: 32 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primaryDark} />
      </View>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

function LegalRow({ body, icon, title }: { body: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>
          {translateCopy(title, language)}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          {translateCopy(body, language)}
        </Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {translateCopy(label, language)}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: "#FAFBFC",
          borderColor: colors.line,
          borderRadius: 12,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 16,
          minHeight: multiline ? 92 : 50,
          padding: 14,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}


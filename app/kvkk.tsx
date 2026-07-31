import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useIsWideWeb } from "@/lib/layout";

/**
 * KVKK Aydınlatma Metni — 6698 sayılı Kanun kapsamında PROFESYONEL bilgilendirme
 * sayfası (veri sorumlusu, işlenen veriler, amaçlar, hukuki sebep, aktarım, saklama,
 * haklar, başvuru). Eski "talep panosu" (sahte fiş no'lu tablo + form + stat kartları)
 * kaldırıldı; haklar e-posta başvurusuyla kullanılır (diğer ciddi platformlar gibi).
 */

type Section = { n: string; title: string; body?: string; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    n: "1",
    title: "Veri Sorumlusu",
    body: `OrtakSat (ortaksat.com), 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusudur. OrtakSat aracı bir platformdur; alıcı, satıcı ve ortakları buluşturur, ödeme/kargo/komisyon tahsilatı yapmaz. Her türlü başvuru ve iletişim ${SUPPORT_EMAIL} adresi üzerinden yürütülür.`
  },
  {
    n: "2",
    title: "İşlenen Kişisel Veriler",
    bullets: [
      "Kimlik ve iletişim: ad-soyad, e-posta, (varsa) telefon numarası.",
      "Hesap ve işlem verileri: ilanlar, mesajlar, favoriler, ortaklık ve komisyon kayıtları, değerlendirmeler.",
      "İşlem güvenliği: IP adresi, cihaz/tarayıcı bilgisi, oturum ve log kayıtları.",
      "Konum (isteğe bağlı): ilan için belirttiğin il/ilçe bilgisi."
    ]
  },
  {
    n: "3",
    title: "Kişisel Verilerin İşlenme Amaçları",
    bullets: [
      "Üyelik ve hesap yönetimi ile kimlik doğrulamanın sağlanması.",
      "İlan yayınlama, ortak-satış eşleştirmesi ve kullanıcılar arası mesajlaşmanın yürütülmesi.",
      "Platform güvenliğinin sağlanması; dolandırıcılık ve kötüye kullanımın önlenmesi.",
      "Yasal yükümlülüklerin yerine getirilmesi; talep, itiraz ve şikâyetlerin yönetimi.",
      "Açık rızanla: pazarlama ve bilgilendirme iletilerinin gönderilmesi (dilediğin an geri çekebilirsin)."
    ]
  },
  {
    n: "4",
    title: "Hukuki Sebepler (KVKK md. 5)",
    body: "Kişisel verileriniz; bir sözleşmenin kurulması veya ifası, veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi, bir hakkın tesisi/korunması, veri sorumlusunun meşru menfaati ve — pazarlama gibi hâllerde — açık rızanız hukuki sebeplerine dayanılarak işlenir."
  },
  {
    n: "5",
    title: "Aktarım (KVKK md. 8-9)",
    body: "Kişisel verileriniz, hizmetin sunulabilmesi için barındırma ve altyapı hizmet sağlayıcılarımızla (yurt içi/yurt dışı) ve yasal bir talep hâlinde yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir. OrtakSat kişisel verilerinizi pazarlama amacıyla üçüncü kişilere satmaz."
  },
  {
    n: "6",
    title: "Saklama Süresi",
    body: "Verileriniz, hesabınız aktif olduğu sürece ve ilgili mevzuatta öngörülen yasal saklama süreleri boyunca saklanır. Sürelerin dolması hâlinde kişisel verileriniz silinir, yok edilir veya anonim hâle getirilir."
  },
  {
    n: "7",
    title: "Haklarınız (KVKK md. 11)",
    bullets: [
      "Kişisel verilerinizin işlenip işlenmediğini öğrenme,",
      "İşlenmişse buna ilişkin bilgi talep etme,",
      "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
      "Yurt içinde/dışında aktarıldığı üçüncü kişileri bilme,",
      "Eksik veya yanlış işlenmişse düzeltilmesini isteme,",
      "Şartlar oluştuğunda silinmesini veya yok edilmesini isteme,",
      "Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
      "Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme,",
      "Kanuna aykırı işleme nedeniyle zarara uğrarsanız zararın giderilmesini talep etme."
    ]
  }
];

export default function KvkkScreen() {
  const isWideWeb = useIsWideWeb();

  const Body = (
    <>
      {/* Breadcrumb */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Link href="/legal" asChild><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Yasal</Text></Link>
        <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>KVKK Aydınlatma Metni</Text>
      </View>

      {/* Başlık */}
      <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
          <MaterialCommunityIcons name="shield-lock" size={28} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontSize: isWideWeb ? 26 : 22, fontWeight: "900" }}>KVKK Aydınlatma Metni</Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19 }}>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerinizin nasıl işlendiğine dair bilgilendirme.</Text>
        </View>
      </View>

      {/* Bölümler */}
      {SECTIONS.map((s) => (
        <View key={s.n} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: isWideWeb ? 20 : 15 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 26, justifyContent: "center", width: 26 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{s.n}</Text>
            </View>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{s.title}</Text>
          </View>
          {s.body ? (
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{s.body}</Text>
          ) : null}
          {s.bullets ? (
            <View style={{ gap: 7 }}>
              {s.bullets.map((b, i) => (
                <View key={i} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
                  <MaterialCommunityIcons name="circle-medium" size={18} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {/* Başvuru — profesyonel: e-posta ile hak kullanımı (pano/form değil) */}
      <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, gap: 10, padding: isWideWeb ? 20 : 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <MaterialCommunityIcons name="email-check-outline" size={22} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>Haklarınızı Nasıl Kullanırsınız? (Başvuru)</Text>
        </View>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>
          Yukarıdaki haklarınızı kullanmak için, kimliğinizi tespit edici bilgilerle birlikte talebinizi aşağıdaki e-posta adresine iletmeniz yeterlidir. Başvurunuz, niteliğine göre en geç <Text style={{ fontWeight: "900" }}>30 gün</Text> içinde ücretsiz olarak sonuçlandırılır (işlem ayrıca bir maliyet gerektiriyorsa Kişisel Verileri Koruma Kurulu tarifesindeki ücret alınabilir).
        </Text>
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
          <MaterialCommunityIcons name="email-outline" size={18} color={colors.primaryDark} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>KVKK Başvuru & İletişim</Text>
            <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{SUPPORT_EMAIL}</Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>
          OrtakSat çağrı merkezi/telefon hattı işletmez; tüm başvurular e-posta üzerinden yürütülür. Hesabını doğrudan kapatmak istersen Hesabım → Ayarlar bölümünden hesap silme talebi oluşturabilirsin.
        </Text>
      </View>

      {/* İlgili belgeler */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>İlgili belgeler:</Text>
        <Link href="/gizlilik-politikasi" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Gizlilik Politikası</Text></Link>
        <Text style={{ color: colors.subtle }}>·</Text>
        <Link href="/cerez-politikasi" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Çerez Politikası</Text></Link>
        <Text style={{ color: colors.subtle }}>·</Text>
        <Link href="/kullanim-sartlari" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Kullanım Şartları</Text></Link>
      </View>
    </>
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Seo title="KVKK Aydınlatma Metni — Kişisel Verilerin Korunması | OrtakSat" description="OrtakSat KVKK Aydınlatma Metni: 6698 sayılı Kanun kapsamında işlenen kişisel veriler, işleme amaçları, aktarım, saklama ve haklarınız. Başvuru: destek@ortaksat.com." path="/kvkk" />
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 860, paddingHorizontal: isWideWeb ? 20 : 14, paddingTop: 16, width: "100%" }}>{Body}</View>
      <View style={{ marginTop: 20 }}><WebFooter /></View>
    </ScrollView>
  );
}

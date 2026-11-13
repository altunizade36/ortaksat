import { LegalDoc } from "@/components/legal-doc";
import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { companyIdentityRows, hasCompanyIdentity } from "@/lib/company";
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
    body: `OrtakSat (ortaksat.com), alıcı, satıcı ve ortakları buluşturan platformun marka adıdır. OrtakSat aracı bir platformdur; alıcı, satıcı ve ortakları buluşturur, ödeme/kargo/komisyon tahsilatı yapmaz. Her türlü başvuru ve iletişim ${SUPPORT_EMAIL} adresi üzerinden yürütülür.`,
    bullets: hasCompanyIdentity() ? companyIdentityRows().map((row) => `${row.label}: ${row.value}`) : undefined
  },
  {
    n: "2",
    title: "İşlenen Kişisel Veriler",
    bullets: [
      "Kimlik ve iletişim: ad-soyad, e-posta, (varsa) telefon numarası.",
      "Hesap ve işlem verileri: ilanlar, mesajlar, favoriler, ortaklık ve komisyon kayıtları, değerlendirmeler.",
      "İşlem güvenliği: IP adresi, cihaz/tarayıcı bilgisi, oturum ve log kayıtları.",
      "Konum: ilan için seçtiğin il ve ilçe, isteğe bağlı mahalle / köy bilgisi; görüntüleme düzeyi ilan ayarından seçilir."
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
    body: "Kişisel verileriniz, hizmetin sunulabilmesi için aşağıdaki altyapı sağlayıcılarıyla ve yasal bir talep hâlinde yetkili kamu kurum ve kuruluşlarıyla paylaşılır. Sağlayıcıların sunucuları Türkiye dışında olduğundan verileriniz yurt dışına (başlıca Avrupa Birliği ve ABD) aktarılır. Bu aktarımlar KVKK'nın 9. maddesine tabidir: yeterlilik kararı bulunmayan ülkeler bakımından Kurul'un ilan ettiği standart sözleşme gibi uygun güvencelerden birinin sağlanması gerekir; süreklilik arz eden aktarımlar açık rızanıza dayandırılmaz. OrtakSat kişisel verilerinizi pazarlama amacıyla üçüncü kişilere satmaz.",
    bullets: [
      "Vercel (ABD merkezli; küresel uç sunucular): web barındırma ve içerik dağıtımı.",
      "Supabase (sunucular AB / İrlanda): veritabanı, kimlik doğrulama, dosya depolama.",
      "Resend (ABD): doğrulama ve bildirim e-postalarının gönderimi.",
      "Google: yalnızca \"Google ile giriş\"i seçersen kimlik doğrulama.",
      "Yalnızca çerez tercihlerinde izin verirsen: Vercel Web Analytics (ziyaret istatistikleri) ve etkinleştirildiği dönemlerde Meta Pixel (reklam ölçümü)."
    ]
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
  return <LegalDoc title="KVKK Aydınlatma Metni" path="/kvkk" updated="13 Kasım 2026" intro="Kişisel verilerinin nasıl işlendiğini, haklarını ve başvuru yollarını incele." seoDescription="OrtakSat KVKK bilgilendirmesi ve kişisel veri başvuru yolları." sections={[...SECTIONS.map(s => ({ heading: s.title, paragraphs: s.body ? [s.body] : [], bullets: s.bullets })), { heading: "Başvuru ve Yanıt Süreci", paragraphs: [`Bilgi, düzeltme, silme ve diğer kişisel veri taleplerinizi ${SUPPORT_EMAIL} adresine, sistemimizde kayıtlı e-posta adresiniz üzerinden iletebilirsiniz. Talebinizi açıkça belirtin; hesabın size ait olduğunun doğrulanması gerekebilir. Başvurunuz en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır; ayrıca maliyet doğuran işlemlerde Kişisel Verileri Koruma Kurulu'nun belirlediği tarife uygulanabilir.`, "Başvuruda şifre, ödeme kartı bilgisi veya gereksiz kimlik belgesi göndermeyin. Başvurunuzun reddedilmesi, yanıtın yetersiz olması ya da süresinde yanıt verilmemesi hâlinde, yanıtı öğrendiğiniz tarihten itibaren 30 ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz."] }]} />;
}

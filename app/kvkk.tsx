import { LegalDoc } from "@/components/legal-doc";
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
    body: `OrtakSat (ortaksat.com), alıcı, satıcı ve ortakları buluşturan platformun marka adıdır. OrtakSat aracı bir platformdur; alıcı, satıcı ve ortakları buluşturur, ödeme/kargo/komisyon tahsilatı yapmaz. Her türlü başvuru ve iletişim ${SUPPORT_EMAIL} adresi üzerinden yürütülür.`
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
  return <LegalDoc title="KVKK Aydınlatma Metni" path="/kvkk" updated="24 Ekim 2026" intro="Kişisel verilerinin nasıl işlendiğini, haklarını ve başvuru yollarını incele." seoDescription="OrtakSat KVKK bilgilendirmesi ve kişisel veri başvuru yolları." sections={[...SECTIONS.map(s => ({ heading: s.title, paragraphs: s.body ? [s.body] : [], bullets: s.bullets })), { heading: "Ba?vuru ve yan?t s?reci", paragraphs: [`Bilgi, d?zeltme ve di?er ki?isel veri taleplerinizi ${SUPPORT_EMAIL} ?zerinden iletebilirsiniz. Talebinizi a??k?a belirtin; hesab?n?z?n size ait oldu?unun do?rulanmas? gerekebilir. Ba?vurunuz en k?sa s?rede ve en ge? 30 g?n i?inde de?erlendirilir. Ba?vurular kural olarak ?cretsizdir; ayr?ca maliyet do?uran i?lemlerde Kurulun belirledi?i tarife uygulanabilir.`, "Ba?vuruda ?ifre, ?deme kart? bilgisi veya gereksiz kimlik belgesi g?ndermeyin. Yan?t?n yetersiz olmas? ya da s?resinde yan?t verilmemesi h?linde Kanunda d?zenlenen ?ik?yet yollar?na ba?vurabilirsiniz."] }]} />;
}

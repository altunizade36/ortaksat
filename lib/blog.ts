export type BlogCategory =
  | "Satış İpuçları"
  | "Komisyon Rehberleri"
  | "E-Ticaret"
  | "Girişimcilik"
  | "Pazarlama"
  | "Başarı Hikayeleri";

export type BlogPost = {
  slug: string;
  category: BlogCategory;
  title: string;
  excerpt: string;
  author: string;
  authorRole: string;
  readMin: number;
  date: string; // display string
  dateShort: string; // sidebar short date
  image: string;
  featured?: boolean;
  body: string[];
};

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Satış İpuçları",
  "Komisyon Rehberleri",
  "E-Ticaret",
  "Girişimcilik",
  "Pazarlama",
  "Başarı Hikayeleri"
];

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "ortak-satisla-gelirinizi-katlamanin-7-yolu",
    category: "Satış İpuçları",
    title: "Ortak Satışla Gelirinizi Katlamanın 7 Etkili Yolu",
    excerpt: "Komisyona dayalı ortak satış modeliyle daha geniş kitlelere ulaşın, güvenilir iş ortaklarıyla birlikte büyüyün.",
    author: "Ahmet Yılmaz",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 6,
    date: "20 Mayıs 2024",
    dateShort: "20 May",
    image: img("1460925895917-afdab827c52f"),
    featured: true,
    body: [
      "Ortak satış, ürününüzü tek başınıza pazarlamak yerine güvenilir ortakların ağından yararlanarak çok daha fazla kişiye ulaştırmanın en hızlı yoludur. Doğru kurgulandığında hem satıcı hem de ortak kazanır; çünkü ödeme yalnızca satış gerçekleştiğinde, belirlenen komisyon üzerinden yapılır.",
      "1. Komisyonu rekabetçi belirleyin. Ortakların ilginizi çekmesi için sektör ortalamasının altında kalmayın. Yüzde olarak belirlediğiniz komisyon, ortağın kazanç beklentisini doğrudan etkiler.",
      "2. İlanınızı eksiksiz hazırlayın. Net başlık, gerçek fotoğraflar, doğru kategori ve açık ürün açıklaması; ortağın ürünü kolayca anlatmasını sağlar.",
      "3. Paylaşıma hazır metinler verin. Ortaklarınıza Instagram, WhatsApp ve TikTok için hazır metinler sunarsanız paylaşım oranı belirgin şekilde artar.",
      "4. Talepleri hızlı yanıtlayın. Gelen ortaklık başvurularını ve alıcı taleplerini geciktirmeden onaylayın; hız, dönüşümü artırır.",
      "5. Performansı takip edin. Hangi ortağın, hangi kanalın daha çok sattığını panelden izleyin ve bütçenizi en verimli kanala yönlendirin.",
      "6. Güveni öne çıkarın. Doğrulanmış satıcı rozeti, şeffaf komisyon ve gerçek yorumlar; alıcının satın alma kararını hızlandırır.",
      "7. Sürekliliği koruyun. Tek seferlik kampanya yerine, ortaklarınızla uzun vadeli bir ilişki kurun. Düzenli yeni ürün ve adil komisyon, sadık bir ortak ağı oluşturur."
    ]
  },
  {
    slug: "komisyonla-satista-basari-getiren-10-altin-kural",
    category: "Satış İpuçları",
    title: "Komisyonla Satışta Başarı Getiren 10 Altın Kural",
    excerpt: "Ortak satış yaparken daha fazla kazanç elde etmenizi sağlayacak etkili stratejiler.",
    author: "Ahmet Yılmaz",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 5,
    date: "18 Mayıs 2024",
    dateShort: "18 May",
    image: img("1556742049-0cfed4f6a45d"),
    body: [
      "Komisyonla satışta başarı, doğru ürünü doğru kitleye, doğru mesajla ulaştırmaktan geçer. Aşağıdaki kurallar, ortak satıcıların kazancını artırmak için en çok işe yarayan uygulamalardır.",
      "Kazancı yüksek ürünleri seçin, hedef kitlenizi tanıyın, paylaşımlarınızda dürüst olun ve her satıştan sonra alıcıyla iletişimi sürdürün. Küçük ama tutarlı adımlar, zamanla büyük bir komisyon hacmine dönüşür.",
      "En önemlisi: yalnızca arkasında durabileceğiniz ürünleri paylaşın. Güven, ortak satışta en değerli sermayedir."
    ]
  },
  {
    slug: "komisyon-oranlari-nasil-belirlenir-rehber",
    category: "Komisyon Rehberleri",
    title: "Komisyon Oranları Nasıl Belirlenir? Rehber",
    excerpt: "Doğru komisyon oranı belirlemek hem sizi hem de ortaklarınızı mutlu eder.",
    author: "Zeynep Kaya",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 4,
    date: "15 Mayıs 2024",
    dateShort: "15 May",
    image: img("1551288049-bebda4e38f71"),
    body: [
      "Komisyon oranı, ortak satışın kalbidir. Çok düşük belirlerseniz ortak ilgisi azalır; çok yüksek belirlerseniz kâr marjınız erir. Doğru oran, ürünün kâr marjına, rekabete ve satış hızına göre belirlenir.",
      "Genel bir başlangıç noktası olarak: yüksek marjlı ürünlerde %10–20, dar marjlı ürünlerde sabit bir tutar tercih edebilirsiniz. Kampanya dönemlerinde komisyonu geçici olarak artırmak, ortak hareketliliğini hızlandırır.",
      "Oranı belirlerken ortağın emeğini de hesaba katın: paylaşım, içerik üretimi ve müşteri ikna süreci ortak için gerçek bir iştir."
    ]
  },
  {
    slug: "e-ticarette-donusum-oranini-artirmanin-8-yolu",
    category: "E-Ticaret",
    title: "E-Ticarette Dönüşüm Oranını Artırmanın 8 Yolu",
    excerpt: "Ürünlerinizi daha çok kişiye ulaştırmak ve satışlarınızı artırmak için ipuçları.",
    author: "Mehmet Arslan",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 6,
    date: "12 Mayıs 2024",
    dateShort: "12 May",
    image: img("1563013544-824ae1b704d3"),
    body: [
      "Dönüşüm oranı, ziyaretçilerin ne kadarının alıcıya dönüştüğünü gösterir. Küçük iyileştirmeler bile toplam satışta büyük fark yaratır.",
      "Net ürün görselleri kullanın, fiyat ve kargo bilgisini açıkça gösterin, güven rozetlerini öne çıkarın, satın alma adımını kısaltın ve sayfa hızını artırın.",
      "Sosyal kanıt güçlüdür: gerçek yorumlar, puanlar ve 'X kişi ortak satıyor' gibi bilgiler kararsız alıcıyı ikna eder."
    ]
  },
  {
    slug: "kucuk-girisimden-buyuk-markaya-ilham-veren-hikaye",
    category: "Girişimcilik",
    title: "Küçük Bir Girişimden Büyük Bir Markaya: İlham Veren Hikaye",
    excerpt: "Ortak satışla büyüyen bir girişimcinin gerçek başarı hikayesi.",
    author: "Elif Demir",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 7,
    date: "10 Mayıs 2024",
    dateShort: "10 May",
    image: img("1506905925346-21bda4d32df4"),
    body: [
      "Tek bir üründen yola çıkan bir girişimcinin, ortak satış ağıyla nasıl ulusal bir markaya dönüştüğünü anlatıyoruz.",
      "Başlangıçta sınırlı bütçeyle reklam yapmak yerine, ürününü ortak satıcılara açtı. Her ortak kendi çevresine ulaştı; satışlar arttıkça yeni ürünler eklendi.",
      "Bugün onlarca ortak satıcıyla çalışan bu markanın sırrı tek cümlede özetlenebilir: adil komisyon ve şeffaf süreç."
    ]
  },
  {
    slug: "sosyal-medyada-ortak-satis-yapmanin-ipuclari",
    category: "Pazarlama",
    title: "Sosyal Medyada Ortak Satış Yapmanın İpuçları",
    excerpt: "Instagram, WhatsApp ve TikTok'ta referans linkinizle daha çok satış yapın.",
    author: "Zeynep Kaya",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 5,
    date: "7 Mayıs 2024",
    dateShort: "7 May",
    image: img("1611162617474-5b21e879e113"),
    body: [
      "Sosyal medya, ortak satıcının en güçlü silahıdır. Doğru içerikle referans linkiniz binlerce kişiye ulaşabilir.",
      "Ürünü kullanırken gösterin, faydayı net anlatın, hikâye ve reels formatını kullanın ve harekete geçirici bir çağrı (linke tıkla) ekleyin.",
      "Tutarlılık önemlidir: düzenli paylaşım yapan ortaklar, ara sıra paylaşanlara göre çok daha fazla komisyon kazanır."
    ]
  },
  {
    slug: "musteri-guvenini-kazanmanin-6-etkili-yolu",
    category: "Komisyon Rehberleri",
    title: "Müşteri Güvenini Kazanmanın 6 Etkili Yolu",
    excerpt: "Doğrulanmış satıcı, şeffaf komisyon ve gerçek yorumlarla güven inşa edin.",
    author: "Mehmet Arslan",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 5,
    date: "5 Mayıs 2024",
    dateShort: "5 May",
    image: img("1521791136064-7986c2920216"),
    body: [
      "Güven, online satışın temelidir. Türkiye'de alıcı; iade var mı, kargo kaç günde gelir, firma gerçek mi gibi sorulara net yanıt arar.",
      "Telefon ve e-posta doğrulaması yapın, mesafeli satış ve gizlilik bilgilerini paylaşın, WhatsApp destek sunun ve her satış sonrası yorum isteyin.",
      "Şeffaf komisyon ve kayıt altına alınan anlaşma, hem alıcıyı hem de ortak satıcıyı korur."
    ]
  },
  {
    slug: "kargo-ve-teslimat-sureclerinde-dikkat-edilmesi-gerekenler",
    category: "E-Ticaret",
    title: "Kargo ve Teslimat Süreçlerinde Dikkat Edilmesi Gerekenler",
    excerpt: "Teslimat deneyimi, tekrar satışın ve olumlu yorumun anahtarıdır.",
    author: "Ahmet Yılmaz",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 4,
    date: "3 Mayıs 2024",
    dateShort: "3 May",
    image: img("1586528116311-ad8dd3c8310d"),
    body: [
      "İyi bir teslimat deneyimi, müşteriyi tekrar alıcıya dönüştürür. Kötü bir deneyim ise tüm pazarlama çabanızı boşa çıkarır.",
      "Teslimat süresini net belirtin, paketlemeye özen gösterin, kargo takip bilgisini paylaşın ve gecikmelerde proaktif iletişim kurun.",
      "İade ve değişim koşullarını satıştan önce netleştirmek, anlaşmazlıkları büyük ölçüde önler."
    ]
  },
  {
    slug: "trend-urunleri-erken-yakalamanin-yollari",
    category: "Pazarlama",
    title: "Trend Ürünleri Erken Yakalamanın Yolları",
    excerpt: "Doğru zamanda doğru ürünü paylaşan ortak, komisyonunu katlar.",
    author: "Elif Demir",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 5,
    date: "9 Mayıs 2024",
    dateShort: "9 May",
    image: img("1483985988355-763728e1935b"),
    body: [
      "Trendi erken yakalamak, ortak satışta büyük avantajdır. Talep zirveye çıkmadan paylaşmaya başlayan ortak, rekabetin önüne geçer.",
      "Keşfet akışını takip edin, mevsimsel talebi öngörün ve 'yüksek komisyon' filtresiyle kazançlı fırsatları erkenden yakalayın.",
      "Trend ürünleri kendi kitlenize uygun bir dille anlatmak, dönüşümü belirgin biçimde artırır."
    ]
  },
  {
    slug: "ortak-satista-iletisim-satisi-artiran-mesajlasma-taktikleri",
    category: "Başarı Hikayeleri",
    title: "Ortak Satışta İletişim: Satışı Artıran Mesajlaşma Taktikleri",
    excerpt: "Alıcıyla doğru iletişim, kararsız ziyaretçiyi memnun müşteriye dönüştürür.",
    author: "Zeynep Kaya",
    authorRole: "OrtakSat İçerik Ekibi",
    readMin: 5,
    date: "1 Mayıs 2024",
    dateShort: "1 May",
    image: img("1556761175-5973dc0f32e7"),
    body: [
      "İyi bir ortak satıcı, sadece link paylaşan değil; soruları yanıtlayan, güven veren ve süreci kolaylaştıran kişidir.",
      "Hızlı yanıt verin, ürünün faydasını alıcının ihtiyacına bağlayın, fiyat ve teslimatı net anlatın ve satış sonrası teşekkür mesajı gönderin.",
      "Samimi ve dürüst iletişim, tek seferlik alıcıyı düzenli müşteriye çevirir."
    ]
  }
];

export const POPULAR_TAGS = ["#ortaksatış", "#komisyon", "#eticaret", "#girişimcilik", "#satışipuçları", "#pazarlama", "#başarıhikayeleri", "#dönüşüm"];

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

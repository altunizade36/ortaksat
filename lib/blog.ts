export type BlogCategory =
  | "Satış İpuçları"
  | "Komisyon Rehberleri"
  | "E-Ticaret"
  | "Girişimcilik"
  | "Pazarlama"
  | "Vaka Analizleri";

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
  "Vaka Analizleri"
];

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

const commonLegalNote =
  "Not: OrtakSat bir aracı ilan, eşleşme ve iletişim platformudur; ödeme almaz, para tutmaz, kargo veya teslimat yapmaz, komisyon tahsil etmez. Komisyon, teslimat ve ödeme şartları satıcı, alıcı ve ortak arasında ayrıca netleştirilir.";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "ortak-satisla-gelirinizi-katlamanin-7-yolu",
    category: "Satış İpuçları",
    title: "Ortak Satışla Daha Geniş Kitleye Ulaşmanın 7 Gerçekçi Yolu",
    excerpt: "Türkiye'de e-ticaret büyürken ürününü tek kanala sıkıştırmadan, şeffaf komisyon ve doğru ortak seçimiyle nasıl daha görünür hale getirebilirsin?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 7,
    date: "18 Haziran 2026",
    dateShort: "18 Haz",
    image: img("1460925895917-afdab827c52f"),
    featured: true,
    body: [
      "Ticaret Bakanlığı'nın 12 Mayıs 2026'da yayımladığı Türkiye'de E-Ticaretin Görünümü 2025 raporuna göre Türkiye'de e-ticaret hacmi 2025'te %52,2 artarak 4,57 trilyon TL'ye, işlem sayısı ise 5,94 milyar adede ulaştı. Bu tablo küçük satıcılar için tek bir anlama geliyor: talep dijitalde büyüyor ama rekabet de aynı hızda sertleşiyor.",
      "Ortak satış, bu rekabette ürünün yalnızca satıcının hesabından değil, ürünü doğru anlatabilecek ortakların çevresinden de görünür olmasını sağlar. Burada başarı, 'herkese link dağıtmak' değil; ölçülebilir, dürüst ve kayıtlı bir süreç kurmaktır.",
      "1. Ürünü ortak satışa gerçekten uygun seç. Her ürün ortak satış için doğru aday değildir. Kolay anlatılan, fotoğrafla anlaşılabilen, fiyatı net, teslimat koşulu açık ve stok durumu güvenilir ürünler daha iyi çalışır. Karmaşık hizmetlerde veya kişiye özel üretimlerde beklentiyi ayrıca yazmak gerekir.",
      "2. Komisyonu satıcının marjına göre değil, ortağın emeğine göre de düşün. Ortak yalnızca link paylaşmaz; ürünü anlatır, soru yanıtlar, bazen alıcıyı ikna eder. Komisyon oranı bu emeği karşılamazsa ürün görünürlük kazanmaz. Yine de oran, satıcının maliyetini ve iade riskini sıfırlayacak kadar yüksek belirlenmemelidir.",
      "3. İlan başlığını arama niyetine göre yaz. 'Çok temiz ürün' yerine marka, model, kapasite, durum ve şehir gibi bilgileri başlığa taşı. Örneğin 'iPhone 14 128 GB kutulu, pil sağlığı %91' gibi başlık hem alıcıya hem ortağa net konuşma zemini verir.",
      "4. Görselleri ortağın anlatabileceği kadar açık hazırla. Tek bir karanlık fotoğraf yerine ürünün ön, arka, detay, kusur ve kullanım halini göster. İkinci el üründe çizik, deformasyon veya eksik aksesuar saklanmamalı; saklanan kusur satış sonrası güveni bozar.",
      "5. Ortaklara hazır ama dürüst paylaşım metni ver. Instagram hikayesi, WhatsApp durumu ve kısa mesaj için farklı uzunlukta metin hazırlamak paylaşımı kolaylaştırır. Metinlerde stok, fiyat, teslimat ve komisyon bilgisi abartısız olmalı; reklam niteliği taşıyan paylaşımlarda iş birliği ilişkisi gizlenmemelidir.",
      "6. İlk yanıt süresini kısalt. Dijital satışta alıcının ilgisi hızlı düşer. Ortak, alıcıyı satıcıya yönlendirdiğinde satıcı geç yanıt verirse hem satış hem ortak motivasyonu kaybolur. Bu yüzden ilan açıklamasında uygun iletişim saatini ve cevap süresini gerçekçi yaz.",
      "7. Sonucu ölç, kazandıran ortakları koru. Hangi ortak, hangi ürün, hangi kanal ve hangi açıklama daha çok talep getirdi? Bu veriyi takip edip iyi çalışan metinleri ve görselleri çoğalt. Ortak satışın sürdürülebilir tarafı, tahminle değil kayıtla büyür.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı, Türkiye'de E-Ticaretin Görünümü Raporu 2025, https://ticaret.gov.tr/duyurular/turkiyede-e-ticaretin-gorunumu-raporu-yayinlandi-12-05-2026"
    ]
  },
  {
    slug: "komisyonla-satista-basari-getiren-10-altin-kural",
    category: "Satış İpuçları",
    title: "Komisyonla Satışta Güven Kaybettirmeyen 10 Kural",
    excerpt: "Komisyonla satış yaparken hem alıcı güvenini hem ortak itibarını koruyan, uygulanabilir ve ölçülebilir kurallar.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "16 Haziran 2026",
    dateShort: "16 Haz",
    image: img("1556742049-0cfed4f6a45d"),
    body: [
      "Komisyonla satışın en büyük riski yanlış beklenti oluşturmaktır. Ürün iyi olsa bile fiyat, stok, teslimat veya iade koşulu belirsizse alıcı güveni azalır. Ortak açısından da durum aynıdır: kendi çevresine önerdiği ürün sorunlu çıkarsa yalnızca bir satış değil, itibar da kaybedilir.",
      "1. Arkasında durabileceğin ürünü paylaş. Ortak, ürünün sahibi olmayabilir ama ürünü tavsiye ettiği için güven ilişkisine dahil olur. Bilmediğin, görmediğin veya satıcısına güvenmediğin üründe 'kesin tavsiye' dili kullanma.",
      "2. Komisyonu tek motivasyon yapma. Yüksek komisyon cazip görünür; fakat ürün talep görmüyorsa veya satış sonrası sorun çıkarıyorsa toplam kazanç düşer. Ürünün fiyatı, talebi, stok durumu ve satıcının iletişim kalitesi birlikte değerlendirilmelidir.",
      "3. Reklam ve tavsiye ayrımını açık tut. Sosyal medya paylaşımlarında ticari bağlantı varsa bunu anlaşılır biçimde belirtmek gerekir. Reklam Kurulu'nun etkileyici pazarlama kılavuzu, tüketicinin reklam niteliğini kolayca anlayabilmesini esas alır.",
      "4. Ürünü olduğu gibi anlat. 'Sıfır gibi' demek yerine gerçek kondisyonu yaz: kutulu mu, garantisi var mı, eksik parçası var mı, ne kadar kullanıldı? Netlik kısa vadede bazı alıcıları eleyebilir ama kalan alıcıların güvenini artırır.",
      "5. Görsel ve metin tutarlı olsun. Fotoğrafta başka model, açıklamada başka model varsa alıcı şüphelenir. Aynı şekilde ilanda 'stok var' yazarken satıcı stok kontrolü yapmıyorsa ortak paylaşımı boşa düşer.",
      "6. Alıcıyı platform içi kayıtlı iletişime yönlendir. Pazarlık, komisyon ve teslimat konuşmaları kayıtlı kalırsa yanlış anlaşılma azalır. Platform dışına taşınan konuşmalarda tarafların neye anlaştığını sonradan ispatlaması zorlaşır.",
      "7. Satıcıdan net teslimat bilgisi iste. Kargo yapılacak mı, elden teslim mümkün mü, şehir dışına gönderim var mı, iade koşulu nedir? Ortak bu bilgileri bilmeden alıcıya güvenilir cevap veremez.",
      "8. Baskı dili kullanma. 'Son şans', 'hemen almazsan kaybedersin' gibi ifadeler gerçek değilse yanıltıcı olur. Daha iyi yaklaşım; stok adedi, kampanya bitiş tarihi veya teslimat sınırı gibi doğrulanabilir bilgileri yazmaktır.",
      "9. Satış sonrası iletişimi koparma. Alıcı ürünü aldıktan sonra kısa bir memnuniyet kontrolü hem güveni artırır hem de olası sorunu büyümeden yakalar. Ortak satışta tekrar eden ilişki, tek seferlik komisyondan daha değerlidir.",
      "10. Veriye bakarak devam et. Tıklama, talep, favori, mesaj ve tamamlanan satış sayıları ayrı ayrı izlenmelidir. Çok tıklanan ama satmayan ürünün sorunu fiyat veya açıklama olabilir; az tıklanan ürünün sorunu başlık, görsel veya kitle uyumu olabilir.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Reklam Kurulu Sosyal Medya Etkileyicileri Kılavuzu, https://tuketici.ticaret.gov.tr/data/60927f5b13b876f954d58bd1/Sosyal%20Medya%20Etkileyicileri%20Taraf%C4%B1ndan%20Yap%C4%B1lan%20Ticari%20Reklam%20ve%20Haks%C4%B1z%20Ticari%20Uygulamalar%20Hakk%C4%B1nda%20K%C4%B1lavuz.docx"
    ]
  },
  {
    slug: "komisyon-oranlari-nasil-belirlenir-rehber",
    category: "Komisyon Rehberleri",
    title: "Komisyon Oranı Nasıl Belirlenir? Satıcı ve Ortak İçin Pratik Rehber",
    excerpt: "Yüzde mi sabit tutar mı, düşük fiyatlı ürünlerde ne yapılmalı, emlak ve araç gibi yüksek tutarlı ilanlarda komisyon nasıl şeffaf yazılmalı?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "14 Haziran 2026",
    dateShort: "14 Haz",
    image: img("1554224155-6726b3ff858f"),
    body: [
      "Komisyon oranı yalnızca 'ortağa kaç para verilecek?' sorusu değildir. Ürünün satış fiyatı, brüt marjı, satış zorluğu, iade riski, stok hızı ve ortağın harcayacağı emek birlikte düşünülmelidir. Yanlış oran, ya satıcının kârını eritir ya da ortağın ürünü paylaşma isteğini düşürür.",
      "Önce toplam maliyeti çıkar. Ürün maliyeti, paketleme, kargo katkısı, olası iade maliyeti, pazaryeri veya reklam maliyeti ve vergi yükümlülükleri hesaba katılmadan komisyon belirlenmemeli. Satıcı 'satış fiyatı eksi ürün maliyeti' hesabıyla kalırsa gerçek marjı olduğundan yüksek görür.",
      "Yüzde komisyon, orta ve yüksek fiyatlı ürünlerde daha anlaşılırdır. Örneğin 20.000 TL'lik bir üründe %5 komisyon, ortağa 1.000 TL kazanç demektir. Ancak düşük fiyatlı ürünlerde yüzde komisyon çok küçük kalabilir; 300 TL'lik üründe %5 yalnızca 15 TL eder ve ortak için cazip olmayabilir.",
      "Sabit tutar, düşük fiyatlı veya dar marjlı ürünlerde daha net olabilir. 'Satış başına 100 TL' gibi bir ifade ortağın ne kazanacağını hemen gösterir. Fakat sabit tutar, farklı fiyat varyasyonları varsa satıcıyı zorlayabilir; bu durumda ürün gruplarına göre farklı sabit tutar belirlenebilir.",
      "Hibrit model bazı kategorilerde daha adildir. Örneğin 'satış başına 250 TL + satış fiyatının %2'si' gibi bir yapı, hem ortağa taban kazanç sağlar hem yüksek fiyatlı satışta emeği ödüllendirir. Bu model özellikle pazarlığı uzun süren ürünlerde işe yarar.",
      "Komisyon şartı ilanda açık görünmeli. Ortak, paylaşmadan önce komisyonun yüzde mi sabit tutar mı olduğunu, hangi durumda ödeneceğini ve satış iptal olursa ne olacağını bilmelidir. Sonradan değişen komisyon güveni hızla zedeler.",
      "Emlak, araç ve yüksek tutarlı ilanlarda hukuki/mesleki yükümlülükleri ayrıca kontrol et. Bazı sektörlerde aracılık, yetki belgesi veya mesleki düzenleme gerekebilir. OrtakSat komisyon kaydını görünür kılabilir; ancak tarafların ilgili mevzuata uygun hareket etme sorumluluğunu ortadan kaldırmaz.",
      "Kısa kontrol listesi: marjı hesapla, kategori riskini değerlendir, ortağın emeğini ölç, oranı ilanda açık yaz, ödeme zamanını netleştir, iptal/iade durumunu baştan konuş ve performansa göre oranı güncelle.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Doğrudan Satış Sistemleri düzenleme duyurusu, https://ticaret.gov.tr/haberler/ticaret-bakanligi-dogrudan-satis-sistemlerinin-kurallarini-belirledi; Ticaret Bakanlığı Türkiye'de E-Ticaretin Görünümü Raporu 2025, https://ticaret.gov.tr/data/6a02f2c7269de183c0b98bc4/T%C3%BCrkiye%27de%20E-Ticaretin%20G%C3%B6r%C3%BCn%C3%BCm%C3%BC%20Raporu%202025.pdf"
    ]
  },
  {
    slug: "e-ticarette-donusum-oranini-artirmanin-8-yolu",
    category: "E-Ticaret",
    title: "İlan Dönüşüm Oranını Artırmanın 8 Kanıta Dayalı Yolu",
    excerpt: "Daha çok trafik almadan da daha çok talep oluşturmak için başlık, görsel, fiyat, güven ve teslimat bilgisini nasıl düzenlemeli?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 7,
    date: "11 Haziran 2026",
    dateShort: "11 Haz",
    image: img("1563013544-824ae1b704d3"),
    body: [
      "Türkiye'de 2025 e-ticaret işlem sayısı 5,94 milyar adede ulaştı. Bu hacimde alıcıların karar süresi kısalıyor; kötü başlık, eksik görsel veya belirsiz teslimat bilgisi olan ilan hızla eleniyor. Dönüşüm oranını artırmak için önce alıcının karar anındaki şüphelerini azaltmak gerekir.",
      "1. Başlıkta ürünün kimliğini netleştir. Marka, model, kapasite, beden, ölçü, şehir ve durum bilgisi mümkünse başlıkta yer almalı. Alıcı arama sonucunda neye baktığını anlamazsa ilanın içine girmez.",
      "2. İlk fotoğrafı ürünün ana kanıtı yap. İlk görsel, ürünün gerçek halini açıkça göstermeli. Stok görsel, bulanık fotoğraf veya aşırı filtre güveni düşürür. İkinci el üründe kusur fotoğrafı eklemek dönüşümü azaltmaz; aksine yanlış alıcıyı eleyerek daha kaliteli talep getirir.",
      "3. Fiyatı gizleme. 'Fiyat için mesaj at' yaklaşımı bazı sosyal mecralarda merak yaratabilir ama ilan ortamında güveni ve hızını düşürür. Fiyat, pazarlık payı ve takas durumu açık yazıldığında alıcı gereksiz mesaj atmadan karar verir.",
      "4. Teslimat seçeneklerini baştan göster. Kargo var mı, elden teslim nerede yapılır, şehir dışına gönderim olur mu, kargo ücretini kim öder? Bu soruların cevabı ilan açıklamasında yoksa alıcı sonraki ilana geçebilir.",
      "5. Sosyal kanıtı dürüst kullan. Satıcı puanı, doğrulama, geçmiş ilanlar, yorumlar ve tamamlanan işlem geçmişi alıcı için güven sinyalidir. Sahte yorum veya abartılı talep ifadesi ise uzun vadede zarar verir.",
      "6. Açıklamayı özellik ve fayda olarak ayır. Özellik: '256 GB, kutulu, faturalı'. Fayda: 'Depolama sorunu yaşamadan fotoğraf ve video saklamak isteyen kullanıcı için uygun'. Bu ayrım alıcının kendi ihtiyacını ürünle eşleştirmesini kolaylaştırır.",
      "7. Soru cevap hızını ölç. Bir ilanın talep alıp satışa dönmemesinin nedeni çoğu zaman geç dönüş veya eksik cevap olabilir. Satıcı, en sık sorulan 5 soruyu açıklamaya ekleyerek mesaj yükünü azaltabilir.",
      "8. İlanı yayına aldıktan sonra test et. Başlık, ilk fotoğraf, fiyat ve açıklama farklı haftalarda tek tek değiştirilmeli. Aynı anda her şeyi değiştirmek hangi iyileştirmenin işe yaradığını anlamayı zorlaştırır.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Türkiye'de E-Ticaretin Görünümü Raporu 2025, https://ticaret.gov.tr/duyurular/turkiyede-e-ticaretin-gorunumu-raporu-yayinlandi-12-05-2026"
    ]
  },
  {
    slug: "kucuk-girisimden-buyuk-markaya-ilham-veren-hikaye",
    category: "Girişimcilik",
    title: "Küçük Satıcı İçin Büyüme Planı: Sahte Hikaye Değil, Uygulanabilir Yol Haritası",
    excerpt: "Tek ürünle başlayan bir satıcı, gerçek veri takibi ve güvenli süreçlerle nasıl daha düzenli satış yapabilir?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 7,
    date: "9 Haziran 2026",
    dateShort: "9 Haz",
    image: img("1507679799987-c73779587ccf"),
    body: [
      "Bu yazı uydurma bir marka hikayesi anlatmıyor. OrtakSat'ta blog içeriği yazarken gerçek kişi veya sahte başarı ismi kullanmak yerine, küçük satıcıların uygulayabileceği genel bir büyüme planını anlatmayı daha doğru buluyoruz.",
      "Başlangıç noktası genelde aynıdır: az ürün, sınırlı reklam bütçesi ve güven oluşturma ihtiyacı. Türkiye'de e-ticaret hacmi büyürken küçük satıcıların görünürlük kazanması kolaylaşmıyor; çünkü büyük oyuncular reklam, stok ve lojistik tarafında daha güçlü.",
      "1. Önce dar bir kategori seç. Her şeyi satmaya çalışmak yerine 10-20 üründen oluşan net bir kategoriyle başlamak daha yönetilebilir. Örneğin yalnızca bebek arabası aksesuarı, yalnızca ikinci el fotoğraf ekipmanı veya yalnızca ev-ofis mobilyası gibi.",
      "2. Her ürün için standart bilgi formatı kullan. Başlık, gerçek fotoğraf, kondisyon, fiyat, teslimat, iade/değişim koşulu, komisyon ve ortak açıklaması aynı sırayla yazılmalı. Standart format, hem alıcının hem ortağın ürünü hızlı anlamasını sağlar.",
      "3. İlk 30 günü öğrenme dönemi kabul et. Hangi ürün daha çok favori alıyor, hangi açıklama daha çok mesaj getiriyor, hangi saatlerde talep geliyor? Bu veriler küçük satıcının reklam bütçesinden daha değerli olabilir.",
      "4. Ortakları kategori uyumuna göre seç. Elektronik ürünü teknoloji kitlesine, anne-bebek ürününü ebeveyn kitlesine, mobilyayı ev dekorasyonuyla ilgilenen kitleye anlatan ortak daha verimli olur. Sadece takipçi sayısına bakmak yanıltıcıdır.",
      "5. Güveni ölçeklenebilir hale getir. Her alıcıya aynı teslimat bilgisi, aynı garanti/kondisyon açıklaması ve aynı satış sonrası mesajı gitmeli. Güven tek tek iyi niyetle değil, tekrar edilebilir süreçle büyür.",
      "6. Stok ve teslimat sözünü tutamayacağın hızda büyüme. Talep artınca en sık yapılan hata stok kontrolünü bırakmaktır. Ortak satışta yanlış stok bilgisi yalnızca satıcıyı değil, ürünü paylaşan ortağı da zor durumda bırakır.",
      "7. Kârı yeni ürüne değil önce sürece yatır. Daha iyi fotoğraf, paketleme malzemesi, müşteri mesaj şablonu, ürün bilgi tablosu ve doğru kategori düzeni küçük satıcıya uzun vadede daha çok katkı verir.",
      "Özet: küçük satıcı için büyüme, viral bir şans hikayesi değil; doğru kategori, açık bilgi, güvenilir teslimat, ölçülen performans ve sürdürülebilir ortak ilişkileridir.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Türkiye'de E-Ticaretin Görünümü Raporu 2025, https://ticaret.gov.tr/data/6a02f2c7269de183c0b98bc4/T%C3%BCrkiye%27de%20E-Ticaretin%20G%C3%B6r%C3%BCn%C3%BCm%C3%BC%20Raporu%202025.pdf; ETBİS duyurusu, https://etbis.ticaret.gov.tr/tr/Post/postturkiyede-e-ticaretin-gorunumu-2025-raporu-yayimlandi-3"
    ]
  },
  {
    slug: "sosyal-medyada-ortak-satis-yapmanin-ipuclari",
    category: "Pazarlama",
    title: "Sosyal Medyada Ortak Satış: Reklamı Gizlemeden Güvenle Paylaşım Yapmak",
    excerpt: "Instagram, TikTok ve WhatsApp'ta ürün paylaşırken hem dönüşümü artıran hem de reklam şeffaflığını koruyan pratikler.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "7 Haziran 2026",
    dateShort: "7 Haz",
    image: img("1611162617474-5b21e879e113"),
    body: [
      "Sosyal medya ortak satış için güçlü bir kanal; ancak tüketicinin reklam veya ticari ilişkiyi anlayabilmesi gerekir. Reklam Kurulu'nun sosyal medya etkileyicileri kılavuzu, ticari reklamların açık ve anlaşılır biçimde ayırt edilebilir olmasını temel alır.",
      "Instagram'da ürün deneyimi görsel kanıtla desteklenmeli. Hikaye, Reels ve gönderide ürünün gerçek kullanımı, ölçüsü, teslimat durumu ve fiyatı net olmalı. Ürünü yalnızca linkle değil, kim için uygun olduğunu anlatarak paylaşmak daha sağlıklıdır.",
      "TikTok'ta kısa problem-çözüm anlatımı daha anlaşılırdır. 'Bu ürün şu sorunu çözer' formatı işe yarar; fakat gerçek dışı performans iddiası, kesin sonuç vaadi veya gizli reklam dili kullanılmamalıdır. İzleyici ürünü neden gördüğünü anlayabilmelidir.",
      "WhatsApp'ta güven yüksektir çünkü kitle yakın çevredir. Bu nedenle abartılı satış dili daha hızlı geri teper. Durum paylaşımında fiyat, stok ve satıcı iletişimi net; birebir mesajda ise ürünün sana mı ait olduğu, yoksa ortak olarak mı paylaştığın açık olmalıdır.",
      "Paylaşım metninde üç bilgi eksik kalmamalı: ürünün temel özelliği, fiyat/teslimat bilgisi ve alıcının hangi adımla iletişime geçeceği. Komisyon ilişkisi varsa bunu saklamak yerine doğal ve kısa bir ifadeyle belirtmek güveni korur.",
      "Görsel tutarlılık da önemlidir. Bir ilanda lüks ürün dili, diğerinde aceleyle çekilmiş düşük kaliteli görsel kullanmak hesap güvenini zayıflatır. Ortak, ürün sahibi olmasa bile paylaştığı ürünler için belli bir kalite eşiği belirlemelidir.",
      "Sosyal medya performansını yalnızca beğeniyle ölçme. Tıklama, mesaj, kaydedilme, profil ziyareti ve tamamlanan satış ayrı metriklerdir. Çok izlenen bir video satış getirmeyebilir; az izlenen ama doğru kitleye ulaşan bir hikaye daha iyi dönüşebilir.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Reklam Kurulu Sosyal Medya Etkileyicileri Kılavuzu, https://tuketici.ticaret.gov.tr/data/60927f5b13b876f954d58bd1/Sosyal%20Medya%20Etkileyicileri%20Taraf%C4%B1ndan%20Yap%C4%B1lan%20Ticari%20Reklam%20ve%20Haks%C4%B1z%20Ticari%20Uygulamalar%20Hakk%C4%B1nda%20K%C4%B1lavuz.docx; DataReportal Digital 2026 Turkey, https://datareportal.com/reports/digital-2026-turkey"
    ]
  },
  {
    slug: "musteri-guvenini-kazanmanin-6-etkili-yolu",
    category: "Komisyon Rehberleri",
    title: "Alıcı Güvenini Kazanmanın 6 Somut Yolu",
    excerpt: "Doğrulama, açık fiyat, kayıtlı iletişim, gerçek görsel ve kişisel veri hassasiyetiyle daha güvenilir ilan deneyimi oluşturun.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 5,
    date: "5 Haziran 2026",
    dateShort: "5 Haz",
    image: img("1521791136064-7986c2920216"),
    body: [
      "Online alışverişte güven yalnızca iyi niyetle kurulmaz; alıcıya karar verirken ihtiyaç duyduğu bilgilerin açıkça sunulması gerekir. Özellikle ikinci el, ortak satış veya komisyonlu ilanlarda taraflar birbirini tanımadığı için kayıtlı iletişim ve şeffaf açıklama daha da önemlidir.",
      "1. Kimlik ve iletişim doğrulamasını tamamla. Doğrulanmış telefon, e-posta, profil bilgisi ve geçmiş işlem sinyalleri alıcıya gerçek kişiyle konuştuğunu hissettirir. Eksik profil, iyi ürünlerde bile şüphe yaratabilir.",
      "2. Fiyat, komisyon ve teslimat bilgisini saklama. Alıcı ürün fiyatını; ortak ise komisyon şartını ilan içinde görebilmeli. Bilgi saklamak daha çok mesaj getirebilir ama kaliteli talebi azaltır.",
      "3. Gerçek fotoğraf kullan. Ürünün mevcut halini göstermeyen stok görsel güven sorunu yaratır. İkinci el üründe kusuru göstermek güveni artırır; çünkü alıcı satıcının saklamadığını görür.",
      "4. Kişisel verileri gereksiz isteme. TC kimlik numarası, kart bilgisi, açık adres veya özel belge gibi hassas bilgiler platform dışı ve gereksiz şekilde talep edilmemeli. KVKK yaklaşımı gereği kişisel veri işleme amaçla sınırlı, ölçülü ve bilgilendirmeye dayalı olmalıdır.",
      "5. Konuşmaları kayıtlı tut. Ürün durumu, teslimat tarihi, ödeme şekli ve komisyon şartı mesajlaşmada netleşirse sonradan çıkabilecek anlaşmazlıklarda taraflar neye anlaştığını görebilir.",
      "6. Söz verdiğin şeyi ölçülebilir yaz. 'Çok hızlı kargo' yerine '2 iş günü içinde kargoya verilir', 'temiz ürün' yerine 'ekranda çizik yok, kasada küçük kullanım izi var' gibi ifadeler kullan. Ölçülebilir cümle güven verir.",
      "Güven bir tasarım meselesidir: alıcıyı daha az soru sormaya, daha az risk hissetmeye ve daha bilinçli karar vermeye götüren her bilgi dönüşümü artırır.",
      commonLegalNote,
      "Kaynaklar: KVKK Çerez Uygulamaları Hakkında Rehber, https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/fb193dbb-b159-4221-8a7b-3addc083d33f.pdf; Ticaret Bakanlığı Mesafeli Sözleşmeler ve tüketici bilgilendirme yaklaşımı, https://tuketici.ticaret.gov.tr/"
    ]
  },
  {
    slug: "kargo-ve-teslimat-sureclerinde-dikkat-edilmesi-gerekenler",
    category: "E-Ticaret",
    title: "Kargo ve Teslimatta Sorun Yaşamamak İçin Satıcı Kontrol Listesi",
    excerpt: "Teslimat süresi, paketleme, takip numarası, cayma/iade bilgilendirmesi ve hasar riskini baştan doğru yönetme rehberi.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 5,
    date: "3 Haziran 2026",
    dateShort: "3 Haz",
    image: img("1586528116311-ad8dd3c8310d"),
    body: [
      "Satış, alıcı ürünü sorunsuz teslim aldığında tamamlanır. Kötü paketleme, belirsiz kargo ücreti veya geç takip bilgisi, ürün iyi olsa bile memnuniyeti düşürür. Ortak satışta teslimat sorunu yalnızca satıcıyı değil, ürünü tavsiye eden ortağın güvenini de etkiler.",
      "Teslimat süresini gerçekçi yaz. 'Bugün kargo' diyorsan bunu aynı gün yapabilecek durumda olmalısın. Emin değilsen '1-2 iş günü içinde kargoya verilir' gibi daha doğru bir zaman aralığı kullan.",
      "Kargo ücretini ve sorumluluğunu baştan netleştir. Ücret satıcıya mı alıcıya mı ait, kapıda ödeme var mı, şehir dışına gönderim yapılır mı? Bu bilgiler ilanda yoksa pazarlık ve anlaşmazlık artar.",
      "Paketlemeyi ürün türüne göre yap. Elektronik ürünlerde darbe koruması, cam/seramik ürünlerde katmanlı ambalaj, kıyafette temiz ve kuru paket, büyük ev eşyasında taşıma planı gerekir. Paketleme fotoğrafı paylaşmak güveni artırabilir.",
      "Takip numarasını geciktirme. Ürün kargoya verildikten sonra takip bilgisi alıcıyla paylaşılmalı. Alıcı süreci görebildiğinde gereksiz mesaj trafiği azalır ve teslimat beklentisi netleşir.",
      "İade ve cayma bilgisini kategoriyi dikkate alarak yaz. Mesafeli satışlarda tüketici mevzuatı alıcı lehine önemli haklar düzenler; ancak ikinci el bireysel satış, kişiye özel ürün veya hijyen istisnası gibi durumlarda koşullar değişebilir. Taraflar satıştan önce şartları açıkça konuşmalıdır.",
      "Teslim sonrası kısa kontrol mesajı gönder. 'Ürün elinize ulaştı mı, bir sorun var mı?' mesajı hem memnuniyeti ölçer hem olası sorunu büyümeden çözmeye yardımcı olur.",
      commonLegalNote,
      "Kaynaklar: Mesafeli Sözleşmeler Yönetmeliği cayma hakkı düzenlemesi, https://www.lexpera.com.tr/mevzuat/yonetmelikler/mesafeli-sozlesmeler-yonetmeligi; Ticaret Bakanlığı tüketici duyuruları, https://ticaret.gov.tr/"
    ]
  },
  {
    slug: "trend-urunleri-erken-yakalamanin-yollari",
    category: "Pazarlama",
    title: "Trend Ürünleri Erken Yakalamak İçin Veri Odaklı 6 Yöntem",
    excerpt: "Sosyal medya sinyali, sezon takvimi, kategori büyümesi ve ilan performansını birlikte okuyarak daha doğru ürün seçin.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 5,
    date: "1 Haziran 2026",
    dateShort: "1 Haz",
    image: img("1483985988355-763728e1935b"),
    body: [
      "Trend ürün seçimi yalnızca 'herkes bunu konuşuyor' diye yapılmaz. Asıl mesele sosyal medya ilgisini, kategori talebini, sezonu, fiyat uygunluğunu ve teslimat kapasitesini birlikte okumaktır. Aksi halde çok konuşulan ama satmayan ürünlere emek harcanır.",
      "1. Resmi e-ticaret eğilimlerini takip et. Ticaret Bakanlığı'nın e-ticaret raporları genel hacim, kategori büyümesi ve işlem sayısı gibi makro sinyaller verir. Bu veriler hangi kategorilerde dijital talebin güçlendiğini anlamaya yardımcı olur.",
      "2. Sosyal medya sinyalini erken uyarı olarak kullan. TikTok, Instagram ve YouTube Shorts'ta aynı ürün farklı hesaplarda görünmeye başladıysa talep artıyor olabilir. Yine de tek başına izlenme sayısı satış garantisi değildir.",
      "3. Sezonu bir ay önceden düşün. Kamp ürünleri yaz başlamadan, okul ürünleri dönem başlamadan, ısıtıcı ve mont gibi ürünler soğuklar bastırmadan hazırlanmalı. Trend ürün, doğru zamanda yayına alınmazsa fırsat kaçabilir.",
      "4. Fiyat ve stok kontrolü yap. Trend ürünün satılabilir olması için fiyatı piyasa ile uyumlu, stok bilgisi güncel ve teslimatı mümkün olmalı. Talep yüksek ama stok belirsizse ortakların paylaşımı boşa gider.",
      "5. Kitle uyumunu test et. Aynı ürün farklı kitlelerde farklı anlatılmalıdır. Bir robot süpürge öğrenciler için zaman kazancı, evcil hayvan sahipleri için tüy temizliği, yoğun çalışanlar için rutin kolaylığı olarak anlatılabilir.",
      "6. Küçük testle başla. Önce sınırlı sayıda ortak ve bir-iki kanal ile paylaşım yap, talep kalitesini ölç. İyi çalışan ürünlerde görsel, açıklama ve paylaşım metnini güçlendirerek ölçekle.",
      "Trend ürünün doğru tanımı şudur: alıcının ihtiyacına zamanında denk gelen, satıcının teslim edebildiği, ortağın güvenle anlatabildiği ve verisi takip edilen ürün.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı Türkiye'de E-Ticaretin Görünümü Raporu 2025, https://ticaret.gov.tr/data/6a02f2c7269de183c0b98bc4/T%C3%BCrkiye%27de%20E-Ticaretin%20G%C3%B6r%C3%BCn%C3%BCm%C3%BC%20Raporu%202025.pdf; DataReportal Digital 2026 Turkey, https://datareportal.com/reports/digital-2026-turkey"
    ]
  },
  {
    slug: "ortak-satista-iletisim-satisi-artiran-mesajlasma-taktikleri",
    category: "Vaka Analizleri",
    title: "Ortak Satışta Mesajlaşma: Satışı Artıran Net Cevap Şablonları",
    excerpt: "Kararsız alıcıyı baskı kurmadan bilgilendiren; fiyat, teslimat, kondisyon ve komisyon konularını açıklaştıran mesajlaşma yaklaşımı.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "30 Mayıs 2026",
    dateShort: "30 May",
    image: img("1556761175-5973dc0f32e7"),
    body: [
      "Ortak satışta birçok karar ilan sayfasında değil, mesajlaşmada verilir. Alıcı ürünü anlamak, satıcı güvenini ölçmek ve teslimat riskini görmek ister. Ortak ise yanlış bilgi vermeden süreci hızlandırmaya çalışır.",
      "İlk cevap kısa ve bilgi odaklı olmalı: 'Merhaba, ürün hâlâ satışta. Fiyat 8.500 TL, İstanbul içi elden teslim mümkün, şehir dışına kargo alıcı ödemeli yapılabilir.' Bu mesaj, alıcının en temel üç sorusunu aynı anda cevaplar.",
      "Kondisyon sorusunda ölçülebilir konuş: 'Çalışmasında sorun yok, ekranda çizik bulunmuyor, kasanın sağ köşesinde küçük kullanım izi var. Fotoğrafını ayrıca gönderebilirim.' Bu dil hem dürüst hem ikna edicidir.",
      "Teslimat sorusunda belirsizlik bırakma: 'Bugün saat 17.00'ye kadar anlaşılırsa yarın kargoya verilir; takip numarası aynı gün paylaşılır.' Zaman vermek, 'hemen yollarız' gibi muğlak ifadelerden daha güvenlidir.",
      "Pazarlıkta saygılı sınır koy: 'Fiyatta küçük bir pay var; 8.200 TL altına inemiyoruz çünkü ürün kutulu ve aksesuarları tam.' Neden belirten cevap, sert pazarlıkta bile ilişkiyi korur.",
      "Ortak olarak ürünü paylaşıyorsan rolünü açık tut: 'Ben bu ürünün ortak satıcısıyım; talebinizi satıcıya iletiyorum ve süreç OrtakSat üzerinden kayıtlı ilerliyor.' Bu açıklık, alıcı ve satıcı arasındaki rol karmaşasını önler.",
      "Satış sonrası mesajı unutma: 'Ürün elinize ulaştığında haber verirseniz sevinirim; sorun olursa mesajdan yazabilirsiniz.' Bu tek cümle, memnuniyet ve yorum ihtimalini artırır.",
      "Kötü mesajlaşma hızlı satış kaybettirir; iyi mesajlaşma ise alıcıya kontrol hissi verir. Netlik, hız ve dürüstlük bu yüzden ortak satışta en önemli üç iletişim kuralıdır.",
      commonLegalNote,
      "Kaynaklar: Ticaret Bakanlığı tüketici bilgilendirme yaklaşımı, https://tuketici.ticaret.gov.tr/; KVKK temel ilkeler ve kişisel veri hassasiyeti, https://www.kvkk.gov.tr/"
    ]
  },
  {
    slug: "instagramdan-komisyonla-para-kazanma-rehberi-2026",
    category: "Pazarlama",
    title: "Instagram'dan Komisyonla Para Kazanma: 2026 Başlangıç Rehberi",
    excerpt: "Takipçini gelire çevirmenin en düşük riskli yolu ortak satış. Sıfır sermaye ile ürün tanıtıp satışta komisyon kazanmanın adım adım rehberi.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "1 Temmuz 2026",
    dateShort: "1 Tem",
    image: img("1611162617474-5b21e879e113"),
    featured: true,
    body: [
      "Instagram'da takipçisi olan çoğu kişi aynı soruyu sorar: 'Bu hesabı nasıl gelire çeviririm?' En düşük riskli yol, ürün satın alıp stok tutmadan, yalnızca doğru ürünü tanıtıp satışta komisyon kazanmaktır. Ortak satış tam olarak budur: ürünü sen üretmezsin, kargolamazsın; sadece güvendiğin ürünü kitlene doğru anlatırsın.",
      "1. Kitleni tanı, ürünü ona göre seç. Takipçilerin ne tür içerikle etkileşiyor? Moda, teknoloji, ev-yaşam, bebek, spor... Kitlenin ilgisiyle uyumlu ürün seçmek, binlerce takipçiye rastgele ürün göstermekten çok daha fazla satış getirir. OrtakSat'ta ürünü seçip sana özel referans linkini alırsın.",
      "2. Ürünü kendin gibi anlat. Hazır reklam metni kopyalamak yerine, ürünü neden beğendiğini kendi cümlelerinle söyle. 'Şu özelliği hoşuma gitti', 'şu fiyata bu iş görür' gibi samimi ve dürüst anlatım, cilalı reklamdan daha çok dönüşür.",
      "3. Hikâye + sabit gönderi + DM üçlüsünü kullan. Hikâyede link etiketiyle hızlı ilgi topla, sabit gönderide detay ver, gelen sorulara DM'den net cevap yaz. Aynı ürünü farklı formatlarda birkaç kez göstermek, tek paylaşımdan çok daha etkilidir.",
      "4. İş birliğini gizleme. Bir ürünü ortak olarak tanıtıyorsan bunu belirtmek hem yasal hem güven açısından doğrudur. 'Bu ürünün ortak satıcısıyım, linkten alırsanız bana da katkısı olur' demek kitlenle olan güveni güçlendirir, zayıflatmaz.",
      "5. Sonucu ölç, kazandıranı çoğalt. Hangi ürün, hangi format ve hangi saat daha çok tıklama ve satış getirdi? OrtakSat panelinde tıklama ve satışların görünür; iyi çalışan paylaşımı tekrarla, çalışmayanı bırak.",
      "Ne kadar kazanacağın kitlene, ürünün komisyonuna ve paylaşım kalitene bağlıdır; garanti bir rakam yoktur. Ama sermaye koymadan, stok tutmadan başlayabildiğin için risk neredeyse sıfırdır. Kazanç Hesaplayıcı ile takipçi sayına göre kaba bir tahmin görebilirsin.",
      commonLegalNote
    ]
  },
  {
    slug: "sifir-sermaye-ile-ek-gelir-ortak-satis-nasil-yapilir",
    category: "Girişimcilik",
    title: "Sıfır Sermaye ile Ek Gelir: Ortak Satış Nasıl Yapılır?",
    excerpt: "Para yatırmadan, stok tutmadan ek gelir elde etmek isteyenler için ortak satış modelinin adım adım işleyişi ve gerçekçi beklentiler.",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 5,
    date: "2 Temmuz 2026",
    dateShort: "2 Tem",
    image: img("1554224155-6726b3ff858f"),
    body: [
      "Ek gelir arayanların çoğu aynı engelle karşılaşır: başlamak için sermaye, stok veya teknik bilgi gerekiyor sanılır. Ortak satış bu engeli kaldırır. Ürünü sen almazsın; satıcının ürününü kitlene tanıtır, satış olursa komisyon kazanırsın.",
      "Model basit işler: satıcı ürününü OrtakSat'a ekler ve komisyon oranını belirler. Sen ürüne ortak olursun, sana özel referans linki oluşur. Bu linki paylaşırsın; alıcı linkten gelip satın alırsa komisyon senin olur. Ödeme ve teslimat alıcı ile satıcı arasında yapılır; platform para tutmaz.",
      "Neden düşük risk? Çünkü kaybedeceğin bir sermaye yok. Yanlış ürün seçsen bile maddi zarara girmezsin; sadece o üründen satış gelmez. Bu yüzden ortak satış, ek gelire 'deneyerek' başlamak için en uygun modellerden biridir.",
      "Nereden başlanır? Önce ilgi alanını ve ulaşabildiğin kitleyi belirle: bir Instagram hesabı, bir WhatsApp grubu, bir Telegram kanalı ya da yalnızca yakın çevren bile olabilir. Sonra bu kitleye uygun 2-3 ürün seçip linklerini paylaş.",
      "Gerçekçi ol: ilk günde büyük kazanç beklemek yerine, hangi ürünün ilgi çektiğini gözlemle. Küçük ama düzenli satışlar, tek seferlik büyük beklentiden daha sürdürülebilirdir. Kazandıran ürün ve paylaşım tarzını bulunca ölçeklersin.",
      "Dürüstlük en büyük sermayendir. Abartılı vaat, sahte indirim veya gizli iş birliği kısa vadede tıklama getirse de güveni bozar. Net fiyat, gerçek görsel ve açık iş birliği ifadesi uzun vadede daha çok kazandırır.",
      "Özetle: sıfır sermaye ile ek gelir mümkündür ama sihir değildir. Doğru kitle, doğru ürün ve dürüst iletişimle zamanla anlamlı bir gelir kanalı kurabilirsin.",
      commonLegalNote
    ]
  },
  {
    slug: "urununu-ucretsiz-nasil-sattirirsin-ortak-satis-rehberi",
    category: "Satış İpuçları",
    title: "Ürününü Ücretsiz Nasıl Sattırırsın? Satıcılar için Ortak Satış Rehberi",
    excerpt: "Reklam bütçesi olmadan, komisyonla çalışan bir satış ordusu kurmanın yolu. İlanını ortaklara nasıl cazip hale getirirsin?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 6,
    date: "3 Temmuz 2026",
    dateShort: "3 Tem",
    image: img("1556742049-0cfed4f6a45d"),
    body: [
      "Küçük satıcının en büyük sorunu görünürlüktür: ürün iyi ama yeterince insana ulaşmıyor. Reklam vermek ise bütçe ister ve sonucu belirsizdir. Ortak satış, reklam yerine performansa dayalı bir satış ordusu kurmanı sağlar: yalnızca satış olursa komisyon ödersin.",
      "Nasıl çalışır? Ürününü OrtakSat'a ücretsiz eklersin ve komisyon oranını belirlersin. Ortaklar ürüne katılır, kendi takipçisiyle referans linkini paylaşır. Alıcı linkten gelir, seninle iletişime geçer. Önden reklam maliyeti yoktur.",
      "İlanını ortaklara cazip yap. Ortak, kazancını göreceği için yüksek etkileşimli ilanları paylaşmak ister. Net başlık, gerçek ve bol fotoğraf, açık fiyat ve makul komisyon; ortağın 'bunu rahatça anlatırım' demesini sağlar.",
      "Komisyonu dengeli belirle. Çok düşük komisyon ortağı motive etmez, ürün paylaşılmaz. Çok yüksek komisyon ise marjını yer. Ürünün kârını ve iade riskini koruyan, ama ortağın emeğini de karşılayan bir oran en iyisidir.",
      "Hızlı yanıt ver. Ortak alıcıyı sana yönlendirdiğinde geç cevap verirsen hem satışı hem ortağın motivasyonunu kaybedersin. İlan açıklamasına uygun iletişim saatini ve gerçekçi yanıt süresini yaz.",
      "Anında mı, onaylı mı? OrtakSat'ta ortaklığı 'anında' açık bırakabilir ya da başvuruları tek tek onaylayabilirsin. Yeni başlıyorsan anında ortaklık daha hızlı yayılma sağlar; hassas ürünlerde onaylı mod kontrolü sende tutar.",
      "Sonuçları panelden izle: kaç ortak katıldı, kaç tıklama ve talep geldi. Kazandıran ortakları ve iyi çalışan görselleri belirleyip çoğaltmak, ürününü zamanla çok daha görünür kılar.",
      commonLegalNote
    ]
  },
  {
    slug: "tiktok-reels-ile-urun-tanitip-komisyon-kazanma",
    category: "Pazarlama",
    title: "TikTok ve Reels ile Ürün Tanıtıp Komisyon Kazanma",
    excerpt: "Kısa videonun gücünü ortak satışa çevirmenin pratik yolları: hangi ürün, hangi kanca, hangi çağrı daha çok satış getirir?",
    author: "OrtakSat Editör Ekibi",
    authorRole: "Editör",
    readMin: 5,
    date: "4 Temmuz 2026",
    dateShort: "4 Tem",
    image: img("1521791136064-7986c2920216"),
    body: [
      "Kısa video, bugün ürün tanıtmanın en hızlı büyüyen yolu. TikTok ve Instagram Reels, tek bir iyi videoyla küçük hesapların bile geniş kitleye ulaşmasını sağlar. Ortak satışla birleşince bu erişim doğrudan gelire dönüşebilir: ürünü tanıt, referans linkini profil ya da açıklamaya koy, satışta komisyon kazan.",
      "Doğru ürünü seç. Kısa videoda en iyi çalışan ürünler görselliği güçlü, faydası ilk saniyede anlaşılan ve fiyatı makul olanlardır. İzleyicinin 'bunu ben de isterim' dediği ürünler daha çok tıklama getirir.",
      "İlk 3 saniyede kanca kur. 'Bu üründen neden vazgeçemedim', 'X TL'ye bu iş görür mü?', 'evde mutlaka olması gereken şey' gibi net bir açılış izleyiciyi durdurur. Uzun girişler izlenmeden geçilir.",
      "Faydayı göster, özelliği say. Ürünün ne işe yaradığını kullanırken göstermek, teknik özellik sıralamaktan daha ikna edicidir. Gerçek kullanım, gerçek ortam, abartısız anlatım.",
      "Net bir çağrı bırak. Videonun sonunda ne yapılacağını söyle: 'Profildeki linkten ulaşabilirsin', 'detaylar açıklamada'. Belirsiz bırakılan videolar ilgi toplasa da satışa dönmez.",
      "İş birliğini belirt. Ortak olarak tanıtım yaptığını açıkça söylemek hem platform kurallarına hem güvene uygundur. Şeffaflık, izleyicinin sana ve ürüne güvenini artırır.",
      "Test et ve tekrarla. Hangi ürün, hangi kanca ve hangi uzunluk daha çok tıklama getirdi? OrtakSat panelinde satışları izleyip kazandıran formatı çoğaltmak, tek videoya güvenmekten çok daha sürdürülebilirdir.",
      commonLegalNote
    ]
  }
];

export const POPULAR_TAGS = ["#ortaksatış", "#komisyon", "#eticaret", "#girişimcilik", "#satışipuçları", "#pazarlama", "#güven", "#vaka"];

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

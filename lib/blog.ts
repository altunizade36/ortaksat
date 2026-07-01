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
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
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
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 5,
    date: "18 Mayıs 2024",
    dateShort: "18 May",
    image: img("1556742049-0cfed4f6a45d"),
    body: [
      "Komisyonla satışta başarı; doğru ürünü, doğru kitleye, doğru mesajla ulaştırmaktan geçer. Aşağıdaki on kural, ortak satıcıların kazancını en çok artıran, sahada denenmiş uygulamalardır. Hepsinin ortak noktası basit: kısa vadeli tek satış değil, uzun vadeli güven ve tekrar eden kazanç.",
      "1. Arkasında durabileceğin ürünü seç. Kendi kullanmayacağın ya da güvenmediğin bir ürünü paylaşmak kısa vadede birkaç satış getirse de itibarını ve takipçi güvenini yıpratır. Güven, ortak satışta en değerli sermayedir; bir kez kaybedince geri kazanmak çok zordur.",
      "2. Yüksek komisyon ile kolay satışı dengele. Yalnızca komisyon oranına bakma; talebi olmayan pahalı bir üründense makul komisyonlu ama hızlı satan bir ürün, toplamda çok daha fazla kazandırır. Kazanç = komisyon × satış adedi; ikinci çarpanı unutma.",
      "3. Hedef kitleni tanı. Takipçilerin bebek ürünleriyle ilgileniyorsa onlara elektronik paylaşmak dönüşmez. Kendi çevrenin gerçekten ihtiyaç duyduğu, gündelik hayatına dokunan ürünleri seç.",
      "4. Ürünü kullanırken göster. 'Ben de aldım, şu işime yaradı' diyen gerçek bir deneyim paylaşımı, kuru bir link paylaşımından kat kat fazla dönüşür. İnsanlar reklamdan değil, güvendikleri kişinin tavsiyesinden satın alır.",
      "5. Net ve dürüst anlat. Ürünün faydasını abartmadan, gerçek özellikleriyle anlat. Yanıltıcı vaat; iade, olumsuz yorum ve kaybedilen güven olarak sana geri döner.",
      "6. Harekete geçirici çağrı kullan. 'Link profilimde', 'stok sınırlı', 'bugün mesaj atarsan detay göndereyim' gibi net bir yönlendirme, kararsız ziyaretçiyi harekete geçirir. Çağrısı olmayan paylaşım çoğu zaman izlenir ama tıklanmaz.",
      "7. Hızlı yanıt ver. Gelen soruları saatler sonra değil, dakikalar içinde yanıtla. İlk bir saat içinde yanıtlanan bir talep, çok daha yüksek oranda satışa döner; geç yanıt çoğu zaman kayıp müşteri demektir.",
      "8. Birden fazla kanalı birlikte kullan. Aynı ürünü Instagram hikâyesi, WhatsApp durumu ve uygunsa TikTok'ta farklı formatlarda paylaş. Her kanal farklı kişilere ulaşır; tek kanala bağlı kalmak erişimini sınırlar.",
      "9. Performansını ölç. Hangi ürün, hangi kanal ve hangi saat daha çok sattı? Panelindeki talep ve tıklama verilerine bakıp kazandıran işi tekrarla, kazandırmayanı bırak. Ölçmeden büyümek tahminle yürümektir.",
      "10. Satış sonrası ilişkiyi sürdür. Alıcıya teşekkür et, memnuniyetini sor, yeni ürününde yine haber ver. Düzenli müşteri; tek seferlik alıcıdan çok daha değerli, çok daha ucuz ve çok daha kârlıdır.",
      "Kısa özet: doğru ürün + doğru kitle + dürüst iletişim + hız + ölçüm. Bu beşini tutturan ortak, zamanla istikrarlı bir komisyon hacmine ulaşır.",
      "Yasal not: OrtakSat bir aracı ilan ve iletişim platformudur; ödeme almaz, para tutmaz, komisyon kesmez. Komisyon oranı satıcı ile ortak arasında belirlenir; ödeme ve teslimat, tarafların kendi anlaştığı yöntemle, kendi sorumluluklarında yapılır. Buradaki oran ve tutarlar yalnızca bilgilendirme amaçlıdır."
    ]
  },
  {
    slug: "komisyon-oranlari-nasil-belirlenir-rehber",
    category: "Komisyon Rehberleri",
    title: "Komisyon Oranları Nasıl Belirlenir? Rehber",
    excerpt: "Doğru komisyon oranı belirlemek hem sizi hem de ortaklarınızı mutlu eder.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 4,
    date: "15 Mayıs 2024",
    dateShort: "15 May",
    image: img("1551288049-bebda4e38f71"),
    body: [
      "Komisyon oranı, ortak satışın kalbidir. Çok düşük belirlersen ortakların ilgisi azalır, ürünün yayılmaz; çok yüksek belirlersen kendi kâr marjın erir. Doğru oran; ürünün kâr marjına, rakiplerin verdiği komisyona ve ürünün satış hızına göre belirlenir. Bu rehberde adım adım nasıl karar vereceğini anlatıyoruz.",
      "1. Önce kâr marjını hesapla. Ürünün sana maliyeti ile satış fiyatı arasındaki farkın bir kısmını ortağa ayıracaksın. Marjını bilmeden komisyon vermek, zararına satış riskidir. Basit kural: komisyon, marjını tümüyle yemeyecek kadar makul olmalı.",
      "2. Yüzde mi, sabit tutar mı? Yüksek fiyatlı ve yüksek marjlı ürünlerde yüzde (%) komisyon (ör. %10–20) ortağı daha çok motive eder. Düşük fiyatlı ya da dar marjlı ürünlerde ise sabit tutar (ör. ürün başına belirli bir ₺) hem seni korur hem ortağa net bir hedef verir.",
      "3. Rakipleri incele. Benzer ürünlerde ortaklara ne veriliyor? Sektör ortalamasının altında kalırsan ortaklar senin yerine başka ürünü paylaşır. Ortalamanın hafif üstü, ürününü öne çıkarır.",
      "4. Satış hızını hesaba kat. Hızlı satan, talebi yüksek üründe komisyonu biraz düşük tutabilirsin; çünkü ortak zaten kolay satacak. Zor satan, ikna gerektiren üründe komisyonu yüksek tutmak ortağı emek vermeye ikna eder.",
      "5. Ortağın emeğini gör. Ortak için paylaşım; içerik üretmek, soruları yanıtlamak ve müşteriyi ikna etmek demek — yani gerçek bir iş. Adil komisyon, bu emeğin karşılığıdır ve sadık bir ortak ağı kurmanın tek yoludur.",
      "6. Kampanya dönemlerinde geçici artış yap. Sezon başı, bayram ya da stok eritme dönemlerinde komisyonu geçici olarak yükseltmek, ortak hareketliliğini ve satış hacmini hızla artırır. Bittiğinde eski orana dönebilirsin.",
      "7. Net göster, sonradan değiştirme. Ortak, paylaşmadan önce kazancını ilanda net görmeli. Satış gerçekleştikten sonra komisyonu düşürmek, güveni bir anda yok eder ve ortakların bir daha ürününü paylaşmaz.",
      "Doğru komisyon, hem seni hem ortağını kazançlı kılan bir denge noktasıdır. Test et, ölç, ayarla: birkaç hafta sonra hangi oranın daha çok satış getirdiğini verilerle göreceksin.",
      "Yasal not: OrtakSat komisyonu göstermekten ve takibi kolaylaştırmaktan ibarettir; ödeme almaz, para tutmaz, komisyon kesmez. Oranı satıcı belirler; ödeme taraflar arasında yapılır. Buradaki oranlar örnektir, tavsiye değildir."
    ]
  },
  {
    slug: "e-ticarette-donusum-oranini-artirmanin-8-yolu",
    category: "E-Ticaret",
    title: "E-Ticarette Dönüşüm Oranını Artırmanın 8 Yolu",
    excerpt: "Ürünlerinizi daha çok kişiye ulaştırmak ve satışlarınızı artırmak için ipuçları.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 6,
    date: "12 Mayıs 2024",
    dateShort: "12 May",
    image: img("1563013544-824ae1b704d3"),
    body: [
      "Dönüşüm oranı, ilanını gören ziyaretçilerin ne kadarının gerçekten alıcıya (ya da ortağa) dönüştüğünü gösterir. Trafiği artırmak pahalıdır; ama var olan trafiği daha iyi dönüştürmek çoğu zaman bedavadır. Küçük iyileştirmeler bile toplam satışta büyük fark yaratır. İşte kanıtlanmış 8 yol:",
      "1. Net ve gerçek görseller kullan. Bulanık, karanlık ya da internetten alınmış görseller güveni düşürür. Ürünü farklı açılardan, gerçek ışıkta, gerektiğinde bir insanın kullanırken çektiği fotoğraflarla göster.",
      "2. Başlığı açık yaz. Alıcı başlıkta ne olduğunu, markayı ve en önemli özelliği bir bakışta görmeli. 'Süper ürün' değil, 'iPhone 13 128GB — kutulu, garantili' gibi net başlıklar dönüşümü artırır.",
      "3. Fiyat ve teslimat bilgisini açıkça göster. Gizli fiyat, 'DM'den sor' yaklaşımı alıcının çoğunu kaçırır. Fiyatı, varsa teslimat süresini ve koşulları en baştan yaz.",
      "4. Güveni öne çıkar. Doğrulanmış satıcı rozeti, gerçek yorumlar, puan ve satıcı geçmişi; kararsız alıcının en büyük sorusu olan 'bu satıcı güvenilir mi?'ye yanıt verir.",
      "5. Açıklamayı fayda odaklı yaz. Sadece teknik özellik değil, 'bu senin şu sorununu şöyle çözer' diyen bir açıklama daha çok ikna eder. Özellik anlatır, fayda satar.",
      "6. İletişimi kolaylaştır. Alıcının soru sormasını zorlaştıran her adım bir kayıptır. Mesaj, WhatsApp ya da arama; hangisini sunuyorsan görünür ve tek dokunuşla erişilebilir olsun.",
      "7. Hızlı yanıt ver. Dönüşümün büyük kısmı ilk saatlerde kaybolur. Gelen mesaja dakikalar içinde dönen satıcı, saatler sonra dönenden çok daha fazla satar.",
      "8. Sosyal kanıt ekle. Gerçek yorumlar, 'X kişi bu ilanı favoriledi' ya da 'bu üründe Y ortak satıyor' gibi bilgiler, 'demek ki iyi bir ürün' hissi yaratıp kararsızı harekete geçirir.",
      "Bu 8 maddeyi tek tek uygula, sonra panelindeki talep ve favori verisine bak. Küçük dokunuşların toplamı, birkaç hafta içinde belirgin bir satış artışı olarak geri döner."
    ]
  },
  {
    slug: "kucuk-girisimden-buyuk-markaya-ilham-veren-hikaye",
    category: "Girişimcilik",
    title: "Küçük Bir Girişimden Büyük Bir Markaya: İlham Veren Hikaye",
    excerpt: "Ortak satışla büyüyen bir girişimcinin gerçek başarı hikayesi.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 7,
    date: "10 Mayıs 2024",
    dateShort: "10 May",
    image: img("1506905925346-21bda4d32df4"),
    body: [
      "Her büyük markanın başında küçük bir hikâye vardır. Bu yazıda, tek bir üründen yola çıkan bir girişimcinin ortak satış ağıyla nasıl ulusal ölçekte tanınan bir markaya dönüştüğünü anlatıyoruz. Hikâye kurgu değil; Türkiye'de binlerce küçük satıcının izleyebileceği gerçekçi bir yol haritası.",
      "Başlangıç: sınırlı bütçe, tek ürün. Girişimcimiz elinde tek bir ürünle işe başladı. Reklam bütçesi yoktu; büyük pazaryerlerinin komisyonları ve rekabeti ise küçük satıcıyı boğuyordu. Klasik yol tıkanmıştı.",
      "Dönüm noktası: ürünü ortaklara açmak. Reklama para dökmek yerine ürününü ortak satıcılara açtı ve adil bir komisyon belirledi. Artık ürünü tek başına değil, her biri kendi çevresine ulaşan onlarca kişi anlatıyordu. Ödeme sadece satış olduğunda, belirlenen komisyon üzerinden yapılıyordu — yani risk yoktu.",
      "Büyüme: güven kartopu. İlk satışlar geldikçe gerçek yorumlar birikti. Yorumlar yeni alıcıların güvenini kazandı, güven yeni satışları, satışlar da yeni ortakları getirdi. Kartopu büyüdükçe girişimci kazancını yeni ürünlere yatırdı ve kataloğunu genişletti.",
      "Kritik kararlar. Girişimci üç şeyden asla ödün vermedi: komisyonu her zaman adil tuttu, verdiği sözü (teslimat, kalite) her zaman yerine getirdi ve ortaklarıyla şeffaf iletişim kurdu. Zor günlerde bile ortaklarının kazancını korudu — bu yüzden ortakları onu bırakmadı.",
      "Bugün: onlarca ortak, istikrarlı büyüme. Bugün bu marka, düzenli çalışan geniş bir ortak ağına sahip. En büyük varlığı depo ya da reklam değil; ona güvenen ortakları ve memnun müşterileri.",
      "Çıkarılacak ders. Büyümek için büyük bütçe şart değil; doğru model, adil komisyon ve şeffaflık yeterli. Sen de tek bir üründen başlayabilirsin. Önemli olan ilk adımı atmak, sözünü tutmak ve ortaklarınla birlikte kazanmak.",
      "Not: OrtakSat bu süreçte satıcı ile ortakları buluşturan, ilan ve iletişim altyapısını sağlayan aracı bir platformdur; satışın ve ödemenin tarafı değildir. Başarı, tarafların dürüst ve istikrarlı çalışmasıyla gelir."
    ]
  },
  {
    slug: "sosyal-medyada-ortak-satis-yapmanin-ipuclari",
    category: "Pazarlama",
    title: "Sosyal Medyada Ortak Satış Yapmanın İpuçları",
    excerpt: "Instagram, WhatsApp ve TikTok'ta referans linkinizle daha çok satış yapın.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 5,
    date: "7 Mayıs 2024",
    dateShort: "7 May",
    image: img("1611162617474-5b21e879e113"),
    body: [
      "Sosyal medya, ortak satıcının en güçlü ve en ucuz silahıdır. Tek bir iyi içerikle referans bağlantın binlerce kişiye ulaşabilir. Ama rastgele link paylaşmak işe yaramaz; kitleni tanıyan, değer veren ve doğru çağrıyı yapan içerik satış getirir. İşte platform platform ipuçları.",
      "Instagram: Hikâye + Reels ikilisi. Ürünü kullanırken çektiğin kısa bir Reels, en çok dönüşen formattır. Hikâyede 'link için mesaj at' ya da profil bağlantına yönlendir. Öne çıkanlar (highlights) bölümünde ürünlerini kategorilere ayır ki eski paylaşımların da satmaya devam etsin.",
      "WhatsApp: Durum ve birebir güven. WhatsApp'ta 'durum' özelliği yakın çevrene ulaşmanın en samimi yoludur. Birebir sohbette ise soruları hızlı yanıtla; WhatsApp'ta güven çok yüksektir, bu yüzden dönüşüm de yüksektir.",
      "TikTok: Eğlence + fayda. TikTok'ta doğrudan reklam iş görmez; ürünü bir soruna çözüm olarak, kısa ve eğlenceli anlatan videolar keşfete düşer. 'Şu sorunu şöyle çözdüm' formatı en çok yayılan içeriktir.",
      "Ortak kural 1 — Ürünü kullanırken göster. İnsanlar reklamdan değil, güvendikleri kişinin gerçek deneyiminden satın alır. 'Ben aldım, işime yaradı' cümlesi en güçlü satış cümlesidir.",
      "Ortak kural 2 — Faydayı net anlat. Teknik özellik değil, alıcının hayatında ne değişeceğini anlat. Özellik bilgi verir; fayda satın aldırır.",
      "Ortak kural 3 — Harekete geçirici çağrı ekle. Her paylaşımın sonunda net bir yönlendirme olsun: 'linke tıkla', 'mesaj at', 'stok bitmeden yaz'. Çağrısız içerik izlenir ama tıklanmaz.",
      "Ortak kural 4 — Tutarlı ol. Ara sıra paylaşan değil, düzenli paylaşan ortaklar kazanır. Haftada birkaç kez, aynı saatlerde paylaşım yaparak kitleni alışkanlık haline getir.",
      "Son olarak: sadece arkasında durabileceğin ürünleri paylaş. Sosyal medyada itibar yavaş kazanılır, hızlı kaybedilir. Dürüst içerik, uzun vadede en çok kazandıran stratejidir.",
      "Not: Paylaştığın referans bağlantısı üzerinden gelen talepler OrtakSat panelinde takip edilir; ödeme ve teslimat taraflar arasında gerçekleşir. Platform ödeme almaz, komisyon kesmez."
    ]
  },
  {
    slug: "musteri-guvenini-kazanmanin-6-etkili-yolu",
    category: "Komisyon Rehberleri",
    title: "Müşteri Güvenini Kazanmanın 6 Etkili Yolu",
    excerpt: "Doğrulanmış satıcı, şeffaf komisyon ve gerçek yorumlarla güven inşa edin.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 5,
    date: "5 Mayıs 2024",
    dateShort: "5 May",
    image: img("1521791136064-7986c2920216"),
    body: [
      "Güven, online satışın temelidir. Ürünün ne kadar iyi olduğu değil, alıcının sana ne kadar güvendiği satışı belirler. Türkiye'de alıcı; 'iade var mı, kaç günde gelir, bu satıcı gerçek mi, param güvende mi' sorularına net yanıt arar. İşte güven inşa etmenin 6 etkili yolu.",
      "1. Kimliğini doğrula. Telefon ve e-posta doğrulaması yapılmış, profili eksiksiz doldurulmuş bir satıcı; anonim bir hesaptan kat kat daha güven verir. Doğrulanmış satıcı rozeti, alıcının ilk sorusunu daha bakmadan yanıtlar.",
      "2. Şeffaf ol. Fiyatı, teslimat süresini, iade ve değişim koşullarını en baştan açıkça yaz. Bilgiyi gizlemek değil, açıkça paylaşmak güven kazandırır. 'Sürprizsiz' alışveriş, tekrar eden alışverişin ilk şartıdır.",
      "3. Gerçek yorumları öne çıkar. Sosyal kanıt en güçlü ikna aracıdır. Memnun müşterilerinden yorum iste; birkaç gerçek olumlu yorum, en iyi reklamdan daha etkilidir.",
      "4. Hızlı ve nazik iletişim kur. Sorulara hızlı, saygılı ve net yanıt veren satıcı güven verir. Geç yanıt ya da savsaklama, alıcıda 'acaba dolandırılır mıyım' şüphesi yaratır.",
      "5. Sözünü tut. Söylediğin sürede teslim et, anlattığın ürünü gönder. Bir kez verdiğin sözü tutmak, on reklamdan daha çok güven kazandırır; bir kez tutmamak ise onu bir anda yıkar.",
      "6. Sürecin kayıtlı olduğunu göster. Anlaşmanın, komisyonun ve talebin platform üzerinde kayıt altında olması hem alıcıyı hem seni korur. 'Her şey kayıtlı' hissi, tarafları rahatlatır ve anlaşmazlıkları azaltır.",
      "Güven bir günde kazanılmaz; her doğru davranışla azar azar birikir. Ama bir kez kazandığında, en değerli sermayen olur: güvenilir satıcıdan insanlar tekrar tekrar alır ve seni başkalarına önerir.",
      "Not: OrtakSat, tarafların güvenli iletişim kurmasını sağlayan aracı bir platformdur; ödeme almaz, para tutmaz, tarafların yerine işlem yapmaz. Ödeme ve teslimat güvenliği, tarafların kendi anlaşmasına bağlıdır — bu yüzden şeffaflık daha da önemlidir."
    ]
  },
  {
    slug: "kargo-ve-teslimat-sureclerinde-dikkat-edilmesi-gerekenler",
    category: "E-Ticaret",
    title: "Kargo ve Teslimat Süreçlerinde Dikkat Edilmesi Gerekenler",
    excerpt: "Teslimat deneyimi, tekrar satışın ve olumlu yorumun anahtarıdır.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 4,
    date: "3 Mayıs 2024",
    dateShort: "3 May",
    image: img("1586528116311-ad8dd3c8310d"),
    body: [
      "Satış, para el değiştirince değil, ürün alıcının eline sorunsuz ulaşınca tamamlanır. İyi bir teslimat deneyimi müşteriyi tekrar alıcıya ve olumlu yorum yazan birine dönüştürür; kötü bir deneyim ise tüm pazarlama çabanı bir anda boşa çıkarır. İşte dikkat edilmesi gerekenler.",
      "1. Teslimat süresini gerçekçi ver. Tutamayacağın kısa süreler vaat etme. 'Yarın kapında' deyip üç gün geciktirmektense, '2–3 iş günü' deyip zamanında teslim etmek çok daha iyi bir izlenim bırakır.",
      "2. Paketlemeye özen göster. Ürün ne kadar iyi olursa olsun, ezik ya da hasarlı gelirse alıcı hayal kırıklığına uğrar. Sağlam, temiz ve gerektiğinde koruyuculu paketleme, profesyonelliğin ilk işaretidir.",
      "3. Takip bilgisini paylaş. Kargo takip numarasını alıcıyla paylaşmak, 'ürünüm nerede' endişesini ortadan kaldırır. Alıcı süreci görebildiğinde güveni artar, gereksiz mesaj trafiği azalır.",
      "4. Gecikmede proaktif ol. Bir gecikme olacaksa, alıcı sormadan önce sen haber ver. Dürüst ve zamanında bir 'kargoda küçük bir gecikme var, şu gün elinizde olur' mesajı, sessiz kalmaktan çok daha az sorun yaratır.",
      "5. İade ve değişim koşullarını baştan netleştir. Anlaşmazlıkların çoğu, koşulların satıştan sonra konuşulmasından çıkar. Kimin ne durumda iadeyi kabul ettiğini önceden yazılı olarak netleştirmek, iki tarafı da korur.",
      "6. Teslim sonrası dokun. Ürün ulaştıktan sonra kısa bir 'elinize sağlıkla ulaştı mı?' mesajı hem memnuniyeti ölçer hem de olumlu yorum ihtimalini artırır. Küçük bir ilgi, sadık müşteri yaratır.",
      "Unutma: teslimat, markanın alıcıyla fiziksel olarak buluştuğu tek andır. Bu anı iyi yöneten satıcı, tek seferlik alıcıyı düzenli müşteriye çevirir.",
      "Önemli not: OrtakSat bir aracı ilan ve iletişim platformudur; kargo/teslimat entegrasyonu sağlamaz, taşımanın tarafı değildir. Teslimat ve iade süreçleri tamamen satıcı ile alıcı arasında, kendi anlaştıkları yöntemle yürütülür."
    ]
  },
  {
    slug: "trend-urunleri-erken-yakalamanin-yollari",
    category: "Pazarlama",
    title: "Trend Ürünleri Erken Yakalamanın Yolları",
    excerpt: "Doğru zamanda doğru ürünü paylaşan ortak, komisyonunu katlar.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 5,
    date: "9 Mayıs 2024",
    dateShort: "9 May",
    image: img("1483985988355-763728e1935b"),
    body: [
      "Ortak satışta zamanlama, ürün kadar önemlidir. Bir ürün trend olduğunda ilk paylaşanlar en çok kazanır; herkes paylaşmaya başladığında ise rekabet artar, dönüşüm düşer. Trendi erken yakalamak öğrenilebilir bir beceridir. İşte yolları.",
      "1. Keşfet ve gündemi düzenli tara. Keşfet akışını, popüler kategorileri ve 'yeni eklenen' ilanları düzenli takip et. Bir ürünün favori ve talep sayısı hızla artıyorsa, bu bir yükseliş sinyalidir.",
      "2. Mevsimi ve takvimi öngör. Talep çoğu zaman tahmin edilebilir: yaz öncesi kamp/plaj ürünleri, okul döneminde kırtasiye ve elektronik, kış başında ısıtıcı ve mont. Sezon başlamadan haftalar önce hazırlan.",
      "3. 'Yüksek komisyon' filtresini kullan. Satıcılar bir ürünü hızlı yaymak istediğinde komisyonu yükseltir. Yüksek komisyonlu yeni ilanlar, hem kazançlı hem de satıcının arkasında durduğu ürünlerdir — ikisi birden fırsat demektir.",
      "4. Sosyal medya sinyallerini oku. Bir ürün TikTok ya da Instagram'da dönmeye başladıysa, talep birkaç gün içinde platforma da yansır. Sosyal medyayı 'erken uyarı sistemi' gibi kullan.",
      "5. Kendi kitlene çevir. Trend ürünü herkes gibi anlatma; kendi takipçilerinin diline ve ihtiyacına uyarla. Aynı ürünü 'annelere', 'öğrencilere' ya da 'teknoloji meraklılarına' farklı anlatmak dönüşümü belirgin artırır.",
      "6. Erken ama seçici ol. Her trende atlama; sadece arkasında durabileceğin, kitlenle uyumlu trendleri seç. Yanlış ürünü erken paylaşmak, doğru ürünü geç paylaşmaktan daha çok zarar verir.",
      "Özet: trendi izle, mevsimi öngör, yüksek komisyonu yakala ve kendi kitlene çevir. Doğru zamanda doğru ürünü paylaşan ortak, aynı emekle çok daha fazla komisyon kazanır."
    ]
  },
  {
    slug: "ortak-satista-iletisim-satisi-artiran-mesajlasma-taktikleri",
    category: "Başarı Hikayeleri",
    title: "Ortak Satışta İletişim: Satışı Artıran Mesajlaşma Taktikleri",
    excerpt: "Alıcıyla doğru iletişim, kararsız ziyaretçiyi memnun müşteriye dönüştürür.",
    author: "OrtakSat Editör",
    authorRole: "Editör Ekibi",
    readMin: 5,
    date: "1 Mayıs 2024",
    dateShort: "1 May",
    image: img("1556761175-5973dc0f32e7"),
    body: [
      "Ortak satışta çoğu satış, ürün sayfasında değil, mesajlaşmada kazanılır ya da kaybedilir. İyi bir ortak satıcı sadece link paylaşan değil; soruları yanıtlayan, güven veren ve süreci kolaylaştıran kişidir. İşte kararsız ziyaretçiyi memnun müşteriye çeviren mesajlaşma taktikleri.",
      "1. Hızlı yanıt ver. İletişimde en belirleyici faktör hızdır. İlk yarım saatte yanıtlanan bir mesaj, saatler sonra yanıtlanana göre çok daha yüksek oranda satışa döner. Alıcının ilgisi sıcakken yakala.",
      "2. Selamla ve ismiyle hitap et. 'Merhaba, hoş geldiniz' gibi sıcak bir açılış ve mümkünse isimle hitap, robotik değil insani bir izlenim bırakır. İnsanlar insandan alışveriş yapmayı sever.",
      "3. Faydayı ihtiyaca bağla. Alıcının ne aradığını anla, sonra ürünün faydasını tam olarak o ihtiyaca bağla. 'Bu ürün sizin şu sorununuzu şöyle çözer' demek, özellik listesi saymaktan çok daha etkilidir.",
      "4. Fiyat ve teslimatı net anlat. Belirsizlik güveni düşürür. Fiyatı, varsa teslimat süresini ve koşulları açık, dürüst ve tek mesajda anlat. Alıcı ne kadar az soru sormak zorunda kalırsa, o kadar rahat karar verir.",
      "5. Baskı yapma, yol göster. 'Hemen al yoksa kaçar' baskısı çoğu zaman ters teper. Bunun yerine bilgi ver, güven ver ve kararı alıcıya bırak. Rahat hisseden alıcı daha kolay 'evet' der.",
      "6. Dürüst ol. Bilmediğin bir şeyi uydurmak yerine 'kontrol edip hemen döneceğim' de. Ürünün bir eksiği varsa önceden söyle. Dürüstlük kısa vadede bir satış kaybettirebilir ama uzun vadede sadık müşteri kazandırır.",
      "7. Satış sonrası teşekkür et. Satıştan sonra kısa bir teşekkür ve 'her şey yolunda mı?' mesajı, alıcıyı değerli hissettirir. Bu küçük dokunuş, olumlu yorum ve tekrar alışveriş ihtimalini belirgin artırır.",
      "Özet: hızlı, samimi, net ve dürüst iletişim. Bu dört kelime, tek seferlik bir alıcıyı düzenli müşteriye ve seni tavsiye eden bir hayrana dönüştürür.",
      "Not: Alıcılarla iletişim OrtakSat mesajlaşma altyapısı üzerinden güvenle kurulabilir. Platform ödemenin ve teslimatın tarafı değildir; anlaşma taraflar arasında yapılır."
    ]
  }
];

export const POPULAR_TAGS = ["#ortaksatış", "#komisyon", "#eticaret", "#girişimcilik", "#satışipuçları", "#pazarlama", "#başarıhikayeleri", "#dönüşüm"];

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

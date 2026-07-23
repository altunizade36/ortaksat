import { MaterialCommunityIcons } from "@/components/icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CategoryPicker } from "@/components/category-picker";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { AnchoredDropdown, useAnchor } from "@/components/anchored-dropdown";
import { OptionSheet } from "@/components/option-sheet";
import { LegalDisclaimer, LegalDisclaimerCollapsible } from "@/components/legal-disclaimer";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { modelsForSchema, deriveFieldsFromPath, describeAttributes, getFormSchema, resolveFormKey, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { CURRENCIES, moneyIn, partnerInviteUrl, productUrl, listingShareTemplates, type CurrencyCode } from "@/lib/format";
import { categoryConversion } from "@/lib/conversion";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { formatLocation, getProvince } from "@/lib/locations";
import { uploadListingImage } from "@/lib/live-service";
import { autoFillListing } from "@/lib/listing-autofill";
import { categoryRisk, moderateListingText, MODERATION_MESSAGES, scanTextLocal } from "@/lib/moderation";
import { computeListingRisk } from "@/lib/risk";
import { rateLimit } from "@/lib/rate-limit";
import { shareOrCopy } from "@/lib/share";
import { useIsWideWeb } from "@/lib/layout";
import type { CommissionType, Listing, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { LIMITS, parseTrPrice, validateListing } from "@/lib/validation";

const STEPS = ["Kategori", "İlan Bilgileri", "Konum", "Fotoğraflar", "Komisyon & Ortak Satış", "Önizleme & Yayınla"];
// 5 idi: emlak/vasıta gibi kategorilerde ürünü anlatmaya yetmiyordu (Sahibinden 15-30 verir).
// Yükleme otomatik 1600px'e ölçekler + sıkıştırır, ayrıca 512px kart varyantı üretir.
const MAX_PHOTOS = 15;
const RECOMMENDED_PHOTOS = 3;
const CONDITION_IMG = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";

// Kategoriye göre önerilen komisyon aralığı (%). Yüksek-tutarlı kategoriler (emlak/
// vasıta) düşük oran, dijital/hizmet yüksek oran. Bilgi amaçlı öneri — zorlayıcı değil.
const SUGGESTED_COMMISSION: Record<string, [number, number]> = {
  "Emlak": [1, 3],
  "Vasıta": [2, 6],
  "Yedek Parça, Aksesuar & Tuning": [8, 15],
  "İkinci El & Sıfır Alışveriş": [8, 18],
  "İş Makineleri & Sanayi": [3, 10],
  "Ustalar & Hizmetler": [10, 20],
  "Özel Ders & Eğitim": [10, 20],
  "Hayvanlar Alemi": [8, 15],
  "Dijital Ürünler & Hizmetler": [15, 30],
  "Yapı Market & Bahçe": [8, 18],
  "Müzik Enstrümanları": [8, 18],
  "Sağlık & Medikal": [8, 15]
};

// Başlık boşken gösterilen ÖRNEK (kategoriye göre). Sahibinden gibi: kullanıcıya iyi bir
// başlığın nasıl olduğunu gösterir, ama alanı doldurmaz — kendi yazar.
const TITLE_EXAMPLES: Record<string, string> = {
  "Emlak": "Örn. Bahçelievler'de 3+1 Ara Kat Cephe Daire",
  "Vasıta": "Örn. 2018 BMW 320i, 45.000 km, tam bakımlı",
  "Yedek Parça, Aksesuar & Tuning": "Örn. Passat B8 Orijinal Far Takımı, sıfır",
  "İkinci El & Sıfır Alışveriş": "Örn. iPhone 13 128GB, kutulu, garantili",
  "İş Makineleri & Sanayi": "Örn. 2015 CAT 320D Ekskavatör, 6.500 saat",
  "Ustalar & Hizmetler": "Örn. Boya Badana ve Alçı Ustası — İstanbul",
  "Özel Ders & Eğitim": "Örn. Lise Matematik Özel Ders — birebir/online",
  "Hayvanlar Alemi": "Örn. Golden Retriever Yavru, aşıları tam",
  "Dijital Ürünler & Hizmetler": "Örn. Kurumsal Logo + Marka Kimliği Tasarımı"
};
const titlePlaceholderFor = (topLabel?: string) => (topLabel && TITLE_EXAMPLES[topLabel]) || "Örn. Ürünü, modeli ve öne çıkan özelliğini yaz";

// Açıklama için tek-dokunuş madde şablonu (kategoriye göre). Boş açıklamayı doldurur;
// kullanıcı üzerine yazar. Alıcının en çok sorduğu şeyleri hazır satır olarak verir.
const DESC_TEMPLATES: Record<string, string> = {
  "Emlak": "• Oda / salon: \n• m² (net/brüt): \n• Bulunduğu kat / bina yaşı: \n• Isıtma: \n• Aidat: \n• Krediye uygun mu: \n• Eşyalı mı: \n• Öne çıkanlar (asansör, otopark, cephe): ",
  "Vasıta": "• Model yılı / km: \n• Yakıt / vites: \n• Değişen–boyalı parça: \n• Tramer kaydı: \n• Bakım geçmişi: \n• Lastik durumu: \n• Ekstralar (cam tavan, kamera…): \n• Takas / kredi: ",
  "İkinci El & Sıfır Alışveriş": "• Ürün / model: \n• Durumu (sıfır / az kullanılmış): \n• Garanti / fatura: \n• Kutu–aksesuar tam mı: \n• Kullanım süresi: \n• Kusur (varsa): \n• Kargo / elden teslim: ",
  "İş Makineleri & Sanayi": "• Marka / model / yıl: \n• Çalışma saati: \n• Bakım durumu: \n• Arıza / eksik: \n• Ekipman / ataşman: \n• Teslim yeri: "
};
const descTemplateFor = (topLabel?: string) =>
  (topLabel && DESC_TEMPLATES[topLabel]) ||
  "• Ürün / hizmet: \n• Durumu: \n• Öne çıkan özellikler: \n• Neden satıyorsun: \n• Teslim / iletişim: ";
const DEFAULT_COMMISSION_RANGE: [number, number] = [8, 20];

// Yarım kalan ilan taslağı — cihazda saklanır, kullanıcı geri döndüğünde devam eder.
// TASLAK ANAHTARI KULLANICIYA ÖZEL olmalı: eskiden sabit anahtardı ve çıkışta
// silinmiyordu → A kullanıcısının yarım ilanı (başlık/fiyat/fotoğraf/konum) aynı
// cihazda B kullanıcısına "yarım kalan ilanın var" diye açılıyordu.
const DRAFT_PREFIX = "ortaksat_listing_draft_v1";
const draftKeyFor = (userId?: string) => `${DRAFT_PREFIX}:${userId || "anon"}`;
// Anonim kullanıcı "Yayınla" deyip kayda yönlendirilince taslak BURAYA yazılır; kayıt/giriş
// sonrası /create'e dönünce kullanıcının kendi anahtarına taşınır (anon→user migrasyonu).
// ANON_USER.id'den bağımsız sabit anahtar → hangi guest kimliği olursa olsun kaybolmaz.
const ANON_PENDING_KEY = `${DRAFT_PREFIX}:anon-pending`;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

type Values = Record<string, string | boolean | string[]>;

type DraftShape = {
  savedAt: number;
  step: number;
  path: Array<Pick<CategoryNode, "key" | "label" | "slug" | "formKey" | "image">>;
  values: Values;
  images: string[];
  loc: LocationValue;
  visibility: "city_only" | "district_only" | "neighborhood" | "full_address_private";
  currency: CurrencyCode;
  commissionType: CommissionType;
  commissionValue: string;
  bonusAmount: string;
  bonusQuota: string;
  partnershipMode: PartnershipMode;
  partnerNote: string;
  contactMethod: "message" | "whatsapp" | "phone";
  attributionWindow?: string;
  tiers?: Array<{ minSales: string; rate: string }>;
  customCategory?: string;
};

export function DesktopCreateFlow() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const router = useRouter();
  const { createListing, addCategorySuggestion, addLocationSuggestion, currentUser, isAuthenticated, listings } = useStore();
  const DRAFT_KEY = draftKeyFor(currentUser?.id);
  const [step, setStep] = useState(0);
  // Mobilde alan-grubu aç/kapa (Emlak/Vasıta uzun formları). Anahtar yoksa varsayılan kullanılır.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // "Donanım & Özellikler" (opsiyonel, en şişkin bölüm) mobilde varsayılan KAPALI.
  const [openFeatures, setOpenFeatures] = useState(false);
  const [path, setPath] = useState<CategoryNode[]>([]);
  // "Diğer" seçildiğinde kullanıcı ARADIĞI kategoriyi yazar → admin ÖNERİ HAVUZUNA düşer.
  const [customCategory, setCustomCategory] = useState("");
  const [values, setValues] = useState<Values>({});
  const [images, setImages] = useState<string[]>([]);
  const [imageDraft, setImageDraft] = useState("");
  const [loc, setLoc] = useState<LocationValue>({});
  const [visibility, setVisibility] = useState<"city_only" | "district_only" | "neighborhood" | "full_address_private">("neighborhood");

  const [currency, setCurrency] = useState<CurrencyCode>("TRY");
  const [commissionType, setCommissionType] = useState<CommissionType>("rate");
  const [commissionValue, setCommissionValue] = useState("15");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusQuota, setBonusQuota] = useState("");
  // Kademeli komisyon (yalnız yüzde): ortağın kümülatif satışına göre artan oran satırları.
  const [tiers, setTiers] = useState<Array<{ minSales: string; rate: string }>>([]);
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>("approval");
  // Atıf (referans) penceresi: ortak linkinin kaç gün geçerli olacağı (7/15/30/60).
  const [attributionWindow, setAttributionWindow] = useState("30");
  const [partnerNote, setPartnerNote] = useState("");
  const [contactMethod, setContactMethod] = useState<"message" | "whatsapp" | "phone">("message");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState(""); // bot tuzağı: gerçek kullanıcı boş bırakır
  const [pendingDraft, setPendingDraft] = useState<DraftShape | null>(null); // "devam et?" banner'ı
  const [draftReady, setDraftReady] = useState(false); // ilk yükleme bitti mi (autosave'i geciktir)
  const [published, setPublished] = useState<{ listing: Listing; review: boolean } | null>(null);
  const [shareCopied, setShareCopied] = useState(false); // paylaşım metni kopyalandı bildirimi

  const formKey = path.length ? resolveFormKey(path) : "";
  const schema = formKey ? getFormSchema(formKey) : undefined;
  const leafLabel = path.length ? path[path.length - 1].label : "";
  // Yolun HERHANGİ bir düğümü "Diğer" ise → kategori listemizde eksik demektir.
  // (Eskiden yalnız path[0]==="Diğer" bakılıyordu; artık "Diğer" her dalda olduğu için
  //  "Emlak › Konut › Diğer" gibi seçimler de havuza düşmeliydi ama düşmüyordu.)
  const isDigerPath = path.some((p) => /^di[ğg]er/i.test(p.label.trim()));
  const coverImage = images[0] || path.find((p) => p.image)?.image || CONDITION_IMG;

  // Anlık moderasyon uyarısı (kullanıcı yazarken): yasaklı = kırmızı, dikkatli = sarı.
  const liveModeration = useMemo(() => {
    const kw = scanTextLocal(`${String(values.title ?? "")} ${String(values.description ?? "")}`);
    if (kw.verdict === "block") return { level: "block" as const, msg: `Yasaklı ifade tespit edildi: "${kw.matched}". Bu içerikle ilan yayınlanamaz.` };
    const cat = categoryRisk(path.map((p) => p.label));
    if (kw.verdict === "review") return { level: "review" as const, msg: `"${kw.matched}" ifadesi dikkat gerektirebilir; ilan yönetici onayına düşebilir.` };
    if (cat === "review") return { level: "review" as const, msg: translateCopy("Bu kategori, güvenlik gereği yayından önce yönetici onayına düşer.", language) };
    return null;
  }, [values.title, values.description, path]);

  const setV = (k: string, v: string | boolean | string[]) => setValues((s) => ({ ...s, [k]: v }));

  // Komisyon/kazanç yardımı: fiyattan ortak kazancını ve kategoriye göre önerilen
  // komisyon aralığını canlı hesapla.
  // ETKİN FİYAT ANAHTARI: her şema fiyatı "price" ile tutmuyor (gecelik / kişi başı /
  // başlangıç fiyatı gibi anahtarlar var). publish() bunu zaten türetiyordu ama ÖNİZLEME,
  // canlı komisyon hesabı ve paylaşım metni doğrudan values.price okuyordu → o kategorilerde
  // kullanıcı fiyatı ₺0, ortak kazancını ₺0 görüyor, ilan ise doğru fiyatla yayınlanıyordu.
  const priceKey = useMemo(() => {
    if (!schema) return "price";
    const f =
      schema.fields.find((x) => x.key === "price") ??
      schema.fields.find((x) => x.type === "number" && x.suffix === "₺" && x.required) ??
      schema.fields.find((x) => x.type === "number" && x.suffix === "₺");
    return f?.key ?? "price";
  }, [schema]);
  const priceNum = parseTrPrice(String(values[priceKey] ?? ""));
  // KOMİSYON/BONUS TR-SAYI GÜVENLİĞİ: sabit (₺) komisyonu satıcı "1.500" diye yazınca
  // Number("1.500") = 1.5 ₺ olur → sessizce YANLIŞ komisyonla yayınlanır (para modelini bozar).
  // Sabit tutar TR binlik biçimindedir → parseTrPrice. Yüzde (%) için nokta binlik DEĞİL
  // ondalık olabilir (12,5), o yüzden virgülü noktaya çevirip parseFloat. (bkz. tr-number-parse-gotcha)
  const commissionRaw = String(commissionValue);
  const commissionNum = commissionType === "rate"
    ? (parseFloat(commissionRaw.replace(",", ".")) || 0)
    : (parseTrPrice(commissionRaw) || 0);
  const bonusNum = parseTrPrice(String(bonusAmount)) || 0;
  const perSaleCommission = commissionType === "rate"
    ? Math.round((priceNum * commissionNum) / 100)
    : commissionNum;
  const suggestedRange = SUGGESTED_COMMISSION[path[0]?.label ?? ""] ?? DEFAULT_COMMISSION_RANGE;

  /**
   * PİYASA İPUCU + MÜKERRER BAŞLIK UYARISI.
   * Bu iki sinyali risk motoru (lib/risk.ts) ZATEN hesaplıyordu — ama yalnız gizli bir
   * moderasyon puanı olarak: fiyatı medyanın çok altındaysan ya da başlığın başka bir
   * ilanla aynıysa ilanın sessizce "incelemeye" düşüyordu ve NEDENİNİ öğrenemiyordun.
   * Artık yazarken söylüyoruz.
   */
  const peerPrices = useMemo(() => {
    const cat = leafLabel || path[0]?.label;
    if (!cat) return [] as number[];
    return listings
      .filter((l) => l.status === "active" && l.category === cat && l.price > 0)
      .map((l) => l.price)
      .sort((a, b) => a - b);
  }, [listings, leafLabel, path]);

  const priceHint = useMemo(() => {
    if (peerPrices.length < 4) return null; // az örnekle "piyasa" demek yanıltıcı olur
    const q = (f: number) => peerPrices[Math.min(peerPrices.length - 1, Math.floor(peerPrices.length * f))];
    const low = q(0.25);
    const high = q(0.75);
    const median = q(0.5);
    const tooLow = priceNum > 0 && priceNum < median * 0.25;
    return { low, high, median, tooLow, n: peerPrices.length };
  }, [peerPrices, priceNum]);

  const duplicateTitle = useMemo(() => {
    const t = String(values.title ?? "").trim().toLocaleLowerCase("tr-TR");
    if (t.length < 9) return null;
    const dup = listings.find((l) => l.status === "active" && l.title.trim().toLocaleLowerCase("tr-TR") === t);
    if (!dup) return null;
    return dup.ownerId === currentUser?.id ? "own" : "other";
  }, [values.title, listings, currentUser?.id]);


  // Paylaşım önizlemesi: yayınlandığında ortakların kullanacağı hazır metinler
  // (WhatsApp/Instagram/TikTok). Yayından önce görülür + kopyalanabilir.
  const sharePreview = useMemo(() => autoFillListing({
    title: String(values.title ?? leafLabel).trim() || leafLabel || "Ürün",
    category: leafLabel || path[0]?.label || "Genel",
    price: priceNum,
    commission: commissionType === "rate" ? commissionNum || 0 : 0,
    currency
  }).shareTemplates, [values.title, leafLabel, path, priceNum, commissionType, commissionValue, currency]);

  const copyShare = async (text: string) => {
    try { await Clipboard.setStringAsync(text); setShareCopied(true); setTimeout(() => setShareCopied(false), 1800); } catch { /* pano yoksa sessiz geç */ }
  };
  const missingFields = useMemo(() => (schema ? schema.fields.filter((f) => {
    if (!f.required) return false;
    const val = values[f.key];
    if (Array.isArray(val)) return val.length === 0;
    return !String(val ?? "").trim();
  }) : []), [schema, values]);

  // Kategori seçiminden form alanlarını otomatik doldur: ağaçta seçilen marka/model/
  // ilan-tipi ilgili alanlara taşınır, başlık önerilir. Böylece bir sonraki adımda
  // form boş gelmez. Marka/model/ilan-tipi kategoriyle güncellenir; başlık yalnızca
  // kullanıcı henüz yazmadıysa doldurulur (elle girdisinin üzerine yazılmaz).
  const pathKey = path.map((p) => p.key).join("/");
  // Taslak geri yüklenirken (setPath) türetme etkisi tetiklenir ve kullanıcının
  // elle düzelttiği marka/model/ilan-tipini EZERDİ. Restore bir kez atlatılır.
  const skipNextDerive = useRef(false);
  useEffect(() => {
    if (!schema) return;
    if (skipNextDerive.current) { skipNextDerive.current = false; return; }
    const seed = deriveFieldsFromPath(path, schema);
    if (!Object.keys(seed).length) return;
    setValues((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(seed)) {
        if (k === "title") {
          if (!String(next.title ?? "").trim()) next.title = v;
        } else {
          next[k] = v;
        }
      }
      return next;
    });
    // path/formKey değişince yeniden türet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, pathKey]);

  // ---- Taslak (yarım kalan ilan) otomatik kaydetme/geri-yükleme ----
  // İlk açılışta cihazdaki taslağı oku; kategori seçilmişse "devam et?" banner'ı göster.
  useEffect(() => {
    let alive = true;
    (async () => {
      let raw = await AsyncStorage.getItem(DRAFT_KEY);
      // ANON→USER MİGRASYONU: anonimken "Yayınla" deyip kayıt olan kullanıcı /create'e
      // dönünce, kendi anahtarında taslak yoksa anon-pending'i devral (emeği kaybolmasın).
      if (!raw && isAuthenticated) {
        const anon = await AsyncStorage.getItem(ANON_PENDING_KEY);
        // GÜVENLİK: anon-pending yalnız TAZE ise devral (kayıt akışı dakikalar sürer). Paylaşılan
        // cihazda saatler sonra giren BAŞKA kullanıcı, önceki anonun taslağını DEVRALMASIN.
        let fresh = false;
        if (anon) { try { const d = JSON.parse(anon) as DraftShape; fresh = !!d?.savedAt && Date.now() - d.savedAt < 30 * 60 * 1000; } catch { fresh = false; } }
        if (anon && fresh) {
          raw = anon;
          void AsyncStorage.setItem(DRAFT_KEY, anon);
        }
        if (anon) void AsyncStorage.removeItem(ANON_PENDING_KEY); // tek kullanımlık: her hâlükârda temizle
      }
      if (!alive) return;
      setDraftReady(true);
      if (!raw) return;
      try {
        const d = JSON.parse(raw) as DraftShape;
        if (!d?.savedAt || Date.now() - d.savedAt > DRAFT_TTL_MS) { void AsyncStorage.removeItem(DRAFT_KEY); return; }
        if (Array.isArray(d.path) && d.path.length) setPendingDraft(d);
      } catch { void AsyncStorage.removeItem(DRAFT_KEY); }
    })().catch(() => { if (alive) setDraftReady(true); });
    return () => { alive = false; };
  }, []);

  // Değişiklikleri cihaza yaz (debounce). Sadece kategori seçilip form başladıysa ve
  // ilk yükleme bittiyse — böylece boş/eski taslağın üzerine hemen yazılmaz.
  // Taslak nesnesini kur (hem debounce kaydı hem anonim-yayın kaydı kullanır — tek kaynak).
  const buildDraft = (): DraftShape => ({
    savedAt: Date.now(), step,
    path: path.map((p) => ({ key: p.key, label: p.label, slug: p.slug, formKey: p.formKey, image: p.image })),
    values, images, loc, visibility, currency, commissionType, commissionValue,
    bonusAmount, bonusQuota, partnershipMode, partnerNote, contactMethod, attributionWindow,
    // Eskiden kaydedilmiyorlardı: kademeli komisyon kurup ya da eksik kategori adı yazıp
    // sayfadan çıkan kullanıcı, taslağı geri yüklediğinde ikisini de sessizce kaybediyordu.
    tiers, customCategory
  });

  useEffect(() => {
    if (!draftReady || !path.length || publishing) return;
    const draft = buildDraft();
    const h = setTimeout(() => { void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }, 700);
    return () => clearTimeout(h);
  }, [DRAFT_KEY, draftReady, path, values, images, loc, visibility, currency, commissionType, commissionValue, bonusAmount, bonusQuota, partnershipMode, partnerNote, contactMethod, attributionWindow, tiers, customCategory, step, publishing]);

  const clearDraft = () => { setPendingDraft(null); void AsyncStorage.removeItem(DRAFT_KEY); };

  const restoreDraft = () => {
    const d = pendingDraft;
    if (!d) return;
    skipNextDerive.current = true; // geri-yüklenen değerlerin üzerine türetme yazmasın
    setPath((d.path as CategoryNode[]) ?? []);
    setValues(d.values ?? {});
    setImages(d.images ?? []);
    setLoc(d.loc ?? {});
    if (d.visibility) setVisibility(d.visibility);
    if (d.currency) setCurrency(d.currency);
    if (d.commissionType) setCommissionType(d.commissionType);
    if (d.commissionValue) setCommissionValue(d.commissionValue);
    setBonusAmount(d.bonusAmount ?? "");
    setBonusQuota(d.bonusQuota ?? "");
    if (d.partnershipMode) setPartnershipMode(d.partnershipMode);
    if (d.attributionWindow) setAttributionWindow(String(d.attributionWindow));
    setPartnerNote(d.partnerNote ?? "");
    if (d.contactMethod) setContactMethod(d.contactMethod);
    if (Array.isArray(d.tiers)) setTiers(d.tiers);
    if (typeof d.customCategory === "string") setCustomCategory(d.customCategory);
    setStep(typeof d.step === "number" ? d.step : 1);
    setPendingDraft(null);
  };

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  /** Seçilen görselleri (boyut sınırı + adet sınırı ile) listeye ekler. Galeri ve kamera ortak kullanır. */
  /**
   * URL ile görsel ekleme. Eskiden: herhangi bir metni (ör. "asdf") görsel diye kabul
   * ediyor, sınıra gelindiğinde ise SESSİZCE hiçbir şey yapmıyordu (buton ölü görünüyordu).
   */
  function addImageUrl() {
    const u = imageDraft.trim();
    if (!u) return;
    if (!/^https?:\/\/.+/i.test(u)) { setError(translateCopy("Görsel bağlantısı http:// veya https:// ile başlamalı.", language)); return; }
    if (images.includes(u)) { setError(translateCopy("Bu görsel zaten ekli.", language)); return; }
    if (images.length >= MAX_PHOTOS) { setError(`${translateCopy("En fazla", language)} ${MAX_PHOTOS} ${translateCopy("görsel ekleyebilirsin.", language)}`); return; }
    setError(null);
    setImages((s) => [...s, u]);
    setImageDraft("");
  }

  // WEB: SÜRÜKLE-BIRAK + PANODAN YAPIŞTIR. İkisi de yoktu; masaüstünde fotoğraf eklemenin
  // tek yolu dosya seçiciydi. Yalnız fotoğraf adımında (step 3) ve yalnız web'de dinlenir.
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || step !== 3 || typeof window === "undefined") return;
    const takeFiles = (files: FileList | null | undefined) => {
      const imgs = Array.from(files ?? ([] as unknown as FileList)).filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      addAssets(imgs.map((f) => ({ uri: URL.createObjectURL(f), fileSize: f.size })));
    };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); takeFiles(e.dataTransfer?.files); };
    const onPaste = (e: ClipboardEvent) => {
      // Metin yapıştırırken (URL kutusu) araya girme — yalnız görsel varsa devral.
      const files = e.clipboardData?.files;
      if (files && files.length) { e.preventDefault(); takeFiles(files); }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, images.length]);

  function addAssets(assets: Array<{ uri: string; fileSize?: number }>) {
    const tooBig = assets.some((a) => typeof a.fileSize === "number" && a.fileSize > MAX_BYTES);
    if (tooBig) setError(translateCopy("Bazı görseller 5 MB sınırını aşıyor ve eklenmedi. Lütfen daha küçük dosyalar seçin.", language));
    const uris = assets
      .filter((a) => !(typeof a.fileSize === "number" && a.fileSize > MAX_BYTES))
      .map((a) => a.uri)
      .filter(Boolean);
    if (!uris.length) return;
    setImages((s) => {
      const next = [...s, ...uris].slice(0, MAX_PHOTOS);
      if (s.length + uris.length > MAX_PHOTOS) setError(translateCopy(`En fazla ${MAX_PHOTOS} görsel ekleyebilirsin. Fazlası eklenmedi.`, language));
      return next;
    });
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(translateCopy("Galeri izni verilmedi. Ayarlardan izin verip tekrar dene.", language));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: MAX_PHOTOS });
    if (result.canceled) return;
    addAssets(result.assets);
  }

  /**
   * KAMERA (mobil): ürünü anında çekip ilana ekle. Eskiden yalnız galeri vardı —
   * mobilde ilan verirken en doğal yol telefonla fotoğrafı O AN çekmek.
   * Web'de kamera akışı yok (tarayıcı dosya seçici zaten galeriyi kapsar) → buton gizli.
   */
  async function captureFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(translateCopy("Kamera izni verilmedi. Ayarlardan izin verip tekrar dene.", language));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    addAssets(result.assets);
  }

  // Adım-1 kapısı yalnızca "boş değil"e bakınca kısa (otomatik-önerilen) başlık adımı
  // geçip yayında patlıyordu. Aynı uzunluk kurallarını burada uygularız; nedeni de
  // kullanıcıya nextBlockReason ile gösteririz (buton sessizce kilitlenmesin).
  // "Devam"a basınca eksikleri GÖSTER + ilk eksiğe kaydır. Eskiden buton disabled'dı:
  // kullanıcı basıyordu, HİÇBİR ŞEY olmuyordu ve eksiğin hangi alan olduğunu formda arıyordu.
  const [showErrors, setShowErrors] = useState(false);
  const missingKeys = useMemo(() => new Set(missingFields.map((f) => f.key)), [missingFields]);

  /** İlk eksik alana kaydır (web). Native'de alanlar kırmızı işaretlenir. */
  function scrollToFirstMissing() {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const first = missingFields[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-field="${first.key}"]`) as HTMLElement | null;
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    });
  }

  /** Devam: geçebiliyorsa ilerle; geçemiyorsa eksikleri işaretle ve ilkine götür. */
  function tryNext() {
    if (canNext()) {
      setShowErrors(false);
      setStep((s) => s + 1);
      return;
    }
    setShowErrors(true);
    scrollToFirstMissing();
  }

  const nextBlockReason = (): string | null => {
    if (step === 0) return path.length ? null : translateCopy("Devam etmek için bir kategori seç.", language);
    if (step === 1) {
      if (missingFields.length) {
        const shown = missingFields.slice(0, 4).map((f) => f.label).join(", ");
        const rest = missingFields.length - 4;
        return `${translateCopy("Zorunlu alanları doldur", language)}: ${shown}${rest > 0 ? ` +${rest} ${translateCopy("alan daha", language)}` : ""}`;
      }
      const t = String(values.title ?? leafLabel).trim();
      if (t.length < LIMITS.title.min) return `${translateCopy("Başlık en az", language)} ${LIMITS.title.min} ${translateCopy("karakter olmalı", language)}.`;
      const descReq = schema?.fields.some((f) => f.key === "description" && f.required);
      const d = String(values.description ?? "").trim();
      if (descReq && d.length < LIMITS.description.min) return `${translateCopy("Açıklama en az", language)} ${LIMITS.description.min} ${translateCopy("karakter olmalı", language)}.`;
      // FİYAT SAĞLIĞI (kapıda): zorunlu fiyat alanına "0"/"abc"/"-5" yazılınca boş-değil olduğu için
      // adım 1 geçiliyor, kullanıcı tüm adımları tamamlayıp Yayınla'ya basınca adım 1'e geri fırlatılıyordu.
      const priceReq = schema?.fields.some((f) => f.key === priceKey && f.required);
      if (priceReq && priceNum < LIMITS.price.min) return translateCopy("Geçerli bir fiyat gir.", language);
      return null;
    }
    if (step === 2) {
      if (!loc.provinceId) return translateCopy("İl seçmelisin.", language);
      if (!loc.districtId) return translateCopy("İlçe seçmelisin.", language);
      return null;
    }
    if (step === 3) return images.length ? null : translateCopy("Devam etmek için en az 1 görsel ekle.", language);
    if (step === 4) {
      // NORMAL İLAN (ortak satışa kapalı): komisyon gerekmez.
      if (partnershipMode === "none") return null;
      if (!(commissionNum > 0)) return translateCopy("Komisyon değeri sıfırdan büyük olmalı.", language);
      // Absürt komisyon koruması (para modeli): oran %100'ü, sabit tutar ürün fiyatını aşamaz.
      if (commissionType === "rate" && commissionNum > 100) return translateCopy("Komisyon oranı %100'den büyük olamaz.", language);
      if (commissionType !== "rate" && priceNum > 0 && commissionNum > priceNum) return translateCopy("Sabit komisyon, ürün fiyatından büyük olamaz.", language);
      return null;
    }
    return null;
  };
  const canNext = () => nextBlockReason() === null;

  async function publish() {
    if (!schema) {
      // Eskiden sessizce return ediyordu: "Yayınla" tıklanıyor, hiçbir şey olmuyordu.
      setError(translateCopy("Kategori formu yüklenemedi. Kategoriyi tekrar seç.", language));
      setStep(0);
      return;
    }
    setError(null);
    setNotice(null);

    // Bot tuzağı: gizli alan doluysa sessizce reddet (kullanıcıya başarı gibi göster, kayıt oluşturma).
    if (honeypot.trim()) {
      router.replace("/(tabs)/seller");
      return;
    }

    const title = String(values.title ?? leafLabel).trim() || leafLabel;
    const description = String(values.description ?? "").trim();
    const descRequired = schema.fields.some((f) => f.key === "description" && f.required);

    // Fiyat alanı her şemada "price" anahtarıyla gelmez: kimi form gecelik/kişi-başı/
    // başlangıç fiyatı gibi farklı bir anahtar kullanır. Etkin fiyatı şemadan türetiriz;
    // aksi halde günlük kiralık, tur/etkinlik, talep gibi kategoriler hiç yayınlanamıyordu.
    const priceField = schema.fields.find((f) => f.key === priceKey);
    const priceRaw = values[priceKey];
    const priceFilled = priceRaw != null && String(priceRaw).trim().length > 0;
    // Şemada fiyat alanı YOKSA fiyat opsiyoneldir (ör. İş İlanları). Aksi hâlde
    // fiyatsız kategori hiç yayınlanamıyordu (validateListing daima fiyat ister).
    const priceRequired = priceField ? !!priceField.required : false;

    // Merkezi doğrulama (başlık/açıklama/fiyat). Fiyat TR formatıyla ("1.500.000") ayrıştırılır.
    const v = validateListing({ title, description, price: parseTrPrice(String(priceRaw ?? "")) });
    const errs = v.errors.filter((e) => {
      if (e.field === "description" && !descRequired && !description) return false;
      // Fiyat şemada opsiyonel (hayvan/hizmet/ders vb.) ve boşsa: fiyat=0 kabul, hatayı düşür.
      if (e.field === "price" && !priceRequired && !priceFilled) return false;
      return true;
    });
    if (errs.length) {
      setError(errs[0].message);
      setStep(1);
      return;
    }
    // Savunmacı yayın-anı kontrolü: adım-navigasyonu atlansa/draft bozulsa bile
    // eksik foto/konum/komisyonlu ilan yayınlanmasın (canNext'e ek güvenlik).
    if (images.length === 0) { setError(translateCopy("En az bir fotoğraf ekle.", language)); setStep(3); return; }
    if (!loc.provinceId) { setError(translateCopy("İl seçmelisin.", language)); setStep(2); return; }
    if (!loc.districtId) { setError(translateCopy("İlçe seçmelisin.", language)); setStep(2); return; }
    if (partnershipMode !== "none" && !(commissionNum > 0)) { setError(translateCopy("Komisyon değeri sıfırdan büyük olmalı.", language)); setStep(4); return; }

    // ANONİM YAYIN: form GEÇERLİ ama giriş yok → taslağı anon-pending'e kaydet + Kayıt'a
    // yönlendir (dönüşte /create'e döner, taslak migrasyonla korunur). Emeğini harcamış
    // kullanıcıyı EN YÜKSEK motivasyon anında kayda alırız — kayıt duvarını başa değil sona koy.
    if (!isAuthenticated) {
      try { await AsyncStorage.setItem(ANON_PENDING_KEY, JSON.stringify(buildDraft())); } catch { /* yoksay */ }
      setNotice("İlanını yayınlamak için ücretsiz hesabını oluştur — bilgilerin korunuyor.");
      router.push("/auth?redirect=/create&mode=register");
      return;
    }

    setPublishing(true);
    try {
      // Hız sınırı (spam/bot ilan yağmurunu engeller).
      const rl = await rateLimit("listing_create");
      if (!rl.allowed) {
        setError(rl.reason ?? translateCopy("Çok sık denediniz, lütfen sonra tekrar deneyin.", language));
        return;
      }

      // Yasaklı/şüpheli içerik taraması (kelime) + hassas kategori kontrolü.
      const kwVerdict = await moderateListingText(title, description);
      if (kwVerdict === "block") {
        setError(MODERATION_MESSAGES.block);
        setStep(1);
        return;
      }
      const catVerdict = categoryRisk(path.map((p) => p.label).concat(leafLabel));
      let verdict = kwVerdict === "review" || catVerdict === "review" ? "review" : "none";
      let statusOverride: "pending_review" | undefined = verdict === "review" ? "pending_review" : undefined;

      // "Diğer" seçildiyse → kategori EKSİK demektir: kullanıcının yazdığı kategori adını
      // TAM YOL ile birlikte admin ÖNERİ HAVUZUNA düşür (category_suggestions).
      // Böylece eksik kategoriler görünür olur ve ağaca eklenir.
      if (isDigerPath) {
        const yol = path.map((p) => p.label).join(" › ");
        const istenen = customCategory.trim();
        addCategorySuggestion({
          suggestedPath: istenen ? `${yol} → ${istenen}` : `${yol} → (belirtilmedi: ${title || "Yeni ürün"})`,
          note: istenen
            ? `Kullanıcı "Diğer"i seçip eksik kategoriyi yazdı. İlan: ${title || "-"}`
            : `Kullanıcı "Diğer"i seçti (kategori adı yazmadı). İlan: ${title || "-"} — ${description.slice(0, 60)}`
        });
      }
      void addLocationSuggestion; // konum önerisi 'Mahallemi bulamadım' akışına bağlı (canlıda mahalle listesi gelince)
      const price = v.clean.price;
      const tags = [path[0]?.label, leafLabel, String(values.brand ?? ""), String(values.condition ?? "")].map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
      const detailLines = schema.fields
        .filter((f) => f.key !== "title" && f.key !== "description" && f.key !== "price" && values[f.key] !== undefined && String(values[f.key]).trim() && typeof values[f.key] !== "boolean")
        .map((f) => `${f.label}: ${values[f.key]}${f.suffix ? " " + f.suffix : ""}`);
      const boolLines = schema.fields.filter((f) => f.type === "bool" && values[f.key] === true).map((f) => `${f.label}: Evet`);

      // Yapısal özellikler: form değerlerini (m², oda, imar, tapu…) filtrelenebilir
      // biçimde sakla. title/description/price zaten üst-seviye kolonlarda tutulur.
      const attributes: Record<string, string | number | boolean | string[]> = {};
      for (const f of schema.fields) {
        if (f.key === "title" || f.key === "description" || f.key === "price") continue;
        const raw = values[f.key];
        if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) continue;
        if (Array.isArray(raw)) { if (raw.length) attributes[f.key] = raw; continue; }
        if (typeof raw === "boolean") { if (raw) attributes[f.key] = true; continue; }
        // Sayısal alanlar TR biçimiyle girilir ("150.000"); parseTrPrice binlik
        // ayıracını doğru çözer. Number("150.000") → 150 (km/m² veri bozulması).
        attributes[f.key] = f.type === "number" ? parseTrPrice(String(raw)) : String(raw);
      }
      // Kategori bağlamı da sakla (alt-kategori filtresi, rozetler ve DÜZENLEME
      // ekranının form şemasını çözebilmesi için).
      if (leafLabel) attributes._leaf = leafLabel;
      if (path[0]?.label) attributes._root = path[0].label;
      attributes._formKey = schema.key;

      // Görselleri Supabase storage'a yükle (web'de otomatik ölçekleme+sıkıştırma).
      // Yerel URI'ler public URL'e döner, böylece herkes görebilir.
      const pickedImages = images.slice(0, MAX_PHOTOS);
      const uploadedImages = currentUser?.id
        ? await Promise.all(pickedImages.map((uri) => uploadListingImage(uri, currentUser.id)))
        : pickedImages;
      const cover = uploadedImages[0] || coverImage;

      // Shopify-tarzı otomatik doldurma: açıklama boşsa doldurulur, paylaşım
      // metinleri (Instagram/WhatsApp/TikTok) her ilan için otomatik üretilir,
      // argüman/etiket zayıfsa zenginleştirilir. Uydurma ürün özelliği yok —
      // yalnızca başlık/kategori/fiyat/komisyondan düzenlenebilir taslak.
      const auto = autoFillListing({
        title: v.clean.title || leafLabel,
        category: leafLabel || path[0]?.label || "Genel",
        price,
        commission: commissionNum || 0,
        currency
      });

      // Çok sinyalli risk-puanı (fiyat anomalisi, mükerrer, iletişim spam'i, gerçek
      // dışı komisyon…): YÜKSEK risk otomatik admin incelemesine (pending_review) düşer.
      const riskDraft = {
        id: "draft", ownerId: currentUser?.id ?? "", title: v.clean.title || leafLabel,
        description: description || auto.description, salesPitch: detailLines, price,
        category: leafLabel || path[0]?.label || "Genel", commissionType, commissionValue: commissionNum || 0,
        adAssets: uploadedImages.slice(1), status: "active"
      } as unknown as Listing;
      const risk = computeListingRisk(riskDraft, listings, currentUser);
      if (risk.level === "high" && !statusOverride) { verdict = "review"; statusOverride = "pending_review"; }

      const created = createListing({
        title: v.clean.title || leafLabel,
        description: description ? v.clean.description : auto.description,
        salesPitch: detailLines.slice(0, 4).length ? detailLines.slice(0, 4) : auto.salesPitch,
        shareTemplates: auto.shareTemplates,
        adAssets: uploadedImages.slice(1),
        tags: tags.length ? tags : auto.tags,
        price,
        currency,
        commissionType,
        // NORMAL İLAN (partnershipMode="none"): komisyon/tier/bonus SIFIRLANIR — aksi halde
        // toggle "15"i sıfırlamadığından kart/panel/önizlemede hayalet "%15 komisyon" görünüyordu.
        commissionValue: partnershipMode === "none" ? 0 : commissionNum || 0,
        commissionTiers: partnershipMode !== "none" && commissionType === "rate"
          ? tiers.map((tr) => ({ minSales: Math.max(0, Math.floor(Number(tr.minSales) || 0)), rate: Math.max(0, Math.min(90, Number(tr.rate) || 0)) })).filter((tr) => tr.rate > 0).sort((a, b) => a.minSales - b.minSales)
          : undefined,
        bonusAmount: partnershipMode !== "none" && bonusNum > 0 && Number(bonusQuota) > 0 ? bonusNum : undefined,
        bonusQuota: partnershipMode !== "none" && bonusNum > 0 && Number(bonusQuota) > 0 ? Number(bonusQuota) : undefined,
        partnershipMode,
        attributes,
        category: leafLabel || path[0]?.label || "Genel",
        location: formatLocation(loc, visibility) || getProvince(loc.provinceId)?.name || "Türkiye",
        provinceId: loc.provinceId,
        districtId: loc.districtId,
        addressVisibility: visibility,
        locationNote: loc.neighborhood?.trim() || undefined,
        image: cover,
        stockCount: Math.max(1, Math.floor(parseTrPrice(String(values.stock ?? "")) || 1)),
        // Varsayılan 4 idi → 1–3.9 puanlı ortakları engelliyordu (soğuk-başlangıçta
        // ortak arzını kısıyordu). 0 = herkes ortak olabilir; satıcı isterse sonradan yükseltir.
        minPartnerRating: 0,
        commissionDueDays: 3,
        returnWindowDays: 7,
        attributionWindowDays: Number(attributionWindow) || 30,
        partnerRules: [...boolLines, partnerNote.trim()].filter(Boolean).length ? [...boolLines, partnerNote.trim()].filter(Boolean) : ["Komisyon sadece onaylı satış kaydında oluşur."],
        deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; Ortaksat para tutmaz.",
        contactMethod
      }, statusOverride);

      // İlan oluşturuldu → yarım-kalan taslağı sil (tekrar "devam et?" çıkmasın).
      void AsyncStorage.removeItem(DRAFT_KEY);

      // BAŞARI EKRANI: eskiden kullanıcı doğrudan panele atılıyordu ve elinde HİÇBİR ŞEY
      // kalmıyordu. Paylaşım metinleri yayından ÖNCE gösteriliyordu — yani içlerinde gerçek
      // ilan linki OLAMIYORDU (ilan henüz yoktu). Oysa platformun trafiği tam da satıcının
      // bu linki paylaşmasından geliyor. Artık gerçek link + paylaş + ortak daveti veriyoruz.
      setPublished({ listing: created, review: verdict === "review" });
      setPublishing(false);
      return;
    } catch (e) {
      // Eskiden yalnız finally vardı: uploadListingImage/createListing çökerse buton
      // dönmeyi bırakıyor ama HİÇBİR mesaj çıkmıyordu — kullanıcı ilanın neden
      // görünmediğini anlamıyordu (sessiz kayıp).
      console.warn("İlan yayınlanamadı", e);
      setError(
        (e as Error)?.message?.includes("Network")
          ? translateCopy("Bağlantı koptu. İlanın taslakta duruyor — internetin gelince tekrar dene.", language)
          : translateCopy("İlan yayınlanamadı. Taslağın korundu, tekrar deneyebilirsin.", language)
      );
      setStep(5);
    } finally {
      setPublishing(false);
    }
  }

  // ── YAYIN SONRASI ───────────────────────────────────────────────────────────
  function resetForNew() {
    setPublished(null); setStep(0); setPath([]); setValues({}); setImages([]);
    setLoc({}); setTiers([]); setCustomCategory(""); setError(null); setNotice(null);
  }

  if (published) {
    const l = published.listing;
    const link = productUrl(l);
    const invite = partnerInviteUrl(l);
    const wa = listingShareTemplates(l, link).whatsapp;
    const partnerable = l.partnershipMode !== "none"; // normal ilanda ortak-odaklı UI gösterme
    const copy = async (text: string) => {
      try { await Clipboard.setStringAsync(text); setShareCopied(true); setTimeout(() => setShareCopied(false), 1800); } catch { /* pano yok */ }
    };
    return (
      <View style={{ gap: 14 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: published.review ? colors.gold : colors.success, borderRadius: 18, borderWidth: 1, gap: 10, padding: 22 }}>
          <Mascot name={published.review ? "thinking" : "success"} size={92} />
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>
            {published.review ? translateCopy("İlanın incelemeye alındı", language) : translateCopy("İlanın yayında! 🎉", language)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 520, textAlign: "center" }}>
            {published.review
              ? translateCopy("Kısa bir kontrolden sonra yayına alınacak. Onaylanınca haber vereceğiz.", language)
              : partnerable
                ? translateCopy("İlanı gören ortaklar senin için satabilir; ürünü kendi yöntemleriyle tanıtır, satışta komisyonu sen belirlersin. Ürünü sen de paylaşabilirsin.", language)
                : translateCopy("İlanın yayında. Alıcılar ürününü görüp seninle iletişime geçebilir; ürünü istediğin yerde paylaşabilirsin.", language)}
          </Text>
        </View>

        {/* GERÇEK İLAN LİNKİ — eskiden yayından sonra kullanıcıya hiçbir link verilmiyordu. */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("İlan linkin", language)}</Text>
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, padding: 11 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" }}>{link}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable accessibilityRole="button" testID="publish-share" onPress={() => void shareOrCopy({ title: l.title, message: wa, url: link })}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
              <MaterialCommunityIcons name="share-variant" size={16} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Paylaş", language)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" testID="publish-copy-link" onPress={() => void copy(link)}
              style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
              <MaterialCommunityIcons name="content-copy" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Linki kopyala", language)}</Text>
            </Pressable>
            {partnerable && l.partnershipMode === "invite" ? (
            <Pressable accessibilityRole="button" testID="publish-invite" onPress={() => void copy(invite)}
              style={({ pressed }) => ({ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
              <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ortak davet linki", language)}</Text>
            </Pressable>
            ) : null}
          </View>
          {shareCopied ? <Text style={{ color: colors.success, fontSize: 12, fontWeight: "800" }}>{translateCopy("Kopyalandı", language)}</Text> : null}
          {partnerable && l.partnershipMode === "invite" ? (
          <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
            {translateCopy("Sadece davetle: bu davet linkiyle gelen kişi ön-onaylı ortağın olur.", language)}
          </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pressable accessibilityRole="button" testID="publish-view" onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })}
            style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
            <MaterialCommunityIcons name="eye-outline" size={16} color={colors.ink} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("İlanı gör", language)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={resetForNew}
            style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 11 })}>
            <MaterialCommunityIcons name="plus" size={16} color={colors.ink} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Yeni ilan ver", language)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/seller")}
            style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 11 })}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("İlanlarıma git", language)}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Geri: adım 0'da önceki sayfaya (yoksa ana sayfa), adım >0'da önceki adıma.
  const goBack = () => {
    if (step === 0) { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); return; }
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <View style={{ gap: 18 }}>
      {/* Üstte her zaman görünür geri butonu — önceki sayfaya / önceki adıma. */}
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={translateCopy(step === 0 ? "Önceki sayfaya dön" : "Önceki adıma dön", language)}
        style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 8 })}
      >
        <MaterialCommunityIcons name="arrow-left" size={17} color={colors.primaryDark} />
        <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{step === 0 ? translateCopy("Geri", language) : `${translateCopy("Geri", language)}: ${translateCopy(STEPS[step - 1], language)}`}</Text>
      </Pressable>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: isWideWeb ? 24 : 21, fontWeight: "900" }}>{translateCopy("Yeni ilan oluştur", language)}</Text>
        {isWideWeb ? <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{translateCopy("Kategorini seç, sana özel form açılsın.", language)}</Text> : null}
      </View>

      {/* Yarım kalan taslak — "kaldığın yerden devam et" */}
      {pendingDraft ? (
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 }}>
          <MaterialCommunityIcons name="content-save-edit-outline" size={20} color={colors.primaryDark} />
          <View style={{ flex: 1, gap: 2, minWidth: 180 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Yarım kalan bir ilanın var", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{(pendingDraft.path?.map((p) => translateCopy(p.label, language)).join(" › ") || translateCopy("Taslak", language))} · {translateCopy("kaldığın yerden devam edebilirsin", language)}</Text>
          </View>
          <Pressable onPress={restoreDraft} style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Devam et", language)}</Text>
          </Pressable>
          <Pressable onPress={clearDraft} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Yeni başla", language)}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Adım göstergesi. Eskiden 6 kocaman çip mobilde 3 satıra yayılıp kategoriyi
          ekranın çok altına itiyordu. Mobilde artık tek satır: ilerleme çubuğu + "Adım n/6".
          Masaüstünde kompakt tıklanabilir çipler kalır. */}
      {isWideWeb ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const on = i === step;
            const reachable = i <= step || (i === step + 1 && canNext());
            return (
              <Pressable key={s} onPress={() => { if (i < step || reachable) setStep(i); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : "transparent", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
                <View style={{ alignItems: "center", backgroundColor: on ? "#FFFFFF" : done ? colors.primary : colors.surfaceAlt, borderRadius: 999, height: 18, justifyContent: "center", width: 18 }}>
                  {done ? <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" /> : <Text style={{ color: on ? colors.primary : colors.muted, fontSize: 10.5, fontWeight: "900" }}>{i + 1}</Text>}
                </View>
                <Text style={{ color: on ? "#FFFFFF" : done ? colors.primaryDark : colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy(s, language)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 7 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy(STEPS[step], language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Adım", language)} {step + 1}/{STEPS.length}</Text>
          </View>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 6, overflow: "hidden" }}>
            <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: "100%", width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </View>
        </View>
      )}

      {/* Body */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: isWideWeb ? 22 : 14 }}>
        {step === 0 ? <CategoryPicker value={path} onChange={(p) => { setPath(p); if (p.length) setStep(1); }} /> : null}

        {step === 1 && schema ? (() => {
          // Sahibinden tarzı gruplama: alanları rolüne göre bölümlere ayır (şema
          // değişmeden). Başlık → Özellikler → Donanım (multiselect) → Fiyat → Açıklama.
          const titleFieldRaw = schema.fields.find((f) => f.key === "title");
          // Başlık boşken kategoriye özel iyi bir örnek göster (Sahibinden gibi).
          const titleField = titleFieldRaw ? { ...titleFieldRaw, placeholder: titlePlaceholderFor(path[0]?.label) } : undefined;
          const priceField = schema.fields.find((f) => f.key === "price");
          const descField = schema.fields.find((f) => f.key === "description");
          const multiFields = schema.fields.filter((f) => f.type === "multiselect" && f !== titleFieldRaw);
          const specFields = schema.fields.filter((f) => f !== titleFieldRaw && f !== priceField && f !== descField && f.type !== "multiselect");
          const renderField = (f: FieldDef) => {
            // Model alanı: marka seçiliyse markaya bağımlı model listesi.
            if (f.key === "model") {
              const models = modelsForSchema(schema.key, String(values.brand ?? ""));
              if (models.length) {
                const dep: FieldDef = { ...f, type: "select", options: [...models, "Diğer"] };
                return <DField key={f.key} field={dep} value={values[f.key]} onChange={(v) => setV(f.key, v)} invalid={showErrors && missingKeys.has(f.key)} />;
              }
            }
            return <DField key={f.key} field={f} value={values[f.key]} onChange={(v) => setV(f.key, v)} invalid={showErrors && missingKeys.has(f.key)} />;
          };
          return (
            <View style={{ gap: 22 }}>
              {/* Seçilen kategori yolu — kullanıcı ne seçtiğini görür + tek tıkla değiştirir. */}
              {path.length ? (
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <MaterialCommunityIcons name="tag-multiple-outline" size={15} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{path.map((p) => translateCopy(p.label, language)).join(" › ")}</Text>
                  <Pressable onPress={() => setStep(0)} accessibilityRole="button" accessibilityLabel={translateCopy("Kategoriyi değiştir", language)} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <MaterialCommunityIcons name="pencil-outline" size={13} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Değiştir", language)}</Text>
                  </Pressable>
                </View>
              ) : null}

                {/* "Diğer" seçildi → kategorimiz eksik. Kullanıcıdan aradığı kategoriyi iste;
                  bu metin admin ÖNERİ HAVUZUNA düşer ve eksik kategoriler tamamlanır. */}
              {isDigerPath ? (
                <FormSection title="Aradığın kategori listede yok mu?" icon="playlist-plus" hint="Kategorini yaz — ekibimiz görüp kategori listesine ekler. İlanın yine de hemen yayınlanır.">
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Aradığın kategori", language)}</Text>
                    <TextInput
                      value={customCategory}
                      onChangeText={setCustomCategory}
                      placeholder={translateCopy("ör. Drone Yedek Parçası, Vintage Plak, Solar Panel…", language)}
                      placeholderTextColor={colors.subtle}
                      accessibilityLabel={translateCopy("Aradığın kategori", language)}
                      style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }}
                    />
                    <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
                      {translateCopy("Seçtiğin yol", language)}: {path.map((p) => p.label).join(" › ")}
                    </Text>
                  </View>
                </FormSection>
              ) : null}

              {titleField ? (
                <FormSection title="İlan başlığı" icon="format-title" hint="Kısa, net ve aranan kelimelerle eşleşen bir başlık yaz.">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{renderField(titleField)}</View>
                  {/* MÜKERRER BAŞLIK — risk motoru bunu zaten yakalıyor ve ilanı sessizce
                      incelemeye düşürüyordu; kullanıcı nedenini asla öğrenemiyordu. */}
                  {duplicateTitle ? (
                    <View style={{ alignItems: "flex-start", backgroundColor: colors.goldSoft, borderColor: colors.gold, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, marginTop: 8, padding: 10 }}>
                      <MaterialCommunityIcons name="alert-outline" size={15} color={colors.goldInk} />
                      <Text style={{ color: colors.goldInk, flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
                        {duplicateTitle === "own"
                          ? translateCopy("Bu başlıkla yayında olan bir ilanın zaten var. Aynısını tekrar açmak yerine mevcut ilanı güncellemen daha iyi sonuç verir.", language)
                          : translateCopy("Bu başlık, yayındaki başka bir ilanla birebir aynı. Kopya görünmemesi için başlığı farklılaştır — aksi halde ilanın incelemeye düşebilir.", language)}
                      </Text>
                    </View>
                  ) : null}
                </FormSection>
              ) : null}

              {specFields.length ? (() => {
                const hasGroups = specFields.some((f) => f.group);
                if (!hasGroups) {
                  return (
                    <FormSection title={schema.title} icon="clipboard-list-outline" hint="* işaretli alanlar zorunludur.">
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{specFields.map(renderField)}</View>
                    </FormSection>
                  );
                }
                // Alt-başlıklara böl (Sahibinden gibi): group'a göre sırayı koruyarak
                // grupla; group'suz alanlar "Diğer bilgiler"e düşer.
                const buckets: Array<{ name: string; fields: FieldDef[] }> = [];
                for (const f of specFields) {
                  const g = f.group || "Diğer bilgiler";
                  let bkt = buckets.find((x) => x.name === g);
                  if (!bkt) { bkt = { name: g, fields: [] }; buckets.push(bkt); }
                  bkt.fields.push(f);
                }
                return (
                  <FormSection title={schema.title} icon="clipboard-list-outline" hint="* işaretli alanlar zorunludur.">
                    <View style={{ gap: 20 }}>
                      {/* MOBİL: gruplar KATLANABİLİR. Emlak/Vasıta gibi zengin şemalarda (konut ~50,
                          otomobil ~32 alan) hepsi açıkken form 4700px'lik bir duvar oluyordu.
                          Açık kalanlar: İLK grup + ZORUNLU alan içeren gruplar (kullanıcı zorunluyu
                          kaçırmasın). Geniş web'de davranış AYNI (hepsi açık, başlık tıklanamaz). */}
                      {buckets.map((bkt, bi) => {
                        const hasRequired = bkt.fields.some((f) => f.required);
                        const defaultOpen = isWideWeb || bi === 0 || hasRequired;
                        const open = openGroups[bkt.name] ?? defaultOpen;
                        return (
                        <View key={bkt.name} style={{ gap: 11 }}>
                          <Pressable
                            accessibilityRole={isWideWeb ? undefined : "button"}
                            accessibilityLabel={isWideWeb ? undefined : `${translateCopy(bkt.name, language)} — ${bkt.fields.length} ${translateCopy("alan", language)}`}
                            disabled={isWideWeb}
                            onPress={() => setOpenGroups((s) => ({ ...s, [bkt.name]: !open }))}
                            style={{ alignItems: "center", flexDirection: "row", gap: 7, paddingVertical: isWideWeb ? 0 : 4 }}
                          >
                            <View style={{ backgroundColor: colors.primary, borderRadius: 2, height: 14, width: 3 }} />
                            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy(bkt.name, language)}</Text>
                            {!isWideWeb ? (
                              <>
                                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1 }}>
                                  <Text style={{ color: colors.muted, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{bkt.fields.length}</Text>
                                </View>
                                <View style={{ flex: 1 }} />
                                <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                              </>
                            ) : null}
                          </Pressable>
                          {open ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{bkt.fields.map(renderField)}</View> : null}
                        </View>
                        );
                      })}
                    </View>
                  </FormSection>
                );
              })() : null}

              {multiFields.length ? (
                <FormSection title="Donanım & Özellikler" icon="star-outline" hint="Ürünün öne çıkan özelliklerini işaretle — alıcının güvenini artırır.">
                  {/* MOBİL: bu bölüm OPSİYONEL ama en şişkin kısım (Vasıta'da 4 dev multiselect →
                      formu ~4700px'e çıkarıyordu). Mobilde varsayılan KAPALI, tek dokunuşla açılır.
                      Geniş web'de her zaman açık (davranış değişmez).
                      SATIR-sarmalı olmalı: DField kökü flexBasis:"100%"+flexGrow:1 taşır ve bu
                      SÜTUN konteynerde flexBasis ANA EKSEN=YÜKSEKLİK olarak yorumlanıyordu →
                      her multiselect tam-yükseklik kutuya şişip sayfayı devasa yapıyordu. */}
                  {!isWideWeb ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${translateCopy("Donanım & Özellikler", language)} — ${multiFields.length} ${translateCopy("bölüm", language)}`}
                      onPress={() => setOpenFeatures((v) => !v)}
                      style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 11 }}
                    >
                      <MaterialCommunityIcons name="star-outline" size={17} color={colors.primaryDark} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" }}>
                        {openFeatures ? translateCopy("Donanımı gizle", language) : translateCopy("Donanım ve özellikleri ekle (isteğe bağlı)", language)}
                      </Text>
                      <MaterialCommunityIcons name={openFeatures ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                    </Pressable>
                  ) : null}
                  {isWideWeb || openFeatures ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>{multiFields.map(renderField)}</View>
                  ) : null}
                </FormSection>
              ) : null}

              <FormSection title="Fiyat" icon="cash-multiple" hint="Üst sınır yok. Nokta binlik ayırıcıdır (örn. 1.500.000).">
                {priceField ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{renderField(priceField)}</View> : null}
                {/* PİYASA İPUCU — risk motoru medyanı zaten hesaplıyordu ama kullanıcı görmüyordu. */}
                {priceHint ? (
                  <View style={{ backgroundColor: priceHint.tooLow ? colors.goldSoft : colors.surfaceAlt, borderColor: priceHint.tooLow ? colors.gold : colors.line, borderRadius: 10, borderWidth: 1, gap: 3, marginTop: 10, padding: 10 }}>
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>
                      {translateCopy("Bu kategoride benzer ilanlar", language)}: {moneyIn(priceHint.low, currency)} – {moneyIn(priceHint.high, currency)}
                      <Text style={{ color: colors.subtle, fontWeight: "600" }}>{`  (${priceHint.n} ilan)`}</Text>
                    </Text>
                    {priceHint.tooLow ? (
                      <Text style={{ color: colors.goldInk, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
                        {translateCopy("Fiyatın piyasa medyanının çok altında. Doğruysa sorun yok — ama bu ilanlar dolandırıcılık şüphesiyle incelemeye düşebilir.", language)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={{ gap: 8, marginTop: priceField ? 12 : 0 }}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Para birimi", language)}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {CURRENCIES.map((c) => {
                      const on = currency === c.code;
                      return (
                        <Pressable key={c.code} onPress={() => setCurrency(c.code)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 15, paddingVertical: 9 }}>
                          <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 15, fontWeight: "900" }}>{c.symbol}</Text>
                          <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{c.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </FormSection>

              {descField ? (
                <FormSection title="Açıklama" icon="text-box-outline" hint="Ürünü detaylı anlat; ne kadar açık yazarsan o kadar güven verirsin.">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{renderField(descField)}</View>
                  {/* Sahibinden tarzı tek-dokunuş şablon: boş açıklamayı, alıcının en çok
                      sorduğu maddelerle doldurur. Doluysa üzerine yazmamak için sadece
                      açıklama boşken görünür. */}
                  {!String(values.description ?? "").trim() ? (
                    <Pressable
                      accessibilityRole="button"
                      testID="desc-template"
                      onPress={() => setV("description", descTemplateFor(path[0]?.label))}
                      style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", borderColor: colors.primary, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 8 })}
                    >
                      <MaterialCommunityIcons name="playlist-plus" size={15} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Örnek şablon ekle", language)}</Text>
                    </Pressable>
                  ) : null}
                </FormSection>
              ) : null}
            </View>
          );
        })() : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Konum", language)}</Text>
            <LocationSelector value={loc} onChange={setLoc} required neighborhoodRequired={false} showNeighborhood showAddressLine mode="listing" />
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Adres görünürlüğü", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["district_only", "Sadece il/ilçe"], ["neighborhood", "İl/ilçe/mahalle"], ["full_address_private", "Açık adres yalnızca onay sonrası"]] as const).map(([k, lbl]) => {
                  const on = visibility === k;
                  return (
                    <Pressable key={k} onPress={() => setVisibility(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Fotoğraflar", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy(`En az 1, en fazla ${MAX_PHOTOS} görsel ekle. İlk görsel kapak olur. Fotoğraflar otomatik ölçeklenir — format/boyutla uğraşmana gerek yok.`, language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {/* MOBİL: ürünü O AN çek (eskiden yalnız galeri vardı — telefonla ilan verenin en doğal yolu). */}
              {Platform.OS !== "web" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translateCopy("Fotoğraf çek", language)}
                  onPress={() => void captureFromCamera()}
                  style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, minHeight: 48, paddingHorizontal: 16 }}
                >
                  <MaterialCommunityIcons name="camera-outline" size={18} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{translateCopy("Fotoğraf çek", language)}</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Galeriden / cihazdan seç", language)} onPress={() => void pickFromGallery()} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 11, flexDirection: "row", gap: 7, minHeight: 48, paddingHorizontal: 16 }}>
                <MaterialCommunityIcons name="image-multiple-outline" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Galeriden / cihazdan seç", language)}</Text>
              </Pressable>
            </View>
            {/* SÜRÜKLE-BIRAK alanı + sayaç + öneri. Eskiden: sayaç yoktu (kaç fotoğraf
                kaldığını bilmiyordun), sürükle-bırak/yapıştır hiç yoktu, ve "3+ fotoğraflı
                ilan daha hızlı satılır" bilgisi yalnız gizli risk motorunda duruyordu. */}
            {/* Sürükle-bırak/Ctrl+V yalnız GENİŞ web'de var. Telefon tarayıcısında bu jestler
                yok → mobilde çalışmayan kesikli kutu + "Ctrl+V ile yapıştır" yönergesi
                gösteriliyordu (kafa karıştıran ölü UI). isWideWeb'e kapatıldı. */}
            {Platform.OS === "web" && isWideWeb ? (
              <View style={{ alignItems: "center", backgroundColor: dragOver ? colors.primarySoft : colors.surfaceAlt, borderColor: dragOver ? colors.primary : colors.line, borderRadius: 12, borderStyle: "dashed", borderWidth: 2, gap: 4, paddingVertical: 16 }}>
                <MaterialCommunityIcons name={dragOver ? "tray-arrow-down" : "image-plus"} size={22} color={dragOver ? colors.primaryDark : colors.subtle} />
                <Text style={{ color: dragOver ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: "800" }}>
                  {dragOver ? translateCopy("Bırak, ekleyelim", language) : translateCopy("Fotoğrafları buraya sürükle — ya da Ctrl+V ile yapıştır", language)}
                </Text>
              </View>
            ) : null}
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                {images.length}/{MAX_PHOTOS} {translateCopy("fotoğraf", language)}
              </Text>
              {images.length > 0 && images.length < RECOMMENDED_PHOTOS ? (
                <Text style={{ color: colors.goldInk, flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "700" }}>
                  · {translateCopy("En az 3 fotoğraflı ilanlar belirgin şekilde daha çok ilgi görüyor.", language)}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("veya görsel adresi yapıştır:", language)}</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <TextInput value={imageDraft} onChangeText={setImageDraft} placeholder="https://…/foto.jpg" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 46, paddingHorizontal: 12 }} />
              <Pressable onPress={() => addImageUrl()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ekle", language)}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {images.length === 0 ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Devam etmek için en az 1 görsel ekle.", language)}</Text> : null}
              {images.map((img, i) => (
                <View key={img + i} style={{ borderColor: i === 0 ? colors.primary : colors.line, borderRadius: 12, borderWidth: i === 0 ? 2 : 1, height: 110, overflow: "hidden", width: 150 }}>
                  <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  <Pressable onPress={() => setImages((s) => s.filter((_, idx) => idx !== i))} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 24, justifyContent: "center", position: "absolute", right: 6, top: 6, width: 24 }}>
                    <MaterialCommunityIcons name="close" size={15} color="#FFFFFF" />
                  </Pressable>
                  {i === 0 ? (
                    <View style={{ backgroundColor: colors.primary, borderRadius: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, position: "absolute", top: 6 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{translateCopy("Kapak", language)}</Text></View>
                  ) : (
                    <Pressable onPress={() => setImages((s) => [s[i], ...s.filter((_, idx) => idx !== i)])} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, bottom: 6, flexDirection: "row", gap: 4, left: 6, paddingHorizontal: 7, paddingVertical: 3, position: "absolute" }}>
                      <MaterialCommunityIcons name="star-outline" size={11} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{translateCopy("Kapak yap", language)}</Text>
                    </Pressable>
                  )}
                  {/* Sıralama: sola/sağa taşı (görsel sırası ilan detay galerisinde korunur). */}
                  <View style={{ bottom: 6, flexDirection: "row", gap: 4, position: "absolute", right: 6 }}>
                    {i > 0 ? (
                      <Pressable accessibilityLabel={translateCopy("Sola taşı", language)} onPress={() => setImages((s) => { const n = [...s]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, height: 24, justifyContent: "center", width: 24 }}>
                        <MaterialCommunityIcons name="chevron-left" size={16} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                    {i < images.length - 1 ? (
                      <Pressable accessibilityLabel={translateCopy("Sağa taşı", language)} onPress={() => setImages((s) => { const n = [...s]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, height: 24, justifyContent: "center", width: 24 }}>
                        <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Komisyon & Ortak Satış", language)}</Text>
            {/* MODEL: ortak satış İSTEĞE BAĞLI — satıcı isterse komisyonsuz NORMAL ilan verir.
                "Normal ilan"da ortaklık talebi alınmaz, komisyon gerekmez (partnershipMode="none"). */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {([["approval", "Ortak satışa aç"], ["none", "Normal ilan"]] as const).map(([mode, lbl]) => {
                const on = mode === "none" ? partnershipMode === "none" : partnershipMode !== "none";
                return <Pressable key={mode} onPress={() => setPartnershipMode(mode === "none" ? "none" : (partnershipMode === "none" ? "approval" : partnershipMode))} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 12 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800", textAlign: "center" }}>{translateCopy(lbl, language)}</Text></Pressable>;
              })}
            </View>
            {partnershipMode !== "none" ? (<>
            {/* Faz 4: bu kategoride komisyon HANGİ olayda hak edilir. */}
            {(() => {
              const conv = categoryConversion(leafLabel);
              return (
                <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 11, flexDirection: "row", gap: 9, padding: 12 }}>
                  <MaterialCommunityIcons name={conv.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={17} color={colors.primaryDark} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Komisyon şu olayda hak edilir", language)}: {translateCopy(conv.event, language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy(conv.hint, language)}</Text>
                  </View>
                </View>
              );
            })()}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, gap: 6, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Komisyon tipi", language)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["rate", "fixed"] as const).map((tp) => {
                    const on = commissionType === tp;
                    // Tip değişince değeri sıfırla: "%15" iken "Sabit"e geçip "15 ₺" gibi
                    // anlamsız bir komisyonun yayınlanmasını önler.
                    return <Pressable key={tp} onPress={() => { if (tp !== commissionType) { setCommissionType(tp); setCommissionValue(tp === "rate" ? "15" : ""); } }} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>{tp === "rate" ? translateCopy("Yüzde (%)", language) : translateCopy("Sabit (₺)", language)}</Text></Pressable>;
                  })}
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>{translateCopy("Komisyon", language)} {commissionType === "rate" ? translateCopy("oranı (%)", language) : translateCopy("tutarı (₺)", language)}</Text>
                <TextInput accessibilityLabel={translateCopy("Komisyon değeri", language)} value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
              </View>
            </View>

            {/* Kategoriye göre önerilen komisyon aralığı — bilgi amaçlı, tek tıkla uygula. */}
            {commissionType === "rate" ? (
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {translateCopy(path[0]?.label ? `${path[0].label} için önerilen komisyon` : "Önerilen komisyon", language)}: <Text style={{ color: colors.ink, fontWeight: "900" }}>%{suggestedRange[0]}–%{suggestedRange[1]}</Text>
                </Text>
                <View style={{ flex: 1 }} />
                {[suggestedRange[0], Math.round((suggestedRange[0] + suggestedRange[1]) / 2), suggestedRange[1]].map((v) => (
                  <Pressable key={v} onPress={() => setCommissionValue(String(v))} style={{ backgroundColor: commissionNum === v ? colors.primary : colors.surface, borderColor: commissionNum === v ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 }}>
                    <Text style={{ color: commissionNum === v ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "900" }}>%{v}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Canlı kazanç hesaplayıcı: fiyattan ortak kazancını ve satıcıya kalanı göster. */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 14 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="calculator-variant-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Kazanç hesabı", language)}</Text>
              </View>
              {priceNum > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, flex: 1, gap: 3, minWidth: 130, padding: 11 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Satış fiyatı", language)}</Text>
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{moneyIn(priceNum, currency)}</Text>
                  </View>
                  <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, flex: 1, gap: 3, minWidth: 130, padding: 11 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{translateCopy("Ortak kazancı (satış başına)", language)}</Text>
                    <Text style={{ color: colors.primaryDark, fontSize: 16, fontWeight: "900" }}>{moneyIn(perSaleCommission, currency)}</Text>
                  </View>
                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, flex: 1, gap: 3, minWidth: 130, padding: 11 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Sana kalan", language)}</Text>
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{moneyIn(Math.max(0, priceNum - perSaleCommission), currency)}</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "600" }}>{translateCopy("Kazanç hesabını görmek için 2. adımda fiyat gir.", language)}</Text>
              )}
              {bonusNum > 0 && Number(bonusQuota) > 0 && priceNum > 0 ? (
                <Text style={{ color: colors.warning, fontSize: 11.5, fontWeight: "800" }}>
                  {translateCopy("Bonus dahil ilk", language)} {Number(bonusQuota)} {translateCopy("satışta HER ORTAK toplam", language)}: {moneyIn((perSaleCommission + bonusNum) * Number(bonusQuota), currency)}
                </Text>
              ) : null}
              <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{translateCopy("Ortaksat para tutmaz; ödeme satıcı ile ortak arasında yapılır. Rakamlar bilgilendirme amaçlıdır.", language)}</Text>
            </View>

            {/* ÖNEMLİ kararlar önce: ortaklık kabul şekli + iletişim (opsiyonel bonus/kademe SONRA). */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ortaklık kabul şekli", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["open", "Herkese açık (anında ortak)"], ["approval", "Başvuru onayı gerekir"], ["invite", "Sadece davetle"]] as const).map(([k, lbl]) => {
                  const on = partnershipMode === k;
                  return <Pressable key={k} onPress={() => setPartnershipMode(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text></Pressable>;
                })}
              </View>
            </View>

            {/* Atıf/referans-süresi kontrolü KALDIRILDI: model'de zorunlu referans linki/tıklama takibi
                YOK. Satış, satıcının manuel kaydıyla ortağa bağlanır (attributionWindow içeride varsayılan). */}

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("İletişim tercihi", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["message", "Mesaj"], ["whatsapp", "WhatsApp"], ["phone", "Telefon"]] as const).map(([k, lbl]) => {
                  const on = contactMethod === k;
                  return <Pressable key={k} onPress={() => setContactMethod(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}><MaterialCommunityIcons name={k === "whatsapp" ? "whatsapp" : k === "phone" ? "phone" : "message-text-outline"} size={15} color={on ? "#FFFFFF" : colors.primary} /><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text></Pressable>;
                })}
              </View>
            </View>

            {/* Teşvik bonusu (opsiyonel): ilk N satışa komisyon üstüne ek ödül. */}
            <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="rocket-launch-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Hızlı başlangıç bonusu (opsiyonel)", language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Her ortağın ilk satışlarına komisyonun üstüne ek ödül taahhüt et — ilanın öne çıkar, ortaklar daha hızlı harekete geçer. Bonus her ortak için ayrı geçerlidir.", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>{translateCopy("Bonus tutarı", language)} ({CURRENCIES.find((c) => c.code === currency)?.symbol ?? "₺"})</Text>
                  <TextInput accessibilityLabel={translateCopy("Bonus tutarı", language)} value={bonusAmount} onChangeText={setBonusAmount} keyboardType="numeric" placeholder={translateCopy("Örn. 500", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>{translateCopy("İlk kaç satış için?", language)}</Text>
                  <TextInput accessibilityLabel={translateCopy("Bonus kotası", language)} value={bonusQuota} onChangeText={setBonusQuota} keyboardType="numeric" placeholder={translateCopy("Örn. 5", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
                </View>
              </View>
            </View>

            {/* Kademeli komisyon (yalnız yüzde): hacimle artan oran — ortakları çok satmaya teşvik. */}
            {commissionType === "rate" ? (
              <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                  <MaterialCommunityIcons name="stairs-up" size={16} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy("Kademeli komisyon (opsiyonel)", language)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Ortağın bu ilandaki kümülatif satışı arttıkça oran yükselsin. Örn: 5. satıştan sonra %12, 20. satıştan sonra %15. Boş bırakırsan tek oran geçerli.", language)}</Text>
                {tiers.map((tr, i) => (
                  <View key={i} style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Satıştan sonra", language)}</Text>
                      <TextInput value={tr.minSales} onChangeText={(v) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, minSales: v } : x)))} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 44, paddingHorizontal: 12 }} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{translateCopy("Oran (%)", language)}</Text>
                      <TextInput value={tr.rate} onChangeText={(v) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, rate: v } : x)))} keyboardType="numeric" placeholder="12" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 44, paddingHorizontal: 12 }} />
                    </View>
                    <Pressable onPress={() => setTiers((s) => s.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" style={{ paddingBottom: 11 }}>
                      <MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                {tiers.length < 4 ? (
                  <Pressable onPress={() => setTiers((s) => [...s, { minSales: "", rate: "" }])} accessibilityRole="button" style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="plus" size={15} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Kademe ekle", language)}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ortak satıcıya özel açıklama (opsiyonel)", language)}</Text>
              <TextInput value={partnerNote} onChangeText={setPartnerNote} multiline placeholder={translateCopy("Ortakların dikkat etmesi gerekenler…", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }} />
            </View>

            <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.info} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Ortaksat para tutmaz; komisyon, satış sonrası satıcı ile ortak arasında doğrudan ödenir. Uygulama yalnızca kaydı tutar.", language)}</Text>
            </View>
            </>) : (
              <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 11, flexDirection: "row", gap: 9, padding: 12 }}>
                <MaterialCommunityIcons name="tag-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Normal ilan: ürünün doğrudan alıcılara açık. Ortak satış ve komisyon yoktur; alıcılar seninle iletişime geçip satın alır. İstediğin zaman ilanı düzenleyip ortak satışa açabilirsin.", language)}</Text>
              </View>
            )}
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 14 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
              <Mascot name="approved" size={56} />
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Önizleme & Yayınla", language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Her şey hazır! Son bir kez göz at ve yayınla.", language)}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <View style={{ borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", flexBasis: 280, maxWidth: 280, minWidth: 0, flexShrink: 1 }}>
                <View style={{ backgroundColor: colors.line, height: 170, width: "100%" }}><SafeRemoteImage uri={coverImage} style={{ height: "100%", width: "100%" }} contentFit="cover" /></View>
                <View style={{ gap: 6, padding: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{path.map((p) => translateCopy(p.label, language)).join(" › ")}</Text>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{String(values.title ?? leafLabel)}</Text>
                  {/* priceNum/perSaleCommission ŞART: değeri "price" DIŞINDA bir alanda tutan
                      kategorilerde (günlük kiralık→nightlyPrice, oda/yurt→perPersonPrice,
                      açık artırma→startPrice) `values.price` undefined → önizleme ₺0 gösteriyordu.
                      Yayınla priceKey kullanıyor; bu satırlar da aynı türetilmiş değeri kullanmalı. */}
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{moneyIn(priceNum, currency)}</Text>
                  {/* NORMAL İLAN (partnershipMode==="none") → komisyon YOK. Eskiden bu bloklar koşulsuz
                      render olup "Ortak kazancı ₺X" + "%15 komisyon" gösteriyordu; oysa yayınlanan ilan
                      commissionValue:0 ve sağdaki PreviewRow "Ortak satış kapalı" diyor → çelişki. */}
                  {partnershipMode !== "none" ? (
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6 }}>
                      <MaterialCommunityIcons name="cash-multiple" size={14} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 11, fontWeight: "800" }}>{translateCopy("Ortak kazancı", language)}</Text>
                      <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{moneyIn(perSaleCommission, currency)}</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{formatLocation(loc, visibility) || translateCopy("Konum belirtilmedi", language)}</Text>
                  {partnershipMode !== "none" ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{commissionType === "rate" ? `%${commissionValue} komisyon` : `${moneyIn(commissionNum || 0, currency)} komisyon`}</Text>
                      </View>
                      {bonusNum > 0 && Number(bonusQuota) > 0 ? (
                        <View style={{ backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "900" }}>ilk {Number(bonusQuota)} satışa +{moneyIn(bonusNum, currency)} bonus</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flex: 1, gap: 8, minWidth: 240 }}>
                <PreviewRow label={translateCopy("Kategori", language)} value={path.map((p) => translateCopy(p.label, language)).join(" › ")} />
                <PreviewRow label={translateCopy("Konum", language)} value={formatLocation(loc, "neighborhood") || "—"} />
                <PreviewRow label={translateCopy("Görsel", language)} value={`${images.length || "kategori görseli"} adet`} />
                <PreviewRow label={translateCopy("Ortaklık", language)} value={partnershipMode === "none" ? translateCopy("Ortak satış kapalı (normal ilan)", language) : partnershipMode === "open" ? translateCopy("Herkese açık", language) : partnershipMode === "approval" ? translateCopy("Onaylı", language) : translateCopy("Davetle", language)} />
                {missingFields.length ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>Eksik zorunlu alan: {missingFields.map((f) => f.label).join(", ")}</Text> : <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("✓ Tüm zorunlu alanlar dolu", language)}</Text>}
              </View>
            </View>

            {/* Girilen özelliklerin özeti — kullanıcı yayından önce ne girdiğini görsün
                (Sahibinden önizlemesi gibi: km/yıl/m²/oda vb. + açıklama). */}
            {(() => {
              const specs = describeAttributes(values).filter((r) => !r.items);
              const descText = String(values.description ?? "").trim();
              if (!specs.length && !descText) return null;
              return (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden" }}>
                  <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("İlan bilgileri (özet)", language)}</Text>
                  </View>
                  {specs.map((row, i) => (
                    <View key={row.label} style={{ backgroundColor: i % 2 === 1 ? colors.surface : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(row.label, language)}</Text>
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", textAlign: "right" }}>{translateCopy(row.value, language)}</Text>
                    </View>
                  ))}
                  {descText ? (
                    <View style={{ borderTopColor: colors.line, borderTopWidth: specs.length ? 1 : 0, gap: 4, padding: 14 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Açıklama", language)}</Text>
                      <Text numberOfLines={6} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{descText}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })()}

            {/* Paylaşım önizlemesi — yayınlandığında ortakların kullanacağı hazır metinler. */}
            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Paylaşım metni önizlemesi", language)}</Text>
                {shareCopied ? <Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "900" }}>{translateCopy("Kopyalandı ✓", language)}</Text> : null}
              </View>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("İlanın yayınlandığında ortaklar bu hazır metinlerle paylaşabilir. Şimdiden kopyalayabilirsin.", language)}</Text>
              {([["whatsapp", "WhatsApp", sharePreview.whatsapp], ["instagram", "Instagram", sharePreview.instagram], ["tiktok", "TikTok", sharePreview.tiktok]] as const).map(([k, lbl, text]) => (
                <View key={k} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, gap: 6, padding: 11 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                    <MaterialCommunityIcons name={k === "whatsapp" ? "whatsapp" : k === "instagram" ? "instagram" : "music-note"} size={14} color={colors.primary} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "900" }}>{lbl}</Text>
                    <Pressable onPress={() => void copyShare(text)} accessibilityRole="button" accessibilityLabel={`${lbl} ${translateCopy("metnini kopyala", language)}`} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <MaterialCommunityIcons name="content-copy" size={12} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{translateCopy("Kopyala", language)}</Text>
                    </Pressable>
                  </View>
                  <Text selectable style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Son adımda (yayından hemen önce) tam yasal kutu; ara adımlarda kompakt açılır-kapanır
          (içerik korunur, her adımda 6 satırla ekranı doldurmaz). */}
      {step === 5 ? <LegalDisclaimer /> : <LegalDisclaimerCollapsible />}

      {/* Honeypot (botlar için gizli tuzak; ekranda görünmez, gerçek kullanıcı dokunmaz) */}
      <TextInput
        value={honeypot}
        onChangeText={setHoneypot}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        autoCorrect={false}
        autoCapitalize="none"
        style={{ height: 0, opacity: 0, position: "absolute", width: 0 }}
        placeholder={translateCopy("Bu alanı boş bırakın", language)}
      />

      {/* Anlık moderasyon uyarısı (kategori/kelime riski) */}
      {liveModeration ? (
        <View style={{ alignItems: "center", backgroundColor: liveModeration.level === "block" ? colors.accentSoft : colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name={liveModeration.level === "block" ? "cancel" : "shield-alert-outline"} size={18} color={liveModeration.level === "block" ? colors.accent : colors.warning} />
          <Text style={{ color: liveModeration.level === "block" ? colors.accent : colors.warning, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{liveModeration.msg}</Text>
        </View>
      ) : null}

      {/* Hata / bilgi banner'ı */}
      {error ? (
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, flex: 1, fontSize: 13, fontWeight: "700" }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name="clock-check-outline" size={18} color={colors.warning} />
          <Text style={{ color: colors.warning, flex: 1, fontSize: 13, fontWeight: "700" }}>{notice}</Text>
        </View>
      ) : null}

      {/* Adımın neden ilerleyemediğini açıkça göster (sessiz kilitli buton yerine). */}
      {step < STEPS.length - 1 && nextBlockReason() ? (
        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700", marginBottom: 8 }}>{nextBlockReason()}</Text>
      ) : null}

      {/* Nav */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          onPress={goBack}
          style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{step === 0 ? translateCopy("Vazgeç", language) : translateCopy("Geri", language)}</Text>
        </Pressable>
        {step < STEPS.length - 1 ? (
          <Pressable accessibilityRole="button" onPress={tryNext} style={{ alignItems: "center", backgroundColor: canNext() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Devam", language)}</Text><MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable disabled={publishing || missingFields.length > 0 || liveModeration?.level === "block"} onPress={() => void publish()} style={{ alignItems: "center", backgroundColor: missingFields.length || liveModeration?.level === "block" ? colors.line : colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 24, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="check-decagram" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{publishing ? translateCopy("Yayınlanıyor…", language) : translateCopy("İlanı Yayınla", language)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Sahibinden tarzı bölüm başlığı — ilan formunu mantıklı gruplara ayırır
// (25+ alanı düz bir yığın yerine: Başlık · Özellikler · Donanım · Fiyat · Açıklama).
function FormSection({ title, hint, icon, children }: { title: string; hint?: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; children: ReactNode }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 3, paddingBottom: 9 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 28, justifyContent: "center", width: 28 }}>
            <MaterialCommunityIcons name={icon} size={16} color={colors.primaryDark} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{translateCopy(title, language)}</Text>
        </View>
        {hint ? <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", marginLeft: 36 }}>{translateCopy(hint, language)}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function DField({ field, value, onChange, invalid }: { field: FieldDef; value: string | boolean | string[] | undefined; onChange: (v: string | boolean | string[]) => void; invalid?: boolean }) {
  const { language } = useLanguage();
  const wide = field.type === "textarea" || field.type === "multiselect";
  // Başlık/açıklama için karakter standardı (Sahibinden benzeri) + canlı sayaç.
  const charLimit = field.key === "title" ? LIMITS.title : field.key === "description" ? LIMITS.description : null;
  const charLen = charLimit ? String(value ?? "").length : 0;
  const selected = Array.isArray(value) ? value : [];
  return (
    // data-field: "Devam"a basınca ilk EKSİK alana kaydırmak için hedef (web).
    <View dataSet={{ field: field.key }} style={{ flexBasis: wide ? "100%" : 230, flexGrow: 1, gap: 6, minWidth: 0 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text style={{ color: invalid ? colors.accent : colors.muted, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{field.label}{field.required ? " *" : ""}{field.suffix ? ` (${field.suffix})` : ""}{field.type === "multiselect" && selected.length ? ` · ${selected.length} seçili` : ""}</Text>
        {charLimit ? <Text style={{ color: charLen > charLimit.max || (charLen > 0 && charLen < charLimit.min) ? colors.accent : colors.subtle, fontSize: 11, fontWeight: "700" }}>{charLen}/{charLimit.max}</Text> : null}
      </View>
      {field.type === "multiselect" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(field.options ?? []).map((opt) => {
            const on = selected.includes(opt);
            return (
              <Pressable key={opt} onPress={() => onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 7 }}>
                {on ? <MaterialCommunityIcons name="check" size={13} color={colors.primaryDark} /> : null}
                <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: on ? "800" : "600" }}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.type === "bool" ? (
        <Pressable onPress={() => onChange(!(value === true))} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
          <View style={{ alignItems: value === true ? "flex-end" : "flex-start", backgroundColor: value === true ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{value === true ? translateCopy("Evet", language) : translateCopy("Hayır", language)}</Text>
        </Pressable>
      ) : field.type === "select" ? (
        <DSelect label="" value={String(value ?? "")} options={field.options ?? []} onChange={onChange} placeholder={translateCopy("Seçin", language)} />
      ) : (
        <TextInput
          testID={`field-${field.key}`}
          accessibilityLabel={field.label}
          value={String(value ?? "")}
          onChangeText={onChange}
          keyboardType={field.type === "number" ? "numeric" : "default"}
          multiline={wide}
          maxLength={charLimit ? charLimit.max : undefined}
          placeholder={field.key === "title" ? (field.placeholder || `En az ${LIMITS.title.min} karakter — kısa ve net başlık`) : field.placeholder}
          placeholderTextColor={colors.subtle}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: wide ? 84 : 46, paddingHorizontal: 12, paddingVertical: wide ? 10 : 8, textAlignVertical: wide ? "top" : "center" }}
        />
      )}
    </View>
  );
}

function DSelect({ label, value, options, onChange, placeholder }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // ÇAPALI AÇILIR LİSTE: liste artık AKIŞTA değil. Eskiden inline açılıyor, altındaki
  // her şeyi AŞAĞI İTİYORDU; kutu ekranın altındaysa liste görünür alanın dışında
  // kalıyordu (çözüm "sayfayı listeye kaydır"dı — istenmeyen davranış). Artık ticari
  // sitelerdeki gibi tetikleyicinin ÜSTÜNDE katman olarak açılır; yer yoksa yukarı açar.
  const { ref: anchorRef, rect: anchorRect, measure } = useAnchor(open);
  const searchable = options.length >= 12;
  const shown = searchable && query.trim()
    ? options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR").trim()))
    : options;
  return (
    <View style={{ gap: label ? 6 : 0 }}>
      {label ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text> : null}
      <View ref={anchorRef} collapsable={false} onLayout={measure}>
        <Pressable onPress={() => { if (open) { setOpen(false); return; } measure(); setQuery(""); setOpen(true); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
          <Text style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || placeholder || translateCopy("Seçin", language)}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        </Pressable>
      </View>
      {/* NATIVE: alttan açılan seçim sayfası (mobil standardı). */}
      {Platform.OS !== "web" ? (
        <OptionSheet
          visible={open}
          title={label || placeholder || translateCopy("Seçin", language)}
          options={options}
          value={value}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      ) : (
        <AnchoredDropdown visible={open} anchor={anchorRect} onClose={() => setOpen(false)} maxHeight={300} minWidth={200}>
          {searchable ? (
            <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
              <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={translateCopy("Ara…", language)} placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 40, paddingVertical: 8 }} />
            </View>
          ) : null}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 14 }}>{translateCopy("Sonuç yok.", language)}</Text>
            ) : null}
            {shown.map((o) => (
              <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 11 })}>
                <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </AnchoredDropdown>
      )}
    </View>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", width: 140 }}>{label}</Text>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

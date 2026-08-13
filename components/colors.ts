// OrtakSat marka paleti — TURKUAZ sistem. Ana renk #0EA5B7.
// Tüm butonlar, ikonlar, linkler ve aktif menüler bu sisteme bağlıdır.
export const colors = {
  background: "#F0FDFF",   // çok açık turkuaz arkaplan
  surface: "#FFFFFF",      // beyaz kart
  surfaceAlt: "#F0FBFC",   // hafif turkuaz tint (ikincil yüzey)
  ink: "#0F172A",          // başlık yazısı
  muted: "#64748B",        // açıklama yazısı
  subtle: "#5E6A7A",       // en soluk yazı — WCAG için koyulaştırıldı (#94A3B8→#6B7A8C→şimdi #5E6A7A; kart yüzeyi #F0FDFF üstünde 4.22:1 kalıp AA'yı geçemiyordu → ~5.3:1)
  line: "#D8F3F6",         // turkuaz kenarlık
  primary: "#0EA5B7",      // ana turkuaz
  primaryDark: "#096273",  // koyu turkuaz — primarySoft çip üstünde AA (4.2→5.2:1) için hafif koyultuldu; beyazda da kontrast arttı
  primarySoft: "#B8E8DE",  // açık turkuaz (soft yüzey/chip) — göz yormayan sakin ton
  accent: "#EF4444",       // hata/tehlike (kırmızı)
  accentSoft: "#FEE4E2",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  success: "#22C55E",
  successSoft: "#DCFCE7",
  info: "#2563EB",         // bilgi (grafik çeşitliliği için mavi)
  infoSoft: "#DBEAFE",
  violet: "#7C5CFC",
  violetSoft: "#EFE8FF",
  gold: "#F2A900",
  goldSoft: "#FFF3D1",
  goldInk: "#7A5200",    // gold-soft zemin üstünde okunur koyu ton (rozet/etiket metni)
  badgeGold: "#F5C518",  // parlak sarı rozet zemini (Kazanç/ÖRNEK) — gold'dan daha canlı
  badgeInk: "#1A1400",   // parlak sarı rozet üstünde koyu metin (near-black, yüksek kontrast)
  neutralSoft: "#F2F4F7" // nötr gri yer-tutucu (görsel yükleme arkaplanı vb.)
};

// Gölge token'ları — eskiden her kartta/rozette inline kopyalanıyordu (5 farklı renk). Tek kaynak.
export const shadow = {
  card: { shadowColor: "#101828", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 },
  badge: { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 }
} as const;

// Hero gradyanı — index + home-desktop'ta birebir kopyalıydı. Ortası ana turkuaz (colors.primary).
export const heroGradient = ["#14B8C4", colors.primary, "#0891B2"] as const;

// ---- Tasarım ölçekleri (birörnek "bitmiş" görünüm için) --------------------
// Köşe yarıçapı: 3 temel değer + hap. Yeni bileşenlerde ham sayı yerine bunları kullan.
export const radius = {
  sm: 10,    // input / küçük öğe
  md: 14,    // kart / bölüm kutusu
  lg: 18,    // büyük panel
  pill: 999  // hap / rozet / yuvarlak düğme
} as const;

// Tipografi ölçeği (px). Fiyat/başlık büyük, gövde orta, etiket küçük — 900 ağırlığı
// yalnız fiyat/başlıklara; gövde 600-700. Yeni metinlerde bu ölçeğe bağlan.
export const text = {
  hero: 30,   // fiyat / ana vurgu
  h1: 22,     // sayfa başlığı
  h2: 18,     // bölüm başlığı
  h3: 16,     // alt başlık
  body: 14,   // gövde metni
  small: 13,  // ikincil metin
  label: 12,  // etiket / alan başlığı
  micro: 11   // rozet / ipucu
} as const;

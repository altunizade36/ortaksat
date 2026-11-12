/**
 * ICU'suz hızlı metin yardımcıları.
 *
 * NEDEN: Hermes (Android) `toLocaleLowerCase`, `normalize`, `localeCompare` ve ASCII dışı `toLowerCase`
 * çağrılarını JNI üzerinden Java ICU'ya götürür — çağrı başına onlarca mikrosaniye ile milisaniye arası.
 * 7.467 düğümlü kategori ağacında bu işlevler düğüm başına çağrılınca uygulama saniyelerce donuyordu
 * (gerçek cihazda: kategoriye dokununca 8–20 sn bekleme, "uygulama yanıt vermiyor").
 *
 * Burada ASCII ve Türkçe harfler elle çevrilir; yalnız başka alfabeden bir karakter görülürse
 * (nadir) doğru sonuç için yerleşik (yavaş) yola düşülür. Sonuçlar yerleşik işlevlerle AYNIDIR.
 */
// Yerleşik işlevlerin ÖZGÜN halleri modül yüklenirken yakalanır. lib/install-fast-intl bu işlevleri
// uygulamada hızlı sürümlere yönlendirir; aşağıdaki "yavaş yol" geri dönüşleri prototip üzerinden
// çağrılsaydı yeniden buraya düşer ve SONSUZ ÖZYİNELEME olurdu (yayın derlemesinde "Maximum call stack
// size exceeded" çökmesi — ⫷ gibi tanınmayan bir karakter içeren ilan başlığıyla görüldü).
const nativeLocaleLower = String.prototype.toLocaleLowerCase;
const nativeNormalize = String.prototype.normalize;

const TR_UPPER_TO_LOWER: Record<string, string> = { "İ": "i", "Ç": "ç", "Ğ": "ğ", "Ö": "ö", "Ş": "ş", "Ü": "ü", "\u00C2": "â", "\u00CE": "î", "\u00DB": "û" };
const TR_LOWER_SET = "çğıöşüâîû";
const FOLD: Record<string, string> = {
  "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u",
  "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u", "\u00C2": "a", "\u00CE": "i", "\u00DB": "u"
};

/** `value.toLocaleLowerCase("tr-TR")` ile aynı sonuç (I → ı, İ → i). */
export function trLower(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 128) {
      out += code >= 65 && code <= 90 ? (code === 73 ? "ı" : String.fromCharCode(code + 32)) : value[i];
      continue;
    }
    const ch = value[i];
    const mapped = TR_UPPER_TO_LOWER[ch];
    if (mapped !== undefined) out += mapped;
    else if (TR_LOWER_SET.indexOf(ch) >= 0) out += ch;
    else return nativeLocaleLower.call(value, "tr-TR");
  }
  return out;
}

/** `value.toLocaleLowerCase("en-US")` ile aynı sonuç ASCII + Türkçe küçük harfler için; diğerleri yerleşik yola düşer. */
export function enLower(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 128) { out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : value[i]; continue; }
    const ch = value[i];
    if (TR_LOWER_SET.indexOf(ch) >= 0) out += ch;
    else return nativeLocaleLower.call(value, "en-US");
  }
  return out;
}

const foldCache = new Map<string, string>();
const FOLD_CACHE_LIMIT = 40000;

/**
 * Arama anahtarı: küçük harf + aksan/Türkçe harf sadeleştirme + harf-rakam dışı her şey boşluk.
 * Eski `lower(v).normalize("NFD").replace(aksan).replace(ı→i).replace([^a-z0-9\s]→" ")…` zinciriyle
 * aynı sonuç; yerel ayardan bağımsızdır (I, İ, ı → i). Sonuçlar önbelleğe alınır.
 */
export function foldKey(value: string): string {
  const cached = foldCache.get(value);
  if (cached !== undefined) return cached;
  let out = "";
  let pendingSpace = false;
  let slow = false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    let ch: string | undefined;
    if (code < 128) {
      if (code >= 97 && code <= 122) ch = value[i];
      else if (code >= 48 && code <= 57) ch = value[i];
      else if (code >= 65 && code <= 90) ch = String.fromCharCode(code + 32);
      else ch = undefined; // boşluk, noktalama → ayırıcı
    } else {
      const mapped = FOLD[value[i]];
      if (mapped !== undefined) ch = mapped;
      else if (code === 0x0307 || (code >= 0x0300 && code <= 0x036f)) continue; // birleşen aksan → düşer
      else if (code === 0xa0 || (code >= 0x2000 && code <= 0x200a) || code === 0x202f || code === 0x3000) ch = undefined;
      else { slow = true; break; }
    }
    if (ch === undefined) { pendingSpace = out.length > 0; continue; }
    if (pendingSpace) { out += " "; pendingSpace = false; }
    out += ch;
  }
  if (slow) {
    out = nativeNormalize.call(nativeLocaleLower.call(value, "tr-TR"), "NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i")
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  if (foldCache.size >= FOLD_CACHE_LIMIT) foldCache.clear();
  foldCache.set(value, out);
  return out;
}

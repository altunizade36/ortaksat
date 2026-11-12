/**
 * UYGULAMA (Hermes) için yerel-ayar çağrılarının hızlı yolları.
 *
 * Gerçek cihaz ölçümü (Android, geliştirme derlemesi, çağrı başına):
 *   "…".toLocaleLowerCase("tr-TR")   ≈ 1.640 µs      "…".localeCompare(x, "tr")      ≈ 1.650 µs
 *   "…".toLocaleUpperCase("tr-TR")   ≈ 1.610 µs      (1234567).toLocaleString("tr-TR") ≈ 1.830 µs
 *   new Date().toLocaleDateString("tr-TR") ≈ 2.030 µs
 * Hermes bu çağrıların her birinde JNI üzerinden Java ICU'ya gider. Liste sıralama, kategori ağacı
 * (7.467 düğüm), il/ilçe listeleri ve kart tarihleri gibi döngülerde bu saniyeler eder: kategoriye
 * dokununca 8–20 sn bekleme ve "uygulama yanıt vermiyor" uyarısı buradan geliyordu.
 *
 * Burada YALNIZ uygulamada (web değil) ve YALNIZ kodun kullandığı kalıplar için ICU'suz eşdeğerler
 * kurulur; tanınmayan yerel ayar / seçenek / karakter görülürse özgün (yavaş ama tam) işleve düşülür.
 * Web'de hiçbir şey değişmez: tarayıcılarda bu çağrılar zaten hızlıdır.
 */
import { Platform } from "react-native";

import { enLower, trLower } from "./fast-text";

type Locales = string | string[] | undefined;

const TR_UP: Record<string, string> = { "ç": "Ç", "ğ": "Ğ", "ö": "Ö", "ş": "Ş", "ü": "Ü", "â": "\u00C2", "î": "\u00CE", "û": "\u00DB" };
const TR_UPPER_SET = "ÇĞİÖŞÜ\u00C2\u00CE\u00DB";
const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
// Türk alfabesi sırası (küçük harf); ICU'nun "tr" harmanlamasındaki harf sırası.
const TR_ORDER = "abcçdefgğhıijklmnoöpqrsştuüvwxyz";

function first(locales: Locales): string | undefined {
  return Array.isArray(locales) ? locales[0] : locales;
}
const isTr = (l: string | undefined) => l === "tr" || l === "tr-TR";
const isEn = (l: string | undefined) => l === "en" || l === "en-US" || l === "en-GB";

function upper(value: string, turkish: boolean): string | null {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 128) {
      if (code >= 97 && code <= 122) out += turkish && code === 105 ? "İ" : String.fromCharCode(code - 32);
      else out += value[i];
      continue;
    }
    const ch = value[i];
    if (ch === "ı") out += "I";
    else if (TR_UP[ch] !== undefined) out += TR_UP[ch];
    else if (TR_UPPER_SET.indexOf(ch) >= 0) out += ch;
    else return null;
  }
  return out;
}

/** Yalnız rakam ve tarih/saat ayırıcılarından oluşan dizgeler (ISO zaman damgaları) kod birimiyle karşılaştırılır. */
function dateLike(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || c === 45 || c === 58 || c === 46 || c === 84 || c === 90 || c === 43 || c === 32)) return false;
  }
  return true;
}

/** Türkçe sıralama anahtarı: harfler alfabe sırasına, rakamlar harflerden önce, boşluk/noktalama en önce. Bilinmeyen karakterde null. */
function trRank(ch: string, code: number): number {
  if (code === 32) return 1;
  if (code >= 48 && code <= 57) return 100 + (code - 48);
  if (code < 128 && !((code >= 65 && code <= 90) || (code >= 97 && code <= 122))) return 2 + (code % 90);
  const lowered = code < 128 ? (code >= 65 && code <= 90 ? (code === 73 ? "ı" : String.fromCharCode(code + 32)) : ch) : (ch === "İ" ? "i" : TR_UPPER_SET.indexOf(ch) >= 0 ? trLower(ch) : ch);
  const at = TR_ORDER.indexOf(lowered === "â" ? "a" : lowered === "î" ? "i" : lowered === "û" ? "u" : lowered);
  return at < 0 ? -1 : 200 + at;
}
function trCompare(a: string, b: string): number | null {
  const n = Math.min(a.length, b.length);
  let caseTie = 0;
  for (let i = 0; i < n; i++) {
    const ca = a.charCodeAt(i), cb = b.charCodeAt(i);
    if (ca === cb) continue;
    const ra = trRank(a[i], ca), rb = trRank(b[i], cb);
    if (ra < 0 || rb < 0) return null;
    // İki noktalama işaretinin kendi arasındaki sırası ICU'ya bırakılır (ör. "." ile "+").
    if (ra > 1 && ra < 100 && rb > 1 && rb < 100) return null;
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (caseTie === 0) caseTie = ca > cb ? -1 : 1; // aynı harf, farklı büyüklük: küçük harf önce
  }
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return caseTie;
}

function groupNumber(value: number, group: string, decimal: string, minFraction: number, maxFraction: number): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(maxFraction);
  let [whole, fraction = ""] = fixed.split(".");
  while (fraction.length > minFraction && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  let out = "";
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) out += group;
    out += whole[i];
  }
  whole = out;
  const zero = Number(fixed) === 0;
  return (negative && !zero ? "-" : "") + whole + (fraction ? decimal + fraction : "");
}

const two = (n: number) => (n < 10 ? "0" + n : String(n));

/** tr-TR tarih kalıpları: kodun kullandığı seçenek birleşimleri. Tanınmayan birleşimde null. */
function trDate(date: Date, options: Intl.DateTimeFormatOptions | undefined, withTimeByDefault: boolean): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const d = date.getDate(), m = date.getMonth(), y = date.getFullYear();
  if (!options) {
    const base = `${two(d)}.${two(m + 1)}.${y}`;
    return withTimeByDefault ? `${base} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}` : base;
  }
  const keys = Object.keys(options).filter((k) => (options as Record<string, unknown>)[k] !== undefined);
  for (const key of keys) if (!["day", "month", "year", "hour", "minute"].includes(key)) return null;
  const { day, month, year, hour, minute } = options;
  if (month !== "long" && month !== "short" && month !== undefined) return null;
  if ((hour !== undefined && hour !== "2-digit") || (minute !== undefined && minute !== "2-digit") || (hour === undefined) !== (minute === undefined)) return null;
  if (month === undefined) return null;
  const parts: string[] = [];
  if (day === "numeric") parts.push(String(d)); else if (day === "2-digit") parts.push(two(d)); else if (day !== undefined) return null;
  parts.push(month === "long" ? TR_MONTHS[m] : TR_MONTHS_SHORT[m]);
  if (year === "numeric") parts.push(String(y)); else if (year === "2-digit") parts.push(two(y % 100)); else if (year !== undefined) return null;
  let out = parts.join(" ");
  if (hour !== undefined) out += ` ${two(date.getHours())}:${two(date.getMinutes())}`;
  return out;
}

let installed = false;

export function installFastIntl(): void {
  if (installed || Platform.OS === "web") return;
  // Yalnız Hermes: başka motorlarda bu çağrılar zaten hızlıdır.
  if (!(globalThis as { HermesInternal?: unknown }).HermesInternal) return;
  installed = true;

  const S = String.prototype as unknown as Record<string, (...args: never[]) => unknown>;
  const origLower = String.prototype.toLocaleLowerCase;
  const origUpper = String.prototype.toLocaleUpperCase;
  const origCompare = String.prototype.localeCompare;
  // Cihazın varsayılan yerel ayarı Türkçe mi? (bir kez, özgün işlevle)
  // ASCII dışı bir harfle sına: bazı motorlar yalnız-ASCII dizgelerde yerel ayarı dikkate almayan hızlı yol kullanır.
  const deviceTr = origLower.call("IŞ") === "ış";

  S.toLocaleLowerCase = function (this: string, locales?: Locales) {
    const value = String(this), l = first(locales);
    if (isTr(l) || (l === undefined && deviceTr)) return trLower(value);
    if (isEn(l) || l === undefined) return enLower(value);
    return origLower.call(value, locales as string);
  } as never;

  S.toLocaleUpperCase = function (this: string, locales?: Locales) {
    const value = String(this), l = first(locales);
    const turkish = isTr(l) || (l === undefined && deviceTr);
    if (turkish || isEn(l) || l === undefined) {
      const fast = upper(value, turkish);
      if (fast !== null) return fast;
    }
    return origUpper.call(value, locales as string);
  } as never;

  S.localeCompare = function (this: string, that: string, locales?: Locales, options?: Intl.CollatorOptions) {
    const a = String(this), b = String(that);
    if (options === undefined) {
      if (a === b) return 0;
      if (dateLike(a) && dateLike(b)) return a < b ? -1 : 1;
      const l = first(locales);
      if (isTr(l) || (l === undefined && deviceTr)) {
        const fast = trCompare(a, b);
        if (fast !== null) return fast;
      }
    }
    return origCompare.call(a, b, locales as string, options);
  } as never;

  const origNumber = Number.prototype.toLocaleString;
  (Number.prototype as unknown as Record<string, unknown>).toLocaleString = function (this: number, locales?: Locales, options?: Intl.NumberFormatOptions) {
    const value = Number(this), l = first(locales);
    const turkish = isTr(l) || (l === undefined && deviceTr);
    // 1e21 ve üstünde toFixed üstel gösterime geçer → özgün işleve bırak.
    if (Number.isFinite(value) && Math.abs(value) < 1e21 && (turkish || isEn(l))) {
      const keys = options ? Object.keys(options).filter((k) => (options as Record<string, unknown>)[k] !== undefined) : [];
      if (keys.every((k) => k === "minimumFractionDigits" || k === "maximumFractionDigits")) {
        const min = Math.min(20, Math.max(0, options?.minimumFractionDigits ?? 0));
        const max = Math.min(20, Math.max(min, options?.maximumFractionDigits ?? Math.max(3, min)));
        return turkish ? groupNumber(value, ".", ",", min, max) : groupNumber(value, ",", ".", min, max);
      }
    }
    return origNumber.call(value, locales as string, options);
  };

  const D = Date.prototype as unknown as Record<string, unknown>;
  const origDate = Date.prototype.toLocaleDateString;
  const origDateTime = Date.prototype.toLocaleString;
  D.toLocaleDateString = function (this: Date, locales?: Locales, options?: Intl.DateTimeFormatOptions) {
    if (isTr(first(locales))) {
      const fast = trDate(this, options, false);
      if (fast !== null) return fast;
    }
    return origDate.call(this, locales as string, options);
  };
  D.toLocaleString = function (this: Date, locales?: Locales, options?: Intl.DateTimeFormatOptions) {
    if (isTr(first(locales))) {
      const fast = trDate(this, options, true);
      if (fast !== null) return fast;
    }
    return origDateTime.call(this, locales as string, options);
  };
}

installFastIntl();

/**
 * Girdi temizleme (defense-in-depth). React Native/RNW `<Text>` zaten XSS'e karşı
 * güvenlidir, ama veriyi DB'ye yazmadan önce temizlemek; kontrol karakterlerini,
 * gizli script kalıplarını ve aşırı boşlukları engeller. Tek merkezden kullanılır.
 *
 * Kontrol/zero-width karakterleri regex literali yerine char-code kontrolüyle
 * eleriz; böylece bu kaynak dosyası tamamen ASCII kalır (encoding kontrolü temiz).
 */

const HTML_TAG = /<\/?[a-z][^>]*>/gi;
const SCRIPT_PROTOCOL = /\b(?:javascript|data|vbscript)\s*:/gi;

// Görünmez/kontrol karakteri mi? \t (9) ve \n (10) korunur (multiline için).
function isInvisibleControl(code: number): boolean {
  if (code === 9 || code === 10) return false; // tab, newline
  if (code <= 8) return true; // C0 başı
  if (code === 11 || code === 12) return true; // VT, FF
  if (code >= 14 && code <= 31) return true; // C0 kalanı
  if (code === 127) return true; // DEL
  if (code >= 0x200b && code <= 0x200f) return true; // zero-width + LTR/RTL marks
  if (code >= 0x202a && code <= 0x202e) return true; // yön değiştirme (bidi override)
  if (code === 0x2060 || code === 0xfeff) return true; // word-joiner, BOM
  return false;
}

function stripControl(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    if (!isInvisibleControl(input.charCodeAt(i))) out += input[i];
  }
  return out;
}

/** Tek satırlık alan (başlık, isim, e-posta vb.) için: tag/script/kontrol temizliği + tek boşluk. */
export function sanitizeLine(input: string, maxLen = 200): string {
  return stripControl(input ?? "")
    .replace(HTML_TAG, " ")
    .replace(SCRIPT_PROTOCOL, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Çok satırlı alan (açıklama, mesaj) için: satır sonlarını korur, fazlasını kırpar. */
export function sanitizeMultiline(input: string, maxLen = 4000): string {
  return stripControl(input ?? "")
    .replace(HTML_TAG, " ")
    .replace(SCRIPT_PROTOCOL, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

/** Telefon: yalnızca rakam ve baştaki +; TR formatına normalize eder. */
export function sanitizePhone(input: string): string {
  const cleaned = (input ?? "").replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? "+" + cleaned.slice(1).replace(/\+/g, "") : cleaned.replace(/\+/g, "");
}

/** E-posta: küçük harf (TR-güvenli) + boşluk temizliği. */
export function sanitizeEmail(input: string): string {
  return stripControl(input ?? "").trim().toLocaleLowerCase("tr-TR");
}

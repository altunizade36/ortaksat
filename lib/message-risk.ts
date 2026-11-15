import { searchKey } from "@/lib/locale";

/**
 * Sohbet metninde "site dışına çıkma / ödeme bilgisi paylaşma" işaretleri.
 *
 * Üç sohbet yüzeyi (masaüstü gelen kutusu, dar web sohbeti, uygulama) AYNI taramayı kullanır.
 * Eskiden her ekranın kendi kelime listesi vardı; uygulamada hiç uyarı yoktu ve hiçbiri
 * telefon numarasını ya da dış bağlantıyı yakalamıyordu (en sık görülen iki kaçış yolu).
 *
 * Uyarı yalnız BİLGİLENDİRİR; gönderimi engellemez.
 */
// Gösterim için aksanlı yazım; eşleştirme aksansız anahtar (searchKey) üzerinden yapılır.
const RISK_WORDS = [
  "iban",
  "havale",
  "eft",
  "kapora",
  "kaparo",
  "whatsapp",
  "telegram",
  "papara",
  "kripto",
  "site dışı",
  "western union",
  "hesap numarası",
  "kart bilgisi",
  "dolandırıcı"
];
const RISK_WORD_KEYS = RISK_WORDS.map((word) => ({ word, key: searchKey(word) }));

// Türkiye telefon numarası; boşluk, nokta, tire ve parantez ayırıcılarıyla. Önünde/arkasında başka
// rakam olmamalı (fiyat gibi uzun sayıların içinden eşleşmesin).
// Cep: 5xx xxx xx xx (+90 / 0 öneki isteğe bağlı).
const MOBILE_PHONE_PATTERN = /(?:^|[^\d])(?:(?:\+|00)?90[\s.-]?|0[\s.-]?)?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/;
// Sabit hat: 0 ya da +90 öneki ZORUNLU (2xx/3xx/4xx) — önek istenmezse 2 ile başlayan 10 haneli
// ilan numarası telefon sanılırdı.
const LANDLINE_PHONE_PATTERN = /(?:^|[^\d])(?:(?:\+|00)?90[\s.-]?|0[\s.-]?)\(?[2-4]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/;
// Dış bağlantı: http(s)://…, www.…, kısa mesajlaşma bağlantıları ve yaygın alan adı uzantıları.
const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|\b(?:wa\.me|t\.me|bit\.ly|tinyurl\.com)\/[^\s]*|\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|shop|site|store|online|xyz|link|app|io|co|me)(?:\.tr)?\b[^\s]*/gi;
// Uygulamanın kendi ürettiği bağlantılar uyarı sayılmaz: ilan/profil adresleri ve "Konum gönder".
const TRUSTED_LINK = /ortaksat\.com|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|maps\.google\./i;

export type MessageRisk = { hasRisk: boolean; matches: string[] };

export function scanMessageRisk(text: string): MessageRisk {
  if (!text) return { hasRisk: false, matches: [] };
  const key = searchKey(text);
  const matches = new Set<string>();
  for (const item of RISK_WORD_KEYS) if (key.includes(item.key)) matches.add(item.word);
  if (MOBILE_PHONE_PATTERN.test(text) || LANDLINE_PHONE_PATTERN.test(text)) matches.add("telefon numarası");
  const links = text.match(LINK_PATTERN);
  if (links && links.some((link) => !TRUSTED_LINK.test(link))) matches.add("dış bağlantı");
  const list = Array.from(matches);
  return { hasRisk: list.length > 0, matches: list.slice(0, 3) };
}

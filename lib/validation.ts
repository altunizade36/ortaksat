/**
 * Merkezi form doğrulama. Tüm formlar (ilan ver, kayıt, giriş, mesaj, destek)
 * buradaki kuralları kullanır; böylece uzunluk/format kuralları tek yerde durur
 * ve DB'ye temiz, sınırlı veri gider.
 */

import { sanitizeEmail, sanitizeLine, sanitizeMultiline } from "@/lib/sanitize";

export type FieldError = { field: string; message: string };
export type ValidationResult = { ok: boolean; errors: FieldError[] };

// Alan uzunluk sınırları (DB ile uyumlu, makul üst sınırlar).
export const LIMITS = {
  name: { min: 2, max: 80 },
  title: { min: 10, max: 70 },
  description: { min: 20, max: 4000 },
  price: { min: 1, max: 999_999_999_999 },
  message: { min: 1, max: 2000 },
  supportSubject: { min: 3, max: 120 },
  supportMessage: { min: 10, max: 2000 },
  password: { min: 8, max: 72 } // Supabase/bcrypt üst sınırı 72
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// TR telefon: 10-13 hane (başında +90 veya 0 olabilir)
const PHONE_RE = /^(\+?90)?0?5\d{9}$/;

/** TR fiyat metnini sayıya çevirir: nokta = binlik ayırıcı, virgül = ondalık. "1.500.000" -> 1500000. */
export function parseTrPrice(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(sanitizeEmail(email));
}

/** TR cep telefonu doğrulama (boş bırakılırsa geçerli kabul edilir — opsiyonel alan). */
export function isValidTrPhone(phone: string): boolean {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return true;
  return PHONE_RE.test(digits);
}

function lenError(field: string, value: string, min: number, max: number, label: string): FieldError | null {
  const v = value.trim();
  if (v.length < min) return { field, message: `${label} en az ${min} karakter olmalı.` };
  if (v.length > max) return { field, message: `${label} en fazla ${max} karakter olabilir.` };
  return null;
}

/** İlan oluşturma/düzenleme doğrulaması. Temizlenmiş değerleri de döndürür. */
export function validateListing(input: {
  title: string;
  description: string;
  price: number | string;
  category?: string;
  location?: string;
}): ValidationResult & { clean: { title: string; description: string; price: number } } {
  const errors: FieldError[] = [];
  const title = sanitizeLine(input.title, LIMITS.title.max);
  const description = sanitizeMultiline(input.description, LIMITS.description.max);
  const price = typeof input.price === "string" ? parseTrPrice(input.price) : input.price;

  const te = lenError("title", title, LIMITS.title.min, LIMITS.title.max, "Başlık");
  if (te) errors.push(te);
  const de = lenError("description", description, LIMITS.description.min, LIMITS.description.max, "Açıklama");
  if (de) errors.push(de);
  if (!Number.isFinite(price) || price < LIMITS.price.min) {
    errors.push({ field: "price", message: "Geçerli bir fiyat girin." });
  } else if (price > LIMITS.price.max) {
    errors.push({ field: "price", message: "Fiyat çok yüksek görünüyor." });
  }
  if (input.category !== undefined && !input.category.trim()) {
    errors.push({ field: "category", message: "Kategori seçin." });
  }
  if (input.location !== undefined && !input.location.trim()) {
    errors.push({ field: "location", message: "Konum seçin." });
  }

  return { ok: errors.length === 0, errors, clean: { title, description, price: Number.isFinite(price) ? price : 0 } };
}

/** Kayıt doğrulaması. */
export function validateSignUp(input: { name: string; email: string; password: string }): ValidationResult {
  const errors: FieldError[] = [];
  const ne = lenError("name", sanitizeLine(input.name, LIMITS.name.max), LIMITS.name.min, LIMITS.name.max, "Ad Soyad");
  if (ne) errors.push(ne);
  if (!isValidEmail(input.email)) errors.push({ field: "email", message: "Geçerli bir e-posta girin." });
  if ((input.password ?? "").length < LIMITS.password.min) {
    errors.push({ field: "password", message: `Şifre en az ${LIMITS.password.min} karakter olmalı.` });
  } else if (input.password.length > LIMITS.password.max) {
    errors.push({ field: "password", message: `Şifre en fazla ${LIMITS.password.max} karakter olabilir.` });
  }
  return { ok: errors.length === 0, errors };
}

/** Giriş doğrulaması (hafif). */
export function validateSignIn(input: { email: string; password: string }): ValidationResult {
  const errors: FieldError[] = [];
  if (!isValidEmail(input.email)) errors.push({ field: "email", message: "Geçerli bir e-posta girin." });
  if (!(input.password ?? "").trim()) errors.push({ field: "password", message: "Şifre gerekli." });
  return { ok: errors.length === 0, errors };
}

/** İlk hatayı tek satır mesaj olarak verir (UI'da göstermek için pratik). */
export function firstError(result: ValidationResult): string | null {
  return result.errors[0]?.message ?? null;
}

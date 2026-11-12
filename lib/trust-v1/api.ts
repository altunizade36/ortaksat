import { supabase } from "@/lib/supabase";
import { makeUuid } from "@/lib/live-service";
import type { TrustCapabilities, TrustDashboard, TrustProfile } from "./model";

const disabled: TrustCapabilities = { enabled: false, phoneRequired: true, phoneVerificationAvailable: false, evidenceScanningAvailable: false, guestReferralsAvailable: false, paymentsEnabled: false };
const errors: Record<string, string> = {
  TRUST_LEDGER_MISMATCH: "Mevcut satış kaydı, ilan, tutar veya anlaşma komisyonuyla eşleşmiyor. Doğru kaydı ve anlaşma sürümünü kontrol et.",
  TRUST_LEDGER_NOT_READY: "Bu satışın iade/inceleme süreci tamamlanmadan komisyon hak edişi doğrulanamaz.",
  TRUST_STOCK_UNAVAILABLE: "İlan aktif değil veya yeterli stok bulunmuyor. Satıcı ilan durumunu kontrol etmeli.",
  TRUST_USE_TRANSACTION_CENTRE: "Bu satış Güven ve İşlem Merkezi'ne bağlı. Ödeme değişikliklerini işlem dosyasından yap.",
  TRUST_DISABLED: "Güven Sistemi henüz kullanıma açılmadı.", TRUST_AUTH_REQUIRED: "Bu işlem için hesabına giriş yap.", TRUST_FORBIDDEN: "Bu işlem dosyasına erişim yetkin yok.",
  TRUST_CONFLICT: "Kayıt başka bir işlemle güncellendi. Yenileyip son durumu incele; bilgilerin korunuyor.", TRUST_IDEMPOTENCY_CONFLICT: "İşlem içeriği değişti. Kaydı yenileyip tekrar dene.",
  TRUST_PHONE_VERIFICATION_REQUIRED: "Bu adım için telefonunu doğrulaman gerekiyor.", TRUST_VALID_AGREEMENT_REQUIRED: "İki tarafın da onayladığı geçerli bir anlaşma gerekiyor.",
  TRUST_INVALID_TRANSITION: "Bu işlem mevcut durumda uygulanamaz. Son durumu kontrol et.", TRUST_TERMS_CHANGED: "Anlaşma sürümü değişti. Koşulları yeniden incele.",
  TRUST_SCANNER_UNAVAILABLE: "Belge tarama hizmeti yapılandırılmadan dosya yüklenemez.", TRUST_EVIDENCE_UNAVAILABLE: "Belge henüz taranmamış veya bu belgeye erişim yetkin yok.",
  TRUST_REFERRAL_CONFLICT: "Bu alıcı için koruma süresi devam eden başka bir geçerli yönlendirme var. İtiraz merkezinden inceleme isteyebilirsin.",
  TRUST_RATE_LIMIT: "Çok fazla işlem yapıldı. Bir süre sonra tekrar dene.", TRUST_REVIEW_INELIGIBLE: "Bu işlem veya değerlendirme dönemi yorum göndermeye uygun değil.",
  TRUST_INVALID_RATINGS: "Tüm değerlendirme ölçütlerine 1–5 arasında puan ver."
  , TRUST_PARTNERSHIP_RESTRICTED: "Yeni ortaklık yetkin süreli olarak kısıtlı. Mevcut dosyalarını ve ödeme kayıtlarını inceleyebilir, destek ekibine başvurabilirsin."
  , TRUST_RESPONSE_WINDOW_OPEN: "Tarafların cevap süresi henüz dolmadı. İncelemeyi sürdürebilirsin; karar daha sonra kaydedilebilir."
};
export function trustError(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.code === "23505") return "Bu kayıt zaten mevcut. Aynı işlem için ikinci bir değerlendirme veya açık itiraz oluşturulamaz.";
  for (const [code, text] of Object.entries(errors)) if (e?.message?.includes(code)) return text;
  return "İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene; form bilgilerin korunuyor.";
}
function client() { if (!supabase) throw new Error("Sunucu bağlantısı gerekli."); return supabase; }
export async function trustCapabilities(): Promise<TrustCapabilities> {
  const { data, error } = await client().rpc("trust_v1_capabilities");
  if (error?.code === "PGRST202") return disabled; // Migration has deliberately not been installed in production.
  if (error) throw error;
  if (!data || typeof data.enabled !== "boolean" || data.paymentsEnabled !== false) throw new Error("Invalid trust capabilities");
  return data;
}
export async function trustDashboard(transactionId?: string, cursor?: { at: string; id: string } | null): Promise<TrustDashboard> {
  const { data, error } = await client().rpc("trust_v1_dashboard", { p_transaction_id: transactionId || null, p_cursor_at: cursor?.at || null, p_cursor_id: cursor?.id || null });
  if (error) throw error;
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.agreements)) throw new Error("Invalid trust dashboard");
  return data;
}
export async function trustProfile(userId: string): Promise<TrustProfile> {
  const { data, error } = await client().rpc("trust_v1_profile", { p_user_id: userId });
  if (error) throw error;
  return data;
}
export const trustRequestId = makeUuid;
export async function trustCommand(operation: string, entity: string, payload: Record<string, unknown>, requestId: string, revision?: number) {
  const { data, error } = await client().rpc("trust_v1_command", { p_operation: operation, p_entity_id: entity, p_payload: payload, p_request_id: requestId, p_revision: revision ?? null });
  if (error) throw error;
  return data as { transactionId?: string; agreementId?: string; disputeId?: string; revision?: number };
}
export async function trustConfirmReferral(transactionId: string, refCode: string, requestId: string) {
  const { data, error } = await client().rpc("trust_v1_confirm_referral", { p_transaction_id: transactionId, p_ref_code: refCode, p_request_id: requestId });
  if (error) throw error;
  return data;
}
export async function requestTrustPhoneOtp(phone: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Telefonu ülke koduyla gir. Örnek: +905001112233.");
  if (!(await trustCapabilities()).phoneVerificationAvailable) throw new Error("SMS doğrulama sağlayıcısı henüz yapılandırılmadı.");
  const { error } = await client().auth.updateUser({ phone });
  if (error) throw error;
}
export async function confirmTrustPhoneOtp(phone: string, token: string) {
  if (!/^\d{6}$/.test(token)) throw new Error("Altı haneli doğrulama kodunu gir.");
  const { error } = await client().auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error) throw error;
}
export async function trustStaffQueue(): Promise<{ disputes: (TrustDashboard["disputes"][number] & { revision: number })[]; restrictions: { id: string; user_id: string; reason: string; expires_at: string; lifted_at: string | null }[] }> {
  const { data, error } = await client().rpc("trust_v1_staff_queue");
  if (error) throw error;
  return data;
}
export async function trustRestrict(userId: string, disputeId: string, reason: string, days: number, requestId: string) {
  const { error } = await client().rpc("trust_v1_restrict_partnership", { p_user_id: userId, p_dispute_id: disputeId, p_reason: reason, p_days: days, p_request_id: requestId });
  if (error) throw error;
}
export async function trustLiftRestriction(id: string, reason: string) {
  const { error } = await client().rpc("trust_v1_lift_restriction", { p_restriction_id: id, p_reason: reason });
  if (error) throw error;
}
export async function uploadTrustEvidence(transactionId: string, kind: string, uri: string, mime: string, requestId: string) {
  const response = await fetch(uri), blob = await response.blob();
  if (!blob.size || blob.size > 5242880 || !["image/jpeg", "image/png", "application/pdf"].includes(mime)) throw new Error("TRUST_INVALID_FILE");
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error("TRUST_INVALID_FILE"));
    reader.onload = () => { try { const decoded = atob(String(reader.result).split(",")[1]), bytes = new Uint8Array(decoded.length); for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i); resolve(bytes.buffer); } catch (e) { reject(e); } };
    reader.readAsDataURL(blob);
  });
  const registered = await client().rpc("trust_v1_register_evidence", { p_transaction_id: transactionId, p_kind: kind, p_mime: mime, p_bytes: blob.size, p_request_id: requestId });
  if (registered.error) throw registered.error;
  const upload = await client().storage.from("trust-evidence").upload(registered.data.path, buffer, { contentType: mime, upsert: false });
  if (upload.error && upload.error.message !== "The resource already exists") throw upload.error;
  // Server function verifies file bytes and malware service; upload alone never makes it clean.
  const scanned = await client().functions.invoke("trust-evidence", { body: { operation: "scan", evidenceId: registered.data.evidenceId } });
  if (scanned.error) throw scanned.error;
  return registered.data.evidenceId as string;
}
export async function downloadTrustEvidence(evidenceId: string): Promise<string> {
  const { data, error } = await client().functions.invoke("trust-evidence", { body: { operation: "download", evidenceId } });
  if (error) throw error;
  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) throw new Error("TRUST_EVIDENCE_UNAVAILABLE");
  return data.url;
}
export async function trustGuestReferral(body: { operation: "begin"; transactionId: string; refCode: string; email: string; consent: true } | { operation: "confirm"; challengeId: string; code: string }): Promise<{ challengeId?: string; ok?: boolean }> {
  const { data, error } = await client().functions.invoke("trust-referral", { body });
  if (error || data?.ok === false) throw new Error("TRUST_GUEST_VERIFICATION_FAILED");
  return data;
}

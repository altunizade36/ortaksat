/**
 * Uygulama-içi "giriş gerekli" yönlendirmesi.
 *
 * Store (data/app-store.tsx) gibi router'a erişemeyen katmanlar `promptLogin()`
 * çağırır; root layout'ta mount'lu bir bileşen (ErrorToast) `registerAuthPrompt`
 * ile gerçek yönlendirmeyi (router.push("/auth")) bağlar.
 *
 * GEÇMİŞ: anon kullanıcı favori kalbine basınca store yalnız `setAuthError` yazıyordu;
 * ErrorToast `authError`'ı hiç göstermediği için hiçbir şey olmuyordu (sessiz no-op).
 * Artık anon favori/aksiyon → /auth'a yönlendirilir (iletişim/ortak akışlarıyla parite).
 */
let handler: (() => void) | null = null;

export function registerAuthPrompt(fn: (() => void) | null): void {
  handler = fn;
}

export function promptLogin(): void {
  handler?.();
}

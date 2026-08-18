/**
 * HAFİF BAŞARI/BİLGİ TOAST'ı — bloklamayan geri bildirim.
 *
 * GEÇMİŞ: "Bağlantı kopyalandı", "İlan güncellendi", "Ortaklık aktif" gibi BAŞARI
 * mesajları `Alert.alert(...)` ile gösteriliyordu → mobilde her seferinde KAPATILMASI
 * GEREKEN bir modal açılıyordu (web'de daha az sorun; mobilde çok rahatsız edici).
 * Onay (yes/no) için Alert doğru; ama tek yönlü "oldu" bildirimi için AĞIR.
 *
 * ŞİMDİ: `showToast(mesaj, tone)` → <ToastHost /> (root layout) alttan yükselen,
 * kendiliğinden kaybolan bir şerit gösterir (ErrorToast'ın başarı ikizi). Bloklamaz.
 * API alert.ts deseniyle aynı (queue+notify). Native + web'de aynı çalışır.
 */
export type ToastTone = "success" | "info";

export type ToastRequest = { id: number; message: string; tone: ToastTone };

let seq = 0;
let current: ToastRequest | undefined;
let notify: (() => void) | null = null;

/** ToastHost bağlanır (root layout). Dönen fonksiyon aboneliği bırakır. */
export function subscribeToast(fn: () => void): () => void {
  notify = fn;
  return () => { notify = null; };
}

/** Aktif toast (yoksa undefined). */
export function peekToast(): ToastRequest | undefined {
  return current;
}

/** Toast'ı kapat (id eşleşiyorsa). */
export function clearToast(id: number): void {
  if (current?.id === id) current = undefined;
  notify?.();
}

/** Hafif başarı/bilgi bildirimi göster (bloklamaz). Mesaj kısa olmalı (tek satır ideal). */
export function showToast(message: string, tone: ToastTone = "success"): void {
  current = { id: ++seq, message, tone };
  notify?.();
}

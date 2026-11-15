/**
 * SOHBET BAŞLANGICI (2026-11-15).
 *
 * Kural (kullanıcı kararı): "Mesaj gönder" düğmesi karşı tarafa OTOMATİK mesaj YOLLAMAZ. Eskiden altı ayrı yerde
 * düğmeye basınca "… ilanı için bilgi almak istiyorum. Fiyat, stok ve teslimat detayları güncel mi?" gibi hazır bir
 * cümle kullanıcı adına gönderiliyordu; satıcının gelen kutusu birbirinin aynı, kimsenin yazmadığı mesajlarla
 * doluyordu. Artık sohbet BOŞ açılır, mesajı kullanıcı yazar.
 *
 * Yazmaya başlamayı kolaylaştırmak için sohbet boşken öneriler gösterilir; öneriye dokunmak yalnız yazı kutusunu
 * DOLDURUR (göndermez). Belirli bir işlem için sohbet açılıyorsa (ör. ortağın "satışı bildir" isteği) hazır metin
 * yine gönderilmez; taslak olarak kutuya konur (setChatDraft → takeChatDraft).
 */
export type ChatRole = "buyer" | "seller" | "partner";

export function chatStarters(role: ChatRole): string[] {
  if (role === "partner") {
    return [
      "Merhaba, bu ürün için ortak satış şartlarını konuşabilir miyiz?",
      "Komisyon ne zaman ve nasıl ödeniyor?",
      "Elimde bu ürünle ilgilenen bir müşteri var."
    ];
  }
  if (role === "seller") {
    return [
      "Merhaba, nasıl yardımcı olabilirim?",
      "Ürün hâlâ satışta; sorularını yanıtlayabilirim."
    ];
  }
  return [
    "Merhaba, ilan hâlâ güncel mi?",
    "Fiyatta pazarlık payı var mı?",
    "Ürünü nerede görebilirim?",
    "Teslimat nasıl olacak?"
  ];
}

// Sohbet ekranı açılırken yazı kutusuna konacak taslaklar (gönderilmez). Bellekte tutulur; bir kez okunur.
const drafts = new Map<string, string>();

export function setChatDraft(conversationId: string, text: string) {
  if (conversationId && text.trim()) drafts.set(conversationId, text);
}

export function takeChatDraft(conversationId: string | undefined): string | undefined {
  if (!conversationId) return undefined;
  const text = drafts.get(conversationId);
  if (text !== undefined) drafts.delete(conversationId);
  return text;
}

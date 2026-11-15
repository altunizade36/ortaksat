/**
 * SOHBET BALONCUĞU BİÇİMİ — üç sohbet arayüzü (telefon web, masaüstü, uygulama) aynı kuralı kullanır (2026-11-15).
 *
 * Eskiden her baloncuk aynı köşelere sahipti (uygulamada gruplama hiç yoktu, her mesajda saat yazıyordu). Art arda gelen
 * mesajlar tek bir blok gibi okunsun diye köşeler grup içindeki yere göre değişir:
 * - gönderenin tarafındaki köşeler grup İÇİNDE küçük (6), grubun ilk baloncuğunun üstü tam yuvarlak (18);
 * - grubun SON baloncuğunda gönderen tarafındaki alt köşe "kuyruk" gibi sivri (4);
 * - karşı taraftaki köşeler her zaman tam yuvarlak.
 */
const ROUND = 18;
const TIGHT = 6;
const TAIL = 4;

export function bubbleRadius(mine: boolean, grouped: boolean, lastOfGroup: boolean) {
  const top = grouped ? TIGHT : ROUND;
  const bottom = lastOfGroup ? TAIL : TIGHT;
  return mine
    ? { borderTopLeftRadius: ROUND, borderBottomLeftRadius: ROUND, borderTopRightRadius: top, borderBottomRightRadius: bottom }
    : { borderTopRightRadius: ROUND, borderBottomRightRadius: ROUND, borderTopLeftRadius: top, borderBottomLeftRadius: bottom };
}

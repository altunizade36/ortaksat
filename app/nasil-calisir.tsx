import { InfoPage } from "@/components/info-page";

export default function HowItWorksScreen() {
  return (
    <InfoPage
      title="Nasıl çalışır?"
      intro="Ortak satış üç adımda: ilanını aç, ortakların paylaşsın, satışta komisyon kazan."
      sections={[
        {
          heading: "1 · İlanını aç",
          body: "Ürünü, fiyatı, stoğu ve ortaklara vereceğin komisyonu belirle. Ortaklığı herkese açık ya da onaylı seçebilirsin."
        },
        {
          heading: "2 · Ortaklar paylaşsın",
          body: "Onaylanan her ortak için benzersiz bir referans bağlantısı oluşur (ortaksat.com/i/urun?ref=KOD). Ortak bu bağlantıyı WhatsApp, Instagram, TikTok veya kendi çevresinde paylaşır."
        },
        {
          heading: "3 · Talep gelir, satışa dönüşür",
          body: "Alıcı bağlantıdan gelip talep oluşturur. Satıcı talebi görüşüp satışa çevirir. Komisyon otomatik olarak bekliyor → onaylandı → ödendi durumlarıyla takip edilir."
        },
        {
          heading: "Komisyon ne zaman ödenir?",
          body: "Satış satıcı tarafından onaylandığında komisyon ortak panelinde görünür. İlk sürümde komisyon takibi panelde yapılır; ödeme akışı ilerleyen sürümlerde otomatikleşecektir."
        }
      ]}
    />
  );
}

import { InfoPage } from "@/components/info-page";

export default function BlogScreen() {
  return (
    <InfoPage
      title="Blog & Rehber"
      intro="Ortak satışla kazanmanın yolları, satıcı ve ortak ipuçları yakında burada."
      sections={[
        {
          heading: "Yakında",
          body: "Komisyonla kazanç, güvenli satış, iyi ilan yazma ve ortak satış stratejileri üzerine rehber içerikler hazırlıyoruz. Takipte kal."
        }
      ]}
    />
  );
}

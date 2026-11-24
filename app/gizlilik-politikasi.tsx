import { LegalDoc } from "@/components/legal-doc";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "@/lib/privacy-policy";

// Gizlilik Politikası sayfası — metin lib/privacy-policy.ts içinde (giriş ekranıyla ortak tek kaynak).

export default function GizlilikPolitikasi() {
  return (
    <LegalDoc
      title="Gizlilik Politikası"
      path="/gizlilik-politikasi"
      updated={PRIVACY_UPDATED}
      seoDescription="OrtakSat Gizlilik Politikası: hangi verileri topladığımız, nasıl kullandığımız, üçüncü taraf hizmetler ve KVKK kapsamındaki haklarınız."
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
    />
  );
}

import { useLocalSearchParams } from "expo-router";

import { ContentPageView } from "@/components/content-page-view";

/**
 * Admin panelden eklenen ekstra içerik sayfaları (guvenli-alisveris,
 * ortak-satis-kurallari, yasakli-urunler vb.) için genel route.
 * /sayfa/<slug> -> content_pages tablosundan render.
 */
export default function GenericContentPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ContentPageView slug={slug ?? ""} />;
}

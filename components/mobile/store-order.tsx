import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { displayListingTitle } from "@/lib/listing-title";
import { listingPhotos } from "@/lib/mobile-listing";
import { moneyIn } from "@/lib/format";
import { saveStoreOrder, sortByStoreOrder } from "@/lib/store-order";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";
import { IconButton, MobileBottomNav, MobileButton, MobileCard, MobileScreen, mobile, ms } from "./ui";

/**
 * MAĞAZA SIRASI ekranı (/magaza-sirasi; uygulama + web): satıcı yayındaki ilanlarını mağazasında görünmesini
 * istediği sıraya koyar. Sıra yalnız "Sırayı Kaydet" ile yazılır (bkz. lib/store-order.ts); kaydetmeden çıkılırsa
 * hiçbir şey değişmez.
 */
export function MobileStoreOrder() {
  const store = useStore(), router = useRouter(), goBack = useBackNavigation();
  const active = store.listings.filter((l) => l.ownerId === store.currentUser.id && l.status === "active");
  // Kullanıcının ekranda kurduğu sıra; null = henüz dokunmadı (mağazadaki güncel sıra gösterilir).
  const [draft, setDraft] = useState<string[] | null>(null), [saving, setSaving] = useState(false);
  const current = sortByStoreOrder(active).map((l) => l.id);
  // İlan listesi arkada yenilenirse (silinen/eklenen ilan) taslak sıra geçerli kimliklerle sınırlanır, yeniler başa eklenir.
  const ids = draft ? [...current.filter((id) => !draft.includes(id)), ...draft.filter((id) => current.includes(id))] : current;
  const byId = new Map(active.map((l) => [l.id, l] as const));
  const dirty = !!draft && ids.join() !== current.join();
  function move(index: number, to: number) {
    if (to < 0 || to >= ids.length || to === index) return;
    const next = [...ids];
    const [id] = next.splice(index, 1);
    next.splice(to, 0, id);
    setDraft(next);
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (!(await saveStoreOrder(ids))) { showToast("Sıra kaydedilemedi. Tekrar dene."); return; }
      showToast("Mağaza sırası kaydedildi.");
      await Promise.all([store.refreshUserData(), store.refreshMarketplace()]).catch(() => {});
      setDraft(null);
    } finally { setSaving(false); }
  }
  return <MobileScreen title="Mağaza Sırası" bottom={<MobileBottomNav active="menu" />}>
    <MobileCard style={{ backgroundColor: mobile.tealSoft }}>
      <Text style={ms.section}>İlanlarını istediğin sıraya koy</Text>
      <Text style={ms.muted}>Mağazanda ilanlar bu sırayla görünür. Oklarla yukarı ya da aşağı taşı, yıldızla en başa al. Sonradan eklediğin yeni ilan kendiliğinden en başa gelir.</Text>
    </MobileCard>
    {ids.map((id, index) => { const l = byId.get(id); if (!l) return null; const title = displayListingTitle(l.title); return <MobileCard key={id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ width: 24, textAlign: "center", fontWeight: "800", color: mobile.teal }}>{index + 1}</Text>
      <SafeRemoteImage uri={listingPhotos(l)[0]} style={{ width: 52, height: 52, borderRadius: 8 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontWeight: "700", fontSize: 13, color: mobile.ink }}>{title}</Text>
        {l.price > 0 && <Text style={{ fontWeight: "800", color: mobile.teal }}>{moneyIn(l.price, l.currency)}</Text>}
      </View>
      <IconButton name="star-outline" label={`${title}: en başa al`} color={index === 0 ? mobile.line : mobile.teal} onPress={() => move(index, 0)} />
      <IconButton name="chevron-up" label={`${title}: yukarı taşı`} color={index === 0 ? mobile.line : mobile.ink} onPress={() => move(index, index - 1)} />
      <IconButton name="chevron-down" label={`${title}: aşağı taşı`} color={index === ids.length - 1 ? mobile.line : mobile.ink} onPress={() => move(index, index + 1)} />
    </MobileCard>; })}
    {!ids.length && <MobileCard>
      <Text style={ms.section}>{store.accountLoaded ? "Sıralanacak yayında ilan yok" : "İlanların yükleniyor…"}</Text>
      {store.accountLoaded && <><Text style={ms.muted}>Mağaza sırası yalnız yayındaki ilanlar için geçerlidir.</Text><MobileButton icon="plus" onPress={() => router.push("/create")}>İlan Ver</MobileButton></>}
    </MobileCard>}
    {ids.length > 0 && <View style={[ms.row, { marginTop: 8 }]}>
      <MobileButton secondary style={{ flex: 1 }} disabled={saving} onPress={goBack}>{dirty ? "Vazgeç" : "Geri Dön"}</MobileButton>
      <MobileButton style={{ flex: 1 }} disabled={saving || !dirty} onPress={() => void save()}>{saving ? "Kaydediliyor…" : "Sırayı Kaydet"}</MobileButton>
    </View>}
    {ids.length > 0 && <MobileButton secondary icon="storefront-outline" style={{ marginTop: 10 }} onPress={() => router.push(`/store/${store.currentUser.id}` as never)}>Mağazamı Gör</MobileButton>}
  </MobileScreen>;
}

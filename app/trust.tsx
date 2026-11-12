import { TrustPage } from "@/components/trust/screen";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileScreen, mobile } from "@/components/mobile/ui";
import { TrustEntry } from "@/components/trust/entry";
import { Seo } from "@/components/seo";
import { useStore } from "@/lib/use-store";
import { showToast } from "@/lib/toast";
import type { ModerationStatus, Report } from "@/lib/types";

const statuses: Record<ModerationStatus, string> = { open: "Açık", reviewing: "İnceleniyor", resolved: "Sonuçlandı", rejected: "Reddedildi" };

/** Existing complaint/moderation actions remain; heuristic trust percentages are retired. */
export default function TrustScreen() {
  const router = useRouter(), { currentUser, isAuthenticated, reports, updateReportStatus, findListing } = useStore();
  const [filter, setFilter] = useState("all"), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState("");
  const flight = useRef(false);
  const staff = ["admin", "moderator", "super_admin"].includes(currentUser.role || "user");
  const own = isAuthenticated ? reports.filter(r => staff || r.reporterId === currentUser.id || r.reportedUserId === currentUser.id) : [];
  const visible = own.filter(r => filter === "all" || (filter === "open" ? ["open", "reviewing"].includes(r.status) : ["resolved", "rejected"].includes(r.status)));
  async function change(report: Report, status: ModerationStatus) {
    if (flight.current) return; flight.current = true; setBusy(report.id); setError("");
    try { if (await updateReportStatus(report.id, status)) showToast("İnceleme kaydı güncellendi."); else setError("Kayıt güncellenemedi. Yetkini ve bağlantını kontrol et."); }
    catch { setError("Kayıt güncellenemedi. Tekrar deneyebilirsin."); }
    finally { flight.current = false; setBusy(null); }
  }
  return <TrustPage title="Güven ve Şikâyet Merkezi" active="menu">
    <Seo title="Güven ve Şikâyet Merkezi | OrtakSat" description="İnceleme kayıtları ve güvenli işlem bilgileri." noindex />
    <View style={{ gap: 14 }}>
      <MobileCard><Text style={{ color: mobile.ink, fontSize: 20, fontWeight: "700", marginBottom: 10 }}>Gerçek işlem geçmişine dayanan güven</Text><Text style={{ color: mobile.muted, lineHeight: 22 }}>Profil doluluğu, reddedilen başvuru veya açık şikâyet bir kullanıcıya risk puanı vermez. Doğrulanmış işlem karneleri hazır olduğunda satıcı, satış ortağı ve alıcı için ayrı gösterilir.</Text></MobileCard>
      <TrustEntry />
      {!isAuthenticated && <MobileButton onPress={() => router.push("/auth?redirect=%2Ftrust")}>Kayıtlarım için giriş yap</MobileButton>}
      {isAuthenticated && <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[["all", "Tümü"], ["open", "Açık incelemeler"], ["resolved", "Sonuçlananlar"]].map(([key, label]) => <MobileChip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />)}</View>
        {!!error && <Text accessibilityRole="alert" style={{ color: "#A12639" }}>{error}</Text>}
        {!visible.length && <MobileCard><Text style={{ color: mobile.muted }}>Bu görünümde inceleme kaydı bulunmuyor.</Text></MobileCard>}
        {visible.map(r => <MobileCard key={r.id}><Text style={{ color: mobile.ink, fontWeight: "700", fontSize: 17 }}>{r.reason}</Text><Text style={{ color: mobile.muted, lineHeight: 22 }}>{r.details}</Text><Text style={{ color: mobile.teal }}>{statuses[r.status]} · {new Date(r.createdAt).toLocaleDateString("tr-TR")}</Text>{r.listingId && findListing(r.listingId) && <MobileButton secondary onPress={() => router.push(`/listing/${r.listingId}`)}>İlanı incele</MobileButton>}{staff && <View style={{ gap: 8 }}>{(["reviewing", "resolved", "rejected"] as ModerationStatus[]).filter(s => s !== r.status).map(s => <MobileButton key={s} secondary disabled={!!busy} onPress={() => void change(r, s)}>{statuses[s]}</MobileButton>)}</View>}</MobileCard>)}
      </>}
      <MobileCard><Text style={{ color: mobile.ink, fontWeight: "700", marginBottom: 8 }}>Açık itiraz kesinleşmiş ihlal değildir</Text><Text style={{ color: mobile.muted, lineHeight: 22 }}>İnceleme sürecinde taraflara cevap hakkı tanınır. Alıcının satın almaktan vazgeçmesi tek başına olumsuz güven değerlendirmesi oluşturmaz.</Text></MobileCard>
      <MobileButton secondary onPress={() => router.push("/guvenli-alisveris")}>Güvenli alışveriş rehberi</MobileButton>
    </View>
  </TrustPage>;
}

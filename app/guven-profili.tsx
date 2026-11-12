import { TrustPage } from "@/components/trust/screen";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileScreen, mobile } from "@/components/mobile/ui";
import { Seo } from "@/components/seo";
import { trustCapabilities, trustError, trustProfile } from "@/lib/trust-v1/api";
import { badgeLabels, reviewCriteria, roleLabels, type TrustProfile, type TrustRole } from "@/lib/trust-v1/model";
import { useStore } from "@/lib/use-store";

export default function TrustProfileScreen() {
  const params = useLocalSearchParams<{ user?: string; role?: string }>(), { currentUser, isAuthenticated } = useStore(), router = useRouter();
  const userId = params.user || (isAuthenticated ? currentUser.id : "");
  const [profile, setProfile] = useState<TrustProfile>(), [role, setRole] = useState<TrustRole>(params.role === "partner" || params.role === "buyer" ? params.role : "seller"), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const seq = ++generation.current; let live = true;
    setLoading(true); setError(""); setProfile(undefined);
    void (async () => {
      try {
        const caps = await trustCapabilities();
        const result = caps.enabled && userId ? await trustProfile(userId) : { enabled: false };
        if (live && seq === generation.current) setProfile(result);
      } catch (e) { if (live && seq === generation.current) setError(trustError(e)); }
      finally { if (live && seq === generation.current) setLoading(false); }
    })();
    return () => { live = false; };
  }, [userId, attempt]);
  const score = profile?.roles?.[role];
  return <TrustPage title="Kullanıcı Güven Karnesi" active="menu">
    <Seo title="Güven Karnesi | OrtakSat" description="Gerçek ve doğrulanmış işlem geçmişine dayanan rol bazlı değerlendirmeler." noindex />
    <View style={s.stack}>
      {loading && <ActivityIndicator accessibilityLabel="Güven karnesi yükleniyor" color={mobile.teal} />}
      {!!error && <MobileCard><Text accessibilityRole="alert" style={s.body}>{error}</Text><MobileButton secondary onPress={() => setAttempt(v => v + 1)}>Tekrar dene</MobileButton></MobileCard>}
      {profile && !profile.enabled && <MobileCard><Text style={s.heading}>Güven Karnesi hazırlanıyor</Text><Text style={s.body}>Gerçek işlem verileriyle çalışacak sistem henüz kullanıma açılmadı.</Text></MobileCard>}
      {profile?.enabled && <>
        <MobileCard><Text accessibilityRole="header" style={s.heading}>{profile.user?.full_name || "OrtakSat kullanıcısı"}</Text><Text style={s.body}>Üyelik: {profile.user?.created_at ? new Date(profile.user.created_at).toLocaleDateString("tr-TR") : "—"}</Text>
          <View style={s.chips}>{profile.badges?.map(b => <View key={b} style={s.badge}><Text style={s.badgeText}>{badgeLabels[b] || "İşlem bilgisi"}</Text></View>)}</View>
        </MobileCard>
        <View style={s.chips}>{(["seller", "partner", "buyer"] as TrustRole[]).map(r => <MobileChip key={r} label={roleLabels[r]} selected={role === r} onPress={() => setRole(r)} />)}</View>
        {score && <MobileCard><Text style={s.heading}>{roleLabels[role]} değerlendirmesi</Text>
          <Text style={s.rating}>{score.rating == null ? "Henüz puan yok" : `${score.rating.toFixed(1)} / 5`}</Text>
          <Text style={s.body}>{score.reviewCount} görünür değerlendirme · {score.verifiedTransactions} doğrulanmış işlem</Text>
          {score.mutualPaymentCount != null && <Text style={s.body}>{score.mutualPaymentCount} komisyon ödemesi taraflarca doğrulandı.</Text>}
          {score.paymentConfirmationPercent != null && <Text style={s.body}>Vadesi gelmiş / doğrulanmış komisyonlarda karşılıklı doğrulama: %{score.paymentConfirmationPercent}</Text>}
          <Text style={s.body}>{score.openDisputes} açık inceleme · {score.resolvedDisputes} sonuçlanan itiraz</Text>
          <Text style={s.body}>Açık inceleme ihlal kararı değildir. İşlem geçmişi bulunmaması olumsuz puan oluşturmaz.</Text>
        </MobileCard>}
        <MobileCard><Text style={s.heading}>Değerlendirme ölçütleri</Text>{reviewCriteria[role].map(c => <Text key={c.key} style={s.body}>• {c.label}</Text>)}
          <Text style={s.body}>Yalnızca doğrulanmış işlem tarafları değerlendirebilir. Karşılıklı yorumlar gönderilene veya 14 gün dolana kadar değerlendirmeler gizli kalır.</Text>
        </MobileCard>
        <MobileCard><Text style={s.heading}>Etiketler nasıl verilir?</Text><Text style={s.body}>Olumlu işlem geçmişi: aynı rolde en az 5 doğrulanmış işlem, 5 görünür değerlendirme ve en az 4/5 ortalama. Olumlu komisyon geçmişi: en az 5 vadesi gelen / doğrulanan komisyonun tamamının taraflarca doğrulanması ve bekleyen ödeme kaydı olmaması.</Text><Text style={s.body}>Yüzdeler en az 10 uygun kayıt olduğunda gösterilir. Ödeme doğrulaması tarafların onayına dayanır; banka teyidi değildir. Kısıtlama yalnızca gerekçeli, sonuçlanmış inceleme ve yetkili kararıyla uygulanır.</Text></MobileCard>
      </>}
      <MobileButton secondary onPress={() => router.push("/guven-merkezi")}>İşlem merkezine git</MobileButton>
    </View>
  </TrustPage>;
}
const s = StyleSheet.create({ stack: { gap: 14 }, heading: { color: mobile.ink, fontSize: 20, fontWeight: "700", marginBottom: 8 }, body: { color: "#5C687A", fontSize: 14, lineHeight: 22, marginBottom: 8 }, rating: { color: mobile.teal, fontSize: 26, fontWeight: "700", marginVertical: 10 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, badge: { borderRadius: 10, padding: 9, backgroundColor: "#E8EEF7" }, badgeText: { color: "#00347D", fontSize: 13 } });

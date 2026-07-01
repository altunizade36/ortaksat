import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { EmptyState } from "@/components/ui";
import { commissionAmount, money } from "@/lib/format";
import { useIsWideWeb } from "@/lib/layout";
import { getDistrict, getProvince } from "@/lib/locations";
import { fetchAdminAudit, type AuditEntry, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import type { SaleStatus, SuggestionStatus, UserRole } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type Section =
  | "dashboard" | "users" | "listings" | "partnerships" | "complaints" | "categories" | "locations"
  | "messages" | "commissions" | "stats" | "notifications" | "content" | "blog" | "seo" | "settings" | "reports";

const NAV: Array<{ key: Section; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
  { key: "dashboard", icon: "view-dashboard-outline", label: "Dashboard" },
  { key: "users", icon: "account-group-outline", label: "Kullanıcılar" },
  { key: "listings", icon: "file-document-outline", label: "İlanlar" },
  { key: "partnerships", icon: "handshake-outline", label: "Ortak Satış Talepleri" },
  { key: "complaints", icon: "flag-outline", label: "Şikayetler" },
  { key: "categories", icon: "shape-outline", label: "Kategoriler" },
  { key: "locations", icon: "map-marker-outline", label: "Konum Önerileri" },
  { key: "messages", icon: "message-text-outline", label: "Mesajlar" },
  { key: "commissions", icon: "cash-multiple", label: "Komisyon Kayıtları" },
  { key: "stats", icon: "chart-line", label: "İstatistikler" },
  { key: "notifications", icon: "bell-outline", label: "Bildirimler" },
  { key: "content", icon: "file-edit-outline", label: "Site İçerikleri" },
  { key: "blog", icon: "post-outline", label: "Blog Yönetimi" },
  { key: "seo", icon: "magnify-scan", label: "SEO Yönetimi" },
  { key: "settings", icon: "cog-outline", label: "Ayarlar" },
  { key: "reports", icon: "chart-box-outline", label: "Raporlar" }
];

// Güvenlik: mesajlarda geçince "riskli konuşma" işaretlenecek kelimeler.
const RISK_WORDS = ["iban", "havale", "eft", "kapora", "kaparo", "site dışı", "whatsapp", "telegram", "dolandırıcı", "dolandiri", "sahte", "acil gönder", "papara", "western union", "hesap numaras", "kart numaras", "kripto", "bitcoin"];
function conversationRisk(bodies: string[]): string | null {
  const hay = bodies.join(" ").toLocaleLowerCase("tr-TR");
  for (const w of RISK_WORDS) if (hay.includes(w)) return w;
  return null;
}

const PARTNERSHIP_TONE: Record<string, { tint: string; color: string; label: string }> = {
  pending: { tint: "#FFF2CC", color: "#B8860B", label: "Bekliyor" },
  active: { tint: "#DDF8E9", color: "#0A7A56", label: "Kabul edildi" },
  approved: { tint: "#DDF8E9", color: "#0A7A56", label: "Kabul edildi" },
  rejected: { tint: "#FCE8E8", color: "#C0392B", label: "Reddedildi" },
  cancelled: { tint: "#EEF1F4", color: "#6B7280", label: "İptal" },
  completed: { tint: "#DDF8E9", color: "#0A7A56", label: "Tamamlandı" }
};

const STATUS_TONE: Record<SuggestionStatus, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.warningSoft, color: colors.warning, label: "İncelemede" },
  approved: { tint: colors.successSoft, color: colors.success, label: "Onaylandı" },
  rejected: { tint: colors.accentSoft, color: colors.accent, label: "Reddedildi" }
};
const SALE_TONE: Record<SaleStatus, { tint: string; color: string; label: string }> = {
  pending: { tint: colors.warningSoft, color: colors.warning, label: "Bekliyor" },
  return_pending: { tint: colors.warningSoft, color: colors.warning, label: "İade süresi" },
  approved: { tint: colors.infoSoft, color: colors.info, label: "Onaylandı" },
  seller_paid: { tint: colors.goldSoft, color: colors.gold, label: "Onay bekliyor" },
  paid: { tint: colors.successSoft, color: colors.success, label: "Tamamlandı" },
  cancelled: { tint: colors.surfaceAlt, color: colors.muted, label: "İptal" },
  disputed: { tint: colors.accentSoft, color: colors.accent, label: "İtiraz" }
};

// Son 12 ay — gerçek veri: yayınlanan ilanların aya göre dağılımı.
function monthlyListingChart(listings: Array<{ createdAt: string }>): { data: number[]; labels: string[] } {
  const MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const now = new Date();
  const data = new Array(12).fill(0) as number[];
  const labels = new Array(12).fill("") as string[];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    labels[i] = MON[d.getMonth()];
  }
  for (const l of listings) {
    const d = new Date(l.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 12) data[11 - monthsAgo] += 1;
  }
  return { data, labels };
}

function AdminScreenInner() {
  const isWideWeb = useIsWideWeb();
  const router = useRouter();
  const {
    listings, users, sales, partnerships, leads, conversations, messages, notifications,
    categorySuggestions, locationSuggestions, setCategorySuggestionStatus, setLocationSuggestionStatus,
    updateListingStatus, setListingFeatured, deleteListing, findUser, signOut, currentUser, reports, updateReportStatus,
    platformSettings, updatePlatformSetting, setAnnouncement, setUserRole, setUserStatus,
    setUserVerification, adminNotifyUser, adminBroadcast,
    blogPosts, contentPages, seoSettings, saveBlogPost, deleteBlogPost, saveContentPage, saveSeoSetting,
    categoryTree, extraCategories, saveCategory, deleteCategory
  } = useStore();
  const [annText, setAnnText] = useState(platformSettings.announcement);
  const canManageUsers = currentUser.role === "admin" || currentUser.role === "super_admin";
  const [userQuery, setUserQuery] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [listingFilter, setListingFilter] = useState<"all" | "pending" | "active" | "rejected" | "paused" | "featured">("all");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "suspended" | "seller" | "staff">("all");
  const [msgFilter, setMsgFilter] = useState<"all" | "risky">("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const uq = userQuery.trim().toLocaleLowerCase("tr-TR");
  const lq = listingQuery.trim().toLocaleLowerCase("tr-TR");

  const liveUsers = users.filter((u) => u.status !== "deleted");
  const deletedUserCount = users.length - liveUsers.length;
  const userFiltered = liveUsers.filter((u) => {
    if (userFilter === "active") return u.status !== "suspended";
    if (userFilter === "suspended") return u.status === "suspended";
    if (userFilter === "seller") return (u.listingCount ?? 0) > 0;
    if (userFilter === "staff") return u.role === "admin" || u.role === "moderator" || u.role === "super_admin";
    return true;
  });
  const shownUsers = uq ? userFiltered.filter((u) => u.name.toLocaleLowerCase("tr-TR").includes(uq) || (u.role ?? "").includes(uq) || (u.status ?? "").includes(uq)) : userFiltered;

  const listingFiltered = listingFilter === "all" ? listings : listingFilter === "featured" ? listings.filter((l) => l.featured) : listingFilter === "pending" ? listings.filter((l) => l.status === "pending_review") : listings.filter((l) => l.status === listingFilter);
  const shownListings = lq ? listingFiltered.filter((l) => l.title.toLocaleLowerCase("tr-TR").includes(lq) || l.category.toLocaleLowerCase("tr-TR").includes(lq) || (findUser(l.ownerId)?.name ?? "").toLocaleLowerCase("tr-TR").includes(lq) || l.status.includes(lq)) : listingFiltered;

  function promptNotify(userId: string, name: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const msg = window.prompt(`${name} kullanıcısına bildirim gönder:`, "");
      if (msg && msg.trim()) adminNotifyUser(userId, "OrtakSat Yönetimi", msg.trim());
    } else {
      adminNotifyUser(userId, "OrtakSat Yönetimi", "Yönetimden bilgilendirme.");
    }
  }
  const [section, setSection] = useState<Section>("dashboard");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ logs: AuditEntry[]; rateHits: number } | null>(null);

  useEffect(() => {
    fetchAdminAudit().then(setAudit).catch(() => setAudit(null));
  }, []);

  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator";
  const activeListings = listings.filter((l) => l.status === "active");
  const pendingReview = listings.filter((l) => l.status === "pending_review");
  const totalCommission = sales.reduce((s, x) => s + x.commissionAmount, 0);
  const pendingCat = categorySuggestions.filter((s) => s.status === "pending").length;
  const pendingLoc = locationSuggestions.filter((s) => s.status === "pending").length;
  const pendingReports = reports.filter((r) => r.status === "open" || r.status === "reviewing").length;
  const pendingPartnerships = partnerships.filter((p) => p.status === "pending").length;

  // Son 12 ay — gerçek veri: aya göre yayınlanan ilan sayısı (kayıtlı veriden).
  const { data: chartData, labels: chartLabels } = useMemo(() => monthlyListingChart(listings), [listings]);

  const navBadge = (k: Section) => (k === "categories" ? pendingCat : k === "locations" ? pendingLoc : k === "listings" ? pendingReview.length : k === "complaints" ? pendingReports : k === "partnerships" ? pendingPartnerships : 0);

  return (
    <View style={{ backgroundColor: colors.background, flex: 1, flexDirection: isWideWeb ? "row" : "column", minHeight: "100%" }}>
      {/* Sidebar */}
      {isWideWeb ? (
        <View style={{ backgroundColor: "#0A5C44", gap: 4, paddingHorizontal: 12, paddingVertical: 18, width: 240 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 9, paddingHorizontal: 8, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="shield-crown" size={24} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "900" }}>OrtakSat <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Admin</Text></Text>
          </View>
          <View style={{ height: 8 }} />
          {NAV.map((n) => {
            const on = section === n.key;
            const badge = navBadge(n.key);
            return (
              <Pressable key={n.key} onPress={() => setSection(n.key)} style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.16)" : "transparent", borderRadius: 10, flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
                <MaterialCommunityIcons name={n.icon} size={18} color={on ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
                <Text style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.8)", flex: 1, fontSize: 13.5, fontWeight: on ? "900" : "700" }}>{n.label}</Text>
                {badge ? <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Link href="/" asChild>
            <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name="storefront-outline" size={18} color="rgba(255,255,255,0.7)" />
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5, fontWeight: "700" }}>Siteye dön</Text>
            </Pressable>
          </Link>
          <Pressable onPress={() => { void signOut(); router.replace("/"); }} style={{ alignItems: "center", flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
            <MaterialCommunityIcons name="logout" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5, fontWeight: "700" }}>Çıkış Yap</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: "#0A5C44", maxHeight: 56 }} contentContainerStyle={{ alignItems: "center", gap: 6, paddingHorizontal: 10 }}>
          <Link href="/" asChild>
            <Pressable style={{ alignItems: "center", borderColor: "rgba(255,255,255,0.3)", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
              <MaterialCommunityIcons name="storefront-outline" size={15} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>Site</Text>
            </Pressable>
          </Link>
          {NAV.map((n) => {
            const on = section === n.key;
            return (
              <Pressable key={n.key} onPress={() => setSection(n.key)} style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.18)" : "transparent", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
                <MaterialCommunityIcons name={n.icon} size={15} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: on ? "900" : "700" }}>{n.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, padding: isWideWeb ? 24 : 14, paddingBottom: 60 }}>
        {!isAdmin ? (
          <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 10, padding: 12 }}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600" }}>Önizleme: bu panel canlıda yalnızca admin/moderatör rolündeki hesaplarda görünür. Demo amaçlı tüm içerik gösteriliyor.</Text>
          </View>
        ) : null}

        {section === "dashboard" ? (
          <Dashboard
            usersN={liveUsers.length} listingsN={listings.length} salesN={sales.length} commission={totalCommission}
            activeN={activeListings.length} pendingN={pendingReview.length} reportsN={pendingReports} partnershipsN={pendingPartnerships} messagesN={messages.length}
            listings={listings} users={users} findUser={findUser} notifications={notifications} leads={leads} setSection={setSection}
          />
        ) : null}

        {section === "users" ? (
          <Panel title="Kullanıcılar" sub={`${shownUsers.length} aktif kullanıcı${deletedUserCount ? ` · ${deletedUserCount} silinmiş (gizli)` : ""}${canManageUsers ? " · rol, durum, doğrulama, bildirim" : ""}`}>
            <AdminSearch value={userQuery} onChange={setUserQuery} placeholder="İsim, rol veya durum ara…" />
            <FilterChips value={userFilter} onChange={setUserFilter} options={[
              { key: "all", label: "Tümü", count: liveUsers.length },
              { key: "active", label: "Aktif" },
              { key: "suspended", label: "Askıda", count: liveUsers.filter((u) => u.status === "suspended").length },
              { key: "seller", label: "Satıcı" },
              { key: "staff", label: "Yönetici", count: liveUsers.filter((u) => u.role === "admin" || u.role === "moderator" || u.role === "super_admin").length }
            ]} />
            {detailUserId ? (() => {
              const du = users.find((x) => x.id === detailUserId);
              if (!du) return null;
              const uListings = listings.filter((l) => l.ownerId === du.id);
              const uPartner = partnerships.filter((p) => p.partnerId === du.id);
              const uReports = reports.filter((r) => r.reportedUserId === du.id);
              const uMsgs = messages.filter((m) => m.senderId === du.id || m.receiverId === du.id).length;
              return (
                <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 12, padding: 14 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                    <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{du.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{du.phone || "telefon yok"} · {du.role ?? "user"} · {du.status ?? "active"} · ⭐ {du.rating}</Text>
                    </View>
                    <Pressable onPress={() => setDetailUserId(null)} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} /></Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    <MiniStat label="İlan" value={`${uListings.length}`} />
                    <MiniStat label="Ortaklık" value={`${uPartner.length}`} />
                    <MiniStat label="Mesaj" value={`${uMsgs}`} />
                    <MiniStat label="Şikayet" value={`${uReports.length}`} tone={uReports.length ? "accent" : undefined} />
                    <MiniStat label="Satış" value={`${du.successfulSales}`} />
                  </View>
                  {uListings.length ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>İlanları</Text>
                      {uListings.slice(0, 6).map((l) => (
                        <View key={l.id} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                          <MaterialCommunityIcons name="circle-small" size={16} color={colors.primary} />
                          <Link href={{ pathname: "/listing/[id]", params: { id: l.id } }} asChild><Pressable style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{l.title}</Text></Pressable></Link>
                          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{l.status === "active" ? "Yayında" : l.status === "pending_review" ? "İncelemede" : l.status}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {uReports.length ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Hakkındaki şikayetler</Text>
                      {uReports.slice(0, 4).map((r) => <Text key={r.id} numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>• {r.reason}{r.details ? ` — ${r.details}` : ""}</Text>)}
                    </View>
                  ) : null}
                </View>
              );
            })() : null}
            <Table head={["KULLANICI", "ROL", "DURUM", "DOĞRULAMA", "İŞLEM"]} cols={[1.8, 1.5, 1, 1.1, 2]}>
              {shownUsers.map((u) => {
                const suspended = u.status === "suspended";
                const isSelf = u.id === currentUser.id;
                const roles: UserRole[] = ["user", "moderator", "admin"];
                return (
                  <Row key={u.id} cols={[1.8, 1.5, 1, 1, 1.8]} cells={[
                    <Pressable onPress={() => setDetailUserId(detailUserId === u.id ? null : u.id)} style={{ gap: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{u.name}{isSelf ? " (sen)" : ""}</Text>
                      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "600" }}>Detay için tıkla · ⭐ {u.rating}</Text>
                    </Pressable>,
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {roles.map((r) => {
                          const on = (u.role ?? "user") === r || (r === "user" && !["moderator", "admin", "super_admin"].includes(u.role ?? "user"));
                          return (
                            <Pressable key={r} onPress={() => setUserRole(u.id, r)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 }}>
                              <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 10.5, fontWeight: "800" }}>{r === "user" ? "Üye" : r === "moderator" ? "Mod" : "Admin"}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{u.role === "admin" || u.role === "super_admin" ? "Admin" : u.role === "moderator" ? "Moderatör" : "Üye"}</Text>
                    ),
                    <View style={{ alignSelf: "flex-start", backgroundColor: suspended ? colors.accentSoft : colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: suspended ? colors.accent : colors.success, fontSize: 10, fontWeight: "900" }}>{suspended ? "Askıda" : "Aktif"}</Text></View>,
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable onPress={() => setUserVerification(u.id, "verifiedPhone", !u.verifiedPhone)}>
                          <MaterialCommunityIcons name="phone-check" size={17} color={u.verifiedPhone ? colors.success : colors.line} />
                        </Pressable>
                        <Pressable onPress={() => setUserVerification(u.id, "verifiedIdentity", !u.verifiedIdentity)}>
                          <MaterialCommunityIcons name="card-account-details-outline" size={17} color={u.verifiedIdentity ? colors.success : colors.line} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {u.verifiedPhone ? <MaterialCommunityIcons name="phone-check" size={15} color={colors.success} /> : null}
                        {u.verifiedIdentity ? <MaterialCommunityIcons name="card-account-details-outline" size={15} color={colors.success} /> : null}
                        {u.verifiedInstagram ? <MaterialCommunityIcons name="instagram" size={15} color={colors.violet} /> : null}
                      </View>
                    ),
                    canManageUsers && !isSelf ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        <Pressable onPress={() => setUserStatus(u.id, suspended ? "active" : "suspended")} style={{ alignItems: "center", backgroundColor: suspended ? colors.successSoft : colors.accentSoft, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <MaterialCommunityIcons name={suspended ? "account-check-outline" : "account-cancel-outline"} size={14} color={suspended ? colors.success : colors.accent} />
                          <Text style={{ color: suspended ? colors.success : colors.accent, fontSize: 11, fontWeight: "800" }}>{suspended ? "Aktifleştir" : "Askıya al"}</Text>
                        </Pressable>
                        <Pressable onPress={() => promptNotify(u.id, u.name)} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <MaterialCommunityIcons name="bell-plus-outline" size={13} color={colors.primaryDark} />
                          <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>Bildirim</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmAction(`${u.name} hesabı silinsin mi? Kullanıcı erişimi kapatılır.`, () => setUserStatus(u.id, "deleted"))} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>Sil</Text>
                        </Pressable>
                      </View>
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>—</Text>
                  ]} />
                );
              })}
            </Table>
            {!canManageUsers ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 8 }}>Rol/durum değiştirme yalnızca admin hesaplarına açıktır (sen moderatörsün).</Text> : null}
          </Panel>
        ) : null}

        {section === "listings" ? (
          <View style={{ gap: 16 }}>
          {pendingReview.length > 0 ? (
            <Panel title="Moderasyon Kuyruğu" sub={`${pendingReview.length} ilan onay bekliyor`}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                <Pressable onPress={() => pendingReview.forEach((l) => updateListingStatus(l.id, "active"))} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <MaterialCommunityIcons name="check-all" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>Tümünü onayla ({pendingReview.length})</Text>
                </Pressable>
                <Pressable onPress={() => pendingReview.forEach((l) => updateListingStatus(l.id, "rejected"))} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <MaterialCommunityIcons name="close-box-multiple-outline" size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Tümünü reddet</Text>
                </Pressable>
              </View>
              <Table head={["İLAN", "KATEGORİ", "SAHİP", "İŞLEM"]} cols={[2.4, 1.3, 1.4, 1.6]}>
                {pendingReview.map((l) => (
                  <Row key={l.id} cols={[2.4, 1.3, 1.4, 1.6]} cells={[
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{findUser(l.ownerId)?.name ?? "—"}</Text>,
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={() => updateListingStatus(l.id, "active")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}><MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" }}>Onayla</Text></Pressable>
                      <Pressable onPress={() => updateListingStatus(l.id, "rejected")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 6 }}><MaterialCommunityIcons name="close" size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>Reddet</Text></Pressable>
                    </View>
                  ]} />
                ))}
              </Table>
            </Panel>
          ) : null}
          <Panel title="İlanlar" sub={`${activeListings.length} aktif · ${pendingReview.length} incelemede · ${listings.length} toplam${lq ? ` · ${shownListings.length} sonuç` : ""}`}>
            <AdminSearch value={listingQuery} onChange={setListingQuery} placeholder="Başlık, kategori, sahip veya durum ara…" />
            <FilterChips value={listingFilter} onChange={setListingFilter} options={[
              { key: "all", label: "Tümü", count: listings.length },
              { key: "pending", label: "Onay bekleyen", count: pendingReview.length },
              { key: "active", label: "Yayında", count: activeListings.length },
              { key: "paused", label: "Askıda", count: listings.filter((l) => l.status === "paused").length },
              { key: "rejected", label: "Reddedilen", count: listings.filter((l) => l.status === "rejected").length },
              { key: "featured", label: "Öne çıkan", count: listings.filter((l) => l.featured).length }
            ]} />
            <Table head={["İLAN", "KATEGORİ", "FİYAT", "SAHİP", "DURUM", "İŞLEM"]} cols={[2.2, 1.2, 1, 1.4, 1, 1.4]}>
              {shownListings.map((l) => (
                <Row key={l.id} cols={[2.2, 1.2, 1, 1.4, 1, 1.2]} cells={[
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>,
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{money(l.price)}</Text>,
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{findUser(l.ownerId)?.name ?? "—"}</Text>,
                  <View style={{ alignSelf: "flex-start", backgroundColor: l.status === "active" ? colors.successSoft : l.status === "rejected" ? colors.accentSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: l.status === "active" ? colors.success : l.status === "rejected" ? colors.accent : colors.muted, fontSize: 10.5, fontWeight: "900" }}>{l.status === "active" ? "Yayında" : l.status === "rejected" ? "Reddedildi" : l.status === "pending_review" ? "İncelemede" : l.status}</Text></View>,
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Pressable onPress={() => updateListingStatus(l.id, l.status === "active" ? "paused" : "active")}><Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" }}>{l.status === "active" ? "Kaldır" : "Yayınla"}</Text></Pressable>
                    <Pressable onPress={() => setListingFeatured(l.id, !l.featured)}><Text style={{ color: l.featured ? colors.gold : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{l.featured ? "★ Öne çıkan" : "☆ Öne çıkar"}</Text></Pressable>
                    {l.status !== "rejected" ? <Pressable onPress={() => updateListingStatus(l.id, "rejected")}><Text style={{ color: colors.warning, fontSize: 11.5, fontWeight: "800" }}>Reddet</Text></Pressable> : null}
                    <Pressable onPress={() => confirmAction(`"${l.title}" ilanı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`, () => deleteListing(l.id))}><Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "900" }}>Kalıcı Sil</Text></Pressable>
                  </View>
                ]} />
              ))}
            </Table>
          </Panel>
          </View>
        ) : null}

        {section === "partnerships" ? (
          <Panel title="Ortak Satış Talepleri" sub={`${pendingPartnerships} bekliyor · ${partnerships.length} toplam`}>
            {partnerships.length === 0 ? <EmptyState title="Ortak satış talebi yok" body="Bir kullanıcı bir ilana ortak satıcı olmak için başvurduğunda burada görünür." /> : null}
            <Table head={["İLAN", "İLAN SAHİBİ", "ORTAK ADAYI", "KOMİSYON", "DURUM", "TARİH"]} cols={[2, 1.4, 1.4, 1, 1.1, 1]}>
              {partnerships.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt)).map((p) => {
                const listing = listings.find((l) => l.id === p.listingId);
                const owner = listing ? findUser(listing.ownerId) : undefined;
                const partner = findUser(p.partnerId);
                const tone = PARTNERSHIP_TONE[p.status] ?? { tint: colors.surfaceAlt, color: colors.muted, label: p.status };
                const comm = listing ? (listing.commissionType === "rate" ? `%${listing.commissionValue}` : money(listing.commissionValue)) : "—";
                return (
                  <Row key={p.id} cols={[2, 1.4, 1.4, 1, 1.1, 1]} cells={[
                    listing ? (
                      <Link href={{ pathname: "/listing/[id]", params: { id: listing.id } }} asChild>
                        <Pressable><Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{listing.title}</Text></Pressable>
                      </Link>
                    ) : <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{p.listingId.slice(0, 10)}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{owner?.name ?? "—"}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{partner?.name ?? "—"}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{comm}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: tone.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: tone.color, fontSize: 10.5, fontWeight: "900" }}>{tone.label}</Text></View>,
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{p.createdAt}</Text>
                  ]} />
                );
              })}
            </Table>
          </Panel>
        ) : null}

        {section === "complaints" ? (
          <Panel title="Şikayetler" sub={`${pendingReports} bekliyor · ${reports.length} toplam`}>
            {reports.length === 0 ? <EmptyState title="Şikayet yok" body="Kullanıcılar ilan veya satıcı şikayet ettiğinde burada görünür ve buradan işlem yapabilirsin." /> : null}
            {reports.slice().sort((a, b) => (isOpenReport(a) ? -1 : 1) - (isOpenReport(b) ? -1 : 1) || b.createdAt.localeCompare(a.createdAt)).map((r) => {
              const target = r.listingId ? listings.find((l) => l.id === r.listingId) : undefined;
              const reportedUser = r.reportedUserId ? findUser(r.reportedUserId) : undefined;
              const tone = isOpenReport(r) ? { t: colors.warningSoft, c: colors.warning, l: "Bekliyor" } : r.status === "resolved" ? { t: colors.successSoft, c: colors.success, l: "Çözüldü" } : { t: colors.surfaceAlt, c: colors.muted, l: "Reddedildi" };
              return (
                <View key={r.id} style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, paddingVertical: 13 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name={r.listingId ? "file-alert-outline" : "account-alert-outline"} size={17} color={colors.accent} />
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>
                      {target ? target.title : reportedUser ? reportedUser.name : r.listingId ?? r.reportedUserId ?? "Şikayet"}
                    </Text>
                    <View style={{ backgroundColor: tone.t, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ color: tone.c, fontSize: 10.5, fontWeight: "900" }}>{tone.l}</Text></View>
                  </View>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>Sebep: {r.reason}</Text>
                  {r.details ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{r.details}</Text> : null}
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>
                    Şikayet eden: {findUser(r.reporterId)?.name ?? r.reporterId.slice(0, 8)} · {r.createdAt}
                    {reportedUser && r.listingId ? ` · Satıcı: ${findUser(target?.ownerId ?? "")?.name ?? "—"}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    {target ? (
                      <Link href={{ pathname: "/listing/[id]", params: { id: target.id } }} asChild>
                        <Pressable style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="open-in-new" size={14} color={colors.ink} />
                          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>İlana git</Text>
                        </Pressable>
                      </Link>
                    ) : null}
                    {target ? (
                      <Pressable onPress={() => updateListingStatus(target.id, target.status === "active" ? "paused" : "active")} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                        <MaterialCommunityIcons name={target.status === "active" ? "eye-off-outline" : "eye-outline"} size={14} color={colors.ink} />
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{target.status === "active" ? "İlanı kaldır" : "Yayınla"}</Text>
                      </Pressable>
                    ) : null}
                    {isOpenReport(r) ? (
                      <>
                        <Pressable onPress={() => void updateReportStatus(r.id, "resolved")} style={{ alignItems: "center", backgroundColor: colors.success, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>Çözüldü</Text>
                        </Pressable>
                        <Pressable onPress={() => void updateReportStatus(r.id, "rejected")} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="close" size={14} color={colors.muted} />
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Reddet</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Panel>
        ) : null}

        {section === "categories" ? (
          <View style={{ gap: 16 }}>
            <CategoryManager extra={extraCategories} onSave={saveCategory} onDelete={deleteCategory} confirmAction={confirmAction} />
            <Panel title="Kategori Önerileri" sub={`${pendingCat} bekliyor`}>
              {categorySuggestions.length === 0 ? <EmptyState title="Öneri yok" body="Henüz kategori önerisi gelmedi." /> : null}
              {categorySuggestions.map((s) => (
                <SuggestionRow key={s.id} title={s.suggestedPath} note={s.note} meta={`${s.userName ?? "Kullanıcı"} · ${s.createdAt}`} status={s.status} onApprove={() => setCategorySuggestionStatus(s.id, "approved")} onReject={() => setCategorySuggestionStatus(s.id, "rejected")} />
              ))}
            </Panel>
            <Panel title="Kategori Yapısı" sub={`${categoryTree.length} ana kategori`}>
              {categoryTree.map((n) => {
                const open = expandedCat === n.key;
                return (
                  <View key={n.key} style={{ borderBottomColor: colors.line, borderBottomWidth: 1 }}>
                    <Pressable onPress={() => setExpandedCat(open ? null : n.key)} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 12 }}>
                      <MaterialCommunityIcons name="folder-outline" size={18} color={colors.primaryDark} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800" }}>{n.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{n.children?.length ?? 0} alt</Text>
                      <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                    </Pressable>
                    {open ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 12 }}>
                        {(n.children ?? []).map((c) => (
                          <View key={c.key} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}><Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{c.label}{c.children?.length ? ` · ${c.children.length}` : ""}</Text></View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Panel>
          </View>
        ) : null}

        {section === "locations" ? (
          <Panel title="Konum Önerileri" sub={`${pendingLoc} bekliyor`}>
            {locationSuggestions.length === 0 ? <EmptyState title="Öneri yok" body="Henüz konum/mahalle önerisi gelmedi." /> : null}
            {locationSuggestions.map((s) => (
              <SuggestionRow key={s.id} title={`${s.suggestedName} (${s.type})`} note={[getProvince(s.provinceId)?.name, getDistrict(s.districtId)?.name].filter(Boolean).join(" / ") + (s.note ? ` — ${s.note}` : "")} meta={`${s.userName ?? "Kullanıcı"} · ${s.createdAt}`} status={s.status} onApprove={() => setLocationSuggestionStatus(s.id, "approved")} onReject={() => setLocationSuggestionStatus(s.id, "rejected")} />
            ))}
          </Panel>
        ) : null}

        {section === "messages" ? (
          (() => {
            const convRisk = conversations.map((c) => {
              const bodies = messages.filter((m) => m.conversationId === c.id).map((m) => m.body);
              return { c, risk: conversationRisk(bodies), last: bodies[bodies.length - 1], count: bodies.length };
            });
            const riskyCount = convRisk.filter((x) => x.risk).length;
            const shown = msgFilter === "risky" ? convRisk.filter((x) => x.risk) : convRisk;
            return (
              <Panel title="Mesaj Moderasyonu" sub={`${conversations.length} görüşme · ${messages.length} mesaj · ${riskyCount} riskli`}>
                <FilterChips value={msgFilter} onChange={setMsgFilter} options={[{ key: "all", label: "Tümü", count: conversations.length }, { key: "risky", label: "⚠ Riskli", count: riskyCount }]} />
                {shown.length === 0 ? <EmptyState title="Görüşme yok" body={msgFilter === "risky" ? "Riskli kelime içeren görüşme bulunmuyor." : "Henüz görüşme yok."} /> : null}
                <Table head={["GÖRÜŞME", "İLAN", "SON MESAJ", "DURUM"]} cols={[1.4, 1.5, 1.8, 1]}>
                  {shown.slice(0, 60).map(({ c, risk, last }) => {
                    const listing = listings.find((l) => l.id === c.listingId);
                    return (
                      <Row key={c.id} cols={[1.4, 1.5, 1.8, 1]} cells={[
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{c.participantIds.map((id) => findUser(id)?.name).filter(Boolean).join(" ↔ ")}</Text>,
                        listing ? <Link href={{ pathname: "/listing/[id]", params: { id: listing.id } }} asChild><Pressable><Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{listing.title}</Text></Pressable></Link> : <Text style={{ color: colors.muted, fontSize: 12 }}>—</Text>,
                        <Text numberOfLines={1} style={{ color: risk ? colors.accent : colors.muted, fontSize: 12, fontWeight: risk ? "700" : "600" }}>{last ?? "—"}</Text>,
                        risk ? <View style={{ alignSelf: "flex-start", backgroundColor: colors.accentSoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 2 }}><MaterialCommunityIcons name="alert" size={11} color={colors.accent} /><Text style={{ color: colors.accent, fontSize: 10, fontWeight: "900" }}>{risk}</Text></View> : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Normal</Text>
                      ]} />
                    );
                  })}
                </Table>
              </Panel>
            );
          })()
        ) : null}

        {section === "commissions" ? (
          <Panel title="Komisyon Kayıtları" sub="Ortaksat para tutmaz; bu kayıtlar taraflar arası komisyonun takibidir.">
            <Table head={["İLAN", "KOMİSYON", "ORTAKLIK", "DURUM"]} cols={[2.2, 1, 1.4, 1.2]}>
              {sales.map((s) => {
                const listing = listings.find((l) => l.id === s.listingId);
                const p = partnerships.find((x) => x.id === s.partnershipId);
                return (
                  <Row key={s.id} cols={[2.2, 1, 1.4, 1.2]} cells={[
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{listing?.title ?? s.listingId}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{money(s.commissionAmount)}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{p ? findUser(p.partnerId)?.name : "—"}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: SALE_TONE[s.status].tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: SALE_TONE[s.status].color, fontSize: 10.5, fontWeight: "900" }}>{SALE_TONE[s.status].label}</Text></View>
                  ]} />
                );
              })}
            </Table>
          </Panel>
        ) : null}

        {section === "stats" ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <Stat icon="account-group" tint={colors.infoSoft} color={colors.info} value={`${users.length}`} title="Kullanıcı" />
              <Stat icon="file-document" tint={colors.primarySoft} color={colors.primaryDark} value={`${activeListings.length}`} title="Aktif ilan" />
              <Stat icon="handshake" tint={colors.violetSoft} color={colors.violet} value={`${partnerships.length}`} title="Ortaklık" />
              <Stat icon="cart-check" tint={colors.successSoft} color={colors.success} value={`${sales.length}`} title="Satış" />
              <Stat icon="account-clock" tint={colors.goldSoft} color={colors.gold} value={`${leads.length}`} title="Talep" />
              <Stat icon="cash-multiple" tint={colors.successSoft} color={colors.success} value={money(totalCommission)} title="Komisyon (kayıt)" />
            </View>
            <Panel title="Aylık İlan Grafiği" sub="Son 12 ay — yayınlanan ilan (gerçek veri)">
              <BarChart data={chartData} labels={chartLabels} />
            </Panel>
          </View>
        ) : null}

        {section === "notifications" ? (
          <View style={{ gap: 16 }}>
          {canManageUsers ? (
            <Panel title="Duyuru Gönder" sub="Tüm kayıtlı kullanıcılara bildirim gönder">
              <View style={{ gap: 10 }}>
                <TextInput value={bcTitle} onChangeText={setBcTitle} placeholder="Başlık (ör. Yeni özellik!)" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 42, paddingHorizontal: 12 }} />
                <TextInput value={bcBody} onChangeText={setBcBody} placeholder="Mesaj metni" placeholderTextColor={colors.muted} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 }} />
                <Pressable disabled={!bcTitle.trim()} onPress={() => confirmAction(`Duyuru ${users.length - 1} kullanıcıya gönderilsin mi?`, () => { adminBroadcast(bcTitle, bcBody); setBcTitle(""); setBcBody(""); })} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: bcTitle.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="bullhorn-outline" size={16} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Tümüne gönder</Text>
                </Pressable>
              </View>
            </Panel>
          ) : null}
          <Panel title="Bildirimler" sub={`${notifications.length} kayıt`}>
            {notifications.slice(0, 30).map((n) => (
              <View key={n.id} style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 2, paddingVertical: 11 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{n.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{n.body}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{n.createdAt}</Text>
              </View>
            ))}
            {notifications.length === 0 ? <EmptyState title="Bildirim yok" body="Sistem bildirimi bulunmuyor." /> : null}
          </Panel>
          </View>
        ) : null}

        {section === "content" ? (
          <ContentManager pages={contentPages} onSave={saveContentPage} />
        ) : null}

        {section === "blog" ? (
          <BlogManager posts={blogPosts} onSave={saveBlogPost} onDelete={deleteBlogPost} confirmAction={confirmAction} />
        ) : null}

        {section === "seo" ? (
          <SeoManager settings={seoSettings} onSave={saveSeoSetting} />
        ) : null}

        {section === "settings" ? (
          <View style={{ gap: 16 }}>
          <Panel title="Site Duyurusu" sub="Tüm sayfaların üstünde çıkan duyuru banner'ı">
            <View style={{ gap: 10 }}>
              <TextInput value={annText} onChangeText={setAnnText} placeholder="Duyuru metni (ör. Bayrama özel: ilan vermek ücretsiz!)" placeholderTextColor={colors.muted} multiline style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 56, paddingHorizontal: 12, paddingVertical: 10 }} />
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => setAnnouncement(annText, true)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <MaterialCommunityIcons name="bullhorn-outline" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Yayınla</Text>
                </Pressable>
                <Pressable onPress={() => setAnnouncement(annText, false)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Kapat</Text>
                </Pressable>
                <View style={{ alignItems: "center", backgroundColor: platformSettings.announcementActive ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: platformSettings.announcementActive ? colors.success : colors.muted, fontSize: 11, fontWeight: "900" }}>{platformSettings.announcementActive ? "YAYINDA" : "Kapalı"}</Text>
                </View>
              </View>
            </View>
          </Panel>
          <Panel title="Ayarlar" sub="Platform genel ayarları — anında kaydedilir ve tüm siteye uygulanır">
            {([
              { key: "allowSignups", label: "Yeni kayıtlara izin ver", desc: "Kapalıyken yeni hesap kaydı engellenir." },
              { key: "reviewBeforePublish", label: "İlanları yayından önce incele", desc: "Açıkken yeni ilanlar önce onaya (incelemeye) düşer." },
              { key: "requireEmailVerification", label: "E-posta doğrulama zorunlu", desc: "Açıkken doğrulanmamış e-posta ile ilan verme sınırlanır." },
              { key: "maintenanceMode", label: "Bakım modu", desc: "Açıkken tüm sayfalarda üstte bakım uyarısı görünür." }
            ] as Array<{ key: keyof typeof platformSettings; label: string; desc: string }>).map((s) => {
              const on = platformSettings[s.key];
              return (
                <View key={s.key} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{s.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{s.desc}</Text>
                  </View>
                  <Pressable onPress={() => updatePlatformSetting(s.key, !on)} style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}>
                    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} />
                  </Pressable>
                </View>
              );
            })}
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 8 }}>Değişiklikler Supabase'e kaydedilir ve tüm ziyaretçilere anında yansır.</Text>
          </Panel>
          </View>
        ) : null}

        {section === "reports" ? (
          <View style={{ gap: 16 }}>
            <Panel title="Denetim Kaydı (activity_logs)" sub={audit ? `${audit.logs.length} son kayıt · son 1 saatte ${audit.rateHits} hız-limiti olayı` : "yükleniyor / erişim yok"}>
              {!audit ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }}>Denetim kaydı yüklenemedi (admin değilsen veya henüz kayıt yoksa boş görünür).</Text>
              ) : audit.logs.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }}>Henüz denetim kaydı yok. Kullanıcılar giriş yapıp işlem yaptıkça burada görünür.</Text>
              ) : (
                <Table head={["ZAMAN", "AKSİYON", "TİP", "KAYIT"]} cols={[1.4, 1.6, 1, 1.6]}>
                  {audit.logs.map((a) => (
                    <Row key={a.id} cols={[1.4, 1.6, 1, 1.6]} cells={[
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{a.createdAt}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{a.action}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{a.entityType ?? "—"}</Text>,
                      <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{a.entityId ? a.entityId.slice(0, 12) : "—"}</Text>
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Şikayet henüz işlem bekliyor mu (açık/incelemede).
function isOpenReport(r: { status: string }) {
  return r.status === "open" || r.status === "reviewing";
}

// Yıkıcı işlem onayı: web'de window.confirm, native'de Alert.
function confirmAction(message: string, onYes: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(message)) onYes();
  } else {
    Alert.alert("Onay", message, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Evet", style: "destructive", onPress: onYes }
    ]);
  }
}

// ---- pieces --------------------------------------------------------------
type DashProps = {
  usersN: number; listingsN: number; salesN: number; commission: number;
  activeN: number; pendingN: number; reportsN: number; partnershipsN: number; messagesN: number;
  listings: ReturnType<typeof useStore>["listings"]; users: ReturnType<typeof useStore>["users"]; findUser: ReturnType<typeof useStore>["findUser"];
  notifications: ReturnType<typeof useStore>["notifications"]; leads: ReturnType<typeof useStore>["leads"];
  setSection: (s: Section) => void;
};
function Dashboard({ usersN, listingsN, salesN, commission, activeN, pendingN, reportsN, partnershipsN, messagesN, listings, users, findUser, notifications, leads, setSection }: DashProps) {
  const recentUsers = users.slice().filter((u) => u.status !== "deleted").slice(-5).reverse();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Dashboard</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>Hoş geldin, site genelindeki özet bilgilere buradan ulaşabilirsin.</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <Stat icon="account-group" tint={colors.infoSoft} color={colors.info} value={`${usersN}`} title="Toplam Kullanıcı" onPress={() => setSection("users")} />
        <Stat icon="file-document" tint={colors.primarySoft} color={colors.primaryDark} value={`${listingsN}`} title="Toplam İlan" onPress={() => setSection("listings")} />
        <Stat icon="check-decagram" tint={colors.successSoft} color={colors.success} value={`${activeN}`} title="Yayındaki İlan" onPress={() => setSection("listings")} />
        <Stat icon="clock-alert-outline" tint={colors.warningSoft} color={colors.warning} value={`${pendingN}`} title="Onay Bekleyen İlan" onPress={() => setSection("listings")} />
        <Stat icon="flag-outline" tint={colors.accentSoft} color={colors.accent} value={`${reportsN}`} title="Açık Şikayet" onPress={() => setSection("complaints")} />
        <Stat icon="handshake-outline" tint={colors.violetSoft} color={colors.violet} value={`${partnershipsN}`} title="Bekleyen Ortaklık" onPress={() => setSection("partnerships")} />
        <Stat icon="message-text" tint={colors.primarySoft} color={colors.primaryDark} value={`${messagesN}`} title="Toplam Mesaj" onPress={() => setSection("messages")} />
        <Stat icon="cash-multiple" tint={colors.goldSoft} color={colors.gold} value={money(commission)} title="Komisyon (kayıt)" onPress={() => setSection("commissions")} />
      </View>
      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flex: 2, gap: 16, minWidth: 280 }}>
          <Panel title="Aylık İlan Grafiği" sub="Son 12 ay — gerçek veri"><BarChart data={monthlyListingChart(listings).data} labels={monthlyListingChart(listings).labels} /></Panel>
          <Panel title="Son Eklenen İlanlar">
            <Table head={["İLAN", "KATEGORİ", "FİYAT", "DURUM"]} cols={[2.2, 1.2, 1, 1]}>
              {listings.slice(0, 6).map((l) => (
                <Row key={l.id} cols={[2.2, 1.2, 1, 1]} cells={[
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>,
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{money(l.price)}</Text>,
                  <View style={{ alignSelf: "flex-start", backgroundColor: l.status === "active" ? colors.successSoft : l.status === "rejected" ? colors.accentSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: l.status === "active" ? colors.success : l.status === "rejected" ? colors.accent : colors.muted, fontSize: 10.5, fontWeight: "900" }}>{l.status === "active" ? "Yayında" : l.status === "pending_review" ? "İncelemede" : l.status === "rejected" ? "Reddedildi" : l.status}</Text></View>
                ]} />
              ))}
            </Table>
          </Panel>
          <Panel title="Son Kayıt Olan Kullanıcılar">
            <Table head={["KULLANICI", "ROL", "DURUM"]} cols={[2, 1, 1]}>
              {recentUsers.map((u) => (
                <Row key={u.id} cols={[2, 1, 1]} cells={[
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{u.name}</Text>,
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{u.role === "admin" || u.role === "super_admin" ? "Admin" : u.role === "moderator" ? "Mod" : "Üye"}</Text>,
                  <View style={{ alignSelf: "flex-start", backgroundColor: u.status === "suspended" ? colors.accentSoft : colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: u.status === "suspended" ? colors.accent : colors.success, fontSize: 10, fontWeight: "900" }}>{u.status === "suspended" ? "Askıda" : "Aktif"}</Text></View>
                ]} />
              ))}
            </Table>
          </Panel>
        </View>
        <View style={{ flex: 1, gap: 16, minWidth: 240 }}>
          <Panel title="Son Aktiviteler">
            {[...notifications.slice(0, 3).map((n) => ({ t: n.title, s: n.createdAt })), ...leads.slice(0, 2).map((l) => ({ t: `Yeni talep: ${findUser(l.partnershipId)?.name ?? l.buyerName ?? "Alıcı"}`, s: l.createdAt }))].slice(0, 5).map((a, i) => (
              <View key={i} style={{ alignItems: "flex-start", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 11 }}>
                <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 8, marginTop: 5, width: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{a.t}</Text>
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{a.s}</Text>
                </View>
              </View>
            ))}
          </Panel>
          <Panel title="Kısayollar">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "Yeni İlan Ekle", icon: "file-plus-outline" as const, go: "listings" as Section },
                { label: "Kullanıcılar", icon: "account-multiple-outline" as const, go: "users" as Section },
                { label: "Önerileri İncele", icon: "shape-plus" as const, go: "categories" as Section },
                { label: "Raporlar", icon: "chart-box-outline" as const, go: "reports" as Section }
              ].map((k) => (
                <Pressable key={k.label} onPress={() => setSection(k.go)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 6, justifyContent: "center", minWidth: 100, padding: 14 }}>
                  <MaterialCommunityIcons name={k.icon} size={22} color={colors.primaryDark} />
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{k.label}</Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, tint, color, value, title, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: pressed && onPress ? colors.primary : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 190, flexGrow: 1, gap: 10, minWidth: 0, padding: 16 })}>
      <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{title}</Text>
        {onPress ? <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} /> : null}
      </View>
    </Pressable>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{title}</Text>
        {sub ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Table({ head, cols, children }: { head: string[]; cols: number[]; children: ReactNode }) {
  return (
    <View>
      <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingBottom: 8 }}>
        {head.map((h, i) => <Text key={h} style={{ color: colors.muted, flex: cols[i], fontSize: 10.5, fontWeight: "800", textAlign: i === head.length - 1 ? "right" : "left" }}>{h}</Text>)}
      </View>
      {children}
    </View>
  );
}
function Row({ cols, cells }: { cols: number[]; cells: ReactNode[] }) {
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 10 }}>
      {cells.map((c, i) => <View key={i} style={{ alignItems: i === cells.length - 1 ? "flex-end" : "flex-start", flex: cols[i] }}>{c}</View>)}
    </View>
  );
}

function SuggestionRow({ title, note, meta, status, onApprove, onReject }: { title: string; note?: string; meta: string; status: SuggestionStatus; onApprove: () => void; onReject: () => void }) {
  return (
    <View style={{ borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, paddingVertical: 13 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{title}</Text>
        <View style={{ backgroundColor: STATUS_TONE[status].tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: STATUS_TONE[status].color, fontSize: 10.5, fontWeight: "900" }}>{STATUS_TONE[status].label}</Text></View>
      </View>
      {note ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{note}</Text> : null}
      <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{meta}</Text>
      {status === "pending" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={onApprove} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="check" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>Onayla</Text></Pressable>
          <Pressable onPress={onReject} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}><MaterialCommunityIcons name="close" size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Reddet</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ key: T; label: string; count?: number }> }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{o.label}</Text>
            {typeof o.count === "number" ? <View style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.25)" : colors.line, borderRadius: 999, justifyContent: "center", minWidth: 16, paddingHorizontal: 4 }}><Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 10, fontWeight: "900" }}>{o.count}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function slugifyTr(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return s.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşüİ]/g, (m) => map[m] ?? m).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}
const inputStyle = { backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 42, paddingHorizontal: 12 } as const;

function BlogManager({ posts, onSave, onDelete, confirmAction }: { posts: DbBlogPost[]; onSave: (p: DbBlogPost) => void; onDelete: (id: string) => void; confirmAction: (m: string, cb: () => void) => void }) {
  const [edit, setEdit] = useState<DbBlogPost | null>(null);
  const blank = (): DbBlogPost => ({ id: uuid(), slug: "", category: "Satış İpuçları", title: "", excerpt: "", author: "OrtakSat", authorRole: "Editör", readMin: 3, image: "", featured: false, body: [], status: "published", createdAt: new Date().toISOString().slice(0, 10) });
  if (edit) {
    return (
      <Panel title={posts.some((p) => p.id === edit.id) ? "Yazıyı Düzenle" : "Yeni Blog Yazısı"} sub="Alanları doldur ve kaydet">
        <View style={{ gap: 10 }}>
          <TextInput value={edit.title} onChangeText={(t) => setEdit({ ...edit, title: t, slug: edit.slug || slugifyTr(t) })} placeholder="Başlık" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.slug} onChangeText={(t) => setEdit({ ...edit, slug: slugifyTr(t) })} placeholder="URL (slug)" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.category} onChangeText={(t) => setEdit({ ...edit, category: t })} placeholder="Kategori" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.image} onChangeText={(t) => setEdit({ ...edit, image: t })} placeholder="Kapak görseli URL" placeholderTextColor={colors.muted} style={inputStyle} />
          <TextInput value={edit.excerpt} onChangeText={(t) => setEdit({ ...edit, excerpt: t })} placeholder="Özet" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
          <TextInput value={edit.body.join("\n\n")} onChangeText={(t) => setEdit({ ...edit, body: t.split(/\n\n+/) })} placeholder="İçerik (paragrafları boş satırla ayır)" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 160, paddingVertical: 10 }} />
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <Pressable onPress={() => setEdit({ ...edit, featured: !edit.featured })} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}><MaterialCommunityIcons name={edit.featured ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={colors.primary} /><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Öne çıkan</Text></Pressable>
            <Pressable onPress={() => setEdit({ ...edit, status: edit.status === "published" ? "draft" : "published" })} style={{ alignItems: "center", backgroundColor: edit.status === "published" ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: edit.status === "published" ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{edit.status === "published" ? "Yayında" : "Taslak"}</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable disabled={!edit.title.trim() || !edit.slug.trim()} onPress={() => { onSave(edit); setEdit(null); }} style={{ alignItems: "center", backgroundColor: edit.title.trim() && edit.slug.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
            <Pressable onPress={() => setEdit(null)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10 }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Vazgeç</Text></Pressable>
          </View>
        </View>
      </Panel>
    );
  }
  return (
    <Panel title="Blog Yönetimi" sub={`${posts.length} yazı`}>
      <Pressable onPress={() => setEdit(blank())} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10 }}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Yeni Yazı</Text></Pressable>
      {posts.length === 0 ? <EmptyState title="Blog yazısı yok" body="İlk yazıyı oluştur; ortaksat.com/blog'da yayınlanır." /> : null}
      <Table head={["BAŞLIK", "KATEGORİ", "DURUM", "İŞLEM"]} cols={[2.4, 1.2, 1, 1.4]}>
        {posts.map((p) => (
          <Row key={p.id} cols={[2.4, 1.2, 1, 1.4]} cells={[
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{p.title}</Text>,
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{p.category}</Text>,
            <View style={{ alignSelf: "flex-start", backgroundColor: p.status === "published" ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: p.status === "published" ? colors.success : colors.muted, fontSize: 10, fontWeight: "900" }}>{p.status === "published" ? "Yayında" : "Taslak"}</Text></View>,
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setEdit(p)}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Düzenle</Text></Pressable>
              <Pressable onPress={() => confirmAction(`"${p.title}" silinsin mi?`, () => onDelete(p.id))}><Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>Sil</Text></Pressable>
            </View>
          ]} />
        ))}
      </Table>
    </Panel>
  );
}

function CategoryManager({ extra, onSave, onDelete, confirmAction }: { extra: ExtraCategory[]; onSave: (c: ExtraCategory) => void; onDelete: (id: string) => void; confirmAction: (m: string, cb: () => void) => void }) {
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("");
  const [subs, setSubs] = useState("");
  const add = () => {
    const key = `x-${slugifyTr(label)}`;
    if (!label.trim() || !key) return;
    const subcategories = subs.split(",").map((s) => s.trim()).filter(Boolean).map((l) => ({ label: l, slug: slugifyTr(l) }));
    onSave({ id: uuid(), key, label: label.trim(), slug: slugifyTr(label), image: image.trim(), subcategories, sortOrder: 999, isActive: true });
    setLabel(""); setImage(""); setSubs("");
  };
  return (
    <Panel title="Ekstra Kategoriler" sub="Kod ağacına ek ana kategoriler; kategori sayfası ve ilan verme akışında görünür">
      <View style={{ gap: 10, marginBottom: 12 }}>
        <TextInput value={label} onChangeText={setLabel} placeholder="Kategori adı (ör. Sanat & Koleksiyon)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={image} onChangeText={setImage} placeholder="Görsel URL (opsiyonel)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={subs} onChangeText={setSubs} placeholder="Alt kategoriler (virgülle: Tablo, Heykel, Antika)" placeholderTextColor={colors.muted} style={inputStyle} />
        <Pressable disabled={!label.trim()} onPress={add} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: label.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kategori Ekle</Text>
        </Pressable>
      </View>
      {extra.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>Henüz ekstra kategori yok. Yukarıdan ekleyebilirsin.</Text> : null}
      {extra.map((c) => (
        <View key={c.id} style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 11 }}>
          <MaterialCommunityIcons name="shape-outline" size={17} color={colors.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{c.label}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{c.subcategories.map((s) => s.label).join(", ") || "alt kategori yok"}</Text>
          </View>
          <Pressable onPress={() => onSave({ ...c, isActive: !c.isActive })}><Text style={{ color: c.isActive ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{c.isActive ? "Aktif" : "Gizli"}</Text></Pressable>
          <Pressable onPress={() => confirmAction(`"${c.label}" kategorisi silinsin mi?`, () => onDelete(c.id))}><Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>Sil</Text></Pressable>
        </View>
      ))}
    </Panel>
  );
}

const CONTENT_SLUGS = [
  { slug: "hakkimizda", label: "Hakkımızda" },
  { slug: "nasil-calisir", label: "Nasıl Çalışır?" },
  { slug: "sss", label: "Sık Sorulan Sorular" },
  { slug: "guvenli-alisveris", label: "Güvenli Alışveriş İpuçları" },
  { slug: "ortak-satis-kurallari", label: "Ortak Satış Kuralları" },
  { slug: "yasakli-urunler", label: "Yasaklı Ürünler" }
];
function ContentManager({ pages, onSave }: { pages: DbContentPage[]; onSave: (p: DbContentPage) => void }) {
  const [slug, setSlug] = useState(CONTENT_SLUGS[0].slug);
  const existing = pages.find((p) => p.slug === slug);
  const [draft, setDraft] = useState<DbContentPage>(existing ?? { slug, title: "", body: "", seoTitle: "", seoDescription: "" });
  const load = (s: string) => { setSlug(s); const e = pages.find((p) => p.slug === s); setDraft(e ?? { slug: s, title: "", body: "", seoTitle: "", seoDescription: "" }); };
  return (
    <Panel title="Site İçerikleri" sub="Bilgi sayfalarını düzenle (Supabase'e kaydedilir)">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {CONTENT_SLUGS.map((c) => (
          <Pressable key={c.slug} onPress={() => load(c.slug)} style={{ backgroundColor: slug === c.slug ? colors.primary : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: slug === c.slug ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{c.label}</Text></Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <TextInput value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="Sayfa başlığı" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.body} onChangeText={(t) => setDraft({ ...draft, body: t })} placeholder="Sayfa içeriği" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 200, paddingVertical: 10 }} />
        <TextInput value={draft.seoTitle} onChangeText={(t) => setDraft({ ...draft, seoTitle: t })} placeholder="SEO başlığı (meta title)" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.seoDescription} onChangeText={(t) => setDraft({ ...draft, seoDescription: t })} placeholder="SEO açıklaması (meta description)" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
        <Pressable onPress={() => onSave({ ...draft, slug })} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
      </View>
    </Panel>
  );
}

const SEO_PATHS = ["/", "/explore", "/kategoriler", "/blog", "/nasil-calisir", "/hakkimizda"];
function SeoManager({ settings, onSave }: { settings: DbSeoSetting[]; onSave: (s: DbSeoSetting) => void }) {
  const [path, setPath] = useState(SEO_PATHS[0]);
  const existing = settings.find((s) => s.path === path);
  const [draft, setDraft] = useState<DbSeoSetting>(existing ?? { path, metaTitle: "", metaDescription: "", ogImage: "", noindex: false });
  const load = (p: string) => { setPath(p); const e = settings.find((s) => s.path === p); setDraft(e ?? { path: p, metaTitle: "", metaDescription: "", ogImage: "", noindex: false }); };
  return (
    <Panel title="SEO Yönetimi" sub="Sayfa bazlı meta etiketleri (Supabase'e kaydedilir)">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
        {SEO_PATHS.map((p) => (
          <Pressable key={p} onPress={() => load(p)} style={{ backgroundColor: path === p ? colors.primary : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: path === p ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{p}</Text></Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <TextInput value={draft.metaTitle} onChangeText={(t) => setDraft({ ...draft, metaTitle: t })} placeholder="Meta title" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={draft.metaDescription} onChangeText={(t) => setDraft({ ...draft, metaDescription: t })} placeholder="Meta description" placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 56, paddingVertical: 10 }} />
        <TextInput value={draft.ogImage} onChangeText={(t) => setDraft({ ...draft, ogImage: t })} placeholder="OG image URL" placeholderTextColor={colors.muted} style={inputStyle} />
        <Pressable onPress={() => setDraft({ ...draft, noindex: !draft.noindex })} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}><MaterialCommunityIcons name={draft.noindex ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={colors.primary} /><Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>noindex (arama motorlarına kapat)</Text></Pressable>
        <Pressable onPress={() => onSave({ ...draft, path })} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Kaydet</Text></Pressable>
      </View>
    </Panel>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, minWidth: 74, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: tone === "accent" ? colors.accent : colors.ink, fontSize: 17, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 12, paddingHorizontal: 12 }}>
      <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 13, minHeight: 38, paddingVertical: 6 }} />
      {value ? <Pressable onPress={() => onChange("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
    </View>
  );
}

function BarChart({ data, labels }: { data: number[]; labels?: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 6, height: 172, paddingTop: 10 }}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, gap: 5, justifyContent: "flex-end" }}>
          <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "800", textAlign: "center" }}>{v > 0 ? v : ""}</Text>
          <View style={{ backgroundColor: i === data.length - 1 ? colors.primary : colors.primarySoft, borderRadius: 6, height: Math.round((v / max) * 118) + 4, width: "100%" }} />
          <Text style={{ color: colors.subtle, fontSize: 9, fontWeight: "700", textAlign: "center" }}>{labels ? labels[i] : i + 1}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminScreen() {
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Yönetim paneli için giriş yapın" />;
  const role = auth.currentUser.role;
  const isStaff = role === "admin" || role === "moderator" || role === "super_admin";
  if (!isStaff) {
    return (
      <AuthRequired
        icon="shield-lock-outline"
        title="Bu alana erişim yetkiniz yok"
        body="Yönetim paneli yalnızca yönetici ve moderatör hesaplarına açıktır. Yetki gerektiğini düşünüyorsanız bizimle iletişime geçin."
      />
    );
  }
  return <AdminScreenInner />;
}

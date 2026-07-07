import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Alert } from "@/lib/alert";

import { AdminActivity } from "@/components/admin-activity";
import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { EmptyState } from "@/components/ui";
import { commissionAmount, money } from "@/lib/format";
import { useIsWideWeb } from "@/lib/layout";
import { getDistrict, getProvince } from "@/lib/locations";
import { computeListingRisk } from "@/lib/risk";
import { fetchAdminAudit, type AuditEntry, type DbBlogPost, type DbContentPage, type DbSeoSetting, type ExtraCategory } from "@/lib/supabase-data";
import type { SaleStatus, SuggestionStatus, UserRole } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type Section =
  | "dashboard" | "users" | "listings" | "partnerships" | "complaints" | "categories" | "locations"
  | "messages" | "commissions" | "stats" | "notifications" | "content" | "blog" | "seo" | "settings" | "reports";

type NavItem = { key: Section; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string };
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Genel", items: [
    { key: "dashboard", icon: "view-dashboard-outline", label: "Dashboard" },
    { key: "stats", icon: "chart-line", label: "İstatistikler" },
    { key: "reports", icon: "chart-box-outline", label: "Raporlar" }
  ] },
  { title: "Yönetim", items: [
    { key: "users", icon: "account-group-outline", label: "Kullanıcılar" },
    { key: "listings", icon: "file-document-outline", label: "İlanlar" },
    { key: "partnerships", icon: "handshake-outline", label: "Ortak Satış Talepleri" },
    { key: "commissions", icon: "cash-multiple", label: "Komisyon Kayıtları" }
  ] },
  { title: "Güven & İletişim", items: [
    { key: "complaints", icon: "flag-outline", label: "Şikayetler" },
    { key: "messages", icon: "message-text-outline", label: "Mesajlar" },
    { key: "notifications", icon: "bell-outline", label: "Bildirimler" }
  ] },
  { title: "İçerik & Site", items: [
    { key: "categories", icon: "shape-outline", label: "Kategoriler" },
    { key: "locations", icon: "map-marker-outline", label: "Konum Önerileri" },
    { key: "content", icon: "file-edit-outline", label: "Site İçerikleri" },
    { key: "blog", icon: "post-outline", label: "Blog Yönetimi" },
    { key: "seo", icon: "magnify-scan", label: "SEO Yönetimi" }
  ] },
  { title: "Sistem", items: [
    { key: "settings", icon: "cog-outline", label: "Ayarlar" }
  ] }
];
const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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
  const { height: viewportHeight } = useWindowDimensions();
  const router = useRouter();
  const {
    listings, users, sales, partnerships, leads, conversations, messages, notifications,
    categorySuggestions, locationSuggestions, setCategorySuggestionStatus, setLocationSuggestionStatus,
    updateListingStatus, setListingFeatured, deleteListing, findUser, signOut, currentUser, reports, updateReportStatus,
    approvePartnership, rejectPartnership, updateSaleStatus,
    platformSettings, updatePlatformSetting, setAnnouncement, setUserRole, setUserStatus,
    setUserVerification, adminNotifyUser, adminBroadcast,
    blogPosts, contentPages, seoSettings, saveBlogPost, deleteBlogPost, saveContentPage, saveSeoSetting,
    categoryTree, extraCategories, saveCategory, deleteCategory, importCategories,
    hiddenCategories, toggleHiddenCategory
  } = useStore();
  const [annText, setAnnText] = useState(platformSettings.announcement);
  const canManageUsers = currentUser.role === "admin" || currentUser.role === "super_admin";
  const [userQuery, setUserQuery] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [listingFilter, setListingFilter] = useState<"all" | "pending" | "active" | "rejected" | "paused" | "featured" | "risky">("all");
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

  const riskyListings = useMemo(() => listings.filter((l) => computeListingRisk(l, listings, findUser(l.ownerId)).level === "high"), [listings, findUser]);
  const listingFiltered = listingFilter === "all" ? listings : listingFilter === "risky" ? riskyListings : listingFilter === "featured" ? listings.filter((l) => l.featured) : listingFilter === "pending" ? listings.filter((l) => l.status === "pending_review") : listings.filter((l) => l.status === listingFilter);
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

  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
  const activeListings = listings.filter((l) => l.status === "active");
  const pendingReview = listings.filter((l) => l.status === "pending_review");
  const totalCommission = sales.reduce((s, x) => s + x.commissionAmount, 0);
  const disputedSalesN = sales.filter((s) => s.status === "disputed").length;
  const unpaidCommission = sales.filter((s) => s.status !== "paid" && s.status !== "cancelled").reduce((a, s) => a + s.commissionAmount, 0);
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
        <View style={{ backgroundColor: "#0A5C44", height: viewportHeight, width: 264 }}>
          <View style={{ borderBottomColor: "rgba(255,255,255,0.1)", borderBottomWidth: 1, gap: 12, paddingBottom: 14, paddingHorizontal: 18, paddingTop: 20 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, height: 34, justifyContent: "center", width: 34 }}>
                <MaterialCommunityIcons name="shield-crown" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15.5, fontWeight: "900" }}>OrtakSat</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>YÖNETİM PANELİ</Text>
              </View>
            </View>
            {/* Admin kimliği */}
            <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, flexDirection: "row", gap: 9, paddingHorizontal: 10, paddingVertical: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, height: 28, justifyContent: "center", width: 28 }}>
                <Text style={{ color: "#0A5C44", fontSize: 12, fontWeight: "900" }}>{(currentUser.name || "A").slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{currentUser.name || "Yönetici"}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, fontWeight: "700", textTransform: "capitalize" }}>{currentUser.role === "super_admin" ? "Süper Admin" : currentUser.role === "moderator" ? "Moderatör" : "Admin"}</Text>
              </View>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingBottom: 14, paddingHorizontal: 12, paddingTop: 10 }}>
            {NAV_GROUPS.map((group) => (
              <View key={group.title} style={{ gap: 2, marginBottom: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 6 }}>{group.title.toLocaleUpperCase("tr-TR")}</Text>
                {group.items.map((n) => {
                  const on = section === n.key;
                  const badge = navBadge(n.key);
                  return (
                    <Pressable key={n.key} onPress={() => setSection(n.key)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.18)" : pressed ? "rgba(255,255,255,0.08)" : "transparent", borderLeftColor: on ? "#FFFFFF" : "transparent", borderLeftWidth: 3, borderRadius: 9, flexDirection: "row", gap: 11, paddingHorizontal: 11, paddingVertical: 9.5 })}>
                      <MaterialCommunityIcons name={n.icon} size={18} color={on ? "#FFFFFF" : "rgba(255,255,255,0.66)"} />
                      <Text numberOfLines={1} style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.8)", flex: 1, fontSize: 13, fontWeight: on ? "900" : "700" }}>{n.label}</Text>
                      {badge ? <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={{ borderTopColor: "rgba(255,255,255,0.12)", borderTopWidth: 1, gap: 4, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 10 }}>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
                <MaterialCommunityIcons name="storefront-outline" size={18} color="rgba(255,255,255,0.72)" />
                <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, fontWeight: "700" }}>Siteye dön</Text>
              </Pressable>
            </Link>
            <Pressable onPress={() => { void signOut(); router.replace("/"); }} style={{ alignItems: "center", borderRadius: 10, flexDirection: "row", gap: 11, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name="logout" size={18} color="rgba(255,255,255,0.72)" />
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, fontWeight: "700" }}>Çıkış Yap</Text>
            </Pressable>
          </View>
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
          <View style={{ gap: 18 }}>
          <AdminActivity />
          <Dashboard
            usersN={liveUsers.length} listingsN={listings.length} salesN={sales.length} commission={totalCommission}
            activeN={activeListings.length} pendingN={pendingReview.length} reportsN={pendingReports} partnershipsN={pendingPartnerships} messagesN={messages.length}
            disputedN={disputedSalesN} unpaidCommission={unpaidCommission} pendingCat={pendingCat} pendingLoc={pendingLoc}
            listings={listings} users={users} sales={sales} partnerships={partnerships} reports={reports} findUser={findUser} notifications={notifications} leads={leads} setSection={setSection}
          />
          </View>
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
                    <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setDetailUserId(null)} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} /></Pressable>
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
                        <Pressable accessibilityRole="button" accessibilityLabel="Telefon doğrulamasını değiştir" onPress={() => setUserVerification(u.id, "verifiedPhone", !u.verifiedPhone)}>
                          <MaterialCommunityIcons name="phone-check" size={17} color={u.verifiedPhone ? colors.success : colors.line} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Kimlik doğrulamasını değiştir" onPress={() => setUserVerification(u.id, "verifiedIdentity", !u.verifiedIdentity)}>
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
                <Pressable onPress={() => confirmAction(`Onay bekleyen ${pendingReview.length} ilanın TÜMÜ yayınlansın mı?`, () => pendingReview.forEach((l) => updateListingStatus(l.id, "active")))} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <MaterialCommunityIcons name="check-all" size={15} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>Tümünü onayla ({pendingReview.length})</Text>
                </Pressable>
                <Pressable onPress={() => confirmAction(`Onay bekleyen ${pendingReview.length} ilanın TÜMÜ reddedilsin mi? Bu işlem geri alınamaz.`, () => pendingReview.forEach((l) => updateListingStatus(l.id, "rejected")))} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 7 }}>
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
              { key: "featured", label: "Öne çıkan", count: listings.filter((l) => l.featured).length },
              { key: "risky", label: "⚠ Riskli", count: riskyListings.length }
            ]} />
            <Table head={["İLAN", "KATEGORİ", "FİYAT", "SAHİP", "DURUM", "İŞLEM"]} cols={[2.2, 1.2, 1, 1.4, 1, 1.4]}>
              {shownListings.map((l) => {
                const risk = computeListingRisk(l, listings, findUser(l.ownerId));
                const riskColor = risk.level === "high" ? colors.accent : risk.level === "medium" ? colors.warning : colors.success;
                const riskBg = risk.level === "high" ? colors.accentSoft : risk.level === "medium" ? colors.warningSoft : colors.successSoft;
                return (
                <Row key={l.id} cols={[2.2, 1.2, 1, 1.4, 1, 1.2]} cells={[
                  <View style={{ gap: 3 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, flexShrink: 1, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>
                      <View style={{ alignItems: "center", backgroundColor: riskBg, borderRadius: 999, flexDirection: "row", gap: 2, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <MaterialCommunityIcons name={risk.level === "high" ? "alert-octagon" : risk.level === "medium" ? "alert" : "shield-check"} size={10} color={riskColor} />
                        <Text style={{ color: riskColor, fontSize: 9.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{risk.score}</Text>
                      </View>
                    </View>
                    {risk.flags.length && risk.level !== "low" ? (
                      <Text numberOfLines={2} style={{ color: riskColor, fontSize: 10, fontWeight: "700", lineHeight: 13 }}>⚠ {risk.flags.slice(0, 3).join(" · ")}</Text>
                    ) : null}
                  </View>,
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
                );
              })}
            </Table>
          </Panel>
          </View>
        ) : null}

        {section === "partnerships" ? (
          <Panel title="Ortak Satış Talepleri" sub={`${pendingPartnerships} bekliyor · ${partnerships.length} toplam`}>
            {partnerships.length === 0 ? <EmptyState title="Ortak satış talebi yok" body="Bir kullanıcı bir ilana ortak satıcı olmak için başvurduğunda burada görünür." /> : null}
            <Table head={["İLAN", "İLAN SAHİBİ", "ORTAK ADAYI", "KOMİSYON", "DURUM", "TARİH", "İŞLEM"]} cols={[1.9, 1.3, 1.3, 1, 1, 0.9, 1.4]}>
              {partnerships.slice().sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt)).map((p) => {
                const listing = listings.find((l) => l.id === p.listingId);
                const owner = listing ? findUser(listing.ownerId) : undefined;
                const partner = findUser(p.partnerId);
                const tone = PARTNERSHIP_TONE[p.status] ?? { tint: colors.surfaceAlt, color: colors.muted, label: p.status };
                const comm = listing ? (listing.commissionType === "rate" ? `%${listing.commissionValue}` : money(listing.commissionValue)) : "—";
                return (
                  <Row key={p.id} cols={[1.9, 1.3, 1.3, 1, 1, 0.9, 1.4]} cells={[
                    listing ? (
                      <Link href={{ pathname: "/listing/[id]", params: { id: listing.id } }} asChild>
                        <Pressable><Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{listing.title}</Text></Pressable>
                      </Link>
                    ) : <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{p.listingId.slice(0, 10)}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{owner?.name ?? "—"}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{partner?.name ?? "—"}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{comm}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: tone.tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: tone.color, fontSize: 10.5, fontWeight: "900" }}>{tone.label}</Text></View>,
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{p.createdAt}</Text>,
                    p.status === "pending" ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => approvePartnership(p.id)} accessibilityRole="button" accessibilityLabel="Ortaklığı onayla"><Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>Onayla</Text></Pressable>
                        <Pressable onPress={() => confirmAction("Bu ortaklık başvurusu reddedilsin mi?", () => rejectPartnership(p.id))} accessibilityRole="button" accessibilityLabel="Ortaklığı reddet"><Text style={{ color: colors.warning, fontSize: 11.5, fontWeight: "900" }}>Reddet</Text></Pressable>
                      </View>
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>—</Text>
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
              // Şikayet edilen kullanıcı: doğrudan kullanıcı şikayeti ya da ilan sahibi.
              const actUser = reportedUser ?? (target ? findUser(target.ownerId) : undefined);
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
                    {actUser && canManageUsers && actUser.id !== currentUser.id ? (
                      <>
                        <Pressable onPress={() => confirmAction(`${actUser.name} kullanıcısı ${actUser.status === "suspended" ? "aktifleştirilsin" : "askıya alınsın"} mı?`, () => setUserStatus(actUser.id, actUser.status === "suspended" ? "active" : "suspended"))} style={{ alignItems: "center", backgroundColor: actUser.status === "suspended" ? colors.successSoft : colors.accentSoft, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name={actUser.status === "suspended" ? "account-check-outline" : "account-cancel-outline"} size={14} color={actUser.status === "suspended" ? colors.success : colors.accent} />
                          <Text style={{ color: actUser.status === "suspended" ? colors.success : colors.accent, fontSize: 12, fontWeight: "800" }}>{actUser.status === "suspended" ? "Aktifleştir" : "Kullanıcıyı askıya al"}</Text>
                        </Pressable>
                        <Pressable onPress={() => promptNotify(actUser.id, actUser.name)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="bell-outline" size={14} color={colors.ink} />
                          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>Kullanıcıyı uyar</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {isOpenReport(r) && r.reason.startsWith("DOĞRULAMA TALEBİ") && actUser && canManageUsers ? (
                      <>
                        <Pressable onPress={() => { setUserVerification(actUser.id, "verifiedIdentity", true); void updateReportStatus(r.id, "resolved"); }} style={{ alignItems: "center", backgroundColor: colors.success, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="check-decagram" size={14} color="#FFFFFF" />
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>Kimlik doğrula</Text>
                        </Pressable>
                        <Pressable onPress={() => { setUserVerification(actUser.id, "verifiedPhone", true); void updateReportStatus(r.id, "resolved"); }} style={{ alignItems: "center", backgroundColor: colors.info, borderRadius: 8, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}>
                          <MaterialCommunityIcons name="phone-check" size={14} color="#FFFFFF" />
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>Telefon doğrula</Text>
                        </Pressable>
                      </>
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
            <CategoryManager extra={extraCategories} onSave={saveCategory} onDelete={deleteCategory} onImport={importCategories} confirmAction={confirmAction} />
            <Panel title="Kategori Önerileri" sub={`${pendingCat} bekliyor`}>
              {categorySuggestions.length === 0 ? <EmptyState title="Öneri yok" body="Henüz kategori önerisi gelmedi." /> : null}
              {categorySuggestions.map((s) => (
                <SuggestionRow key={s.id} title={s.suggestedPath} note={s.note} meta={`${s.userName ?? "Kullanıcı"} · ${s.createdAt}`} status={s.status} onApprove={() => setCategorySuggestionStatus(s.id, "approved")} onReject={() => setCategorySuggestionStatus(s.id, "rejected")} />
              ))}
            </Panel>
            <Panel title="Kategori Yapısı" sub={`${categoryTree.length} ana kategori`}>
              {categoryTree.map((n) => {
                const open = expandedCat === n.key;
                const hidden = hiddenCategories.includes(n.key);
                return (
                  <View key={n.key} style={{ borderBottomColor: colors.line, borderBottomWidth: 1 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 12 }}>
                      <Pressable onPress={() => setExpandedCat(open ? null : n.key)} style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 }}>
                        <MaterialCommunityIcons name="folder-outline" size={18} color={hidden ? colors.subtle : colors.primaryDark} />
                        <Text style={{ color: hidden ? colors.muted : colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800", textDecorationLine: hidden ? "line-through" : "none" }}>{n.label}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{n.children?.length ?? 0} alt</Text>
                      </Pressable>
                      {/* Gizle/Göster — gezinme yüzeylerinden (menü/keşfet/kategoriler) gizler; ilan verme etkilenmez. */}
                      <Pressable onPress={() => toggleHiddenCategory(n.key)} accessibilityLabel={hidden ? "Kategoriyi göster" : "Kategoriyi gizle"} style={{ alignItems: "center", backgroundColor: hidden ? colors.warningSoft : colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <MaterialCommunityIcons name={hidden ? "eye-off-outline" : "eye-outline"} size={14} color={hidden ? colors.warning : colors.muted} />
                        <Text style={{ color: hidden ? colors.warning : colors.muted, fontSize: 11, fontWeight: "800" }}>{hidden ? "Gizli" : "Görünür"}</Text>
                      </Pressable>
                      <Pressable onPress={() => setExpandedCat(open ? null : n.key)}><MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} /></Pressable>
                    </View>
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
            {sales.filter((s) => s.status === "disputed").length > 0 ? (
              <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 10, flexDirection: "row", gap: 8, marginBottom: 10, padding: 11 }}>
                <MaterialCommunityIcons name="scale-balance" size={17} color={colors.accent} />
                <Text style={{ color: colors.accent, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{sales.filter((s) => s.status === "disputed").length} anlaşmazlık kaydı arabuluculuk bekliyor (en üstte).</Text>
              </View>
            ) : null}
            <Table head={["İLAN", "KOMİSYON", "ORTAKLIK", "DURUM", "ARABULUCULUK"]} cols={[2, 1, 1.3, 1, 1.5]}>
              {[...sales].sort((a, b) => (a.status === "disputed" ? -1 : 0) - (b.status === "disputed" ? -1 : 0)).map((s) => {
                const listing = listings.find((l) => l.id === s.listingId);
                const p = partnerships.find((x) => x.id === s.partnershipId);
                return (
                  <Row key={s.id} cols={[2, 1, 1.3, 1, 1.5]} cells={[
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{listing?.title ?? s.listingId}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{money(s.commissionAmount)}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{p ? findUser(p.partnerId)?.name : "—"}</Text>,
                    <View style={{ alignSelf: "flex-start", backgroundColor: SALE_TONE[s.status].tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: SALE_TONE[s.status].color, fontSize: 10.5, fontWeight: "900" }}>{SALE_TONE[s.status].label}</Text></View>,
                    s.status === "disputed" ? (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => confirmAction("Anlaşmazlık çözülüp komisyon ONAYLANSIN mı?", () => updateSaleStatus(s.id, "approved"))} accessibilityRole="button" accessibilityLabel="Anlaşmazlığı çöz ve onayla"><Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "900" }}>Çöz · Onayla</Text></Pressable>
                        <Pressable onPress={() => confirmAction("Bu komisyon kaydı İPTAL edilsin mi?", () => updateSaleStatus(s.id, "cancelled"))} accessibilityRole="button" accessibilityLabel="Komisyonu iptal et"><Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "900" }}>İptal</Text></Pressable>
                      </View>
                    ) : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>—</Text>
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

        {section === "settings" && !canManageUsers ? (
          <Panel title="Ayarlar" sub="Yalnızca admin">
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>Site duyurusu ve platform ayarları yalnızca admin hesaplarına açıktır (sen moderatörsün). Bu değişiklikler moderatör rolüyle uygulanmaz.</Text>
          </Panel>
        ) : null}
        {section === "settings" && canManageUsers ? (
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
  disputedN: number; unpaidCommission: number; pendingCat: number; pendingLoc: number;
  listings: ReturnType<typeof useStore>["listings"]; users: ReturnType<typeof useStore>["users"]; findUser: ReturnType<typeof useStore>["findUser"];
  sales: ReturnType<typeof useStore>["sales"]; partnerships: ReturnType<typeof useStore>["partnerships"]; reports: ReturnType<typeof useStore>["reports"];
  notifications: ReturnType<typeof useStore>["notifications"]; leads: ReturnType<typeof useStore>["leads"];
  setSection: (s: Section) => void;
};
function Dashboard({ usersN, listingsN, salesN, commission, activeN, pendingN, reportsN, partnershipsN, messagesN, disputedN, unpaidCommission, pendingCat, pendingLoc, listings, users, sales, partnerships, reports, findUser, notifications, leads, setSection }: DashProps) {
  const recentUsers = users.slice().filter((u) => u.status !== "deleted").slice(-5).reverse();
  const recentListings = sortByDate(listings, "createdAt").slice(0, 6);
  const chart = monthlyListingChart(listings);
  const openWork = pendingN + reportsN + partnershipsN + disputedN + pendingCat + pendingLoc;
  const publishRate = listingsN ? Math.round((activeN / listingsN) * 100) : 0;
  const conversionRate = leads.length ? Math.round((salesN / leads.length) * 100) : 0;
  const listingStatusData = listingStatusStats(listings);
  const categoryData = topCategoryStats(listings, 7);
  const saleStatusData = saleStatusStats(sales);
  const funnelData = [
    { label: "Yayındaki ilan", value: activeN, color: colors.primaryDark },
    { label: "Ortaklık", value: partnerships.length, color: colors.violet },
    { label: "Talep", value: leads.length, color: colors.info },
    { label: "Satış kaydı", value: sales.length, color: colors.success }
  ];
  const resolvedReports = reports.filter((r) => r.status === "resolved" || r.status === "rejected").length;
  const reportResolutionRate = reports.length ? Math.round((resolvedReports / reports.length) * 100) : 100;
  const latestActivity = [
    ...notifications.map((n) => ({ icon: "bell-outline" as const, tone: colors.primary, title: n.title, meta: n.createdAt })),
    ...leads.map((l) => ({ icon: "account-arrow-right-outline" as const, tone: colors.info, title: `Yeni talep: ${l.buyerName || "Alıcı"}`, meta: l.createdAt })),
    ...recentListings.map((l) => ({ icon: "file-document-outline" as const, tone: l.status === "pending_review" ? colors.warning : colors.success, title: l.title, meta: `${listingStatusLabel(l.status)} · ${l.createdAt}` }))
  ].slice(0, 7);
  const priorities = [
    { label: "Onay bekleyen ilan", value: pendingN, icon: "clock-alert-outline" as const, tone: colors.warning, go: "listings" as Section, helper: "Yayına alınmayı bekliyor" },
    { label: "Açık şikayet", value: reportsN, icon: "flag-outline" as const, tone: colors.accent, go: "complaints" as Section, helper: "Kullanıcı güveni için öncelikli" },
    { label: "Ortaklık talebi", value: partnershipsN, icon: "handshake-outline" as const, tone: colors.violet, go: "partnerships" as Section, helper: "Satıcı onayı bekliyor" },
    { label: "Öneri kuyruğu", value: pendingCat + pendingLoc, icon: "shape-plus" as const, tone: colors.info, go: pendingCat ? "categories" as Section : "locations" as Section, helper: "Kategori ve konum önerileri" }
  ];

  return (
    <View style={{ gap: 18 }}>
      <View style={{ backgroundColor: "#0A5C44", borderRadius: 18, overflow: "hidden" }}>
        <View style={{ gap: 18, padding: 22 }}>
          <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 6, minWidth: 260 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "900", lineHeight: 34 }}>Yönetim Merkezi</Text>
              <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 680 }}>
                İlan onayı, kullanıcı güvenliği, ortaklık talepleri ve gelir kayıtlarını tek ekrandan izle. Öncelikli işler aşağıda otomatik öne çıkarılır.
              </Text>
            </View>
            <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
              <MaterialCommunityIcons name={openWork ? "alert-circle-outline" : "check-decagram-outline"} size={20} color="#FFFFFF" />
              <View>
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900" }}>{openWork}</Text>
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11.5, fontWeight: "700" }}>açık iş</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <HeroMetric label="Yayın oranı" value={`%${publishRate}`} icon="chart-donut" />
            <HeroMetric label="Toplam komisyon kaydı" value={money(commission)} icon="cash-multiple" />
            <HeroMetric label="Talep/satış dönüşümü" value={`%${conversionRate}`} icon="trending-up" />
            <HeroMetric label="Mesaj hacmi" value={`${messagesN}`} icon="forum-outline" />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {priorities.map((p) => <PriorityCard key={p.label} {...p} onPress={() => setSection(p.go)} />)}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <Stat icon="account-group" tint={colors.infoSoft} color={colors.info} value={`${usersN}`} title="Toplam Kullanıcı" helper={`${recentUsers.length} son kayıt gösteriliyor`} onPress={() => setSection("users")} />
        <Stat icon="file-document" tint={colors.primarySoft} color={colors.primaryDark} value={`${listingsN}`} title="Toplam İlan" helper={`${activeN} yayında`} onPress={() => setSection("listings")} />
        <Stat icon="check-decagram" tint={colors.successSoft} color={colors.success} value={`${activeN}`} title="Yayındaki İlan" helper={`%${publishRate} yayın oranı`} onPress={() => setSection("listings")} />
        <Stat icon="message-text" tint={colors.primarySoft} color={colors.primaryDark} value={`${messagesN}`} title="Toplam Mesaj" helper={`${leads.length} talep kaydı`} onPress={() => setSection("messages")} />
        <Stat icon="cart-check" tint={colors.successSoft} color={colors.success} value={`${salesN}`} title="Satış Kaydı" helper={`%${conversionRate} talep dönüşümü`} onPress={() => setSection("commissions")} />
        <Stat icon="cash-clock" tint={colors.warningSoft} color={colors.warning} value={money(unpaidCommission)} title="Bekleyen Komisyon" helper={`${disputedN} anlaşmazlık`} onPress={() => setSection("commissions")} />
      </View>

      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flex: 2, gap: 16, minWidth: 300 }}>
          <Panel title="Aylık İlan Performansı" sub="Son 12 ay — gerçek ilan verisi">
            <BarChart data={chart.data} labels={chart.labels} />
          </Panel>
          <Panel title="Operasyon Sağlığı" sub="Günlük kontrol için kritik oranlar">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <HealthCard label="Yayın oranı" value={`%${publishRate}`} detail={`${activeN}/${listingsN || 0} ilan yayında`} tone={publishRate >= 70 ? "success" : publishRate >= 40 ? "warning" : "accent"} />
              <HealthCard label="Açık iş yükü" value={`${openWork}`} detail="İnceleme bekleyen toplam kayıt" tone={openWork === 0 ? "success" : openWork < 5 ? "warning" : "accent"} />
              <HealthCard label="Şikayet çözümü" value={`%${reportResolutionRate}`} detail={`${resolvedReports}/${reports.length || 0} kayıt kapanmış`} tone={reportResolutionRate >= 85 ? "success" : reportResolutionRate >= 55 ? "warning" : "accent"} />
              <HealthCard label="Komisyon riski" value={money(unpaidCommission)} detail={`${disputedN} anlaşmazlık var`} tone={disputedN ? "accent" : unpaidCommission ? "warning" : "success"} />
            </View>
          </Panel>
          <Panel title="Gerçek Veri Grafikleri" sub="İlan durumu, kategori yoğunluğu ve satış hunisi mevcut kayıtlardan hesaplanır">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <View style={{ flex: 1, minWidth: 240 }}>
                <SegmentChart title="İlan Durumu" total={listings.length} data={listingStatusData} />
              </View>
              <View style={{ flex: 1, minWidth: 240 }}>
                <HorizontalBars title="Kategori Dağılımı" data={categoryData} emptyLabel="Kategori verisi yok" />
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <FunnelChart data={funnelData} />
            </View>
            <View style={{ marginTop: 12 }}>
              <SegmentChart title="Komisyon/Satış Durumu" total={sales.length} data={saleStatusData} />
            </View>
          </Panel>
          <Panel title="Son Eklenen İlanlar" sub="En yeni kayıtlar ve yayın durumları">
            {recentListings.length === 0 ? <EmptyState title="İlan yok" body="Yeni ilanlar geldiğinde burada görünür." /> : (
              <Table head={["İLAN", "KATEGORİ", "FİYAT", "DURUM"]} cols={[2.2, 1.2, 1, 1]}>
                {recentListings.map((l) => (
                  <Row key={l.id} cols={[2.2, 1.2, 1, 1]} cells={[
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{l.title}</Text>,
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category}</Text>,
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{money(l.price)}</Text>,
                    <StatusBadge label={listingStatusLabel(l.status)} tone={l.status === "active" ? "success" : l.status === "rejected" ? "accent" : l.status === "pending_review" ? "warning" : "neutral"} />
                  ]} />
                ))}
              </Table>
            )}
          </Panel>
        </View>
        <View style={{ flex: 1, gap: 16, minWidth: 280 }}>
          <Panel title="Son Aktiviteler" sub="Bildirim, talep ve ilan akışı">
            {latestActivity.length === 0 ? <EmptyState title="Aktivite yok" body="Yeni bildirim veya talep geldiğinde burada görünür." /> : latestActivity.map((a, i) => (
              <View key={`${a.title}-${i}`} style={{ alignItems: "flex-start", borderBottomColor: i === latestActivity.length - 1 ? "transparent" : colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
                  <MaterialCommunityIcons name={a.icon} size={15} color={a.tone} />
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800", lineHeight: 17 }}>{a.title}</Text>
                  <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{a.meta}</Text>
                </View>
              </View>
            ))}
          </Panel>
          <Panel title="Hızlı İşlemler" sub="Sık kullanılan yönetim ekranları">
            <View style={{ gap: 8 }}>
              {[
                { label: "İlan onay kuyruğu", body: `${pendingN} bekleyen`, icon: "playlist-check" as const, go: "listings" as Section },
                { label: "Şikayetleri incele", body: `${reportsN} açık kayıt`, icon: "shield-alert-outline" as const, go: "complaints" as Section },
                { label: "Ortaklık talepleri", body: `${partnershipsN} başvuru`, icon: "handshake-outline" as const, go: "partnerships" as Section },
                { label: "Raporlar ve grafikler", body: "Performans ekranı", icon: "chart-box-outline" as const, go: "reports" as Section }
              ].map((k) => (
                <Pressable key={k.label} onPress={() => setSection(k.go)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 })}>
                  <MaterialCommunityIcons name={k.icon} size={20} color={colors.primaryDark} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{k.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{k.body}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.subtle} />
                </Pressable>
              ))}
            </View>
          </Panel>
          <Panel title="Son Kayıt Olan Kullanıcılar" sub="Yeni hesaplar">
            {recentUsers.length === 0 ? <EmptyState title="Kullanıcı yok" body="Yeni kullanıcılar burada listelenir." /> : recentUsers.map((u, i) => (
              <View key={u.id} style={{ alignItems: "center", borderBottomColor: i === recentUsers.length - 1 ? "transparent" : colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 9 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 32, justifyContent: "center", width: 32 }}>
                  <MaterialCommunityIcons name="account" size={17} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{u.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{userRoleLabel(u.role)} · {u.listingCount ?? 0} ilan · ⭐ {u.rating}</Text>
                </View>
                <StatusBadge label={u.status === "suspended" ? "Askıda" : "Aktif"} tone={u.status === "suspended" ? "accent" : "success"} />
              </View>
            ))}
          </Panel>
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, tint, color, value, title, helper, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; helper?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: pressed && onPress ? colors.primary : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 166, flexGrow: 1, gap: 9, maxWidth: 300, minHeight: 106, minWidth: 0, padding: 15 })}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        {onPress ? <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.subtle} /> : null}
      </View>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{title}</Text>
        {helper ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{helper}</Text> : null}
      </View>
    </Pressable>
  );
}

function HeroMetric({ label, value, icon }: { label: string; value: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minWidth: 190, paddingHorizontal: 13, paddingVertical: 11 }}>
      <MaterialCommunityIcons name={icon} size={19} color="#FFFFFF" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{value}</Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" }}>{label}</Text>
      </View>
    </View>
  );
}

function PriorityCard({ label, value, helper, icon, tone, onPress }: { label: string; value: number; helper: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; onPress: () => void }) {
  const empty = value === 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: pressed ? tone : colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 260, flexGrow: 1, minWidth: 0, opacity: pressed ? 0.86 : 1, padding: 16 })}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: empty ? colors.successSoft : `${tone}22`, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
          <MaterialCommunityIcons name={empty ? "check-circle-outline" : icon} size={21} color={empty ? colors.success : tone} />
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text style={{ color: empty ? colors.success : tone, fontSize: 22, fontWeight: "900" }}>{value}</Text>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{label}</Text>
          </View>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{empty ? "Şu an işlem beklemiyor" : helper}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
      </View>
    </Pressable>
  );
}

function HealthCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "success" | "warning" | "accent" }) {
  const palette = tone === "success"
    ? { bg: colors.successSoft, fg: colors.success, icon: "check-circle-outline" as const }
    : tone === "warning"
      ? { bg: colors.warningSoft, fg: colors.warning, icon: "alert-circle-outline" as const }
      : { bg: colors.accentSoft, fg: colors.accent, icon: "alert-octagon-outline" as const };
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 180, flexGrow: 1, gap: 9, minWidth: 0, padding: 13 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <View style={{ alignItems: "center", backgroundColor: palette.bg, borderRadius: 999, height: 28, justifyContent: "center", width: 28 }}>
          <MaterialCommunityIcons name={palette.icon} size={15} color={palette.fg} />
        </View>
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "900" }}>{label}</Text>
      </View>
      <Text style={{ color: palette.fg, fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{detail}</Text>
    </View>
  );
}

type ChartDatum = { label: string; value: number; color: string };

function SegmentChart({ title, total, data }: { title: string; total: number; data: ChartDatum[] }) {
  const visible = data.filter((d) => d.value > 0);
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{total} kayıt</Text>
      </View>
      {visible.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Henüz veri yok.</Text>
      ) : (
        <>
          <View style={{ borderRadius: 999, flexDirection: "row", height: 12, overflow: "hidden", width: "100%" }}>
            {visible.map((d) => (
              <View key={d.label} style={{ backgroundColor: d.color, flex: Math.max(d.value, 0.5) }} />
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {visible.map((d) => {
              const rate = total ? Math.round((d.value / total) * 100) : 0;
              return (
                <View key={d.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <View style={{ backgroundColor: d.color, borderRadius: 999, height: 8, width: 8 }} />
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700" }}>{d.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{d.value} · %{rate}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function HorizontalBars({ title, data, emptyLabel }: { title: string; data: ChartDatum[]; emptyLabel: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 }}>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{title}</Text>
      {data.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{emptyLabel}</Text> : null}
      <View style={{ gap: 10 }}>
        {data.map((d) => (
          <View key={d.label} style={{ gap: 5 }}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" }}>{d.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{d.value}</Text>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <View style={{ backgroundColor: d.color, borderRadius: 999, height: "100%", width: `${Math.max(6, Math.round((d.value / max) * 100))}%` }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function FunnelChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="filter-variant" size={17} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Ortak Satış Hunisi</Text>
      </View>
      <View style={{ gap: 9 }}>
        {data.map((d, i) => {
          const width = Math.max(12, Math.round((d.value / max) * 100));
          const prev = i === 0 ? d.value : data[i - 1].value;
          const rate = prev ? Math.round((d.value / prev) * 100) : 0;
          return (
            <View key={d.label} style={{ gap: 5 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{d.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{d.value}{i > 0 ? ` · önceki adıma göre %${rate}` : ""}</Text>
              </View>
              <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 12, overflow: "hidden" }}>
                <View style={{ backgroundColor: d.color, borderRadius: 999, height: "100%", width: `${width}%` }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "accent" | "neutral" }) {
  const bg = tone === "success" ? colors.successSoft : tone === "warning" ? colors.warningSoft : tone === "accent" ? colors.accentSoft : colors.surfaceAlt;
  const fg = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "accent" ? colors.accent : colors.muted;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 10.5, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function sortByDate<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.slice().sort((a, b) => dateScore(b[key]) - dateScore(a[key]));
}

function dateScore(value: unknown) {
  if (typeof value !== "string") return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function listingStatusLabel(status: string) {
  if (status === "active") return "Yayında";
  if (status === "pending_review") return "İncelemede";
  if (status === "rejected") return "Reddedildi";
  if (status === "paused") return "Duraklatıldı";
  if (status === "sold") return "Satıldı";
  if (status === "expired") return "Süresi doldu";
  return status;
}

function userRoleLabel(role?: UserRole) {
  if (role === "super_admin") return "Süper Admin";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderatör";
  if (role === "seller") return "Satıcı";
  if (role === "partner") return "Ortak";
  return "Üye";
}

function listingStatusStats(listings: ReturnType<typeof useStore>["listings"]): ChartDatum[] {
  const colorsByStatus: Record<string, string> = {
    active: colors.success,
    pending_review: colors.warning,
    rejected: colors.accent,
    paused: colors.muted,
    sold: colors.info,
    expired: colors.violet,
    draft: colors.subtle
  };
  return Object.entries(countBy(listings, (l) => l.status)).map(([status, value]) => ({
    label: listingStatusLabel(status),
    value,
    color: colorsByStatus[status] ?? colors.primaryDark
  }));
}

function saleStatusStats(sales: ReturnType<typeof useStore>["sales"]): ChartDatum[] {
  return Object.entries(countBy(sales, (s) => s.status)).map(([status, value]) => ({
    label: SALE_TONE[status as SaleStatus]?.label ?? status,
    value,
    color: SALE_TONE[status as SaleStatus]?.color ?? colors.primaryDark
  }));
}

function topCategoryStats(listings: ReturnType<typeof useStore>["listings"], limit: number): ChartDatum[] {
  const palette = [colors.primaryDark, colors.info, colors.violet, colors.gold, colors.success, colors.accent, colors.warning];
  return Object.entries(countBy(listings, (l) => l.category || "Kategori yok"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
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

// JSON ice aktarim: esnek sema. Kabul edilen ogeler:
//  { name|label, image?, subcategories?: (string | {name|label})[] }
function parseCategoryImport(raw: string): ExtraCategory[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
  const out: ExtraCategory[] = [];
  arr.forEach((c: Record<string, unknown>, i: number) => {
    const label = String((c.name ?? c.label ?? c.title ?? "") as string).trim();
    if (!label) return;
    const subsRaw = (c.subcategories ?? c.children ?? c.subs ?? []) as unknown[];
    const subcategories = (Array.isArray(subsRaw) ? subsRaw : []).map((s) => {
      const sl = typeof s === "string" ? s : String((s as Record<string, unknown>)?.name ?? (s as Record<string, unknown>)?.label ?? "");
      return { label: sl.trim(), slug: slugifyTr(sl) };
    }).filter((s) => s.label);
    out.push({ id: uuid(), key: `x-${slugifyTr(label)}-${i}`, label, slug: slugifyTr(label), image: String((c.image ?? c.icon ?? "") as string), subcategories, sortOrder: 1000 + i, isActive: true });
  });
  return out;
}

function CategoryManager({ extra, onSave, onDelete, onImport, confirmAction }: { extra: ExtraCategory[]; onSave: (c: ExtraCategory) => void; onDelete: (id: string) => void; onImport: (list: ExtraCategory[]) => number; confirmAction: (m: string, cb: () => void) => void }) {
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("");
  const [subs, setSubs] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const doImport = () => {
    try {
      const list = parseCategoryImport(importText);
      if (!list.length) { setImportMsg("Geçerli kategori bulunamadı. JSON dizi formatını kontrol et."); return; }
      confirmAction(`${list.length} kategori içe aktarılsın mı?`, () => { const n = onImport(list); setImportMsg(`✓ ${n} kategori içe aktarıldı.`); setImportText(""); });
    } catch (e) {
      setImportMsg("JSON çözümlenemedi: " + (e as Error).message);
    }
  };
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
      <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 12, padding: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>JSON ile Toplu İçe Aktar</Text>
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Bir JSON dizisi yapıştır (binlerce kategori). Örnek: {`[{"name":"Elektronik","subcategories":["Telefon","Bilgisayar"]},{"name":"Vasıta","subcategories":[{"name":"Otomobil"}]}]`}</Text>
        <TextInput value={importText} onChangeText={setImportText} placeholder='[{"name":"...","subcategories":["..."]}]' placeholderTextColor={colors.muted} multiline style={{ ...inputStyle, minHeight: 120, paddingVertical: 10 }} />
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <Pressable disabled={!importText.trim()} onPress={doImport} style={{ alignItems: "center", backgroundColor: importText.trim() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
            <MaterialCommunityIcons name="upload-outline" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>İçe Aktar</Text>
          </Pressable>
          {importMsg ? <Text style={{ color: importMsg.startsWith("✓") ? colors.success : colors.accent, fontSize: 12, fontWeight: "700" }}>{importMsg}</Text> : null}
        </View>
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
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => onChange("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
    </View>
  );
}

function BarChart({ data, labels }: { data: number[]; labels?: string[] }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((sum, v) => sum + v, 0);
  const avg = data.length ? Math.round(total / data.length) : 0;
  const PLOT = 150; // grafik yüksekliği (px)
  const gridVals = [max, Math.round(max * 0.5), 0];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <MiniStat label="Toplam" value={`${total}`} />
        <MiniStat label="Aylık ort." value={`${avg}`} />
        <MiniStat label="Tepe ay" value={`${max}`} />
      </View>
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, padding: 16 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Y ekseni etiketleri */}
          <View style={{ height: PLOT, justifyContent: "space-between", paddingBottom: 2 }}>
            {gridVals.map((g, gi) => (
              <Text key={gi} style={{ color: colors.subtle, fontSize: 9.5, fontVariant: ["tabular-nums"], fontWeight: "800" }}>{g}</Text>
            ))}
          </View>
          {/* Grafik alanı: ızgara çizgileri + çubuklar */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ height: PLOT, position: "relative" }}>
              {/* yatay ızgara çizgileri */}
              {[0, 0.5, 1].map((f, fi) => (
                <View key={fi} style={{ backgroundColor: colors.line, height: 1, left: 0, position: "absolute", right: 0, top: f * (PLOT - 1), opacity: 0.6 }} />
              ))}
              {/* çubuklar (tabana oturur, üstü yuvarlak) */}
              <View style={{ alignItems: "flex-end", bottom: 0, flexDirection: "row", gap: 6, left: 0, position: "absolute", right: 0 }}>
                {data.map((v, i) => {
                  const on = v === max && max > 0;
                  const h = v > 0 ? Math.max(4, Math.round((v / max) * PLOT)) : 0;
                  return (
                    <View key={i} style={{ alignItems: "center", flex: 1, gap: 3, justifyContent: "flex-end", minWidth: 0 }}>
                      {v > 0 ? <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 9.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{v}</Text> : null}
                      <View style={{ backgroundColor: on ? colors.primary : colors.primarySoft, borderTopLeftRadius: 5, borderTopRightRadius: 5, height: h, width: "100%" }} />
                    </View>
                  );
                })}
              </View>
            </View>
            {/* X ekseni etiketleri */}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
              {data.map((v, i) => (
                <Text key={i} numberOfLines={1} style={{ color: v === max && max > 0 ? colors.primaryDark : colors.subtle, flex: 1, fontSize: 9.5, fontWeight: "800", textAlign: "center" }}>{labels ? labels[i] : i + 1}</Text>
              ))}
            </View>
          </View>
        </View>
      </View>
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

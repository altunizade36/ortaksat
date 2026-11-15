import { MaterialCommunityIcons } from "@/components/icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { commissionValueLabel, moneyIn, partnershipProposal, partnershipTerms } from "@/lib/format";
import { displayListingTitle } from "@/lib/listing-title";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { partnershipStatusLabels } from "@/lib/status-labels";
import type { Listing, Partnership, Sale } from "@/lib/types";

/**
 * Ortak Satış Anlaşması — TEK anlaşma görünümü (ortak ve satıcı aynı kartı görür; yalnız hitap değişir).
 *
 * Gösterdikleri sunucunun satışta uyguladığı değerlerle aynıdır (bkz. lib/format.ts → partnershipTerms):
 *  - komisyon: katılımda KİLİTLENEN anlaşma + (varsa ve daha yüksekse) ortağa özel artırım,
 *  - bonus (ilk N satışta +X), iade süresi, ödeme vadesi: anlaşmadan,
 *  - zaman çizgisi: başvuru → şartların kilitlenmesi → onay → bitiş.
 * ÖDEME SİSTEM DIŞINDADIR — platform yalnızca anlaşmayı kayıt altına alır.
 */
export function AgreementCard({
  listing,
  partnership,
  viewer = "partner",
  partnerName,
  showProduct = true,
  priorSales = 0,
  embedded = false
}: {
  listing: Listing;
  partnership?: Partnership;
  /** Kartı kim görüyor: ortak ("sana özel") ya da satıcı ("ortağa özel"). */
  viewer?: "partner" | "seller";
  /** Satıcı görünümünde ortağın adı (satır olarak gösterilir). */
  partnerName?: string;
  /** Ürün adı/fiyatı satırları (kartın üstünde zaten gösteriliyorsa kapat). */
  showProduct?: boolean;
  /** Ortağın bu ilandaki iptal olmayan satış sayısı (kademeli oran ve kalan bonus için). */
  priorSales?: number;
  /** Başka bir kartın içinde: hafif zeminli, kenarlıksız çizilir; alttaki genel uyarı metni gösterilmez. */
  embedded?: boolean;
}) {
  const { language } = useLanguage();
  const tr = (text: string) => translateCopy(text, language);
  const seller = viewer === "seller";
  const terms = partnershipTerms(listing, partnership, priorSales);
  const proposal = partnership ? partnershipProposal(listing, partnership) : null;
  const status = partnership?.status;
  // Sonlandırılan/kapatılan ortaklık bir zamanlar ONAYLANMIŞ olabilir; geri çekilen başvuru hiç onaylanmamıştır.
  const wasApproved = status === "active" || status === "completed" || Boolean(partnership && status !== "pending" && status !== "rejected" && (partnership.approvedAt || (partnership.agreedAt && listing.partnershipMode === "open")));
  const ended = status === "cancelled" || status === "blocked" || status === "completed";
  const rejected = status === "rejected";
  const days = (value: number) => (value > 0 ? `${value} ${tr("gün")}` : tr("Yok"));
  const date = (value?: string) => { if (!value) return ""; const dt = new Date(value); return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(language === "en" ? "en-GB" : "tr-TR"); };

  const agreedLabel = commissionValueLabel(terms.agreedType, terms.agreedValue, listing.currency);
  const bonusLeft = terms.bonusAmount > 0 && terms.bonusQuota > 0 ? Math.max(0, terms.bonusQuota - priorSales) : 0;

  const rows: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (showProduct) {
    rows.push({ label: tr("Ürün"), value: displayListingTitle(listing.title) });
    rows.push({ label: tr("Ürün fiyatı"), value: moneyIn(listing.price, listing.currency) });
  }
  if (seller && partnerName) rows.push({ label: tr("Ortak"), value: partnerName });
  rows.push({ label: tr(terms.locked ? "Anlaşılan komisyon" : "Komisyon (ilanın güncel değeri)"), value: agreedLabel });
  if (terms.overrideType && typeof terms.overrideValue === "number") {
    const overrideLabel = commissionValueLabel(terms.overrideType, terms.overrideValue, listing.currency);
    rows.push(terms.overrideApplies
      ? { label: tr(seller ? "Ortağa özel artırım" : "Sana özel artırım"), value: `${overrideLabel} · ${tr("uygulanır")}`, strong: true }
      : { label: tr("Özel komisyon"), value: `${overrideLabel} · ${tr("anlaşılan daha yüksek, o uygulanır")}` });
  }
  rows.push({ label: tr(seller ? "Satış başına ödeyeceğin (ilan fiyatından)" : "Satış başına kazancın (ilan fiyatından)"), value: `≈ ${moneyIn(terms.amount, listing.currency)}`, strong: true });
  if (terms.bonusAmount > 0 && terms.bonusQuota > 0) {
    rows.push({
      label: tr("Başlangıç bonusu"),
      value: `${tr("İlk")} ${terms.bonusQuota} ${tr("satışta")} +${moneyIn(terms.bonusAmount, listing.currency)}${partnership && wasApproved ? ` · ${bonusLeft} ${tr("satış kaldı")}` : ""}`
    });
  }
  rows.push({ label: tr("İade süresi"), value: terms.returnWindowDays > 0 ? `${days(terms.returnWindowDays)} · ${tr("komisyon bu süre bitince kesinleşir")}` : tr("Yok · komisyon satışla kesinleşir") });
  rows.push({ label: tr("Ödeme vadesi"), value: terms.commissionDueDays > 0 ? `${tr("Kesinleşmeden sonra")} ${days(terms.commissionDueDays)}` : tr("Taraflar belirler") });
  rows.push({ label: tr("Ödeme yöntemi"), value: tr("Taraflar belirler (havale/EFT, elden…)") });

  const statusTone = status === "active" || status === "completed" ? colors.primary : status === "pending" ? colors.goldInk : status ? colors.accent : colors.muted;
  const statusTint = status === "active" || status === "completed" ? colors.primarySoft : status === "pending" ? colors.warningSoft : status === "rejected" || status === "blocked" ? colors.accentSoft : colors.surfaceAlt;
  const statusText = !partnership ? tr("Henüz başvuru yok") : status === "cancelled" && !wasApproved ? tr("Başvuru geri çekildi") : tr(partnershipStatusLabels[partnership.status]);

  const steps: Array<{ done: boolean; bad?: boolean; label: string; date: string; detail?: string }> = [];
  if (partnership) {
    steps.push({ done: true, label: tr("Başvuru yapıldı"), date: date(partnership.createdAt) });
    if (partnership.agreedAt) steps.push({ done: true, label: tr("Şartlar kilitlendi"), date: date(partnership.agreedAt), detail: tr("İlan sonradan değişse de bu ortaklığın şartları değişmez.") });
    if (rejected) steps.push({ done: false, bad: true, label: tr("Satıcı başvuruyu reddetti"), date: date(partnership.endedAt), detail: partnership.rejectionReason });
    else if (status === "pending") steps.push({ done: false, label: tr("Satıcı onayı bekleniyor"), date: "" });
    else if (wasApproved) steps.push({ done: true, label: tr("Onaylandı — ortaklık başladı"), date: date(partnership.approvedAt ?? partnership.agreedAt) });
    if (ended) {
      steps.push(status === "completed"
        ? { done: true, label: tr("Ortaklık tamamlandı"), date: date(partnership.endedAt) }
        : { done: false, bad: true, label: tr(status === "blocked" ? "Satıcı ortaklığı kapattı" : wasApproved ? "Ortaklık sonlandırıldı" : "Başvuru geri çekildi"), date: date(partnership.endedAt), detail: wasApproved ? tr("Bu tarihe kadar kaydedilen satışların komisyonu geçerlidir.") : undefined });
    }
  }

  return (
    <View style={embedded ? { backgroundColor: colors.surfaceAlt, borderRadius: 10, gap: 10, padding: 12 } : { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, height: 34, justifyContent: "center", width: 34 }}>
          <MaterialCommunityIcons name="file-sign" size={19} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{tr("Ortak Satış Anlaşması")}</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{tr("Şartlar kayıt altına alınır; ödeme taraflar arasındadır.")}</Text>
        </View>
        <View style={{ backgroundColor: statusTint, borderRadius: 999, flexShrink: 0, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: statusTone, fontSize: 11.5, fontWeight: "900" }}>{statusText}</Text>
        </View>
      </View>

      <View style={{ gap: 7 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "700", minWidth: 0 }}>{r.label}</Text>
            <Text selectable style={{ color: r.strong ? colors.primary : colors.ink, flex: 1, fontSize: 12.5, fontWeight: r.strong ? "900" : "800", minWidth: 0, textAlign: "right" }}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* Onay bekleyen başvuruda ortağın komisyon önerisi (yalnız ilan komisyonundan yüksekse anlamlıdır). */}
      {proposal ? (
        <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 10 }}>
          <MaterialCommunityIcons name="hand-coin-outline" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 17, minWidth: 0 }}>
            {tr(seller ? "Ortağın önerisi" : "Komisyon önerin")}: {commissionValueLabel(proposal.type, proposal.value, listing.currency)}. {tr(seller ? "Öneriyle kabul edersen bu oran ortağa özel olarak kaydedilir; ilan oranıyla da kabul edebilirsin." : "Satıcı öneriyle kabul ederse sana özel oran olarak kaydedilir; etmezse ilandaki komisyon geçerli olur.")}
          </Text>
        </View>
      ) : null}

      {steps.length > 0 ? (
        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900", marginBottom: 7 }}>{tr("Anlaşmanın geçmişi")}</Text>
          {steps.map((s, i) => (
            <View key={s.label} style={{ flexDirection: "row", gap: 9 }}>
              <View style={{ alignItems: "center", width: 16 }}>
                <MaterialCommunityIcons name={s.bad ? "close-circle" : s.done ? "check-circle" : "circle-outline"} size={15} color={s.bad ? colors.accent : s.done ? colors.primary : colors.subtle} />
                {i < steps.length - 1 ? <View style={{ backgroundColor: s.done && !s.bad ? colors.primary : colors.line, flex: 1, marginVertical: 1, width: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingBottom: i < steps.length - 1 ? 8 : 0 }}>
                <Text style={{ color: s.done || s.bad ? colors.ink : colors.muted, fontSize: 12, fontWeight: s.done ? "800" : "600" }}>{s.label}</Text>
                {s.detail ? <Text selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{s.detail}</Text> : null}
                {s.date ? <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{s.date}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {embedded ? null : (
        <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", gap: 8, padding: 10 }}>
          <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16, minWidth: 0 }}>
            {tr('OrtakSat ödeme, tahsilat veya teslimat yapmaz. Satış olunca satıcı satışı ortağa kaydeder; komisyon satıcı ile ortak arasında, anlaşılan kanaldan ödenir ve panelden "Ödendi/Alındı" olarak işaretlenir.')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Bir satış kaydındaki ANLAŞMAZLIK: gerekçe, kimin açtığı ve tarih (sunucu açıldığı anda kilitler; not alanı
 * sonradan değişse de kalır). İki taraf da aynı kutuyu görür. Anlaşmazlık kapandıysa geçmiş notu olarak kalır.
 */
export function DisputeNote({ sale, partnerId, sellerId, currentUserId }: { sale: Sale; partnerId?: string; sellerId?: string; currentUserId?: string }) {
  const { language } = useLanguage();
  const tr = (text: string) => translateCopy(text, language);
  const open = sale.status === "disputed";
  // Yerel (henüz sunucudan dönmemiş) anlaşmazlıkta gerekçe ödeme notunda durur.
  const reason = (sale.disputeReason ?? (open ? sale.payoutNote : undefined))?.replace(/^Anlaşmazlık:\s*/i, "").trim();
  if (!reason) return null;
  const by = sale.disputeOpenedBy;
  const who = !by ? "" : by === currentUserId ? tr("Sen bildirdin") : by === partnerId ? tr("Ortak bildirdi") : by === sellerId ? tr("Satıcı bildirdi") : "";
  const when = sale.disputeOpenedAt ? new Date(sale.disputeOpenedAt) : null;
  const meta = [who, when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString(language === "en" ? "en-GB" : "tr-TR") : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ backgroundColor: open ? colors.accentSoft : colors.surfaceAlt, borderRadius: 10, gap: 4, padding: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <MaterialCommunityIcons name="alert-octagon-outline" size={15} color={open ? colors.accent : colors.muted} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "900", minWidth: 0 }}>{tr(open ? "Anlaşmazlık gerekçesi" : "Bu satışta anlaşmazlık bildirilmişti")}</Text>
      </View>
      <Text selectable style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>{reason}</Text>
      {meta ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{meta}</Text> : null}
      {open ? <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{tr("Yönetim bilgilendirildi; taraflar çözemezse destek üzerinden incelenir.")}</Text> : null}
    </View>
  );
}

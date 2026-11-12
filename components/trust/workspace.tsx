import { TrustPage } from "@/components/trust/screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, mobile } from "@/components/mobile/ui";
import { Seo } from "@/components/seo";
import { TrustPhoneVerification } from "./phone-verification";
import { useStore } from "@/lib/use-store";
import { trustCapabilities, trustCommand, trustDashboard, trustError, trustRequestId, trustStaffQueue, trustRestrict, trustLiftRestriction, uploadTrustEvidence, downloadTrustEvidence } from "@/lib/trust-v1/api";
import { commissionLabels, disputeReasons, evidenceKinds, reviewCriteria, roleLabels, saleLabels, type TrustAgreement, type TrustCapabilities, type TrustDashboard, type TrustRole, type TrustTransaction } from "@/lib/trust-v1/model";

const date = (v?: string | null) => v ? new Date(v).toLocaleString("tr-TR") : "—";
const money = (v?: number | null, currency = "TRY") => v == null ? "—" : new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(v);
const title = (s: string) => <Text accessibilityRole="header" style={styles.title}>{s}</Text>;
const copy = (s: string) => <Text style={styles.copy}>{s}</Text>;
const row = (label: string, value: string) => <View style={styles.row}><Text style={styles.copy}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
type Run = (operation: string, entity: string, payload: Record<string, unknown>, revision?: number) => Promise<boolean>;

/** One RPC boundary and one component tree for native and responsive web. */
export function TrustWorkspace() {
  const router = useRouter(), params = useLocalSearchParams<{ transaction?: string; view?: string; partnership?: string }>();
  const { currentUser, isAuthenticated, partnerships, findListing } = useStore();
  const [caps, setCaps] = useState<TrustCapabilities>(), [rawData, setData] = useState<TrustDashboard>(), [loadedUser, setLoadedUser] = useState("");
  const data = loadedUser === currentUser.id ? rawData : undefined;
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(params.transaction || ""), [tab, setTab] = useState(params.view || "transactions");
  const alive = useRef(true), loadSequence = useRef(0), flight = useRef(false);
  const requests = useRef(new Map<string, string>());
  const staff = ["admin", "moderator", "super_admin"].includes(currentUser.role || "user");
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof trustStaffQueue>>>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setSelected(params.transaction || ""); }, [params.transaction]);
  const load = useCallback(async () => {
    const seq = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const capabilities = await trustCapabilities();
      if (!alive.current || seq !== loadSequence.current) return;
      setCaps(capabilities);
      if (capabilities.enabled && isAuthenticated) {
        const result = await trustDashboard(selected || undefined);
        if (alive.current && seq === loadSequence.current) { setData(result); setLoadedUser(currentUser.id); }
      }
    } catch (e) { if (alive.current && seq === loadSequence.current) setError(trustError(e)); }
    finally { if (alive.current && seq === loadSequence.current) setLoading(false); }
  }, [isAuthenticated, selected, currentUser.id]);
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (op, entity, payload, revision) => {
    if (flight.current) return false;
    flight.current = true; setBusy(true); setError(""); setSuccess("");
    const key = JSON.stringify([op, entity, payload, revision]);
    const request = requests.current.get(key) || trustRequestId(); requests.current.set(key, request);
    try {
      const result = await trustCommand(op, entity, payload, request, revision);
      requests.current.delete(key);
      if (alive.current) {
        if (result.transactionId) setSelected(result.transactionId);
        setSuccess("İşlem kaydedildi."); await load();
      }
      return true;
    } catch (e) { if (alive.current) setError(trustError(e)); return false; }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  };
  const t = data?.transactions.find(x => x.id === selected);
  const activePartnerships = partnerships.filter(p => p.status === "active" && findListing(p.listingId)?.ownerId === currentUser.id);
  const agreement = t && data?.agreements.find(a => a.id === t.agreement_id);
  return <TrustPage title="Güven ve İşlem Merkezi">
    <Seo title="Güven ve İşlem Merkezi | OrtakSat" description="Anlaşmalarını, satış ve komisyon sürecini takip et." noindex />
    <View style={styles.stack}>
      <MobileCard>{title("Her adım kayıt altında")}{copy("Anlaşma, satış ve komisyon durumları ayrı takip edilir. Ödeme taraflar arasında gerçekleşir; OrtakSat para tutmaz.")}</MobileCard>
      {loading && <View accessibilityLabel="Güven kayıtları yükleniyor" style={styles.loading}><ActivityIndicator color={mobile.teal} /><Text>Yükleniyor…</Text></View>}
      {!!error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><MobileButton secondary onPress={() => void load()}>Yenile</MobileButton></View>}
      {!!success && <Text accessibilityRole="alert" style={styles.success}>{success}</Text>}
      {caps && !caps.enabled && <MobileCard>{title("Güven Sistemi hazırlanıyor")}{copy("Bu özellik testleri tamamlandıktan sonra açılacak. Mevcut ilan ve ortaklık işlemlerini kullanmaya devam edebilirsin.")}<MobileButton secondary onPress={() => router.push("/partner")}>Ortak satışa dön</MobileButton></MobileCard>}
      {caps?.enabled && !isAuthenticated && <MobileCard>{title("İşlemlerini görmek için giriş yap")}<MobileButton onPress={() => router.push("/auth?redirect=%2Fguven-merkezi")}>Giriş yap</MobileButton></MobileCard>}
      {caps?.enabled && isAuthenticated && <>
        <View style={styles.chips}>{[["transactions", "İşlemler"], ["agreements", "Anlaşmalar"], ["profile", "Güven karnem"], ...(staff ? [["admin", "İnceleme paneli"]] : [])].map(([key, label]) => <MobileChip key={key} label={label} selected={tab === key} onPress={() => { setTab(key); if (key === "admin") void trustStaffQueue().then(setQueue).catch(e => setError(trustError(e))); }} />)}</View>
        {tab === "profile" && <><MobileButton secondary onPress={() => router.push(`/guven-profili?user=${currentUser.id}`)}>Rol bazlı güven karnemi aç</MobileButton><TrustPhoneVerification available={caps.phoneVerificationAvailable} /></>}
        {tab === "agreements" && <>
          {activePartnerships.length > 0 && <AgreementForm partnerships={activePartnerships.map(p => ({ id: p.id, title: findListing(p.listingId)?.title || "İlan" }))} initial={params.partnership} run={run} busy={busy} />}
          {!data?.agreements.length && <MobileCard>{copy("Henüz anlaşma bulunmuyor. Satıcı, kabul edilmiş bir ortaklık için koşulları hazırlayabilir.")}</MobileCard>}
          {data?.agreements.map(a => <AgreementCard key={a.id} agreement={a} userId={currentUser.id} busy={busy} run={run} people={data.people} />)}
        </>}
        {tab === "transactions" && <>
          {selected && <MobileButton secondary onPress={() => setSelected("")}>Tüm işlem dosyaları</MobileButton>}
          {!data?.transactions.length && !loading && <MobileCard>{title("Henüz işlem dosyası yok")}{copy("İki tarafın onayladığı geçerli bir anlaşma üzerinden işlem dosyası oluşturabilirsin.")}<MobileButton secondary onPress={() => setTab("agreements")}>Anlaşmaları incele</MobileButton></MobileCard>}
          {!selected && data?.transactions.map(transaction => <MobileCard key={transaction.id}>
            {title(data.agreements.find(a => a.id === transaction.agreement_id)?.terms.listingTitle || "İşlem dosyası")}
            {copy(saleLabels[transaction.sale_status])}{transaction.commission_status && row("Komisyon", commissionLabels[transaction.commission_status])}
            {row("Oluşturulma", date(transaction.created_at))}<MobileButton secondary onPress={() => setSelected(transaction.id)}>İşlem detayını aç</MobileButton>
          </MobileCard>)}
          {!selected && data?.hasMore && <MobileButton secondary disabled={busy} onPress={async () => {
            if (flight.current) return; flight.current = true; setBusy(true);
            try { const next = await trustDashboard(undefined, data.cursor); setData(old => old ? { ...next, transactions: [...old.transactions, ...next.transactions], agreements: [...new Map([...old.agreements, ...next.agreements].map(a => [a.id, a])).values()] } : next); }
            catch (e) { setError(trustError(e)); } finally { flight.current = false; setBusy(false); }
          }}>Daha fazla işlem</MobileButton>}
          {t && data && <TransactionDetail key={t.id} t={t} data={data} agreement={agreement} userId={currentUser.id} busy={busy} run={run} refresh={load} onError={setError} />}
        </>}
        {tab === "admin" && staff && <>
          {copy("Açık itiraz kesinleşmiş ihlal değildir. Tarafların cevap süresi dolmadan karar verilemez.")}
          {!queue ? <MobileButton secondary onPress={() => void trustStaffQueue().then(setQueue).catch(e => setError(trustError(e)))}>İncelemeleri yükle</MobileButton> : !queue.disputes.length ? <MobileCard>{copy("İncelenecek itiraz bulunmuyor.")}</MobileCard> : queue.disputes.map(d => <MobileCard key={d.id}>{title(disputeReasons[d.reason as keyof typeof disputeReasons] || "İtiraz")}{copy(d.details)}{row("Durum", d.status === "resolved" ? "Sonuçlandı" : "İnceleniyor")}{row("Cevap süresi", date(d.response_due_at))}<MobileButton secondary onPress={() => { setSelected(d.transaction_id); setTab("transactions"); }}>Dosyayı incele</MobileButton></MobileCard>)}
          {queue?.restrictions?.filter(r => !r.lifted_at).map(r => <RestrictionAppeal key={r.id} restriction={r} onDone={() => void trustStaffQueue().then(setQueue).catch(e => setError(trustError(e)))} onError={setError} />)}
        </>}
      </>}
    </View>
  </TrustPage>;
}

function AgreementForm({ partnerships, initial, run, busy }: { partnerships: { id: string; title: string }[]; initial?: string; run: Run; busy: boolean }) {
  const [id, setId] = useState(initial || partnerships[0]?.id || ""), [type, setType] = useState("rate"), [value, setValue] = useState("");
  const [starts, setStarts] = useState(new Date().toISOString().slice(0, 10)), [ends, setEnds] = useState("");
  const [days, setDays] = useState("30"), [due, setDue] = useState("7"), [cancellation, setCancellation] = useState(""), [disputes, setDisputes] = useState("");
  const [validation, setValidation] = useState("");
  return <MobileCard>{title("Yeni anlaşma sürümü")}
    <MobileSelect label="Kabul edilmiş ortaklık" value={partnerships.find(p => p.id === id)?.title} options={partnerships.map(p => `${p.title} · ${p.id.slice(0, 8)}`)} onChange={v => setId(partnerships.find(p => `${p.title} · ${p.id.slice(0, 8)}` === v)?.id || "")} />
    <MobileSelect label="Komisyon türü" value={type === "rate" ? "Yüzde" : "Sabit tutar"} options={["Yüzde", "Sabit tutar"]} onChange={v => setType(v === "Yüzde" ? "rate" : "fixed")} />
    <MobileField label={type === "rate" ? "Komisyon (%)" : "Komisyon tutarı"} value={value} onChange={setValue} numeric maxLength={16} />
    <MobileField label="Başlangıç (YYYY-AA-GG)" value={starts} onChange={setStarts} maxLength={10} />
    <MobileField label="Bitiş (isteğe bağlı, YYYY-AA-GG)" value={ends} onChange={setEnds} maxLength={10} />
    <MobileField label="Alıcı yönlendirme koruması (gün, 1–365)" value={days} onChange={setDays} numeric maxLength={3} />
    <MobileField label="Doğrulanan satıştan sonra ödeme vadesi (gün, 0–365)" value={due} onChange={setDue} numeric maxLength={3} />
    {copy("Komisyon, tarafların doğruladığı satış tutarı üzerinden hesaplanır. Sabit tutarda anlaşmadaki miktar esas alınır.")}
    <MobileField label="İptal koşulları" value={cancellation} onChange={setCancellation} multiline maxLength={2000} />
    <MobileField label="Anlaşmazlık koşulları" value={disputes} onChange={setDisputes} multiline maxLength={2000} />
    {!!validation && <Text accessibilityRole="alert" style={styles.errorText}>{validation}</Text>}
    <MobileButton disabled={busy} onPress={() => {
      const iso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
      const amount = value.replace(",", ".");
      if (!id || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || (type === "rate" && Number(amount) > 90) || !iso(starts) || (ends && (!iso(ends) || ends <= starts)) || !/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 365 || !/^\d+$/.test(due) || Number(due) > 365 || cancellation.trim().length < 10 || disputes.trim().length < 10) { setValidation("Tutarı, tarihleri, gün sayılarını ve en az 10 karakterlik koşulları kontrol et."); return; }
      setValidation(""); void run("propose_agreement", id, { commissionType: type, commissionValue: amount, startsAt: `${starts}T00:00:00+03:00`, endsAt: ends ? `${ends}T23:59:59+03:00` : null, attributionDays: Number(days), dueDays: Number(due), cancellation: cancellation.trim(), disputes: disputes.trim() });
    }}>Sürümü tarafların onayına sun</MobileButton>
  </MobileCard>;
}
function AgreementCard({ agreement: a, userId, run, busy, people }: { agreement: TrustAgreement; userId: string; run: Run; busy: boolean; people?: TrustDashboard["people"] }) {
  const [consent, setConsent] = useState(false);
  const ownAccepted = a.seller_id === userId ? a.seller_accepted_at : a.partner_accepted_at;
  return <MobileCard>{title(a.terms.listingTitle)}{row("Anlaşma", `Sürüm ${a.version}`)}{row("Komisyon", a.terms.commissionType === "rate" ? `%${a.terms.commissionValue}` : money(a.terms.commissionValue, a.terms.currency))}
    {row("Satıcı", people?.find(p => p.id === a.seller_id)?.name || "Satıcı")}{row("Satış ortağı", people?.find(p => p.id === a.partner_id)?.name || "Satış ortağı")}
    {row("Hesaplama", "Taraflarca doğrulanan satış tutarı")}{row("Başlangıç", date(a.terms.startsAt))}{row("Bitiş", a.terms.endsAt ? date(a.terms.endsAt) : "Süresiz")}
    {row("Yönlendirme koruması", `${a.terms.attributionDays} gün`)}{row("Ödeme vadesi", `${a.terms.dueDays} gün`)}
    {title("İptal koşulları")}{copy(a.terms.cancellation)}{title("Anlaşmazlık koşulları")}{copy(a.terms.disputes)}
    {row("Satıcı onayı", date(a.seller_accepted_at))}{row("Ortak onayı", date(a.partner_accepted_at))}
    {copy("Bu kayıt resmî elektronik imza veya ödeme garantisi değildir. Onaylanmış koşullar değiştirilemez; değişiklik yeni sürüm ve iki tarafın onayını gerektirir.")}
    <Text selectable style={styles.hash}>Kayıt özeti: {a.terms_hash}</Text>
    {!ownAccepted && <><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(v => !v)} style={styles.check}><Text style={styles.value}>{consent ? "☑" : "☐"} Bu sürümdeki koşulları okudum ve kabul ediyorum.</Text></Pressable><MobileButton disabled={busy || !consent} onPress={() => void run("accept_agreement", a.id, { termsHash: a.terms_hash })}>Bu sürümü onayla</MobileButton></>}
    {a.finalized_at && <MobileButton secondary disabled={busy} onPress={() => void run("create_transaction", a.id, {})}>İşlem dosyası oluştur</MobileButton>}
  </MobileCard>;
}

function TransactionDetail({ t, data, agreement, userId, busy, run, refresh, onError }: { t: TrustTransaction; data: TrustDashboard; agreement?: TrustAgreement; userId: string; busy: boolean; run: Run; refresh: () => Promise<void>; onError: (s: string) => void }) {
  const router = useRouter(), [section, setSection] = useState("summary"), [amount, setAmount] = useState(""), [reason, setReason] = useState("");
  const [kind, setKind] = useState<keyof typeof disputeReasons>("other"), [outcome, setOutcome] = useState("insufficient_evidence");
  const [subject, setSubject] = useState<TrustRole>(t.seller_id === userId ? "partner" : "seller"), [ratings, setRatings] = useState<Record<string, number>>({}), [comment, setComment] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<keyof typeof evidenceKinds>("receipt"), [uploading, setUploading] = useState(false);
  const [attachedEvidence, setAttachedEvidence] = useState<string[]>([]);
  const uploadFlight = useRef(false), uploadRequests = useRef(new Map<string, string>());
  const { currentUser, sales } = useStore();
  const staff = ["admin", "moderator", "super_admin"].includes(currentUser.role || "user");
  const seller = userId === t.seller_id, partner = userId === t.partner_id, party = seller || partner;
  const preSale = ["partnership_active", "buyer_referred", "negotiating"].includes(t.sale_status);
  const dispute = data.disputes.find(d => d.transaction_id === t.id && d.status !== "resolved");
  const act = (op: string, payload = {}) => void run(op, t.id, payload, t.revision);
  const refCode = data.referralCodes?.[t.partnership_id];
  const refLink = refCode ? `https://www.ortaksat.com/guven-yonlendirme?transaction=${encodeURIComponent(t.id)}&code=${encodeURIComponent(refCode)}` : "";
  const upload = async (uri: string, mime: string) => {
    const key = JSON.stringify([t.id, evidenceKind, uri]), request = uploadRequests.current.get(key) || trustRequestId();
    uploadRequests.current.set(key, request);
    await uploadTrustEvidence(t.id, evidenceKind, uri, mime, request);
    uploadRequests.current.delete(key); await refresh();
  };
  return <>
    <MobileCard>{title(agreement?.terms.listingTitle || "İşlem dosyası")}{copy(`Dosya ${t.id.slice(0, 8)} · Güncelleme ${t.revision}`)}
      {row("Satış", saleLabels[t.sale_status])}{t.commission_status && row("Komisyon", commissionLabels[t.commission_status])}
      <View style={styles.chips}>{[["summary", "Takip"], ["commission", "Komisyon"], ["referral", "Yönlendirme"], ["review", "Değerlendirme"], ["evidence", "Belgeler"], ["disputes", "İtirazlar"], ["history", "Geçmiş"]].filter(([key]) => key !== "commission" || party || staff).map(([key, label]) => <MobileChip key={key} label={label} selected={section === key} onPress={() => setSection(key)} />)}</View>
      <MobileButton secondary onPress={() => router.push(`/listing/${t.listing_id}`)}>İlanı gör</MobileButton>
    </MobileCard>
    {section === "summary" && <MobileCard>{title("Satış süreci")}{row("Bildirilen tutar", money(t.sale_amount, t.currency))}{row("Satıcı doğrulaması", date(t.seller_sale_confirmed_at))}{row("Ortak doğrulaması", date(t.partner_sale_confirmed_at))}
      {party && preSale && data.agreements.filter(a => a.partnership_id === t.partnership_id && a.finalized_at && a.version > (agreement?.version || 0)).map(a => <MobileButton key={a.id} secondary disabled={busy} onPress={() => act("adopt_agreement", { agreementId: a.id })}>{`İki tarafça onaylanan sürüm ${a.version} ile devam et`}</MobileButton>)}
      {party && preSale && sales.some(s => s.partnershipId === t.partnership_id && !["paid", "cancelled"].includes(s.status)) && <><MobileSelect label="Önceden kaydedilmiş satış (varsa)" value={t.legacy_commission_id ? `Satış ${t.legacy_commission_id.slice(0, 8)}` : undefined} options={sales.filter(s => s.partnershipId === t.partnership_id && !["paid", "cancelled"].includes(s.status)).map(s => `Satış ${s.id.slice(0, 8)} · ${money(s.amount, t.currency)}`)} disabled={busy} onChange={label => {
        const sale = sales.find(s => s.partnershipId === t.partnership_id && label.startsWith(`Satış ${s.id.slice(0, 8)}`)); if (sale) { setAmount(String(sale.amount)); act("link_ledger", { commissionId: sale.id }); }
      }} />{copy("Aynı satış daha önce kaydedildiyse mevcut kaydı seç. Bu seçim ikinci komisyon veya stok düşümü oluşturmaz.")}</>}
      {party && !dispute && <>
        {preSale && <><MobileField label="Satış tutarı" value={amount} onChange={setAmount} numeric maxLength={16} /><MobileButton disabled={busy || !/^\d+(?:[.,]\d{1,2})?$/.test(amount) || Number(amount.replace(",", ".")) <= 0} onPress={() => act("report_sale", { amount: amount.replace(",", ".") })}>Satış bildir</MobileButton>{t.sale_status !== "negotiating" && <MobileButton secondary disabled={busy} onPress={() => act("negotiate")}>Görüşme başladı</MobileButton>}</>}
        {["sale_reported", "verification_pending"].includes(t.sale_status) && !(seller ? t.seller_sale_confirmed_at : t.partner_sale_confirmed_at) && <MobileButton disabled={busy} onPress={() => act("confirm_sale")}>Satışın gerçekleştiğini doğrula</MobileButton>}
        {["partnership_active", "buyer_referred", "negotiating", "sale_reported", "verification_pending"].includes(t.sale_status) && <><MobileField label="Satış olmadı / iptal gerekçesi" value={reason} onChange={setReason} multiline maxLength={2000} /><MobileButton secondary disabled={busy || reason.trim().length < 10} onPress={() => act("not_sold", { reason: reason.trim() })}>Satış gerçekleşmedi</MobileButton><MobileButton secondary disabled={busy || reason.trim().length < 10} onPress={() => act("cancel", { reason: reason.trim() })}>Dosyayı iptal et</MobileButton></>}
      </>}
      {copy("Satışın doğrulanması komisyonun ödendiği anlamına gelmez. Alıcının satın almaktan vazgeçmesi tek başına olumsuz değerlendirme oluşturmaz.")}
    </MobileCard>}
    {section === "commission" && <MobileCard>{title("Komisyon takibi")}{row("Tutar", money(t.commission_amount, t.currency))}{row("Vade", date(t.due_at))}{row("Satıcının ödeme beyanı", date(t.seller_payment_declared_at))}{row("Ortağın doğrulaması", date(t.partner_payment_confirmed_at))}
      {copy("Ödemeyi kendi aranızda yaparsınız. Satıcının beyanı ve dekont banka doğrulaması değildir. Ödeme ancak ortağın onayıyla ‘Taraflarca doğrulandı’ olur.")}
      {partner && t.commission_status === "earned" && <MobileButton disabled={busy || !!dispute} onPress={() => act("request_payment")}>Ödeme talebini kaydet</MobileButton>}
      {seller && ["earned", "awaiting_payment"].includes(t.commission_status || "") && <MobileButton disabled={busy || !!dispute} onPress={() => act("declare_payment")}>Ödediğimi bildir</MobileButton>}
      {partner && t.commission_status === "seller_declared" && <MobileButton disabled={busy || !!dispute} onPress={() => act("confirm_payment")}>Komisyonu aldığımı doğrula</MobileButton>}
    </MobileCard>}
    {section === "referral" && <MobileCard>{title("Alıcı yönlendirme")}{copy("Alıcı, bağlantıyı açıp yönlendirmeyi doğrular. Tıklama satış veya doğrulanmış yönlendirme değildir. İlk geçerli yönlendirme koruma süresince korunur.")}
      {!!refLink && <><MobileButton secondary onPress={() => void Clipboard.setStringAsync(refLink).then(() => onError("")).catch(e => onError(trustError(e)))}>Bağlantıyı kopyala</MobileButton><MobileButton secondary onPress={() => void Share.share({ message: refLink }).catch(e => onError(trustError(e)))}>Bağlantıyı paylaş</MobileButton></>}
      {!data.referrals?.length && copy("Henüz doğrulanmış alıcı yönlendirmesi yok.")}
      {data.referrals?.filter(r => r.transaction_id === t.id).map(r => <View key={r.id} style={styles.stack}>{row("Yönlendirme", r.status === "seller_accepted" ? "Satıcı kabul etti" : r.status === "contested" ? "Satıcı itiraz etti" : "Alıcı doğruladı")}{row("Koruma sonu", date(r.expires_at))}</View>)}
      {seller && preSale && !!data.referrals?.length && <><MobileButton secondary disabled={busy} onPress={() => act("accept_referral")}>Yönlendirmeyi kabul et</MobileButton><MobileField label="Yönlendirmeye itiraz gerekçesi" value={reason} onChange={setReason} multiline maxLength={2000} /><MobileButton secondary disabled={busy || reason.trim().length < 10} onPress={() => act("contest_referral", { reason: reason.trim() })}>Gerekçeli itirazı kaydet</MobileButton></>}
    </MobileCard>}
    {section === "review" && <MobileCard>{title("İşlem deneyimini değerlendir")}{copy("Yorumlar karşılıklı gönderildiğinde veya satış doğrulamasından itibaren 14 gün dolduğunda görünür olur.")}
      {!t.sale_verified_at || Date.now() > Date.parse(t.sale_verified_at) + 14 * 86400000 ? copy("Bu dosya değerlendirmeye açık değil.") : <>
        <View style={styles.chips}>{(["seller", "partner", "buyer"] as TrustRole[]).filter(role => ({ seller: t.seller_id, partner: t.partner_id, buyer: t.buyer_id })[role] && ({ seller: t.seller_id, partner: t.partner_id, buyer: t.buyer_id })[role] !== userId).map(role => <MobileChip key={role} label={roleLabels[role]} selected={subject === role} onPress={() => { setSubject(role); setRatings({}); }} />)}</View>
        {reviewCriteria[subject].map(c => <View key={c.key} style={styles.stack}>{copy(c.label)}<View style={styles.chips}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${c.label}: ${n} yıldız`} accessibilityState={{ checked: ratings[c.key] === n }} onPress={() => setRatings(v => ({ ...v, [c.key]: n }))} style={styles.star}><Text style={{ color: (ratings[c.key] || 0) >= n ? "#D99600" : "#687384", fontSize: 25 }}>★</Text></Pressable>)}</View></View>)}
        <MobileField label="Deneyimin (isteğe bağlı)" value={comment} onChange={setComment} multiline maxLength={2000} />
        <MobileButton disabled={busy || reviewCriteria[subject].some(c => !ratings[c.key]) || data.reviews.some(r => r.reviewer_id === userId && r.subject_role === subject && r.transaction_id === t.id)} onPress={() => act("review", { subjectRole: subject, dimensions: ratings, comment: comment.trim() })}>Değerlendirmeyi gönder</MobileButton>
      </>}
      {data.reviews.filter(r => r.transaction_id === t.id).map(r => <View key={r.id}>{copy(`${roleLabels[r.subject_role]} · ${r.rating}/5`)}{copy(r.comment || "Yazılı yorum eklenmedi.")}</View>)}
    </MobileCard>}
    {section === "evidence" && <MobileCard>{title("Özel belgeler")}{copy("JPG, PNG veya PDF · En fazla 5 MB. Hassas alanları yüklemeden önce maskele. Belgeler tarama bitmeden açılmaz ve profilinde yayınlanmaz. Dekont banka doğrulaması sayılmaz.")}
      <MobileSelect label="Belge türü" value={evidenceKinds[evidenceKind]} options={Object.values(evidenceKinds)} onChange={v => setEvidenceKind((Object.entries(evidenceKinds).find(([, label]) => label === v)?.[0] || "other") as keyof typeof evidenceKinds)} />
      {!data.capabilities.evidenceScanningAvailable && copy("Belge tarama hizmeti yapılandırılmadığı için yükleme kapalı.")}
      <MobileButton disabled={busy || uploading || !data.capabilities.evidenceScanningAvailable} onPress={async () => {
        if (uploadFlight.current) return; uploadFlight.current = true; setUploading(true);
        try {
          const photo = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
          if (!photo.canceled) await upload(photo.assets[0].uri, photo.assets[0].mimeType || "image/jpeg");
        } catch (e) { onError(trustError(e)); } finally { setUploading(false); uploadFlight.current = false; }
      }}>{uploading ? "Yükleniyor…" : "Fotoğraf seç ve yükle"}</MobileButton>
      <MobileButton secondary disabled={busy || uploading || !data.capabilities.evidenceScanningAvailable} onPress={async () => {
        if (uploadFlight.current) return; uploadFlight.current = true; setUploading(true);
        try { const file = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], multiple: false, copyToCacheDirectory: true }); if (!file.canceled) await upload(file.assets[0].uri, file.assets[0].mimeType || "application/pdf"); }
        catch (e) { onError(trustError(e)); } finally { setUploading(false); uploadFlight.current = false; }
      }}>PDF veya belge seç</MobileButton>
      {data.evidence.filter(e => e.transaction_id === t.id).map(e => <View key={e.id} style={styles.stack}>{copy(`${evidenceKinds[e.kind as keyof typeof evidenceKinds]} · ${Math.ceil(e.byte_size / 1024)} KB · ${e.scan_status === "clean" ? "Tarandı" : e.scan_status === "quarantined" ? "Tarama bekliyor" : e.scan_status === "rejected" ? "Açılamaz" : "Silindi"}`)}{e.scan_status === "clean" && <MobileButton secondary onPress={() => void downloadTrustEvidence(e.id).then(url => Linking.openURL(url)).catch(err => onError(trustError(err)))}>Yetkili belgeyi aç</MobileButton>}</View>)}
    </MobileCard>}
    {section === "disputes" && <MobileCard>{title("İtiraz ve cevap hakkı")}{copy("Açık itiraz kesinleşmiş ihlal değildir. Karşı tarafın 14 günlük cevap hakkı vardır; inceleme sonuç ve gerekçesiyle kayıt altına alınır.")}
      {data.disputes.filter(d => d.transaction_id === t.id).map(d => <View key={d.id} style={styles.stack}>{title(disputeReasons[d.reason as keyof typeof disputeReasons])}{copy(d.details)}{row("Durum", d.status === "resolved" ? "Sonuçlandı" : "İnceleniyor")}{row("Cevap süresi", date(d.response_due_at))}{d.decision && copy(d.decision)}{data.responses.filter(r => r.dispute_id === d.id).map(r => <View key={r.id}>{copy(`${date(r.created_at)} · ${r.body}`)}</View>)}</View>)}
      {!dispute && <MobileSelect label="İtiraz nedeni" value={disputeReasons[kind]} options={Object.entries(disputeReasons).filter(([k]) => k !== "commission_unpaid" || party).map(([, v]) => v)} onChange={v => setKind((Object.entries(disputeReasons).find(([, label]) => label === v)?.[0] || "other") as keyof typeof disputeReasons)} />}
      <MobileField label={dispute ? "Cevabın / karar gerekçesi" : "İtiraz açıklaması"} value={reason} onChange={setReason} multiline maxLength={4000} />
      {dispute && <View style={styles.chips}>{data.evidence.filter(e => e.transaction_id === t.id && e.scan_status === "clean").map(e => <MobileChip key={e.id} label={`${evidenceKinds[e.kind as keyof typeof evidenceKinds]} ${e.id.slice(0, 6)}`} selected={attachedEvidence.includes(e.id)} onPress={() => setAttachedEvidence(ids => ids.includes(e.id) ? ids.filter(id => id !== e.id) : ids.length < 10 ? [...ids, e.id] : ids)} />)}</View>}
      <MobileButton disabled={busy || reason.trim().length < 10} onPress={() => act(dispute ? "respond_dispute" : "open_dispute", { kind, reason: reason.trim(), ...(dispute ? { evidenceIds: attachedEvidence } : {}) })}>{dispute ? "Cevabı dosyaya ekle" : "İtiraz aç"}</MobileButton>
      {staff && dispute && <><MobileSelect label="İnceleme sonucu" value={outcome} options={["upheld", "dismissed", "resolved_by_parties", "insufficient_evidence"]} onChange={setOutcome} /><MobileButton secondary disabled={busy || reason.trim().length < 10 || Date.now() < Date.parse(dispute.response_due_at)} onPress={() => act("resolve_dispute", { outcome, reason: reason.trim() })}>Gerekçeli kararı kaydet</MobileButton></>}
    </MobileCard>}
    {section === "history" && <MobileCard>{title("Denetlenebilir işlem geçmişi")}{!data.events.length && copy("Bu dosyada henüz olay kaydı yok.")}{data.events.map((e, i) => <View key={`${e.created_at}-${i}`} style={styles.event}>{copy(`${date(e.created_at)} · ${e.user_id ? data.people?.find(p => p.id === e.user_id)?.name || "Yetkili işlem" : "Sistem"}`)}<Text style={styles.value}>{eventLabel(e.action)}</Text>{typeof e.details?.previousSaleStatus === "string" && copy(`${saleLabels[e.details.previousSaleStatus as keyof typeof saleLabels]} → ${saleLabels[e.details.saleStatus as keyof typeof saleLabels]}`)}{typeof e.details?.reason === "string" && !!e.details.reason && copy(e.details.reason)}</View>)}</MobileCard>}
    {staff && section === "disputes" && data.disputes.filter(d => d.transaction_id === t.id && d.status === "resolved" && d.outcome === "upheld").map(d => <RestrictionDecision key={d.id} t={t} disputeId={d.id} onError={onError} />)}
  </>;
}
function RestrictionDecision({ t, disputeId, onError }: { t: TrustTransaction; disputeId: string; onError: (s: string) => void }) {
  const [role, setRole] = useState("Satıcı"), [days, setDays] = useState("7"), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const flight = useRef(false), ids = useRef(new Map<string, string>());
  return <MobileCard>{title("Gerekçeli ve süreli yetki kararı")}{copy("Bu işlem yalnızca yeni ortaklık yetkisini sınırlar. Mevcut ödeme, belge ve itiraz hakları korunur. Kullanıcı destek kanalından kararın yeniden incelenmesini isteyebilir.")}
    <MobileSelect label="İlgili taraf" value={role} options={["Satıcı", "Satış ortağı"]} onChange={setRole} /><MobileField label="Süre (gün, 1–365)" value={days} onChange={setDays} numeric maxLength={3} /><MobileField label="Kararın somut gerekçesi" value={reason} onChange={setReason} multiline maxLength={2000} />
    {done && copy("Yetki kararı kaydedildi.")}
    <MobileButton secondary disabled={busy || done || reason.trim().length < 10 || !/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 365} onPress={async () => {
      if (flight.current) return; flight.current = true; setBusy(true);
      const key = JSON.stringify([role, days, reason]), id = ids.current.get(key) || trustRequestId(); ids.current.set(key, id);
      try { await trustRestrict(role === "Satıcı" ? t.seller_id : t.partner_id, disputeId, reason.trim(), Number(days), id); setDone(true); } catch (e) { onError(trustError(e)); } finally { flight.current = false; setBusy(false); }
    }}>Süreli kısıtlamayı kaydet</MobileButton>
  </MobileCard>;
}
function RestrictionAppeal({ restriction: r, onDone, onError }: { restriction: { id: string; reason: string; expires_at: string }; onDone: () => void; onError: (s: string) => void }) {
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), flight = useRef(false);
  return <MobileCard>{title("Yetki kararını yeniden incele")}{copy(r.reason)}{row("Bitiş", date(r.expires_at))}<MobileField label="Kaldırma gerekçesi" value={reason} onChange={setReason} multiline maxLength={2000} /><MobileButton secondary disabled={busy || reason.trim().length < 10} onPress={async () => {
    if (flight.current) return; flight.current = true; setBusy(true);
    try { await trustLiftRestriction(r.id, reason.trim()); onDone(); } catch (e) { onError(trustError(e)); } finally { flight.current = false; setBusy(false); }
  }}>Kısıtlamayı kaldır</MobileButton></MobileCard>;
}
function eventLabel(action: string) { return ({ report_sale: "Satış bildirildi", confirm_sale: "Satış doğrulaması", declare_payment: "Satıcı ödeme beyanı", confirm_payment: "Ortak ödemeyi doğruladı", review: "Değerlendirme gönderildi", open_dispute: "İtiraz açıldı", respond_dispute: "İtiraza cevap eklendi", resolve_dispute: "İtiraz sonuçlandı", create_transaction: "Dosya oluşturuldu", evidence_registered: "Belge kaydedildi", evidence_scanned: "Belge tarandı", evidence_accessed: "Yetkili belge erişimi", buyer_referral_confirmed: "Alıcı yönlendirmeyi doğruladı" } as Record<string, string>)[action.replace(/^trust_v1_/, "")] || "İşlem kaydı güncellendi"; }
const styles = StyleSheet.create({ stack: { gap: 12, paddingBottom: 12 }, title: { fontSize: 19, fontWeight: "700", color: mobile.ink, marginBottom: 8 }, copy: { fontSize: 14, lineHeight: 21, color: "#596678", flexShrink: 1 }, value: { fontSize: 14, lineHeight: 21, color: mobile.ink, fontWeight: "600", flexShrink: 1 }, row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 8 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }, loading: { padding: 24, gap: 10, alignItems: "center" }, error: { padding: 14, gap: 12, borderRadius: 14, backgroundColor: "#FFF0F1" }, errorText: { color: "#A12639", fontSize: 14, lineHeight: 21 }, success: { padding: 14, color: "#087A53", backgroundColor: "#E9F8F2", borderRadius: 12 }, hash: { fontSize: 11, color: mobile.muted, lineHeight: 17, marginVertical: 10 }, check: { minHeight: 48, paddingVertical: 12 }, star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, event: { paddingVertical: 12, borderBottomWidth: 1, borderColor: mobile.line } });

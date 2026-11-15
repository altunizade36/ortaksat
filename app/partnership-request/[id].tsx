import { listingFlowPaths, listingJoinAction } from "@/lib/listing-actions";
import { commissionValueLabel, listingInviteCode } from "@/lib/format";
import { parseListingRate } from "@/lib/listing-numbers";
import { useUnsavedForm } from "@/lib/use-unsaved-form";
import { displayListingTitle } from "@/lib/listing-title";
import { UserAvatar } from "@/components/user-avatar";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useStore } from "@/lib/use-store";
import { fetchListingById } from "@/lib/supabase-data";
import { moneyIn } from "@/lib/format";
import { parseTrPrice } from "@/lib/validation";
import { showToast } from "@/lib/toast";
import type { Listing, User } from "@/lib/types";
import { MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, SectionLabel, mobile, ms, useMobileLayout } from "@/components/mobile/ui";

const qualities = ["Sosyal medyada tanıtabilirim", "Çevreme önerebilirim", "Düzenli müşteri getirebilirim", "Şehir dışı alıcı bulabilirim"];
const readyMessages = ["Merhaba, bu ilana ortak olmak istiyorum. İlanı çevremle paylaşabilir, müşteri getirmek için elimden geleni yapabilirim. Uygun görürseniz talebimi onaylar mısınız?", "Merhaba, bu ürünü sosyal medya hesaplarımda tanıtarak alıcılara ulaştırmak istiyorum. Ortaklık koşullarınızı görüşebilir miyiz?", "Merhaba, bu ilanla ilgilenebilecek bir çevrem var. Birlikte çalışmak isterim."];
export default function PartnershipRequest() {
  const { id, invite, resume } = useLocalSearchParams<{ id: string; invite?: string; resume?: string }>();
  const router = useRouter();
  const { tablet } = useMobileLayout();
  const store = useStore();
  const [remote, setRemote] = useState<{ listing: Listing; owner?: User } | null>(null);
  const [loading, setLoading] = useState(!store.findListing(id));
  const [retry, setRetry] = useState(0);
  const submitLock = useRef(false);
  const initializedForm = useRef("");
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [message, setMessage] = useState("");
  const [extra, setExtra] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [sent, setSent] = useState(false);
  const l = store.findListing(id) ?? (remote?.listing.id === id ? remote.listing : undefined);
  const owner = l ? store.findUser(l.ownerId) ?? remote?.owner : undefined;
  const existing = l ? store.findPartnership(l.id) : undefined;
  const action = l ? listingJoinAction({ listing: l, status: existing?.status, isOwner: l.ownerId === store.currentUser.id, hasInvite: !!invite && invite === listingInviteCode(l), sellerBlocked: store.isUserBlocked(l.ownerId) }) : undefined;
  const flowPaths = listingFlowPaths(id, l && invite === listingInviteCode(l) ? invite : undefined);
  // KOMİSYON ÖNERİSİ: isteğe bağlı, ilanın komisyon türüyle aynı birimde. Yalnız satıcı onayı gereken
  // başvuruda sorulur (açık ya da davetli katılım anında başlar; sunucu öneriyi orada saklamaz).
  const validInvite = !!l && !!invite && invite === listingInviteCode(l);
  const canPropose = !!l && l.partnershipMode === "approval" && !validInvite;
  const listingCommission = l ? commissionValueLabel(l.commissionType, l.commissionValue, l.currency) : "";
  const dirty = !!(message || extra || selected.length || amount.trim());
  const allowLeave = useUnsavedForm(formReady && !sent && action?.kind === "apply" && dirty, busy);
  const draftKey = `ortaksat_mobile_application:${store.isAuthenticated ? store.currentUser.id : "guest"}:${id}`;
  useEffect(() => { if (l) return; let active = true; setLoading(true); setError(""); fetchListingById(id).then((v) => { if (active) { if (v && "listing" in v) setRemote(v); else if (v && "error" in v) setError("İlan yüklenemedi. Tekrar dene."); } }).catch(() => { if (active) setError("İlan yüklenemedi."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id, l, retry]);
  async function submit() {
    if (!l || !formReady || busy || submitLock.current) return;
    if (action?.kind !== "apply") { setError(action?.reason || "Bu talep zaten oluşturulmuş."); return; }
    const kind = l.commissionType;
    const wantsProposal = canPropose && amount.trim().length > 0;
    const value = !wantsProposal ? NaN : kind === "rate" ? parseListingRate(amount) : parseTrPrice(amount);
    if (wantsProposal && (!/^[\d.,\s]+$/.test(amount) || !Number.isFinite(value) || value <= 0 || kind === "rate" && value > 90)) { setError(kind === "rate" ? "Geçerli bir komisyon önerisi gir. Yüzde öneri 90 değerini aşamaz. Örnek: 12 ya da 12,5." : "Geçerli bir komisyon önerisi gir. Örnek: 1.500."); return; }
    // Öneri yalnız ilandaki komisyondan YÜKSEKSE anlamlıdır (anlaşmanın tabanı ilandır; sunucu daha düşüğünü uygulamaz).
    if (wantsProposal && value < l.commissionValue) { setError(`Önerin ilandaki komisyondan (${listingCommission}) düşük olamaz. Öneri yapmak istemiyorsan alanı boş bırak.`); return; }
    const proposedCommissionValue = wantsProposal && value > l.commissionValue ? value : undefined;
    if (message.trim().length < 10) { setError("Kendini tanıtan en az 10 karakterlik bir mesaj yaz."); return; }
    if (!store.isAuthenticated) {
      submitLock.current = true;
      try {
        await AsyncStorage.setItem(`ortaksat_mobile_application:guest:${id}`, JSON.stringify({ message, extra, selected, kind: l.commissionType, amount, proposal: 1 }));
        router.push({ pathname: "/auth", params: { redirect: `/partnership-request/${id}?resume=1${invite ? `&invite=${encodeURIComponent(invite)}` : ""}` } } as never);
      } catch { setError("Taslağın saklanamadı. Metnin bu ekranda duruyor; tekrar dene."); }
      finally { submitLock.current = false; }
      return;
    }
    if (l.demo || l.ownerId === store.currentUser.id || l.partnershipMode === "none" || l.status !== "active") { setError("Bu ilana ortaklık talebi gönderilemiyor."); return; }
    submitLock.current = true; setBusy(true); setError("");
    try {
      // Öneri artık nota gömülmez: ayrı alanda (proposed_commission_value) gider, satıcı tek dokunuşla kabul eder.
      const note = `${message.trim()}${selected.length ? `\nTanıtım: ${selected.join(", ")}` : ""}${extra.trim() ? `\nEk bilgi: ${extra.trim()}` : ""}`;
      const result = await store.joinListing(l.id, { note, shareChannel: selected.includes(qualities[0]) ? "Sosyal medya" : "Çevrem", audience: selected.join(", "), inviteCode: invite || "", proposedCommissionValue }, l);
      if (result) { setResult({ id: result.id, status: result.status }); allowLeave(); setSent(true); void Promise.all([AsyncStorage.removeItem(draftKey), AsyncStorage.removeItem(`ortaksat_mobile_application:guest:${id}`)]).catch(() => {}); }
      else setError(store.authError || "Talep gönderilemedi. İlanın durumunu ve ortaklık koşullarını kontrol et.");
    } catch { setError("Talep gönderilemedi. Bağlantını kontrol edip tekrar dene."); } finally { submitLock.current = false; setBusy(false); }
  }
  const listingReady = !!l;
  const listingKind = l?.commissionType ?? "fixed";
  // Initialize defaults and restored proposal together; a late listing must not overwrite the draft.
  useEffect(() => {
    if (!listingReady) { setFormReady(false); return; }
    const identity = `${draftKey}:${resume || ""}`;
    if (initializedForm.current === identity) return;
    let active = true;
    setFormReady(false);
    const restoreKey = store.isAuthenticated && resume !== "1" ? draftKey : `ortaksat_mobile_application:guest:${id}`;
    void AsyncStorage.getItem(restoreKey).then((raw) => {
      if (!active) return;
      let draft: Record<string, unknown> = {};
      try { const parsed = raw ? JSON.parse(raw) : null; if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) draft = parsed; } catch { /* Invalid old draft: use listing defaults. */ }
      setMessage(typeof draft.message === "string" ? draft.message.slice(0, 500) : "");
      setExtra(typeof draft.extra === "string" ? draft.extra.slice(0, 300) : "");
      setSelected(Array.isArray(draft.selected) ? qualities.filter(q => (draft.selected as unknown[]).includes(q)) : []);
      // Öneri alanı varsayılan olarak BOŞ (isteğe bağlı). Eski taslaklar (proposal işareti yok) ilan komisyonunu
      // "teklif" diye ön-dolduruyordu ve tür seçilebiliyordu → o değerler öneri sayılmaz.
      setAmount(draft.proposal === 1 && draft.kind === listingKind && typeof draft.amount === "string" ? draft.amount.slice(0, 16) : "");
    }).catch(() => {
      if (active) { setAmount(""); setError("Kaydedilmiş taslak açılamadı. Formu yeniden doldurabilirsin."); }
    }).finally(() => { if (active) { initializedForm.current = identity; setFormReady(true); } });
    return () => { active = false; };
  }, [id, draftKey, store.isAuthenticated, resume, listingReady, listingKind]);
  if (sent) return <MobileScreen title="Ortaklık Talebin"><MobileCard><Icon name="check-circle" size={50} color={mobile.teal} /><Text style={[ms.section, { fontSize: 22 }]}>{result?.status === "active" ? "Ortaklığın aktif" : "Başvurun alındı"}</Text><Text style={ms.muted}>Ortaklık durumunu Ortak Satış bölümünden takip edebilirsin. Satıcıyla mesajlaşarak teklif koşullarını netleştirebilirsin.</Text><MobileButton onPress={() => router.replace(result ? `/partnership/${result.id}` as never : "/partner")}>Başvurunun Detayını Gör</MobileButton></MobileCard></MobileScreen>;
  if (l && action?.kind === "view" && existing) return <MobileScreen title="Ortaklık Talebi"><MobileCard><Text style={ms.section}>{existing.status === "active" ? "Bu ilanda zaten ortaksın" : "Başvurun incelemede"}</Text><Text style={ms.muted}>Mevcut kaydının durumunu detay ekranından takip edebilirsin.</Text><MobileButton onPress={() => router.replace(`/partnership/${existing.id}` as never)}>Detayı Gör</MobileButton></MobileCard></MobileScreen>;
  if (l && action?.kind === "disabled") return <MobileScreen title="Ortaklık Talebi"><MobileCard><Text style={ms.section}>{action.label}</Text><Text accessibilityRole="alert" style={ms.muted}>{action.reason}</Text><MobileButton secondary onPress={() => router.replace(`/listing/${l.id}` as never)}>İlana Dön</MobileButton></MobileCard></MobileScreen>;
  return <MobileScreen title="Ortaklık Talebi">
    {!l ? <MobileCard><Text style={ms.section}>{loading ? "İlan yükleniyor…" : error ? "İlan yüklenemedi" : "İlan bulunamadı"}</Text>{!!error && <><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={() => setRetry(n => n + 1)}>İlanı yeniden yükle</MobileButton></>}</MobileCard> : !formReady ? <MobileCard><Text style={ms.muted}>Başvuru formu hazırlanıyor…</Text></MobileCard> : <>
      <MobileCard style={{ flexDirection: "row", alignItems: "center" }}><SafeRemoteImage uri={l.image} style={{ width: tablet ? 140 : 100, height: tablet ? 110 : 82, borderRadius: 9 }} /><View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text numberOfLines={3} style={[ms.section, { fontSize: 16 }]}>{displayListingTitle(l.title)}</Text><Text style={{ color: mobile.teal, fontSize: 22, fontWeight: "800" }}>{moneyIn(l.price, l.currency)}</Text><Text style={ms.muted}>⌖ {l.location}</Text></View></MobileCard>
      <MobileCard style={{ flexDirection: "row", alignItems: "center" }}><UserAvatar uri={owner?.avatar} style={{ width: 45, height: 45, borderRadius: 23 }} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={ms.section}>{owner?.name || "Satıcı"}</Text><Text style={ms.muted}>{owner?.listingCount || 0} aktif ilan</Text></View><MobileButton secondary icon="chat" onPress={() => { if (!store.isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: flowPaths.request } } as never); return; } const c = store.startConversation(l.id, l.ownerId, "", l); if (c) router.push(`/chat/${c.id}` as never); else showToast("Mesaj başlatılamadı. İlanın veya hesabın durumunu kontrol et."); }}>Mesaj Gönder</MobileButton></MobileCard>
      <MobileCard style={{ backgroundColor: mobile.tealSoft, borderColor: mobile.line, flexDirection: "row", alignItems: "center" }}><View style={{ width: 45, height: 45, borderRadius: 23, backgroundColor: mobile.teal, alignItems: "center", justifyContent: "center" }}><Icon name="handshake" size={29} color="white" /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontWeight: "700", color: mobile.ink, fontSize: 13 }}>Bu ilana ortak olarak komisyon kazanabilirsin!</Text><Text style={[ms.muted, { fontSize: 12 }]}>{canPropose ? `İlandaki komisyon ${listingCommission}. İstersen daha yükseğini önerebilirsin; satıcı önerinle ya da ilan oranıyla kabul eder.` : `Bu ilanda komisyon ${listingCommission}. Ortaklık kurulduğunda bu şart senin için kilitlenir.`}</Text></View></MobileCard>
      {canPropose && <MobileCard><SectionLabel icon="numeric-1-circle">Komisyon Önerin (İsteğe Bağlı)</SectionLabel><Text style={ms.muted}>Satıcının belirlediği komisyon: {listingCommission}. Boş bırakırsan bu komisyonla başvurursun.</Text><MobileField label={l.commissionType === "rate" ? "Önerdiğin Komisyon Oranı (%)" : `Önerdiğin Komisyon Tutarı (${l.currency === "EUR" ? "EUR" : l.currency === "USD" ? "USD" : "TL"})`} value={amount} onChange={setAmount} numeric maxLength={16} placeholder={l.commissionType === "rate" ? "Örn. 12,5" : "Örn. 1.500"} /><Text style={ms.muted}>Önerin ilandaki komisyondan yüksek olmalı. Satıcı öneriyle kabul ederse sana özel oran olarak kaydedilir; ilan oranıyla kabul ederse ilandaki komisyon geçerli olur.</Text></MobileCard>}
      <MobileCard><View style={[ms.row, { justifyContent: "space-between" }]}><SectionLabel icon="numeric-2-circle">Mesajın</SectionLabel><Pressable accessibilityRole="button" onPress={() => setTemplates((v) => !v)}><Text style={{ color: mobile.teal, fontSize: 12 }}>☷ Hazır Mesajlar</Text></Pressable></View>{templates && readyMessages.map((text) => <Pressable key={text} accessibilityRole="button" onPress={() => { setMessage(text); setTemplates(false); }} style={{ padding: 10, borderRadius: 9, backgroundColor: mobile.tealSoft }}><Text style={ms.muted}>{text}</Text></Pressable>)}<MobileField value={message} onChange={setMessage} placeholder="Kendini ve ürünü nasıl tanıtacağını anlat..." multiline maxLength={500} /></MobileCard>
      <MobileCard><SectionLabel icon="numeric-3-circle">Ek Bilgiler (Opsiyonel)</SectionLabel><View style={ms.wrap}>{qualities.map((q) => <MobileChip key={q} label={q} selected={selected.includes(q)} icon={selected.includes(q) ? "check-circle" : undefined} onPress={() => setSelected((prev) => prev.includes(q) ? prev.filter((v) => v !== q) : [...prev, q])} />)}</View><MobileField value={extra} onChange={setExtra} placeholder="Eklemek istediğin bir bilgi var mı?" multiline maxLength={300} /></MobileCard>
      {!!error && <Text accessibilityRole="alert" style={ms.error}>{error}</Text>}
      <MobileButton onPress={() => void submit()} disabled={busy || l.demo || l.partnershipMode === "none"} icon="send">{busy ? "Gönderiliyor…" : "Ortaklık Talebini Gönder"}</MobileButton>
    </>}
  </MobileScreen>;
}

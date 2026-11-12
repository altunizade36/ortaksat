import { displayListingTitle } from "@/lib/listing-title";
import {useUnsavedForm} from "@/lib/use-unsaved-form";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { MobileCategorySelect } from "@/components/mobile/category-select";
import { CategoryArtwork } from "@/components/mobile/categories";
import { MobileRowListing } from "@/components/mobile/catalogue";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, mobile, ms } from "@/components/mobile/ui";
import { loadBuyerRequest, loadBuyerRequests, loadBuyerOffers, matchBuyerRequest, requestTrail, saveBuyerRequest, sendBuyerOffer, decideBuyerOffer, type BuyerRequest, type BuyerOffer } from "@/lib/buyer-requests";
import { makeUuid } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";
import { moneyIn } from "@/lib/format";
import { parseTrPrice } from "@/lib/validation";
import { provinces, getProvince, getDistrict } from "@/lib/locations";
import { Alert } from "@/lib/alert";
import { supabase } from "@/lib/supabase";
import type { CategoryNode } from "@/lib/category-tree";
import type { Listing } from "@/lib/types";

const place = (r: BuyerRequest) => [getProvince(r.province_id)?.name, getDistrict(r.district_id)?.name].filter(Boolean).join(" / ") || "Türkiye geneli";
const budget = (r: BuyerRequest) => `${moneyIn(Number(r.budget_min), r.currency)} – ${moneyIn(Number(r.budget_max), r.currency)}`;
const expired = (r: BuyerRequest) => r.status !== "active" || Date.parse(r.expires_at) <= Date.now();

export default function BuyerRequestsScreen() {
  const store = useStore(), params = useLocalSearchParams<{ id?: string; view?: string }>();
  if (!store.authReady || store.isAuthenticated && !store.accountLoaded) return <ScreenSkeleton/>;
  if (!store.isAuthenticated) return <AuthRequired title="Alıcı Bulma Merkezi için giriş yap"/>;
  if (params.view === "create") return <RequestEditor key={params.id || "new"} id={params.id}/>;
  if (params.id) return <RequestDetail key={params.id} id={params.id}/>;
  return <RequestCentre/>;
}

function RequestCentre() {
  const store = useStore(), router = useRouter();
  const [tab, setTab] = useState("Tüm Talepler"), [search, setSearch] = useState(""), [city, setCity] = useState("Tüm İller"), [rows, setRows] = useState<BuyerRequest[]>([]), [total, setTotal] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const revision = useRef(0), lock = useRef(false), account = store.currentUser.id;
  const criteria = { mine: tab === "Taleplerim" ? account : undefined, search, provinceId: tab === "Yakınımdaki" ? provinces.find(p => p.name === city)?.id : undefined };
  const key = JSON.stringify(criteria);
  useFocusEffect(useCallback(() => {
    const n = ++revision.current; setLoading(true); setError(""); setRows([]);
    const timer = setTimeout(() => { void loadBuyerRequests(criteria).then(result => { if (revision.current === n) { setRows(result.rows); setTotal(result.total); } }).catch(() => { if (revision.current === n) setError("Alıcı talepleri yüklenemedi. Tekrar dene."); }).finally(() => { if (revision.current === n) setLoading(false); }); }, 250);
    return () => { revision.current++; clearTimeout(timer); };
    // key contains all server criteria, including the current account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]));
  async function more() { if (lock.current) return; lock.current = true; setLoading(true); const n = revision.current; try { const result = await loadBuyerRequests({ ...criteria, offset: rows.length }); if (revision.current === n) { setRows(old => [...new Map([...old, ...result.rows].map(r => [r.id, r])).values()]); setTotal(result.total); } } catch { if (revision.current === n) setError("Diğer talepler yüklenemedi."); } finally { lock.current = false; if (revision.current === n) setLoading(false); } }
  return <MobileScreen title="Alıcı Bulma Merkezi" bottom={<MobileBottomNav/>}>
    <Text style={[ms.muted, { marginVertical: 10 }]}>Alıcıların aradığı ürünleri gör, uygun ilanını öner. Aradığın ürünü bulmak için kendi talebini oluştur.</Text>
    <MobileButton icon="plus" onPress={() => router.push("/buyer-requests?view=create" as never)}>Talep Oluştur</MobileButton>
    <ScrollView horizontal contentContainerStyle={{ gap: 7, paddingVertical: 14 }}>{["Tüm Talepler", "Yakınımdaki", "Taleplerim"].map(label => <MobileChip key={label} label={label} selected={tab === label} onPress={() => setTab(label)}/>)}</ScrollView>
    <MobileField placeholder="Alıcı taleplerinde ara…" value={search} onChange={setSearch}/>
    {tab === "Yakınımdaki" && <View style={{ marginTop: 12 }}><MobileSelect label="İl" value={city} options={["Tüm İller", ...provinces.map(p => p.name)]} onChange={setCity}/><Text style={ms.muted}>Konum filtresi seçtiğin ile göre çalışır.</Text></View>}
    <Text accessibilityLiveRegion="polite" style={[ms.muted, { marginVertical: 12 }]}>{loading ? "Yükleniyor…" : `${total} talep`}</Text>
    {error && <MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={() => setRetry(v => v + 1)}>Tekrar Dene</MobileButton></MobileCard>}
    {rows.map(r => <MobileCard key={r.id}><View style={ms.row}><CategoryArtwork tile={r.category_trail[0] === "Vasıta" ? 1 : r.category_trail[0] === "Emlak" ? 0 : r.category_trail[0] === "Elektronik" ? 2 : 15} size={65}/><View style={{ flex: 1, gap: 6 }}><Text style={ms.section}>{r.title}</Text><Text style={{ color: mobile.teal, fontWeight: "800" }}>{budget(r)}</Text><Text style={ms.muted}>{place(r)}</Text><Text style={ms.muted}>{expired(r) ? r.status === "closed" ? "Kapatıldı" : "Süresi doldu" : new Date(r.created_at).toLocaleDateString("tr-TR")}</Text></View></View><Text numberOfLines={2} style={ms.muted}>{r.description}</Text><MobileButton secondary onPress={() => router.push({ pathname: "/buyer-requests", params: { id: r.id } } as never)}>{r.user_id === account ? "Talebimi Yönet" : "İlgilen / Detayları Gör"}</MobileButton></MobileCard>)}
    {!loading && !error && !rows.length && <MobileCard><Text style={ms.muted}>Bu görünümde alıcı talebi bulunmuyor.</Text></MobileCard>}
    {rows.length < total && !loading && <MobileButton secondary onPress={() => void more()}>Diğer Talepleri Göster</MobileButton>}
  </MobileScreen>;
}

function RequestEditor({ id }: { id?: string }) {
  const store = useStore(), router = useRouter(), requestId = useRef(id || makeUuid()), lock = useRef(false);
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [trail, setTrail] = useState<CategoryNode[]>([]), [loc, setLoc] = useState<LocationValue>({}), [min, setMin] = useState(""), [max, setMax] = useState(""), [currency, setCurrency] = useState<BuyerRequest["currency"]>("TRY"), [duration, setDuration] = useState("30 gün"), [partners, setPartners] = useState(true), [categoryOpen, setCategoryOpen] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!id), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const fingerprint=JSON.stringify({title,description,trail:trail.map(n=>n.label),loc,min,max,currency,duration,partners}),baseline=useRef(fingerprint);
  useEffect(() => { let alive = true; if (id) { setLoading(true); setError(""); void loadBuyerRequest(id).then(r => { if (!alive) return; if (r.user_id !== store.currentUser.id) throw Error(); baseline.current=JSON.stringify({title:r.title,description:r.description,trail:r.category_trail,loc:{provinceId:r.province_id||undefined,districtId:r.district_id||undefined},min:String(r.budget_min),max:String(r.budget_max),currency:r.currency,duration:"30 gün",partners:r.allow_partners});setTitle(r.title); setDescription(r.description); setTrail(requestTrail(store.categoryTree, r.category_trail)); setLoc({ provinceId: r.province_id || undefined, districtId: r.district_id || undefined }); setMin(String(r.budget_min)); setMax(String(r.budget_max)); setCurrency(r.currency); setPartners(r.allow_partners); }).catch(() => { if (alive) setError("Talep düzenleme için yüklenemedi veya bu talebe erişimin yok."); }).finally(() => { if (alive) setLoading(false); }); } return () => { alive = false; }; }, [id, store.currentUser.id, store.categoryTree, retry]);
  const allowLeave=useUnsavedForm(fingerprint!==baseline.current,busy);
  async function save() {
    if (lock.current) return;
    if (!trail.length || title.trim().length < 5 || description.trim().length < 20 || !/^[\d.,\s]+$/.test(max) || min && !/^[\d.,\s]+$/.test(min) || parseTrPrice(max) <= 0 || parseTrPrice(min) > parseTrPrice(max)) { setError("Kategori seç; en az 5 karakter başlık, 20 karakter açıklama ve geçerli bütçe aralığı gir."); return; }
    lock.current = true; setBusy(true); setError("");
    try { await saveBuyerRequest({ id: requestId.current, user_id: store.currentUser.id, title: title.trim(), description: description.trim(), category_trail: trail.map(n => n.label), budget_min: parseTrPrice(min), budget_max: parseTrPrice(max), currency, province_id: loc.provinceId || null, district_id: loc.districtId || null, allow_partners: partners, status: "active", expires_at: new Date(Date.now() + parseInt(duration) * 86400000).toISOString() }, !!id); allowLeave(); router.replace({ pathname: "/buyer-requests", params: { id: requestId.current } } as never); }
    catch { setError("Talep kaydedilemedi. Girdiğin bilgiler korunuyor; tekrar dene."); } finally { lock.current = false; setBusy(false); }
  }
  return <MobileScreen title={id ? "Alıcı Talebini Düzenle" : "Alıcı Talebi Oluştur"}>
    {loading ? <Text style={ms.muted}>Yükleniyor…</Text> : <View style={{ gap: 17 }}><Text style={ms.muted}>Aradığın ürünün özelliklerini ve bütçeni belirt. Telefon veya ödeme bilgilerini açıklamaya ekleme.</Text><MobileButton secondary onPress={() => setCategoryOpen(true)}>{trail.length ? trail.map(n => n.label).join(" › ") : "Kategori Seç *"}</MobileButton><MobileField label="Talep Başlığı" required value={title} onChange={setTitle} maxLength={100}/><MobileField label="Açıklama" required multiline maxLength={5000} value={description} onChange={setDescription}/><MobileSelect label="Para Birimi" value={currency} options={["TRY", "USD", "EUR"]} onChange={v => setCurrency(v as typeof currency)}/><View style={ms.row}><MobileField label="Min. Bütçe" numeric value={min} onChange={setMin}/><MobileField label="Maks. Bütçe" required numeric value={max} onChange={setMax}/></View><View><Text style={ms.label}>Konum (İsteğe Bağlı)</Text><LocationSelector value={loc} onChange={setLoc} mode="filter" showNeighborhood={false}/><Text style={ms.muted}>İl seçmezsen Türkiye genelindeki ilanlarla eşleşir.</Text></View><MobileSelect label="Talep Geçerlilik Süresi" value={duration} options={["7 gün", "15 gün", "30 gün", "60 gün"]} onChange={setDuration}/><View style={ms.row}><Text style={[ms.muted, { flex: 1 }]}>Ortaklardan uygun ürün bulma desteği istiyorum.</Text><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} accessibilityLabel="Ortaklara açık talep" value={partners} onValueChange={setPartners} trackColor={{ false: mobile.line, true: mobile.teal }} thumbColor="#FFFFFF" ios_backgroundColor={mobile.line}/></View><MobileButton icon="send" disabled={busy || !!id && !title} onPress={() => void save()}>{busy ? "Kaydediliyor…" : id ? "Değişiklikleri Kaydet" : "Talebi Yayınla"}</MobileButton></View>}
    {error && <MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text>{id && !title && <MobileButton secondary onPress={() => setRetry(v => v + 1)}>Tekrar Yükle</MobileButton>}</MobileCard>}
    <MobileCategorySelect visible={categoryOpen} initial={trail} onClose={() => setCategoryOpen(false)} onSelect={setTrail}/>
  </MobileScreen>;
}

function RequestDetail({ id }: { id: string }) {
  const store = useStore(), router = useRouter();
  const [request, setRequest] = useState<BuyerRequest | null>(null), [offers, setOffers] = useState<BuyerOffer[]>([]), [matches, setMatches] = useState<Listing[]>([]), [total, setTotal] = useState(0), [tab, setTab] = useState("Uygun İlanlar"), [error, setError] = useState(""), [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [offerListing, setOfferListing] = useState(""), [note, setNote] = useState("");
  const lock = useRef(false), offerId = useRef(makeUuid()), revision = useRef(0);
  useFocusEffect(useCallback(() => { const n = ++revision.current; setLoading(true); setError(""); void Promise.all([loadBuyerRequest(id), loadBuyerOffers(id)]).then(([r, o]) => { if (n === revision.current) { setRequest(r); setOffers(o); } }).catch(() => { if (n === revision.current) setError("Talep veya yanıtlar yüklenemedi. Talep kapanmış ya da erişim kaldırılmış olabilir."); }).finally(() => { if (n === revision.current) setLoading(false); }); return () => { revision.current++; }; }, [id, retry]));
  useEffect(() => { let alive = true; if(request && expired(request)){setMatches([]);setTotal(0);} if (request && !expired(request)) { void matchBuyerRequest(request, store.categoryTree).then(data => { if (alive) { setMatches(data.listings); setTotal(data.total); } }).catch(() => { if (alive) setError("Eşleşen ilanlar yüklenemedi. Tekrar dene."); }); } return () => { alive = false; }; }, [request, store.categoryTree, retry]);
  const owner = request?.user_id === store.currentUser.id;
  const own = store.listings.filter(l => l.ownerId === store.currentUser.id && l.status === "active");
  async function act(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await action(); setRetry(v => v + 1); } catch { setError("İşlem kaydedilemedi. Bilgilerin korunuyor; tekrar dene."); } finally { lock.current = false; setBusy(false); } }
  async function more() { if (!request || lock.current) return; lock.current = true; setBusy(true); const n = revision.current; try { const data = await matchBuyerRequest(request, store.categoryTree, matches.length); if (n === revision.current) { setMatches(old => [...new Map([...old, ...data.listings].map(l => [l.id, l])).values()]); setTotal(data.total); } } catch { setError("Diğer eşleşmeler yüklenemedi."); } finally { lock.current = false; setBusy(false); } }
  return <MobileScreen title="Alıcı Talebi" bottom={<MobileBottomNav/>}>
    {loading && <Text style={ms.muted}>Yükleniyor…</Text>}{error && <MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={() => setRetry(v => v + 1)}>Tekrar Dene</MobileButton></MobileCard>}
    {request && <><MobileCard><Text style={ms.section}>{request.title}</Text><Text style={{ color: mobile.teal, fontWeight: "800", fontSize: 20 }}>{budget(request)}</Text><Text style={ms.muted}>{request.category_trail.join(" › ")}</Text><Text style={ms.muted}>⌖ {place(request)}</Text><Text style={ms.muted}>{request.description}</Text><Text style={ms.muted}>Geçerlilik: {new Date(request.expires_at).toLocaleDateString("tr-TR")} · {expired(request) ? "Kapalı / süresi dolmuş" : "Aktif"}</Text><Text style={ms.muted}>{request.allow_partners ? "Ortakların ürün bulmasına açık" : "Doğrudan satıcılardan ürün önerisi bekleniyor"}</Text></MobileCard>
      {owner && <View style={[ms.row, { marginVertical: 12 }]}><MobileButton secondary style={{ flex: 1 }} onPress={() => router.push({ pathname: "/buyer-requests", params: { id, view: "create" } } as never)}>Talebi Düzenle</MobileButton>{request.status === "active" && <MobileButton secondary disabled={busy} style={{ flex: 1 }} onPress={() => Alert.alert("Talebi Kapat", "Yeni ürün önerileri durdurulsun mu?", [{ text: "Vazgeç", style: "cancel" }, { text: "Kapat", onPress: () => void act(async () => { const result = await supabase!.from("buyer_requests").update({ status: "closed" }).eq("id", id).eq("user_id", store.currentUser.id).select("id").single(); if (result.error || !result.data) throw Error(); }) }])}>Talebi Kapat</MobileButton>}</View>}
      <View style={[ms.row, { marginVertical: 12 }]}>{["Uygun İlanlar", "Ürün Önerileri"].map(label => <MobileChip key={label} label={label} selected={tab === label} onPress={() => setTab(label)}/>)}</View>
      {tab === "Uygun İlanlar" && <><Text style={[ms.muted, { marginBottom: 13 }]}>Kategori, bütçe, para birimi ve seçilen konuma uyan {total} ilan. Diğer özellikleri açıklamadan kontrol et.</Text>{matches.map(l => <MobileRowListing key={l.id} listing={l}/>)}{!matches.length && !loading && <MobileCard><Text style={ms.muted}>{expired(request) ? "Bu talep için yeni eşleştirme yapılmıyor." : "Bu ölçütlere uyan ilan bulunamadı."}</Text></MobileCard>}{matches.length < total && <MobileButton secondary disabled={busy} onPress={() => void more()}>Diğer Eşleşmeleri Göster</MobileButton>}</>}
      {tab === "Ürün Önerileri" && <>{offers.map(o => <MobileCard key={o.id}><Text style={ms.section}>Satıcının Ürün Önerisi</Text><Text style={ms.muted}>{o.note}</Text><Text style={{ color: mobile.teal }}>{o.status === "pending" ? "Yanıt Bekliyor" : o.status === "accepted" ? "İlgileniliyor" : "Uygun Bulunmadı"}</Text><MobileButton secondary onPress={() => router.push(`/listing/${o.listing_id}` as never)}>Önerilen İlanı Gör</MobileButton>{owner && o.status === "pending" && <View style={ms.row}><MobileButton secondary disabled={busy} style={{ flex: 1 }} onPress={() => void act(() => decideBuyerOffer(o.id, "rejected"))}>Uygun Değil</MobileButton><MobileButton disabled={busy} style={{ flex: 1 }} onPress={() => void act(() => decideBuyerOffer(o.id, "accepted"))}>İlgileniyorum</MobileButton></View>}<Text style={ms.muted}>İlgilenmek, satış veya ödeme onayı değildir. Ayrıntıları ilan üzerinden satıcıyla görüş.</Text></MobileCard>)}{!offers.length && <MobileCard><Text style={ms.muted}>{owner ? "Henüz ürün önerisi gelmedi." : "Bu talebe gönderdiğin ürün önerisi bulunmuyor."}</Text></MobileCard>}
        {!owner && !expired(request) && <MobileCard><Text style={ms.section}>Uygun İlanını Öner</Text><Text style={ms.muted}>Yayındaki kendi ilanlarından birini seç. Alıcı öneriyi talebinin içinden görebilir.</Text>{own.length ? <><MobileSelect label="Önerilecek İlan" value={own.find(l => l.id === offerListing)?.title} options={own.map(l => `${displayListingTitle(l.title)} · ${l.id}`)} onChange={v => setOfferListing(v.split(" · ").at(-1) || "")}/><MobileField label="Alıcıya Açıklaman" multiline maxLength={1000} value={note} onChange={setNote}/><MobileButton disabled={busy || !offerListing || note.trim().length < 10} onPress={() => void act(async () => { await sendBuyerOffer({ id: offerId.current, request_id: id, seller_id: store.currentUser.id, listing_id: offerListing, note: note.trim() }); setNote(""); setOfferListing(""); offerId.current = makeUuid(); })}>{busy ? "Gönderiliyor…" : "İlanımı Öner"}</MobileButton></> : <MobileButton secondary onPress={() => router.push("/create")}>Önce İlan Oluştur</MobileButton>}</MobileCard>}
      </>}
    </>}
  </MobileScreen>;
}

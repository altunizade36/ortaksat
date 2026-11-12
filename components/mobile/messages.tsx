import { openUrlSafe } from "@/lib/link";
import { conversationGroup, isEmptyThread } from "@/lib/inbox-model";
import { ConversationListingStrip } from "@/components/conversation-listing-strip";
import { ConversationOfferCard } from "@/components/conversation-offer-card";
import { ConversationListingActions } from "@/components/conversation-listing-actions";
import { useTypingIndicator } from "@/lib/use-typing";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { CompactFooter } from "@/components/compact-footer";
import { displayListingTitle } from "@/lib/listing-title";
import {BlockUserSheet} from "./block-user-sheet";
import {Alert} from "@/lib/alert";
import { UserAvatar } from "@/components/user-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { OptionSheet } from "@/components/option-sheet";
import { uploadMessageAttachment } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { usePairBlocked } from "@/lib/use-pair-blocked";
import { useScreenActive } from "@/lib/use-screen-active";
import { moneyIn, localToday } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { showToast } from "@/lib/toast";
import { colors } from "@/components/colors";
import { MobileButton, MobileCard, MobileChip, MobileScreen, IconButton, mobile, mobileContent, ms, useMobileLayout } from "./ui";

// createdAt = msgStamp() → YEREL "YYYY-MM-DD HH:MM:SS" (ISO değil). `new Date(...)` bu biçimi
// her JS motorunda ayrıştırmaz (Invalid Date → "NaN-NaN-NaN" gün anahtarı, "Invalid Date" başlığı);
// damga zaten yerel olduğu için doğrudan dilimlenir (web mesaj ekranıyla aynı yöntem).
const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function time(value: string) { const m = /\d{2}:\d{2}/.exec(value.slice(10)); return m ? m[0] : ""; }
function dayKey(value: string) { return value.slice(0, 10); }
function dayLabel(value: string, months: string[]) { const [y, m, d] = dayKey(value).split("-").map(Number); if (!y || !m || !d || !months[m - 1]) return dayKey(value); return `${d} ${months[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`; }
function isYesterday(value: string) { const [y, m, d] = localToday().split("-").map(Number); const prev = new Date(y, m - 1, d - 1); return dayKey(value) === `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`; }
function day(value: string) { return dayKey(value) === localToday() ? "Bugün" : isYesterday(value) ? "Dün" : dayLabel(value, MONTHS_LONG); }
export function MobileMessages() {
  const store = useStore();
  const router = useRouter();
  const { tablet, wide, maxWidth, height } = useMobileLayout();
  // İKİ BÖLME (liste | sohbet) yalnız ikisi de rahat sığınca açılır: liste en az 280 dp, sohbet en az 380 dp,
  // pencere en az 480 dp yüksek (yatay telefonda başlık + ilan şeridi + yazma alanı mesajlara yer bırakmaz).
  // Eskiden 700 dp'de liste %36 = ≈235 dp'ye sıkışıyordu. Sığmıyorsa (küçük tablet, dar pencere) TEK bölme:
  // liste ortalı ve ≤640 dp, sohbet ayrı ekranda açılır. Geniş tablette toplam ≤1040 dp (kenardan kenara değil).
  const paneWidth = Math.min(maxWidth, mobileContent.page);
  const listWidth = Math.max(280, Math.min(380, Math.round(paneWidth * 0.36)));
  const split = tablet && height >= 480 && paneWidth - listWidth >= 380;
  const [query,setQuery] = useState("");
  const [group,setGroup] = useState("all");
  const [active,setActive] = useState<string | null>(null);
  const [unread,setUnread] = useState(false);
  useForegroundRefresh(store.refreshUserData);
  const all = useMemo(() => store.conversations.filter((c) => c.participantIds.includes(store.currentUser.id)).map((c) => {
    const other = store.findUser(c.participantIds.find((id) => id !== store.currentUser.id) || "");
    const listing = store.findListing(c.listingId);
    const rows = store.messages.filter((m) => m.conversationId === c.id);
    const last = rows.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { ...c, other, listing, last, count: rows.filter((m) => m.receiverId === store.currentUser.id && !m.read).length, search: searchKey(`${other?.name || ""} ${listing?.title || ""} ${rows.map((m) => m.body).join(" ")}`) };
  // Hiç mesaj yazılmamış konuşmalar listelenmez (tablette seçili olan hariç) — bkz. isEmptyThread.
  }).filter((c) => c.id === active || !isEmptyThread(c, Boolean(c.last))).sort((a,b) => b.lastMessageAt.localeCompare(a.lastMessageAt)), [store.conversations,store.messages,store.currentUser.id,store.findUser,store.findListing,active]);
  const matching = all.filter((c) => (!query || c.search.includes(searchKey(query))) && (group === "all" || conversationGroup(c,store.currentUser.id) === group));
  const visible = matching.filter((c) => !unread || c.count > 0);
  const selected = matching.find((c) => c.id === active);
  useEffect(() => { if (split && !active && !unread && group === "all" && !query && all[0]) setActive(all[0].id); }, [split,active,unread,group,query,all]);
  const count = all.reduce((sum,c) => sum+c.count,0);
  return <MobileScreen title="Mesajlar" back={false} right={<View style={ms.row}>{count > 0 ? <Text style={{ color: mobile.teal, fontSize: 12, fontWeight: "700" }}>{count}</Text> : null}<IconButton name="email-mark-as-unread" label="Okunmamış" color={unread ? mobile.teal : mobile.muted} onPress={() => { setActive(null);setUnread((v) => !v); }} /><IconButton name="plus" label="Yeni görüşme için ilan bul" onPress={() => router.push("/explore")} /></View>} scroll={false} contentStyle={split ? { maxWidth: paneWidth } : wide ? { maxWidth: mobileContent.column } : undefined}>
    {!store.authReady || store.isAuthenticated && !store.accountLoaded ? <Text style={[ms.muted,{padding:20}]}>Mesajlar yükleniyor…</Text> : !store.isAuthenticated ? <View style={{ padding:20 }}><Text style={ms.section}>Mesajların burada</Text><Text style={[ms.muted,{marginVertical:10}]}>İlanlarla ilgili görüşmelerini ve ortaklık mesajlarını tek yerde takip et.</Text><MobileButton onPress={() => router.push({pathname:"/auth",params:{redirect:"/messages"}})}>Giriş yap</MobileButton></View> : <View testID="native-inbox" style={{ flex:1, flexDirection:"row", minHeight:0 }}>
      <View style={{ width:split?listWidth:"100%",borderRightWidth:split?1:0,borderColor:mobile.line }}>
        <View style={{ padding:12,gap:10 }}><View style={[ms.input,ms.row,{borderRadius:22}]}><Icon name="magnify" size={18} color={mobile.muted}/><TextInput accessibilityLabel="Kişi veya ilan ara" value={query} onChangeText={setQuery} placeholder="Kişi veya ilan ara…" placeholderTextColor={mobile.muted} style={{ flex:1,minWidth:0,padding:0,fontSize:13,color:mobile.ink }}/></View>
          <HorizontalScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>{[["all","Tümü"],["buyers","Alıcı"],["sellers","Satıcı"],["partner","Ortaklık"]].map(([key,label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:group===key}} onPress={() => {setActive(null);setGroup(key);}} style={{ minHeight:36,paddingHorizontal:13,borderRadius:20,backgroundColor:group===key?mobile.teal:colors.surfaceAlt,alignItems:"center",justifyContent:"center" }}><Text style={{fontSize:12,fontWeight:"600",color:group===key?"white":mobile.ink}}>{label}</Text></Pressable>)}</HorizontalScroll>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{flex:1}} contentContainerStyle={{flexGrow:1}}>{visible.map((c) => <Pressable key={c.id} testID="native-conversation-row" accessibilityRole="button" accessibilityLabel={`${c.other?.name || "Kullanıcı"} ile sohbet`} onPress={() => split ? setActive(c.id) : router.push(`/chat/${c.id}` as never)} style={{ flexDirection:"row",gap:10,paddingHorizontal:12,paddingVertical:12,minHeight:80,backgroundColor:split&&selected?.id===c.id?mobile.tealSoft:"white",borderBottomWidth:1,borderColor:mobile.line }}>
          <UserAvatar uri={c.other?.avatar} size={43}/><View style={{flex:1,minWidth:0,gap:3}}><View style={[ms.row,{justifyContent:"space-between"}]}><Text numberOfLines={1} style={{flex:1,fontSize:13,fontWeight:"700",color:mobile.ink}}>{c.other?.name || "OrtakSat kullanıcısı"}</Text><Text style={{fontSize:10,color:mobile.muted}}>{c.last ? dayKey(c.last.createdAt)===localToday()?time(c.last.createdAt):isYesterday(c.last.createdAt)?"Dün":dayLabel(c.last.createdAt,MONTHS_SHORT):""}</Text></View><Text numberOfLines={1} style={{fontSize:11,color:c.partnerId?mobile.teal:mobile.ink}}>{c.partnerId?"Ortaklık · ":""}{displayListingTitle(c.listing?.title || "İlan görüşmesi")}</Text><View style={ms.row}><Text numberOfLines={1} style={{flex:1,fontSize:12,color:c.count>0?mobile.ink:mobile.muted,fontWeight:c.count>0?"700":"400"}}>{c.last ? `${c.last.senderId === store.currentUser.id ? "Sen: " : ""}${c.last.body || (c.last.attachmentUrl ? (c.last.attachmentType === "file" ? c.last.attachmentName || "Dosya eki" : "Fotoğraf") : "")}` : "Henüz mesaj yok"}</Text>{c.count>0?<Text style={{fontSize:10,fontWeight:"700",color:"white",backgroundColor:mobile.teal,borderRadius:10,overflow:"hidden",paddingHorizontal:6,paddingVertical:2}}>{c.count>99?"99+":c.count}</Text>:null}</View></View>
        </Pressable>)}{!visible.length?<View style={{padding:22,gap:8}}><Icon name="message-text-outline" size={28} color={mobile.teal}/><Text style={ms.section}>{query||unread||group!=="all"?"Bu görünümde konuşma yok":"Henüz mesajın yok"}</Text><Text style={ms.muted}>{query||unread||group!=="all"?"Aramayı veya filtreyi değiştirerek tekrar dene.":"Bir ilanın detayından mesaj göndererek görüşme başlatabilirsin."}</Text></View>:null}</ScrollView>
      </View>
      {split?<View style={{flex:1,minWidth:0}}>{selected?<MobileConversation key={selected.id} id={selected.id} embedded/>:<View style={{padding:24}}><Text style={ms.muted}>Görüntülemek için bir konuşma seç.</Text></View>}</View>:null}
    </View>}
  </MobileScreen>;
}

export function MobileConversation({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const store = useStore();
  const router = useRouter();
  const { insets, wide } = useMobileLayout();
  const [body, setBody] = useState("");
  const [blockOpen,setBlockOpen]=useState(false);
  const [menu, setMenu] = useState(false);
  const [locating, setLocating] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [phoneConfirm, setPhoneConfirm] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const conversation = store.findConversation(id);
  // Yerel id sunucudaki mevcut konuşmaya eşlenmiş olabilir (store alias) → mesajlar gerçek id ile.
  const cid = conversation?.id ?? id;
  const otherId = conversation?.participantIds.find((v) => v !== store.currentUser.id) || "";
  const other = store.findUser(otherId);
  const listing = conversation ? store.findListing(conversation.listingId) : undefined;
  const messages = useMemo(() => { const index = new Map(store.messages.map((m,i) => [m.id,i]));return store.messages.filter((m) => m.conversationId === cid).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || (index.get(b.id) ?? 0) - (index.get(a.id) ?? 0)); }, [store.messages,cid]);
  const blocked = store.isUserBlocked(otherId);
  const { otherTyping, notifyTyping } = useTypingIndicator(conversation?.id, store.currentUser.id);
  useForegroundRefresh(store.refreshUserData);
  const hasUnread = messages.some((m) => m.receiverId === store.currentUser.id && !m.read);
  // Yalnız ekran GERÇEKTEN görünürken okundu yaz (sohbet stack'te/tablet bölmesinde mount'lu
  // kalırken ya da uygulama arka plandayken gelen mesaj görülmeden okundu olmasın).
  const screenActive = useScreenActive();
  useEffect(() => { if (screenActive && conversation && hasUnread) store.markConversationRead(cid); }, [screenActive, cid, hasUnread, store.markConversationRead, conversation]);
  // Karşı taraf beni engellediyse store bilemez → sunucuya sor, composer yerine bant göster.
  const failedCount = messages.reduce((n, m) => n + (m.status === "failed" ? 1 : 0), 0);
  const blockedByOther = usePairBlocked(conversation ? store.currentUser.id : undefined, otherId || undefined, `${id}:${failedCount}:${blocked ? 1 : 0}`) && !blocked;
  // iOS: bir Modal KAPANIRKEN aynı anda açılan ikinci Modal/Alert yutulur (seçenek sayfasından
  // "Engelle"ye basınca hiçbir şey olmuyordu). Sıradaki pencere, sayfa kapanma animasyonu
  // bittikten SONRA açılır.
  const afterSheet = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (afterSheet.current) clearTimeout(afterSheet.current); }, []);
  function openAfterSheetCloses(next: () => void) {
    if (afterSheet.current) clearTimeout(afterSheet.current);
    afterSheet.current = setTimeout(() => { afterSheet.current = null; next(); }, Platform.OS === "ios" ? 420 : 120);
  }
  function send() {
    if (busy.current || !body.trim() || blocked || blockedByOther || !conversation || conversation.status !== "open") return;
    busy.current = true;
    const ok = store.sendConversationMessage(cid, body.trim());
    if (ok) { setBody(""); nearBottom.current = true; scroll.current?.scrollToEnd({ animated: true }); }
    else showToast("Mesaj gönderilemedi. Tekrar dene.");
    setTimeout(() => { busy.current = false; }, 250);
  }
  async function addLocation() {
    if (locating || blocked || conversation?.status !== "open") return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { showToast("Konum izni verilmedi."); return; }
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const text = `Konumum: https://www.google.com/maps/search/?api=1&query=${point.coords.latitude.toFixed(5)},${point.coords.longitude.toFixed(5)}`;
      setBody(old => old ? `${old}\n${text}` : text);
      showToast("Konum mesaja eklendi. Gönder düğmesiyle paylaşabilirsin.");
    } catch { showToast("Konum alınamadı. Tekrar deneyebilirsin."); }
    finally { setLocating(false); }
  }
  async function attachment() {
    if (attaching || blocked || conversation?.status !== "open") return;
    setAttaching(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { showToast("Fotoğraf seçmek için galeri izni gerekli."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      const url = await uploadMessageAttachment(result.assets[0].uri, store.currentUser.id);
      if (!url || !store.sendConversationMessage(cid, "", { url, type: "image", name: "Fotoğraf" })) showToast("Fotoğraf gönderilemedi.");
    } catch { showToast("Fotoğraf gönderilemedi. Bağlantını kontrol et."); } finally { setAttaching(false); }
  }
  const content = <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1, borderColor: mobile.line, backgroundColor: "white" }}>{!embedded && <IconButton name="chevron-left" label="Mesajlara dön" onPress={() => router.canGoBack() ? router.back() : router.replace("/messages")} />}<UserAvatar uri={other?.avatar} style={{ width: 37, height: 37, borderRadius: 19 }} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: mobile.ink }}>{other?.name || "OrtakSat kullanıcısı"}</Text><Text numberOfLines={1} style={{ color: otherTyping ? mobile.teal : mobile.muted, fontSize: 11 }}>{otherTyping ? "yazıyor…" : conversation?.partnerId ? "Ortaklık görüşmesi" : "İlan görüşmesi"}</Text></View><IconButton name="dots-horizontal" label="Sohbet seçenekleri" onPress={() => setMenu(true)} /></View>
    <ConversationListingStrip listing={listing}/>
    {conversation && listing?<View style={{paddingHorizontal:10,paddingBottom:8}}><ConversationListingActions key={id} conversation={conversation} listing={listing}/></View>:null}
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: mobile.canvas }} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => { if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false }); }} onScroll={(e) => { const v = e.nativeEvent; nearBottom.current = v.contentSize.height - v.contentOffset.y - v.layoutMeasurement.height < 120; }} scrollEventThrottle={100}>
      {messages.map((m, i) => { const own = m.senderId === store.currentUser.id; return <View key={m.id}>{(i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1].createdAt)) && <Text style={{ textAlign: "center", alignSelf: "center", color: mobile.muted, fontSize: 10, backgroundColor: mobile.tealSoft, overflow: "hidden", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12, marginVertical: 9 }}>{day(m.createdAt)}</Text>}<View style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "88%", borderWidth: 1, borderColor: own ? mobile.teal : mobile.line, backgroundColor: own ? mobile.teal : "white", borderRadius: 12, padding: 11 }}>
        {m.attachmentType === "file" && m.attachmentUrl ? <Pressable accessibilityRole="button" accessibilityLabel={`Dosyayı aç: ${m.attachmentName || "Dosya"}`} onPress={() => void openUrlSafe(m.attachmentUrl!)} style={{flexDirection:"row",gap:6,alignItems:"center",minHeight:36}}><Icon name="file-document-outline" size={20} color={own?"white":mobile.teal}/><Text numberOfLines={2} style={{flexShrink:1,fontSize:12,color:own?"white":mobile.ink}}>{m.attachmentName || "Dosya"}</Text></Pressable> : null}
        {m.attachmentType !== "file" && m.attachmentUrl && <Pressable accessibilityRole="button" accessibilityLabel="Fotoğrafı büyüt" onPress={() => setLightbox(m.attachmentUrl || null)}><SafeRemoteImage uri={m.attachmentUrl} full style={{ width: 190, maxWidth: "100%", height: 160, borderRadius: 7, backgroundColor: mobile.line }} /></Pressable>}
        {!!m.body && <Text selectable style={{ color: own ? "white" : mobile.ink, fontSize: 13, lineHeight: 19 }}>{m.body}</Text>}<View style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}><Text style={{ fontSize: 9, color: own ? "#D7E2F1" : mobile.muted }}>{time(m.createdAt)}</Text>{own && <Icon name={m.status === "failed" ? "alert-circle-outline" : m.read ? "check-all" : "check"} size={14} color={own ? "white" : mobile.teal} />}</View>{m.status === "failed" && <Pressable accessibilityRole="button" onPress={() => store.retryMessage(m.id)}><Text style={[ms.error, { color: "#FFD9D0", fontWeight: "700", marginBottom: 0 }]}>Gönderilemedi · Tekrar dene</Text></Pressable>}</View></View>; })}
      {!messages.length && <Text style={[ms.muted, { textAlign: "center", padding: 22 }]}>{store.accountLoaded ? "İlk mesajını yazabilirsin." : "Sohbet yükleniyor…"}</Text>}
    {conversation?<ConversationOfferCard key={id} conversation={conversation} listing={listing}/>:null}</ScrollView>
    {!conversation ? null : blocked || blockedByOther || conversation.status !== "open" ? <View style={{ backgroundColor: "white", borderTopWidth: 1, borderColor: mobile.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: embedded ? 12 : Math.max(12, insets.bottom) }}><Text style={{ color: mobile.muted, fontSize: 12.5, lineHeight: 18, textAlign: "center" }}>{blocked ? "Bu kullanıcı engellendi. Sohbet seçeneklerinden engeli kaldırabilirsin." : blockedByOther ? "Bu kullanıcıyla mesajlaşma şu anda mümkün değil. Mesaj geçmişini görüntüleyebilirsin." : "Bu konuşma kapatılmış. Mesaj geçmişini görüntüleyebilirsin."}</Text></View> :<View style={{ backgroundColor: "white", padding: 9, borderTopWidth: 1, borderColor: mobile.line, paddingBottom: embedded ? 9 : Math.max(9, insets.bottom) }}><View style={ms.row}><IconButton name="message-text-outline" label="Hazır yanıtlar" onPress={() => setShowQuick((v) => !v)} /><IconButton name="image-outline" label="Fotoğraf gönder" onPress={() => void attachment()} /><TextInput accessibilityLabel="Mesajın" value={body} onChangeText={(value) => {setBody(value);notifyTyping();}} placeholder={attaching ? "Fotoğraf yükleniyor…" : "Mesajınızı yazın..."} placeholderTextColor={mobile.muted} multiline numberOfLines={1} maxLength={4000} style={[ms.input, { flex: 1, minWidth: 0, maxHeight: 110 }]} /><Pressable accessibilityRole="button" accessibilityLabel="Mesaj gönder" disabled={!body.trim()} onPress={send} style={{ height: 44, width: 44, borderRadius: 10, backgroundColor: mobile.teal, alignItems: "center", justifyContent: "center", opacity: body.trim() ? 1 : 0.4 }}><Icon name="send" size={20} color="white" /></Pressable></View>{showQuick && <HorizontalScroll keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}><MobileChip label={locating ? "Konum alınıyor…" : "Konum Gönder"} icon="map-marker" onPress={() => void addLocation()} /><MobileChip label="İlanı sor" onPress={() => setBody("Merhaba, ilanınız hâlâ güncel mi?")} /><MobileChip label="Telefon Paylaş" icon="phone" onPress={() => setPhoneConfirm(true)} /><MobileChip label="Görüşelim" icon="calendar" onPress={() => setBody("Merhaba, ürünü görmek için uygun olduğunuz bir zamanı paylaşabilir misiniz?")} /></HorizontalScroll>}</View>}
    <BlockUserSheet target={blockOpen?{id:otherId,name:other?.name||"Kullanıcı",avatar:other?.avatar||"",city:other?.city,username:other?.username}:null} onClose={()=>setBlockOpen(false)}/>
    <OptionSheet visible={menu} title="Sohbet seçenekleri" options={[blocked ? "Engeli kaldır" : "Kullanıcıyı engelle", "Kullanıcıyı bildir"]} onClose={() => setMenu(false)} onSelect={(v) => { setMenu(false); const wasBlocked = blocked; openAfterSheetCloses(() => { if (v === "Kullanıcıyı bildir") { router.push({pathname:"/report",params:{userId:otherId}} as never); } else if (wasBlocked) Alert.alert("Engeli Kaldır","Bu kişiyle yeniden iletişim kurulabilsin mi?",[{text:"Vazgeç",style:"cancel"},{text:"Engeli Kaldır",onPress:()=>{void store.unblockUser(otherId).then(ok=>{if(!ok)showToast("Engel kaldırılamadı. Tekrar dene.");});}}]); else setBlockOpen(true); }); }} />
    <OptionSheet visible={phoneConfirm} title="Telefon numaranı paylaş" options={store.currentUser.phone ? [`${store.currentUser.phone} numaramı mesaja ekle`] : ["Profilime telefon ekle"]} onClose={() => setPhoneConfirm(false)} onSelect={() => { setPhoneConfirm(false); if (store.currentUser.phone) setBody(`Telefon numaram: ${store.currentUser.phone}`); else openAfterSheetCloses(() => router.push("/profile-edit")); }} />
    <Modal visible={!!lightbox} onRequestClose={() => setLightbox(null)}><View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#0A1119" }}><IconButton name="close" label="Fotoğrafı kapat" color="white" onPress={() => setLightbox(null)} /><SafeRemoteImage full uri={lightbox} contentFit="contain" style={{ flex: 1, backgroundColor: "#0A1119" }} /></View></Modal>
  </>;
  if (embedded) return <View style={{ flex: 1 }}>{content}</View>;
  // Tek başına sohbet (telefon / tek bölmeli tablet): 600 dp+ ekranda ≤760 dp ortalı sütun — balonlar
  // 1100 dp'lik satırlara yayılmaz.
  return <MobileScreen scroll={false} contentStyle={[{ paddingTop: insets.top }, wide && { maxWidth: mobileContent.pane }]}>{!store.authReady ? <Text style={[ms.muted, { padding: 22 }]}>Hesabın yükleniyor…</Text> : !store.isAuthenticated ? <View style={{ padding: 20 }}><MobileButton onPress={() => router.push({ pathname: "/auth", params: { redirect: `/chat/${id}` } } as never)}>Sohbet için giriş yap</MobileButton></View> : !conversation || !conversation.participantIds.includes(store.currentUser.id) ? <View style={{ padding: 20, gap: 10 }}>{store.accountLoaded ? <><Text style={ms.section}>Konuşma bulunamadı</Text><Text style={ms.muted}>Bu konuşma silinmiş olabilir veya erişimin olmayabilir.</Text></> : <Text style={ms.muted}>Sohbet yükleniyor…</Text>}<MobileButton secondary onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/messages"); }}>Mesajlara dön</MobileButton></View> : content}</MobileScreen>;
}

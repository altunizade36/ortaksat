import { LISTING_GRID_PHOTO_RATIO } from "@/lib/card-layout";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { CompactFooter } from "@/components/compact-footer";
import { displayListingTitle } from "@/lib/listing-title";
import { useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { UserAvatar } from "@/components/user-avatar";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { OptionSheet } from "@/components/option-sheet";
import { useStore } from "@/lib/use-store";
import { fetchListingsByIds } from "@/lib/supabase-data";
import { effectiveCommissionAmount, moneyIn } from "@/lib/format";
import { shareOrCopy } from "@/lib/share";
import { showToast } from "@/lib/toast";
import { Alert } from "@/lib/alert";
import { listingStatusLabels, partnershipStatusLabels } from "@/lib/status-labels";
import type { Listing, Partnership } from "@/lib/types";
import { MobileScreen, MobileButton, MobileCard, MobileChip, IconButton, mobile, ms, useMobileLayout, type MobileIcon } from "./ui";

type Tab = "overview" | "listings" | "partnerships" | "requests" | "favorites";

export function MobileProfile({ mode = "profile" }: { mode?: "profile" | "partner" | "seller" }) {
  const store = useStore(), router = useRouter();
  const { insets, maxWidth, tablet } = useMobileLayout();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [tab, setTab] = useState<Tab>(params.focus && mode !== "partner" ? "requests" : mode === "partner" ? "partnerships" : mode === "seller" ? "listings" : "overview");
  useEffect(() => {
    if (params.focus) { setTab(mode === "partner" ? "partnerships" : "requests"); setPartnershipFilter("Tümü"); }
  }, [params.focus, mode]);
  const [listingFilter, setListingFilter] = useState("Tümü");
  const [partnershipFilter, setPartnershipFilter] = useState(params.focus ? "Tümü" : "Aktif");
  const [limit, setLimit] = useState(12);
  const [refreshing, setRefreshing] = useState(false);
  const [menuListing, setMenuListing] = useState<Listing | null>(null);
  const [remote, setRemote] = useState<Listing[]>([]);
  const [retry, setRetry] = useState(0);
  const [remoteError, setRemoteError] = useState(false);
  const me = store.currentUser;
  const mine = store.listings.filter(l => l.ownerId === me.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const mineIds = new Set(mine.map(l => l.id));
  const myPartnerships = store.partnerships.filter(p => p.partnerId === me.id);
  const visiblePartnerships = myPartnerships.filter(p => tab === "overview" ? p.status === "active" : partnershipFilter === "Tümü" || partnershipStatusLabels[p.status] === partnershipFilter);
  const incoming = store.partnerships.filter(p => mineIds.has(p.listingId));
  const pending = incoming.filter(p => p.status === "pending");
  const active = myPartnerships.filter(p => p.status === "active");
  const favorites = store.favorites.filter(f => f.userId === me.id);
  const missing = [...new Set([...myPartnerships.map(p => p.listingId), ...favorites.map(f => f.listingId)])].filter(id => !store.listings.some(l => l.id === id));
  const missingKey = missing.slice().sort().join(",");
  useEffect(() => {
    let alive = true;
    setRemote([]); setRemoteError(false);
    if (!missingKey) return;
    const ids = missingKey.split(",");
    void Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, (_, n) => fetchListingsByIds(ids.slice(n * 100, (n + 1) * 100)))).then(results => {
      if (!alive) return;
      setRemote(results.flatMap(r => r?.listings ?? []));
      setRemoteError(results.some(r => !r));
    }).catch(() => { if (alive) setRemoteError(true); });
    return () => { alive = false; };
  }, [missingKey, retry]);
  const byId = useMemo(() => new Map([...remote, ...store.listings].map(l => [l.id, l])), [remote, store.listings]);
  const ready = store.authReady && store.accountLoaded && !store.marketplaceInitialLoading;
  function select(next: Tab) { setTab(next); setLimit(12); }
  async function refresh() { setRetry(v => v + 1); setRefreshing(true); try { await Promise.all([store.refreshMarketplace(), store.refreshUserData()]); } finally { setRefreshing(false); } }
  async function share(l?: Listing) {
    const result = await shareOrCopy({ title: l?.title || `${me.name} — OrtakSat`, url: `https://www.ortaksat.com/${l ? `listing/${l.id}` : `store/${me.id}`}` });
    if (result === "copied") showToast("Bağlantı kopyalandı.");
    if (result === "failed") showToast("Paylaşılamadı. Lütfen tekrar dene.");
  }
  function changeRequest(p: Partnership, approve: boolean) {
    Alert.alert(approve ? "Ortaklığı onayla" : "Talebi reddet", approve ? "Bu kişi ilanına ortak olarak katılabilecek. Devam edilsin mi?" : "Bu ortaklık talebi reddedilecek. Devam edilsin mi?", [{ text: "Vazgeç", style: "cancel" }, { text: approve ? "Onayla" : "Reddet", onPress: () => approve ? store.approvePartnership(p.id) : store.rejectPartnership(p.id) }]);
  }
  const cardWidth = Math.floor((maxWidth - 32 - (tablet ? 3 : 2) * 8) / (tablet ? 4 : 3));
  const listingItems = (tab === "favorites" ? favorites.map(f => byId.get(f.listingId)).filter((l): l is Listing => !!l) : mine).filter(l => tab === "favorites" || listingFilter === "Tümü" || listingStatusLabels[l.status] === listingFilter);
  const tabs: {key: Tab; label: string}[] = [{key:"listings", label:"İlanlarım"}, {key:"partnerships",label:"Ortaklıklarım"}, {key:"requests",label:"Ortaklık Talepleri"}, {key:"favorites",label:"Favorilerim"}];
  const empty = (text: string) => <MobileCard><Text style={ms.muted}>{ready ? text : "Hesap verilerin yükleniyor…"}</Text></MobileCard>;
  const heading = (title: string, target: Tab) => <View style={s.heading}><Text style={ms.section}>{title}</Text><Pressable accessibilityRole="button" onPress={() => target === "listings" ? router.push("/seller") : target === "favorites" ? router.push("/favorites") : select(target)}><Text style={s.link}>Tümünü Gör ›</Text></Pressable></View>;
  const listingCard = (l: Listing) => <View key={l.id} style={[s.listingCard, {width:cardWidth}]}><Pressable accessibilityRole="button" accessibilityLabel={displayListingTitle(l.title)} onPress={() => router.push(`/listing/${l.id}` as never)}><SafeRemoteImage uri={l.imageUrl || l.image} style={{width:"100%",height:(cardWidth-2) / LISTING_GRID_PHOTO_RATIO}} accessibilityLabel={displayListingTitle(l.title)} />{l.ownerId === me.id && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.listingStatus,{top:(cardWidth-2) / LISTING_GRID_PHOTO_RATIO - 17},l.status !== "active" && {backgroundColor:"#3F4B5EE6"}]}>{listingStatusLabels[l.status]}</Text>}<View style={{padding:5,gap:2,height:96}}><Text numberOfLines={2} style={s.cardTitle}>{displayListingTitle(l.title)}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.cardPrice}>{moneyIn(l.price,l.currency)}</Text><Text numberOfLines={1} style={[s.small,{height:16}]}>{l.location}</Text><Text numberOfLines={1} style={[s.small,{height:16,color:mobile.teal,fontWeight:"700"}]}>{l.partnershipMode === "none" ? "Satış ilanı" : `Komisyon ${l.commissionType === "rate" ? `%${l.commissionValue}` : moneyIn(l.commissionValue,l.currency)}`}</Text></View></Pressable>{l.ownerId === me.id && <Pressable accessibilityRole="button" accessibilityLabel={`${displayListingTitle(l.title)} yönet`} onPress={() => setMenuListing(l)} style={s.listingMenu}><Icon name="dots-vertical" size={19} color={mobile.ink}/></Pressable>}</View>;
  const partnershipRow = (p: Partnership) => {
    const l = byId.get(p.listingId);
    return <MobileCard key={p.id} style={{padding:9}}><Pressable accessibilityRole="button" accessibilityLabel={l ? displayListingTitle(l.title) : "Ortaklık ilanı"} onPress={() => router.push(`/listing/${p.listingId}` as never)} style={ms.row}><SafeRemoteImage uri={l?.imageUrl || l?.image} style={{width:56,height:50,borderRadius:8}}/><View style={{flex:1}}><Text numberOfLines={2} style={s.cardTitle}>{l ? displayListingTitle(l.title) : "İlan artık yayında olmayabilir"}</Text>{l && <Text style={s.cardPrice}>{moneyIn(l.price,l.currency)}</Text>}</View><Text style={[s.status,p.status !== "active" && {backgroundColor:"#F0F3F7",color:mobile.muted}]}>{partnershipStatusLabels[p.status]}</Text><Icon name="chevron-right" size={18} color={mobile.muted}/></Pressable>{l && <View style={[ms.row,{justifyContent:"space-between",flexWrap:"wrap"}]}><Text style={s.small}>Komisyon: {moneyIn(effectiveCommissionAmount(l,p,0,l.price,1),l.currency)}</Text>{p.status === "active" ? <View style={ms.row}><MobileChip label="Paylaş" icon="share-variant" onPress={() => void share(l)}/><MobileChip label="Satış ve kazançlar" onPress={() => router.push({pathname:"/partner",params:{view:"advanced",focus:p.listingId}} as never)}/></View> : p.status === "rejected" && p.rejectionReason ? <Text style={ms.muted}>{p.rejectionReason}</Text> : null}</View>}</MobileCard>;
  };
  return <MobileScreen scroll={false}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={mobile.teal}/>} contentContainerStyle={{flexGrow:1,paddingBottom:0}}>
      <View style={{height:Math.max(190,insets.top+160),overflow:"hidden",backgroundColor:mobile.darkTeal}}><Image source={require("../../assets/mobile/istanbul-marketplace.webp")} contentFit="cover" contentPosition="center" style={StyleSheet.absoluteFill}/><LinearGradient colors={[`${mobile.darkTeal}18`,`${mobile.darkTeal}E0`]} style={StyleSheet.absoluteFill}/><View style={{position:"absolute",right:12,top:insets.top+6,gap:6}}><IconButton name="cog-outline" label="Profil ayarları" color="white" onPress={() => router.push("/account-settings")}/><IconButton name="share-variant" label="Profilimi paylaş" color="white" onPress={() => void share()}/></View><View style={{position:"absolute",left:16,right:16,bottom:14,flexDirection:"row",gap:12,alignItems:"center"}}><View style={{borderWidth:3,borderColor:"white",borderRadius:47}}><UserAvatar uri={me.avatar} size={82} accessibilityLabel={me.name}/></View><View style={{flex:1,minWidth:0}}><View style={ms.row}><Text numberOfLines={2} style={{fontSize:20,fontWeight:"800",color:"white",flexShrink:1}}>{me.name}</Text>{me.verifiedIdentity ? <Icon name="check-decagram" size={20} color="#FFFFFF"/> : null}</View>{me.city ? <Text numberOfLines={1} style={{color:"white",marginTop:5}}>⌖ {me.city}, Türkiye</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="Profili Düzenle" onPress={() => router.push("/profile-edit")} style={{alignSelf:"flex-start",padding:7,borderRadius:10,borderWidth:1,borderColor:"#FFFFFFB0",marginTop:8}}><Text style={{color:"white",fontSize:11,fontWeight:"700"}}>✎ Profili Düzenle</Text></Pressable></View></View></View>
      <View style={{padding:16}}><Text style={{color:mobile.muted,fontSize:12,lineHeight:19}}>{me.bio || "Profilini düzenleyerek kendini ve uzmanlık alanlarını tanıtabilirsin."}</Text><View style={[ms.row,{marginVertical:12,flexWrap:"wrap"}]}>{me.createdAt && <Text style={ms.muted}>Üye: {new Date(me.createdAt).toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</Text>}<Icon name="star" size={18} color="#FFB900"/><Text style={ms.muted}>{me.rating > 0 ? `${me.rating.toFixed(1)} değerlendirme puanı` : "Henüz değerlendirme yok"}</Text></View>
      <View style={s.stats}>{([{icon:"text-box",value:mine.filter(l=>l.status==="active").length,label:"Aktif İlanım",key:"listings"},{icon:"handshake",value:active.length,label:"Aktif Ortaklığım",key:"partnerships"},{icon:"account-group",value:pending.length,label:"Ortaklık Talebi",key:"requests"},{icon:"heart",value:favorites.length,label:"Favori İlanım",key:"favorites"}] as const).map(stat => <Pressable key={stat.key} accessibilityRole="button" accessibilityLabel={stat.label} onPress={() => select(stat.key)} style={{flex:1,alignItems:"center",gap:7,paddingVertical:13}}><Icon name={stat.icon} size={24} color={mobile.teal}/><Text style={{fontWeight:"800",fontSize:17,color:mobile.ink}}>{ready ? stat.value : "…"}</Text><Text style={{fontSize:9,textAlign:"center",color:mobile.muted}}>{stat.label}</Text></Pressable>)}</View>
      <View style={[ms.row,{marginVertical:12}]}>{([{icon:"plus",label:"Yeni İlan Ver",action:()=>router.push("/create")},{icon:"send-outline",label:"İlanlarım",action:()=>router.push("/seller")},{icon:"handshake-outline",label:"Ortaklıklarım",action:()=>select("partnerships")},{icon:"heart-outline",label:"Favorilerim",action:()=>router.push("/favorites")}] as const).map((action,i) => <Pressable key={action.label} accessibilityRole="button" onPress={action.action} style={[s.quick,i===0&&{backgroundColor:mobile.teal}]}><Icon name={action.icon} size={26} color={i===0?"white":mobile.ink}/><Text numberOfLines={action.label.includes(" ")?2:1} adjustsFontSizeToFit minimumFontScale={0.8} style={{fontSize:10,color:i===0?"white":mobile.ink,textAlign:"center",fontWeight:"600"}}>{action.label}</Text></Pressable>)}</View>
      <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:16,marginBottom:14}}>{tabs.map(t => { const on = tab===t.key || tab==="overview"&&t.key==="listings"; return <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{selected:on}} onPress={()=>select(t.key)} style={{paddingVertical:10,borderBottomWidth:3,borderColor:on?mobile.teal:"transparent"}}><Text style={{color:on?mobile.teal:mobile.muted,fontWeight:"700",fontSize:12}}>{t.label}{t.key==="requests"&&pending.length?` (${pending.length})`:""}</Text></Pressable>; })}</HorizontalScroll>
      {tab==="overview"||tab==="listings"||tab==="favorites" ? <>{heading(tab==="favorites"?"Favori İlanlarım":"İlanlarım",tab==="favorites"?"favorites":"listings")}{tab==="listings"&&<HorizontalScroll  contentContainerStyle={{gap:6,marginBottom:12}}>{["Tümü","Yayında","İncelemede","Yayından kaldırıldı","Taslak","Süresi doldu","Satıldı","Reddedildi","Arşivlendi"].map(label=><MobileChip key={label} label={label} selected={listingFilter===label} onPress={()=>{setListingFilter(label);setLimit(12);}}/>)}</HorizontalScroll>}<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{listingItems.slice(0,tab==="overview"?3:limit).map(listingCard)}</View>{!listingItems.length&&empty(tab==="favorites"?"Henüz favori ilanın yok. Keşfet ekranından ilanları kaydedebilirsin.":"Bu durumda bir ilanın bulunmuyor.")}{listingItems.length>limit&&tab!=="overview"&&<MobileButton secondary onPress={()=>setLimit(v=>v+12)}>Diğer ilanları göster</MobileButton>}</>:null}
      {tab==="overview"||tab==="partnerships" ? <>{heading("Ortaklıklarım","partnerships")}{tab==="partnerships"&&<View style={[ms.wrap,{marginBottom:12}]}>{["Aktif","Onay bekliyor","Tümü"].map(label=><MobileChip key={label} label={label} selected={partnershipFilter===label} onPress={()=>{setPartnershipFilter(label);setLimit(12);}}/>)}</View>}{visiblePartnerships.slice(0,tab==="overview"?3:limit).map(partnershipRow)}{!visiblePartnerships.length&&empty("Bu durumda bir ortaklığın yok. İlan detayından ortaklık başvurusu yapabilirsin.")}{tab==="partnerships"&&visiblePartnerships.length>limit&&<MobileButton secondary onPress={()=>setLimit(v=>v+12)}>Diğer ortaklıkları göster</MobileButton>}</>:null}
      {tab==="overview"||tab==="requests" ? <>{heading("Ortaklık Talepleri","requests")}{pending.slice(0,tab==="overview"?3:limit).map(p=>{const l=byId.get(p.listingId),person=store.findUser(p.partnerId);return <MobileCard key={p.id} style={params.focus===p.id?{borderColor:mobile.teal}:undefined}><View style={ms.row}><SafeRemoteImage uri={l?.image} style={{width:50,height:48,borderRadius:8}}/><View style={{flex:1}}><Text style={s.cardTitle}>{l ? displayListingTitle(l.title) : "İlan"}</Text><Pressable accessibilityRole="button" onPress={()=>router.push(`/store/${p.partnerId}` as never)}><Text style={[s.link,{marginTop:4}]}>{person?.name||"Başvuru sahibinin profili"} ›</Text></Pressable></View><Text style={s.small}>{new Date(p.createdAt).toLocaleDateString("tr-TR")}</Text></View><Text style={{color:mobile.muted,fontSize:12,lineHeight:18}}>{p.note||"İlanınıza ortak olmak istiyor."}</Text><View style={ms.row}><MobileButton onPress={()=>changeRequest(p,true)} style={{flex:1}}>Onayla</MobileButton><MobileButton secondary onPress={()=>changeRequest(p,false)} style={{flex:1}}>Reddet</MobileButton></View></MobileCard>})}{!pending.length&&empty("Bekleyen ortaklık talebin yok.")}{pending.length>limit&&tab==="requests"&&<MobileButton secondary onPress={()=>setLimit(v=>v+12)}>Diğer talepleri göster</MobileButton>}</>:null}
      {remoteError&&<Text style={ms.error}>Bazı ilanlar yüklenemedi. Yenilemek için ekranı aşağı çekebilirsin.</Text>}
      <View style={{gap:8,marginTop:18}}><MobileButton secondary icon="chart-line" onPress={()=>router.push({pathname:mode==="partner"?"/partner":"/seller",params:{view:"advanced"}} as never)}>Satış ve ödeme yönetimi</MobileButton><MobileButton secondary icon="wallet-outline" onPress={()=>router.push("/earnings")}>Kazançlarım</MobileButton><MobileButton secondary icon="chat-outline" onPress={()=>router.push("/messages")}>Mesajlarım</MobileButton></View>
      </View>
    <CompactFooter /></ScrollView>
    <OptionSheet visible={!!menuListing} title="İlanı yönet" options={["İlanı Gör","Düzenle",...(menuListing?.status==="active"?["Yayından Kaldır","Satıldı Olarak İşaretle"]:menuListing?.status==="paused"?["Yeniden Yayınla"]:[])]} onClose={()=>setMenuListing(null)} onSelect={value=>{const l=menuListing;setMenuListing(null);if(!l)return;if(value==="İlanı Gör")router.push(`/listing/${l.id}` as never);else if(value==="Düzenle")router.push(`/listing-edit/${l.id}` as never);else Alert.alert(value,`“${displayListingTitle(l.title)}” ilanının durumu güncellenecek.`,[{text:"Vazgeç",style:"cancel"},{text:"Onayla",onPress:()=>{const next=value==="Yayından Kaldır"?"paused":value==="Yeniden Yayınla"?"active":"sold";void store.updateListingStatus(l.id,next).then(ok=>showToast(ok?next==="paused"?"İlan yayından kaldırıldı.":next==="sold"?"İlan satıldı olarak işaretlendi.":"İlan durumu güncellendi.":"İlan durumu kaydedilemedi. Tekrar dene.")).catch(()=>showToast("İlan durumu kaydedilemedi. Tekrar dene."));}}]);}}/>
  </MobileScreen>;
}
const s=StyleSheet.create({stats:{flexDirection:"row",borderRadius:12,backgroundColor:mobile.tealSoft,borderWidth:1,borderColor:mobile.line},quick:{flex:1,minHeight:72,borderRadius:9,borderWidth:1,borderColor:mobile.line,backgroundColor:"#F1F5F9",paddingVertical:9,paddingHorizontal:4,alignItems:"center",justifyContent:"center",gap:6},heading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:16,marginBottom:12},link:{color:mobile.teal,fontSize:11,fontWeight:"600"},listingCard:{backgroundColor:"white",borderWidth:1,borderColor:mobile.line,borderRadius:10,overflow:"hidden",marginBottom:8},cardTitle:{color:mobile.ink,fontWeight:"700",fontSize:12,lineHeight:17,height:34},cardPrice:{color:mobile.teal,fontWeight:"800",fontSize:16},small:{color:mobile.muted,fontSize:9,lineHeight:14},listingMenu:{position:"absolute",right:2,top:2,borderRadius:15,padding:4,backgroundColor:"#FFFFFFE8"},status:{color:mobile.teal,backgroundColor:mobile.tealSoft,padding:5,borderRadius:6,fontSize:10},listingStatus:{position:"absolute",left:0,right:0,height:17,lineHeight:17,textAlign:"center",color:"white",backgroundColor:"#0645C9E6",paddingHorizontal:3,fontSize:9,fontWeight:"700"}});

import { isPublicPartnershipListing } from "@/lib/listing-actions";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { OptionSheet } from "@/components/option-sheet";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { UserAvatar } from "@/components/user-avatar";
import { useStore } from "@/lib/use-store";
import { fetchListingsByIds } from "@/lib/supabase-data";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { listingPhotos, maximumPartners, priceChange } from "@/lib/mobile-listing";
import { moneyIn } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { showToast } from "@/lib/toast";
import type { Favorite, Listing, User } from "@/lib/types";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, IconButton, mobile, ms } from "./ui";

const tabs = ["Tümü", "Ortaklığa Açık", "Fiyatı Düşen", "Son Eklenen"];
const sorts = ["En son kaydedilen", "Fiyat: düşükten yükseğe", "Fiyat: yüksekten düşüğe"];
export function MobileFavorites() {
  const store = useStore(), router = useRouter();
  const [tab,setTab] = useState(tabs[0]), [query,setQuery] = useState(""), [search,setSearch] = useState(false);
  const [sort,setSort] = useState(sorts[0]), [menu,setMenu] = useState(false), [limit,setLimit] = useState(20);
  const [remote,setRemote] = useState<Listing[]>([]), [owners,setOwners] = useState<User[]>([]);
  const [retry,setRetry] = useState(0), [loading,setLoading] = useState(true), [failed,setFailed] = useState(false);
  const accountRef = useRef(store.currentUser.id);
  const favorites = store.favorites.filter(f=>f.userId===store.currentUser.id);
  const missingKey = favorites.map(f=>f.listingId).filter(id=>!store.listings.some(l=>l.id===id)).sort().join(",");
  useEffect(()=>{
    let active=true; setLoading(!!missingKey); setFailed(false);
    if(accountRef.current!==store.currentUser.id){accountRef.current=store.currentUser.id;setRemote([]);setOwners([]);}
    if(!missingKey)return;
    const ids=missingKey.split(",");
    void (async()=>{
      const rows:Listing[]=[], users:User[]=[]; let error=false;
      for(let i=0;i<ids.length;i+=300){
        const result=await fetchListingsByIds(ids.slice(i,i+300));
        if(!active)return;
        if(!result){error=true;continue;} rows.push(...result.listings);users.push(...result.users);
      }
      if(active){setRemote(previous=>error?Array.from(new Map([...previous,...rows].map(l=>[l.id,l])).values()):rows);setOwners(previous=>error?Array.from(new Map([...previous,...users].map(u=>[u.id,u])).values()):users);setFailed(error);}
    })().catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[missingKey,retry,store.currentUser.id]);
  useForegroundRefresh(store.refreshUserData);
  const byId = useMemo(()=>new Map([...remote,...store.listings].map(l=>[l.id,l])),[remote,store.listings]);
  const rows = favorites.map(f=>({favorite:f,listing:byId.get(f.listingId)})).filter(({listing:l})=>!query||!!l&&searchKey(`${displayListingTitle(l.title)} ${l.category} ${l.location}`).includes(searchKey(query)));
  const matches = ({favorite:f,listing:l}: typeof rows[number],group:string) => group==="Tümü" || group==="Ortaklığa Açık"&&!!l&&isPublicPartnershipListing(l) || group==="Fiyatı Düşen"&&!!l&&priceChange(f.savedPrice,l.price)?.down || group==="Son Eklenen"&&!!f.createdAt&&Date.now()-new Date(f.createdAt).getTime()>=0&&Date.now()-new Date(f.createdAt).getTime()<7*86400000;
  const selected=rows.filter(row=>matches(row,tab)).sort((a,b)=>sort===sorts[1]?(a.listing?.price??Infinity)-(b.listing?.price??Infinity):sort===sorts[2]?(b.listing?.price??0)-(a.listing?.price??0):(b.favorite.createdAt||"").localeCompare(a.favorite.createdAt||""));
  function message(l:Listing) {
    if(l.status!=="active"||l.demo||store.isUserBlocked(l.ownerId)){showToast("Bu ilan için mesaj başlatılamıyor.");return;}
    const conversation=store.startConversation(l.id,l.ownerId,"",l);
    if(conversation)router.push(`/chat/${conversation.id}` as never);else showToast("Mesaj başlatılamadı. Tekrar dene.");
  }
  function card(f:Favorite,l?:Listing) {
    if(!l)return loading?null:<MobileCard key={f.id}><Text style={ms.section}>{failed?"İlan bilgisi yüklenemedi":"Kaydettiğin ilan artık yayında olmayabilir"}</Text><MobileChip label="Favorilerden kaldır" icon="heart-off-outline" onPress={()=>store.toggleFavorite(f.listingId)}/></MobileCard>;
    const photos=listingPhotos(l),owner=store.findUser(l.ownerId)||owners.find(u=>u.id===l.ownerId),change=priceChange(f.savedPrice,l.price),open=isPublicPartnershipListing(l),max=maximumPartners(l);
    return <MobileCard key={f.id}>
      <View style={{flexDirection:"row",gap:10}}><Pressable accessibilityRole="button" accessibilityLabel={`${displayListingTitle(l.title)} ilanını aç`} onPress={()=>router.push(`/listing/${l.id}` as never)} style={{width:"32%"}}><SafeRemoteImage uri={photos[0]} style={{width:"100%",height:103,borderRadius:9}}/><Text style={{position:"absolute",bottom:4,left:4,backgroundColor:"#17232FBB",color:"white",padding:4,fontSize:9,borderRadius:5}}>{photos.length?`1/${photos.length}`:"Fotoğraf yok"}</Text></Pressable><View style={{flex:1,gap:5}}><View style={ms.row}><Text numberOfLines={2} style={{flex:1,fontWeight:"700",color:mobile.ink,fontSize:14}}>{displayListingTitle(l.title)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${displayListingTitle(l.title)} favorilerden kaldır`} onPress={()=>store.toggleFavorite(l.id)} hitSlop={8}><Icon name="heart" size={23} color="#FF728B"/></Pressable></View><View style={[ms.row,{flexWrap:"wrap"}]}><Text style={{fontSize:21,fontWeight:"800",color:mobile.teal}}>{moneyIn(l.price,l.currency)}</Text>{change&&<Text style={{fontSize:10,color:change.down?"#138447":"#CF3154",backgroundColor:change.down?"#E9F9EF":"#FFEFF3",padding:4,borderRadius:4}}>{change.down?"↓":"↑"} %{change.percent}</Text>}</View><Text numberOfLines={1} style={ms.muted}>⌖ {l.location}</Text><Text style={{color:open?mobile.teal:mobile.muted,fontSize:10}}>{open?"Ortaklığa Açık":l.partnershipMode==="invite"?"Yalnız davetle ortaklık":"Ortaklığa Kapalı"}{open?` · ${l.commissionType==="rate"?`%${l.commissionValue}`:moneyIn(l.commissionValue,l.currency)} · ${l.partnerCount||0}/${max||"∞"} ortak`:""}</Text></View></View>
      <View style={[ms.row,{flexWrap:"wrap"}]}><Pressable accessibilityRole="button" accessibilityLabel={`${owner?.name||"Satıcı"} profilini aç`} onPress={()=>router.push(`/store/${l.ownerId}` as never)} style={{flex:1,minWidth:95,flexDirection:"row",gap:6,alignItems:"center"}}><UserAvatar uri={owner?.avatar} size={30}/><View style={{flex:1}}><Text numberOfLines={1} style={{fontWeight:"700",fontSize:11,color:mobile.ink}}>{owner?.name||"Satıcı profili"}</Text><Text style={{fontSize:10,color:mobile.muted}}>Satıcı</Text></View></Pressable>{l.ownerId!==store.currentUser.id&&<MobileChip icon="chat" label="Mesaj Gönder" onPress={()=>message(l)}/>}<MobileChip icon="open-in-new" label="İlanı Gör" onPress={()=>router.push(`/listing/${l.id}` as never)}/></View>
    </MobileCard>;
  }
  return <MobileScreen title="Favorilerim" right={<View style={ms.row}><IconButton name="magnify" label={search?"Aramayı kapat":"Favorilerde ara"} onPress={()=>{setSearch(v=>!v);setQuery("");setLimit(20);}}/><IconButton name="dots-horizontal" label="Favori seçenekleri" onPress={()=>setMenu(true)}/></View>} bottom={<MobileBottomNav active="profile"/>}>
    {search&&<MobileField placeholder="Favorilerinde ara" value={query} onChange={v=>{setQuery(v);setLimit(20);}}/>}
    <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:12}}>{tabs.map(label=><MobileChip key={label} label={`${label} (${loading&&label!=="Tümü"?"…":rows.filter(r=>matches(r,label)).length})`} selected={tab===label} onPress={()=>{setTab(label);setLimit(20);}}/>)}</HorizontalScroll>
    <MobileCard style={{backgroundColor:"#EFF2FC",flexDirection:"row",alignItems:"center"}}><Icon name="heart-circle" size={30} color={mobile.teal}/><Text style={[ms.muted,{flex:1}]}>Kaydettiğin ilanları, fiyat değişikliklerini ve ortaklığa açık ürünleri buradan takip edebilirsin. Son eklenenler son 7 günde kaydettiklerindir.</Text></MobileCard>
    {failed&&<MobileCard><Text style={ms.error}>Bazı ilanlar yüklenemedi. Kaydedilen favorilerin korunuyor.</Text><MobileChip label="Tekrar yükle" onPress={()=>setRetry(v=>v+1)}/></MobileCard>}
    {selected.slice(0,limit).map(({favorite,listing})=>card(favorite,listing))}
    {loading&&<Text style={ms.muted}>İlan bilgileri yükleniyor…</Text>}
    {!selected.length&&!loading&&!failed&&<MobileCard><Text style={ms.section}>{favorites.length?"Bu görünümde favori bulunamadı":"Henüz favori ilanın yok"}</Text><Text style={ms.muted}>Diğer filtreleri seçebilir veya keşfet ekranından ilan kaydedebilirsin.</Text>{favorites.length>0&&(query||tab!==tabs[0])&&<MobileButton secondary onPress={()=>{setQuery("");setTab(tabs[0]);setLimit(20);}}>Arama ve filtreleri temizle</MobileButton>}<MobileButton secondary onPress={()=>router.push("/explore")}>İlanları Keşfet</MobileButton></MobileCard>}
    {selected.length>limit&&<MobileButton secondary onPress={()=>setLimit(v=>v+20)}>Diğer favorileri göster</MobileButton>}
    <OptionSheet visible={menu} title="Favori seçenekleri" options={[...sorts,"Koleksiyonları Yönet","Yenile"]} value={sort} onClose={()=>setMenu(false)} onSelect={value=>{setMenu(false);if(value==="Koleksiyonları Yönet")router.push({pathname:"/favorites",params:{view:"collections"}} as never);else if(value==="Yenile"){setRetry(v=>v+1);void store.refreshUserData();}else{setSort(value);setLimit(20);}}}/>
  </MobileScreen>;
}

import { HorizontalScroll } from "@/components/horizontal-scroll";
import { CompactFooter } from "@/components/compact-footer";
import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { MobileBrand } from "@/components/mobile-brand";
import { UserAvatar } from "@/components/user-avatar";
import { OptionSheet } from "@/components/option-sheet";
import { useStore } from "@/lib/use-store";
import { categoryByPrefix, categoryTrail, mobileCategories } from "@/lib/mobile-catalog";
import { fetchMobileCatalogue } from "@/lib/mobile-catalogue-service";
import { emptyMobileFilters } from "@/lib/mobile-filters";
import { provinces } from "@/lib/locations";
import { searchKey } from "@/lib/locale";
import { pushRecentSearch } from "@/lib/recent-searches";
import type { Listing } from "@/lib/types";
import { IconButton, MobileButton, MobileCard, MobileChip, MobileScreen, mobile, ms, useMobileLayout, type MobileIcon } from "./ui";
import { CategoryArtwork } from "./categories";
import { ExploreMosaic } from "@/components/explore-mosaic";

const tabs: {label:string;icon:MobileIcon;sort:string}[]=[{label:"Keşfet",icon:"compass",sort:"recommended"},{label:"Trend",icon:"fire",sort:"popular"},{label:"Yakınımda",icon:"map-marker",sort:"newest"},{label:"Fırsatlar",icon:"tag-outline",sort:"commission"},{label:"Yeni İlanlar",icon:"creation",sort:"newest"},{label:"Öne Çıkanlar",icon:"star",sort:"featured"}];
export function MobileDiscovery() {
  const store=useStore(),router=useRouter(),params=useLocalSearchParams<{open?:string}>(),{insets,maxWidth,tablet}=useMobileLayout();
  const [tab,setTab]=useState(0),[category,setCategory]=useState("all"),[query,setQuery]=useState(""),[city,setCity]=useState(""),[cityOpen,setCityOpen]=useState(false);
  const [rows,setRows]=useState<Listing[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[moreBusy,setMoreBusy]=useState(false);
  const revision=useRef(0),moreLock=useRef(false);
  const node=category==="all"?undefined:categoryByPrefix(store.categoryTree,category),trail=node?categoryTrail(store.categoryTree,node.slug):[];
  const filters=emptyMobileFilters();filters.open=params.open==="1"||tab===3;filters.photos=true;
  if(tab===2&&city)filters.loc={provinceId:provinces.find(p=>p.name===city)?.id};
  const key=JSON.stringify({category,tab,city,open:params.open,ready:store.categoryTree.length});
  const request=()=>({trail,filters,sort:tabs[tab].sort});
  useEffect(()=>{const n=++revision.current;setRows([]);setLoading(true);setFailed(false);setMoreBusy(false);
    if(tab===2&&!city){setTotal(0);setLoading(false);return;}
    void fetchMobileCatalogue(request()).then(data=>{if(n===revision.current){setRows(data.listings);setTotal(data.total);}}).catch(()=>{if(n===revision.current)setFailed(true);}).finally(()=>{if(n===revision.current)setLoading(false);});
    return()=>{revision.current++;};
    // Criteria include every value used to build the server query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,retry]);
  async function more(){if(moreLock.current)return;moreLock.current=true;setMoreBusy(true);const n=revision.current;try{const data=await fetchMobileCatalogue({...request(),offset:rows.length});if(n===revision.current){setRows(old=>[...new Map([...old,...data.listings].map(l=>[l.id,l])).values()]);setTotal(data.total);setFailed(false);}}catch{if(n===revision.current)setFailed(true);}finally{moreLock.current=false;if(n===revision.current)setMoreBusy(false);}}
  function search(value: string){const q=value.trim().replace(/\s+/g," ").slice(0,120);if(!q)return;pushRecentSearch(q);router.push({pathname:"/explore",params:{q,view:"list"}} as never);}
  return <MobileScreen scroll={false} contentStyle={{paddingTop:insets.top}}><ScrollView scrollEventThrottle={120} onScroll={e=>{const n=e.nativeEvent;if(!loading&&!failed&&rows.length<total&&n.contentOffset.y+n.layoutMeasurement.height>n.contentSize.height-900)void more();}} refreshControl={<RefreshControl refreshing={loading&&rows.length>0} onRefresh={()=>setRetry(v=>v+1)} tintColor={mobile.teal}/>} contentContainerStyle={{flexGrow:1,paddingHorizontal:16,paddingBottom:0}}>
    <View style={[ms.row,{justifyContent:"space-between",paddingVertical:12}]}><MobileBrand size={29}/><View style={ms.row}><IconButton name="bell-outline" label="Bildirimlerim" onPress={()=>router.push("/notifications")} badge={store.notifications.some(n=>n.userId===store.currentUser.id&&!n.read)}/><Pressable accessibilityRole="button" accessibilityLabel="Profilim" onPress={()=>router.push(store.isAuthenticated?"/profile":"/auth")}><UserAvatar uri={store.isAuthenticated?store.currentUser.avatar:undefined} size={35}/></Pressable></View></View>
    <View style={[ms.row,{borderWidth:1,borderColor:mobile.line,backgroundColor:"white",borderRadius:16,paddingHorizontal:11,marginBottom:10}]}><Icon name="magnify" size={23} color={mobile.muted}/><TextInput accessibilityLabel="Keşfet'te ara" placeholder="OrtakSat'ta ara…" value={query} onChangeText={setQuery} onSubmitEditing={event=>search(event.nativeEvent.text)} maxLength={120} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{flex:1,minHeight:44,fontSize:14,color:mobile.ink}}/><IconButton name="tune-variant" label="Keşfet filtrelerini aç" onPress={()=>router.push({pathname:"/explore",params:{view:"list",filters:"1",...(query.trim()?{q:query.trim()}: {})}} as never)}/></View>
    <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:5,paddingBottom:12}}>{tabs.map((item,i)=><Pressable key={item.label} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:tab===i}} onPress={()=>{setTab(i);if(i===2&&!city)setCityOpen(true);}} style={{minWidth:65,paddingVertical:9,paddingHorizontal:7,borderRadius:12,alignItems:"center",gap:6,backgroundColor:tab===i?"#E5ECFA":"transparent",borderWidth:1,borderColor:tab===i?"#A2B9EB":"transparent"}}><Icon name={item.icon} size={23} color={tab===i?mobile.teal:"#5D6682"}/><Text style={{fontSize:10,color:tab===i?mobile.teal:"#606980",fontWeight:"600"}}>{item.label}</Text></Pressable>)}</HorizontalScroll>
    <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:15}}>{[{label:"Tümü",match:"all",tile:15},...mobileCategories.slice(0,9)].map(c=><Pressable key={c.match} accessibilityRole="button" accessibilityLabel={`Keşfet kategorisi: ${c.label}`} accessibilityState={{selected:category===c.match}} onPress={()=>setCategory(c.match)} style={{width:75,alignItems:"center",gap:7,borderWidth:1,borderColor:category===c.match?"#7399E7":mobile.line,borderRadius:12,paddingVertical:9,backgroundColor:category===c.match?"#EDF2FB":"white"}}><CategoryArtwork tile={c.tile} size={42}/><Text numberOfLines={2} style={{fontSize:9,fontWeight:"600",textAlign:"center",color:mobile.ink,minHeight:24}}>{c.label}</Text></Pressable>)}</HorizontalScroll>
    {store.categoryTree.some(n=>store.currentUser.preferences?.[`interest:${n.slug}`]===true)&&<View style={{gap:8,marginBottom:16}}><Text style={ms.section}>İlgi Alanların</Text><HorizontalScroll  contentContainerStyle={{gap:7}}>{store.categoryTree.filter(n=>store.currentUser.preferences?.[`interest:${n.slug}`]===true).map(n=><MobileChip key={n.slug} label={n.label} selected={category===n.label} onPress={()=>setCategory(n.label)}/>)}</HorizontalScroll></View>}
    <View style={[ms.row,{justifyContent:"space-between",marginBottom:12}]}><Text accessibilityRole="header" style={ms.section}>{tab===0?"Senin İçin Önerilenler":tabs[tab].label}</Text><Text style={ms.muted}>{loading?"Yükleniyor…":`${total} ilan`}</Text></View>
    {tab===3&&<Text style={[ms.muted,{marginBottom:10}]}>Ortaklığa açık ilanlar komisyon tutarına göre sıralanır. Bu bölüm ürünün indirimli olduğunu belirtmez.</Text>}
    {tab===2&&<View style={{gap:8,marginBottom:10}}><MobileChip label={city||"İl seç"} icon="map-marker" onPress={()=>setCityOpen(true)}/><Text style={ms.muted}>İl bazında gösterilir. Kesin konumu olmayan ilanlar için kilometre mesafesi hesaplanmaz.</Text></View>}
    {failed&&<MobileCard><Text accessibilityRole="alert" style={ms.error}>İlanlar yüklenemedi. Filtrelerin korunuyor.</Text><MobileButton secondary onPress={()=>rows.length?void more():setRetry(v=>v+1)}>Tekrar Dene</MobileButton></MobileCard>}
    {!loading&&!failed&&!rows.length&&<MobileCard><Text style={ms.section}>{tab===2&&!city?"Önce bir il seç":"Bu görünümde ilan bulunamadı"}</Text><Text style={ms.muted}>Başka kategori veya sekmeyle devam edebilirsin.</Text></MobileCard>}
    <View style={{marginHorizontal:-16}}><ExploreMosaic listings={rows} width={maxWidth} onOpen={l=>router.push(`/listing/${l.id}` as never)}/></View>
    {loading&&<Text style={{padding:24,color:mobile.muted,textAlign:"center"}}>İlanlar yükleniyor…</Text>}
    {rows.length<total&&!loading&&!failed&&<Text style={{padding:18,color:mobile.muted,textAlign:"center"}}>{moreBusy?"Yükleniyor…":" "}</Text>}
    <View style={[ms.row,{marginVertical:17,justifyContent:"space-between"}]}><Text style={ms.section}>Kategorileri Keşfet</Text><MobileChip label="Tümünü Gör" onPress={()=>router.push("/kategoriler")}/></View><HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9}}>{mobileCategories.slice(0,8).map(c=><Pressable key={c.match} accessibilityRole="button" accessibilityLabel={`${c.label} kategorisini aç`} onPress={()=>{const n=categoryByPrefix(store.categoryTree,c.match);router.push(n?`/kategori/${n.slug}` as never:"/kategoriler");}} style={{alignItems:"center",gap:7,width:87}}><CategoryArtwork tile={c.tile} size={72}/><Text style={{fontSize:10,textAlign:"center",color:mobile.ink}}>{c.label}</Text></Pressable>)}</HorizontalScroll>
  <CompactFooter /></ScrollView><OptionSheet visible={cityOpen} title="Yakındaki ilanlar için il seç" options={provinces.map(p=>p.name)} value={city} onClose={()=>setCityOpen(false)} onSelect={value=>{setCity(value);setCityOpen(false);}}/></MobileScreen>;
}

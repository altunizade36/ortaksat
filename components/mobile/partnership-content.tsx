import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import {useEffect,useState} from "react";
import {Modal,Pressable,ScrollView,Text,View} from "react-native";
import {useRouter} from "expo-router";
import {SafeRemoteImage} from "@/components/safe-remote-image";
import {UserAvatar} from "@/components/user-avatar";
import {describeAttributes} from "@/lib/category-tree";
import {listingPhotos,maximumPartners,potentialCommission,listingStatusLabels} from "@/lib/mobile-listing";
import {fetchPublicSeller} from "@/lib/supabase-data";
import {useStore} from "@/lib/use-store";
import {moneyIn} from "@/lib/format";
import {colors} from "@/components/colors";
import {partnershipStatusTitles} from "@/lib/status-labels";
import {partnershipStage,partnershipTimeline} from "@/lib/partnership-stage";
import type {Listing,Partnership,User} from "@/lib/types";
import {MobileListingReviews} from "./listing-reviews";
import {MobileButton,MobileCard,MobileChip,MobileField,MobileScreen,IconButton,mobile,ms,useMobileLayout} from "./ui";
import {showToast} from "@/lib/toast";
import {fetchMyPartnershipNote,saveMyPartnershipNote} from "@/lib/partnership-notes";
import type {LeadStatus} from "@/lib/types";
// Anlamsal "kazanç/aktif" yeşili (teal değil): successSoft zemin üstünde AA okunur koyu ton.
const GREEN_INK="#0645C9";
// Kart başlığı biçimi — tek kaynak lib/status-labels.ts (eski ad geriye dönük uyum için korunur).
export const partnershipStatusLabels:Record<string,string>=partnershipStatusTitles;
export function MobilePartnershipContent({listing,partnership}:{listing:Listing;partnership:Partnership}){
 const store=useStore(),{maxWidth,tablet,height}=useMobileLayout(),[photo,setPhoto]=useState(0),[gallery,setGallery]=useState(false),[tab,setTab]=useState("Genel Bilgiler"),[expanded,setExpanded]=useState(false);
 // MÜŞTERİLER: ortağın bu ortaklık için bildirdiği müşteri kayıtları (satıcı da görür). Ekleme yalnız ortakta.
 const [leadForm,setLeadForm]=useState(false),[buyerName,setBuyerName]=useState(""),[buyerPhone,setBuyerPhone]=useState(""),[buyerNote,setBuyerNote]=useState(""),[leadError,setLeadError]=useState("");
 // ÖZEL NOT: yalnız bu kullanıcının gördüğü not (karşı taraf okuyamaz; bkz. lib/partnership-notes.ts).
 const [privateNote,setPrivateNote]=useState(""),[savedNote,setSavedNote]=useState<string|null>(null),[noteBusy,setNoteBusy]=useState(false);
 const meId=store.currentUser.id;
 useEffect(()=>{let alive=true;setSavedNote(null);void fetchMyPartnershipNote(partnership.id,meId).then(value=>{if(!alive||value===null)return;setSavedNote(value);setPrivateNote(value);});return()=>{alive=false;};},[partnership.id,meId]);
 async function saveNote(){if(noteBusy)return;setNoteBusy(true);try{const ok=await saveMyPartnershipNote(partnership.id,meId,privateNote);if(ok){setSavedNote(privateNote.trim());showToast(privateNote.trim()?"Notun kaydedildi.":"Notun silindi.");}else showToast("Not kaydedilemedi. Tekrar dene.");}finally{setNoteBusy(false);}}
 const myLeads=store.leads.filter(lead=>lead.partnershipId===partnership.id).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
 const leadLabel:Record<LeadStatus,string>={new:"Müşteri bulundu",contacted:"İlk görüşme yapıldı",interested:"Satın almaya hazır",converted:"Satışa döndü",lost:"Vazgeçti"};
 function addLead(){
  const name=buyerName.trim(),phone=buyerPhone.trim();
  if(name.length<2){setLeadError("Müşterinin adını yaz.");return;}
  if(!/^\+?[\d\s()-]{10,24}$/.test(phone)){setLeadError("Geçerli bir telefon numarası gir.");return;}
  const lead=store.createLead({listingId:listing.id,partnershipId:partnership.id,buyerName:name,buyerPhone:phone,note:buyerNote.trim(),source:"phone",intent:"warm"});
  if(!lead){setLeadError(store.authError||"Müşteri eklenemedi. İlan ya da ortaklık aktif olmayabilir.");return;}
  setBuyerName("");setBuyerPhone("");setBuyerNote("");setLeadError("");setLeadForm(false);showToast("Müşteri eklendi; satıcıya bildirildi.");
 }

 const photos=listingPhotos(listing),potential=potentialCommission(listing,partnership),max=maximumPartners(listing),owner=listing.ownerId===store.currentUser.id,active=partnership.status==="active";
 const agreementType=partnership.commissionOverrideType??partnership.agreedCommissionType??listing.commissionType,agreementValue=partnership.commissionOverrideValue??partnership.agreedCommissionValue??listing.commissionValue;
 // Aşama + işlem geçmişi: ortaklık, müşteri kayıtları ve satışlardan türetilir (bkz. lib/partnership-stage.ts).
 const stage=partnershipStage(partnership,store.leads,store.sales),timeline=partnershipTimeline(partnership,store.leads,store.sales,amount=>moneyIn(amount,listing.currency));
 const dayLabel=(value:number|undefined)=>Number.isFinite(value)&&Number(value)>=0?`${value} gün`:"Belirtilmemiş";
 const terms=[["Komisyon",potential===null?"Satıcıyla netleştir":agreementType==="rate"?`%${agreementValue.toLocaleString("tr-TR")}`:moneyIn(agreementValue,listing.currency)],["Potansiyel tutar",potential===null?"Satıcıyla netleştir":moneyIn(potential,listing.currency)],["Maksimum ortak",max?String(max):"Sınır belirtilmemiş"],["Aktif ortak",String(listing.partnerCount??0)],["Atıf süresi",dayLabel(partnership.agreedAttributionWindowDays??listing.attributionWindowDays)],["İade süresi",dayLabel(partnership.agreedReturnWindowDays??listing.returnWindowDays)],["Komisyon vadesi",dayLabel(partnership.agreedCommissionDueDays??listing.commissionDueDays)]];
 return <View style={{gap:15}}>
  <View style={{flexDirection:tablet?"row":"column",gap:16}}><View style={[tablet?{flex:1}:{width:"100%"},{gap:8}]}>{photos.length?<><Pressable accessibilityRole="button" accessibilityLabel="Ürün fotoğrafını büyüt" onPress={()=>setGallery(true)}><SafeRemoteImage full uri={photos[photo]||photos[0]} contentFit="contain" style={{width:"100%",height:tablet?320:Math.min(310,maxWidth*.7),borderRadius:15}}/><Text style={{position:"absolute",right:10,bottom:10,backgroundColor:"#101827BB",color:"white",padding:6,borderRadius:7}}>{Math.min(photo+1,photos.length)}/{photos.length}</Text></Pressable><HorizontalScroll  style={{flexGrow:0,flexShrink:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{photos.map((uri,i)=><Pressable key={uri} accessibilityRole="button" accessibilityLabel={`Ürün fotoğrafı ${i+1}`} accessibilityState={{selected:photo===i}} onPress={()=>setPhoto(i)} style={{padding:2,borderRadius:9,borderWidth:2,borderColor:photo===i?mobile.teal:"transparent"}}><SafeRemoteImage uri={uri} style={{width:64,height:58,borderRadius:7}}/></Pressable>)}</HorizontalScroll></>:<MobileCard><Text style={ms.muted}>Ürün fotoğrafı bulunmuyor.</Text></MobileCard>}</View>
  <View style={[tablet?{flex:1}:{width:"100%"},{gap:10}]}><Text style={{fontSize:tablet?24:20,lineHeight:tablet?30:26,fontWeight:"800",color:mobile.ink}}>{displayListingTitle(listing.title)}</Text><Text style={{fontSize:27,fontWeight:"800",color:mobile.teal}}>{moneyIn(listing.price,listing.currency)}</Text><Text style={ms.muted}>⌖ {listing.location}</Text><Text style={ms.muted}>{listing.category} · {new Date(listing.createdAt).toLocaleDateString("tr-TR")}</Text><Text style={{fontSize:12,color:listing.status==="active"?GREEN_INK:mobile.muted}}>{listingStatusLabels[listing.status]}</Text><MobileCard style={{backgroundColor:colors.primarySoft}}><Text style={ms.label}>Potansiyel Komisyon</Text><Text style={{fontSize:23,fontWeight:"800",color:GREEN_INK}}>{potential===null?"Satıcıyla netleştir":moneyIn(potential,listing.currency)}</Text><Text style={ms.muted}>Satışın tamamlanmasına ve anlaşma koşullarına bağlıdır.</Text></MobileCard><MobileCard><Text style={ms.label}>Ortaklık Kontenjanı</Text><Text style={ms.section}>{listing.partnerCount??0}{max?` / ${max}`:""} aktif ortak</Text>{max!==null&&<Text style={ms.muted}>{Math.max(0,max-(listing.partnerCount||0))} kontenjan kaldı</Text>}</MobileCard></View></View>
  {listing.status!=="active"&&<MobileCard><Text style={ms.error}>İlan şu anda yayında değil. Yeni müşteri yönlendirmeden önce satıcıyla görüş.</Text></MobileCard>}
  <HorizontalScroll  style={{flexGrow:0,flexShrink:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:8}}>{["Genel Bilgiler","Ortaklık Koşulları","Satıcı Bilgileri","Yorumlar"].map(t=><MobileChip key={t} label={t} selected={t===tab} onPress={()=>setTab(t)}/>)}</HorizontalScroll>
  {tab==="Genel Bilgiler"&&<MobileCard>
   <View style={[ms.row,{justifyContent:"space-between"}]}><Text style={ms.section}>Ortaklık Aşaması</Text><Text style={{color:stage.tone==="danger"?colors.accent:stage.tone==="warning"?colors.goldInk:stage.tone==="muted"?mobile.muted:mobile.teal,fontWeight:"800",fontSize:13}}>{stage.label}</Text></View>
   <Text style={ms.muted}>{stage.hint}</Text>
   <Text style={[ms.label,{marginTop:6}]}>İşlem Geçmişi</Text>
   {timeline.map((event,index)=><View key={`${event.at}:${index}`} style={{flexDirection:"row",gap:10,alignItems:"flex-start"}}>
    <View style={{alignItems:"center",width:14}}><View style={{width:10,height:10,borderRadius:5,backgroundColor:index===timeline.length-1?mobile.teal:mobile.line,marginTop:4}}/>{index<timeline.length-1&&<View style={{width:2,flex:1,minHeight:18,backgroundColor:mobile.line}}/>}</View>
    <View style={{flex:1,minWidth:0,paddingBottom:8}}><Text style={{color:mobile.ink,fontSize:13,fontWeight:"700"}}>{event.label}</Text>{!!event.detail&&<Text numberOfLines={2} style={ms.muted}>{event.detail}</Text>}<Text style={{color:mobile.muted,fontSize:11}}>{new Date(event.at).toLocaleDateString("tr-TR")}</Text></View>
   </View>)}
  </MobileCard>}
  {tab==="Genel Bilgiler"&&(active||myLeads.length>0)&&<MobileCard>
   <View style={[ms.row,{justifyContent:"space-between"}]}><Text style={ms.section}>Müşteriler ({myLeads.length})</Text>{active&&!owner&&!leadForm&&<MobileChip icon="account-plus-outline" label="Müşteri Ekle" selected onPress={()=>{setLeadError("");setLeadForm(true);}}/>}</View>
   <Text style={ms.muted}>{owner?"Ortağının bu ilan için bildirdiği müşteriler ve görüşmenin geldiği aşama.":"Bulduğun müşteriyi ekle, görüşme ilerledikçe aşamasını işaretle. Satıcı bu listeyi görür."}</Text>
   {leadForm&&<View style={{gap:10,backgroundColor:mobile.tealSoft,borderRadius:10,padding:10}}>
    <MobileField label="Müşterinin adı" required value={buyerName} onChange={setBuyerName} maxLength={80}/>
    <MobileField label="Telefonu" required value={buyerPhone} onChange={setBuyerPhone} maxLength={24}/>
    <MobileField label="Not (isteğe bağlı)" value={buyerNote} onChange={setBuyerNote} multiline maxLength={400}/>
    <Text style={ms.muted}>Müşterinin bilgilerini yalnız onun izniyle paylaş. Bilgiler yalnız satıcıya gösterilir.</Text>
    {!!leadError&&<Text accessibilityRole="alert" style={ms.error}>{leadError}</Text>}
    <View style={ms.row}><MobileButton secondary style={{flex:1}} onPress={()=>{setLeadForm(false);setLeadError("");}}>Vazgeç</MobileButton><MobileButton style={{flex:1}} onPress={addLead}>Müşteriyi Ekle</MobileButton></View>
   </View>}
   {myLeads.map(lead=>{const locked=lead.status==="converted";return <View key={lead.id} style={{borderTopWidth:1,borderColor:mobile.line,paddingTop:9,gap:6}}>
    <View style={[ms.row,{justifyContent:"space-between",alignItems:"flex-start"}]}><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{color:mobile.ink,fontSize:14,fontWeight:"700"}}>{lead.buyerName||"Müşteri"}</Text><Text style={ms.muted}>{new Date(lead.createdAt).toLocaleDateString("tr-TR")}{lead.note?` · ${lead.note}`:""}</Text></View><Text style={{color:lead.status==="lost"?mobile.muted:mobile.teal,fontSize:12,fontWeight:"800"}}>{leadLabel[lead.status]}</Text></View>
    {!locked&&active&&<View style={ms.wrap}>{(["contacted","interested","lost"] as LeadStatus[]).filter(next=>next!==lead.status).map(next=><MobileChip key={next} label={leadLabel[next]} onPress={()=>store.updateLeadStatus(lead.id,next)}/>)}</View>}
   </View>;})}
   {!myLeads.length&&!leadForm&&<Text style={ms.muted}>{owner?"Henüz müşteri bildirilmedi.":"Henüz müşteri eklemedin."}</Text>}
  </MobileCard>}
  {tab==="Genel Bilgiler"&&savedNote!==null&&<MobileCard>
   <Text style={ms.section}>Özel Notum</Text>
   <Text style={ms.muted}>{owner?"Bu ortakla ilgili kendine not al. Yalnız sen görürsün; ortak göremez.":"Bu ortaklıkla ilgili kendine not al. Yalnız sen görürsün; satıcı göremez."}</Text>
   <MobileField value={privateNote} onChange={setPrivateNote} multiline maxLength={2000} placeholder={owner?"Örn. Güvenilir ortak, daha önce 3 satış yaptı.":"Örn. Müşteri cumartesi tekrar aranacak."}/>
   {privateNote.trim()!==(savedNote||"")&&<MobileButton secondary disabled={noteBusy} onPress={()=>void saveNote()}>{noteBusy?"Kaydediliyor…":"Notu Kaydet"}</MobileButton>}
  </MobileCard>}
  {tab==="Genel Bilgiler"&&<><MobileCard style={{backgroundColor:active?colors.primarySoft:partnership.status==="rejected"||partnership.status==="blocked"?colors.accentSoft:colors.surfaceAlt}}><Text style={ms.section}>{active&&!owner?"Ortaklığın Onaylandı!":partnershipStatusLabels[partnership.status]}</Text><Text style={ms.muted}>{active?owner?"Bu ortaklık aktif. Ortağın koşulları aşağıda gösterilir.":"Satıcının onayıyla bu ilan için müşteri bulabilir, anlaşma koşullarına göre komisyon kazanabilirsin.":partnership.status==="pending"?"Satıcının yanıtı bekleniyor. Henüz aktif ortaklık kurulmadı.":partnership.rejectionReason||"Ortaklığın güncel durumu yukarıda gösterilir."}</Text><Text style={ms.muted}>Başvuru: {new Date(partnership.createdAt).toLocaleDateString("tr-TR")}</Text>{partnership.approvedAt&&<Text style={ms.muted}>Onay: {new Date(partnership.approvedAt).toLocaleDateString("tr-TR")}</Text>}</MobileCard><MobileCard><Text style={ms.section}>Ürün Açıklaması</Text><Text numberOfLines={expanded?undefined:4} style={{fontSize:13,lineHeight:22,color:mobile.muted}}>{listing.description||"Açıklama belirtilmemiş."}</Text>{listing.description.length>180&&<MobileChip label={expanded?"Daha Az":"Daha Fazla"} onPress={()=>setExpanded(v=>!v)}/>}</MobileCard><MobileCard><Text style={ms.section}>Ürün Bilgileri</Text>{describeAttributes(listing.attributes).map(a=><View key={a.label} style={[ms.row,{justifyContent:"space-between",alignItems:"flex-start"}]}><Text style={[ms.muted,{flex:1}]}>{a.label}</Text><Text style={[ms.label,{flex:1,textAlign:"right"}]}>{a.value}</Text></View>)}{!describeAttributes(listing.attributes).length&&<Text style={ms.muted}>Ek özellik girilmemiş.</Text>}</MobileCard></>}
  {tab==="Ortaklık Koşulları"&&<><MobileCard><Text style={ms.section}>Bu Ortaklığın Koşulları</Text>{terms.map(([label,value])=><View key={label} style={[ms.row,{justifyContent:"space-between",alignItems:"flex-start"}]}><Text style={[ms.muted,{flex:1}]}>{label}</Text><Text style={[ms.label,{flex:1,textAlign:"right"}]}>{value}</Text></View>)}<Text style={ms.muted}>{partnership.commissionOverrideType?"Satıcının bu ortağa özel komisyonu uygulanır.":partnership.agreedCommissionType?"Katılım sırasında kaydedilen anlaşma komisyonu uygulanır.":"Bu eski kayıtta anlaşma anlık görüntüsü yok; ilanın güncel koşulları gösterilir."}</Text></MobileCard>{partnership.note&&<MobileCard><Text style={ms.section}>Başvuru Notu</Text><Text style={ms.muted}>{partnership.note}</Text></MobileCard>}<MobileCard><Text style={ms.muted}>OrtakSat para tutmaz. Ödeme ve teslimat taraflar arasında gerçekleşir. İade, komisyon vadesi ve satış koşullarını satıcıyla netleştir.</Text></MobileCard></>}
  {tab==="Satıcı Bilgileri"&&<SellerInformation key={listing.ownerId} id={listing.ownerId}/>}
  {tab==="Yorumlar"&&<MobileListingReviews key={listing.id} listing={listing}/>}
  <Modal visible={gallery} animationType="fade" onRequestClose={()=>setGallery(false)}><MobileScreen title="Ürün Fotoğrafları" onBack={()=>setGallery(false)} right={<IconButton name="close" label="Fotoğraf galerisini kapat" onPress={()=>setGallery(false)}/>}><SafeRemoteImage full uri={photos[photo]||photos[0]} contentFit="contain" style={{width:"100%",height:height*.65,borderRadius:12}}/><Text style={[ms.muted,{textAlign:"center",marginVertical:12}]}>{photo+1}/{photos.length}</Text><View style={ms.row}><MobileButton secondary disabled={photo<=0} style={{flex:1}} onPress={()=>setPhoto(i=>Math.max(0,i-1))}>Önceki Fotoğraf</MobileButton><MobileButton secondary disabled={photo>=photos.length-1} style={{flex:1}} onPress={()=>setPhoto(i=>Math.min(photos.length-1,i+1))}>Sonraki Fotoğraf</MobileButton></View></MobileScreen></Modal>
 </View>;
}
function SellerInformation({id}:{id:string}){const store=useStore(),router=useRouter(),[seller,setSeller]=useState<User|null>(store.findUser(id)||null),[error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);useEffect(()=>{let alive=true;setLoading(true);setError(false);void fetchPublicSeller(id).then(s=>{if(alive){setSeller(s);if(!s)setError(true);}}).catch(()=>{if(alive)setError(true);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[id,retry]);return <MobileCard>{seller&&<><View style={ms.row}><UserAvatar uri={seller.avatar} size={62}/><View style={{flex:1,minWidth:0,gap:5}}><Text style={ms.section}>{seller.name}</Text>{seller.username&&<Text style={ms.muted}>@{seller.username}</Text>}<Text style={ms.muted}>{seller.city||"Konum belirtilmemiş"}</Text>{seller.rating>0&&<Text style={{color:mobile.teal}}>★ {seller.rating.toFixed(1)}</Text>}{seller.verifiedIdentity&&<Text style={{color:mobile.teal}}>Kimliği doğrulanmış</Text>}</View></View><Text style={ms.muted}>{seller.bio||"Satıcı henüz hakkında bilgisi eklememiş."}</Text><MobileButton secondary onPress={()=>router.push(`/store/${id}` as never)}>Satıcının Mağazasını Gör</MobileButton></>}{loading&&<Text style={ms.muted}>Satıcı bilgileri yükleniyor…</Text>}{error&&<><Text accessibilityRole="alert" style={ms.error}>Güncel satıcı bilgileri yüklenemedi.</Text><MobileButton secondary onPress={()=>setRetry(v=>v+1)}>Satıcıyı Tekrar Yükle</MobileButton></>}</MobileCard>;}

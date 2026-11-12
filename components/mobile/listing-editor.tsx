import { parseListingMoney, parseListingRate, listingCommissionError, listingNumberInput, LISTING_MONEY_ERROR } from "@/lib/listing-numbers";
import { movePhoto, restorePhoto, type RemovedPhoto } from "@/lib/photo-order";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { ListingLocationFields } from "@/components/listing-location-fields";
import { ListingTitleField } from "@/components/listing-title-field";
import { validateListingTitle, normalizeListingTitle } from "@/lib/listing-title";
import { useCallback, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { type LocationValue } from "@/components/location-selector";
import { OptionSheet } from "@/components/option-sheet";
import { Alert } from "@/lib/alert";
import { listingCategoryTrail } from "@/lib/mobile-catalog";
import { listingCategoryPath } from "@/lib/category-match";
import { categoryPathAttributes, savedCategoryPath } from "@/lib/category-path";
import { searchKey } from "@/lib/locale";
import { attributeText, listingPhotos } from "@/lib/mobile-listing";
import { deriveFieldsFromPath, getFormSchema, modelsForSchema, resolveFormKey, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { formatLocation, validateListingLocation } from "@/lib/locations";
import { uploadListingImage } from "@/lib/live-service";
import { deleteListingVideo, isListingVideoUrl, splitListingMedia, withListingVideo, type ListingVideoValue } from "@/lib/listing-video";
import { ListingVideoField, type ListingVideoStatus } from "@/components/listing-video-field";
import { parseTrPrice, LIMITS } from "@/lib/validation";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";
import type { Listing } from "@/lib/types";
import { MobileCategorySelect } from "./category-select";
import { MobileListingPreview, type PreviewSection } from "./listing-preview";
import { MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, mobile, ms } from "./ui";

type Values = Record<string,string|boolean|string[]>;
/** Yoldaki marka düğümünü, AYNI üst kategorideki yeni marka dalıyla değiştirir (yoksa null → yol korunur). */
function rebrandPath(path:CategoryNode[],from:string,to:string):CategoryNode[]|null{
  const i=path.findIndex(n=>searchKey(n.label)===searchKey(from));
  if(i<1||!to)return null;
  const brand=path[i-1].children?.find(n=>searchKey(n.label)===searchKey(to));
  if(!brand||brand===path[i])return null;
  if(!brand.children?.length)return [...path.slice(0,i),brand];
  // Model de sıfırlandığı için yeni markanın "Diğer Model" yaprağına iner; kullanıcı kategori satırından inceltebilir.
  const other=brand.children.find(n=>/^di[ğg]er/i.test(n.label.trim())&&!n.children?.length);
  return other?[...path.slice(0,i),brand,other]:null;
}
export function MobileListingEditor({ listing }: {listing:Listing}) {
  const store=useStore(),router=useRouter(),params=useLocalSearchParams<{section?:string}>();
  const [draft,setDraft]=useState(listing),[price,setPrice]=useState(listingNumberInput(listing.price)),[commission,setCommission]=useState(listingNumberInput(listing.commissionValue));
  const [maxPartners,setMaxPartners]=useState(String(listing.attributes?._maxPartners||""));
  const [removedPhoto,setRemovedPhoto]=useState<RemovedPhoto|null>(null);
  // FOTOĞRAFLAR video içermez: adAssets'in sonundaki TEK video ayrı tutulur. Eskiden video da "fotoğraf"
  // sayılıyordu → kırık kare olarak çiziliyor, 5 sınırına dahil oluyor ve kapak yapılabiliyordu.
  const originalVideo=splitListingMedia(listing.adAssets).video;
  const [photos,setPhotos]=useState(()=>listingPhotos(listing).filter(uri=>!isListingVideoUrl(uri)));
  const [video,setVideo]=useState<ListingVideoValue|null>(originalVideo?{url:originalVideo}:null);
  const [videoStatus,setVideoStatus]=useState<ListingVideoStatus>("idle");
  // KAYITLI YOL: önce benzersiz `_path`, yoksa keşfet/kategori sayfalarıyla AYNI çözücü; o da
  // bulamazsa (yönetici-eklentisi kategori) etiket araması. Eskiden yalnız etiket araması vardı ve
  // eş-etiketli dallarda ("Diğer", "Satılık", model adları) [] dönüp kategoriyi BOŞ gösteriyordu.
  const [path,setPath]=useState<CategoryNode[]>(()=>{const exact=savedCategoryPath(store.categoryTree,listing);if(exact)return exact;const resolved=listingCategoryPath(listing);return resolved.length?resolved:listingCategoryTrail(store.categoryTree,listing);});
  // Kullanıcı kategoriyi DEĞİŞTİRMEDİYSE _root/_leaf/_formKey/_path'e dokunulmaz (tahmin yazılmaz).
  const [categoryChanged,setCategoryChanged]=useState(false);
  const [values,setValues]=useState<Values>(()=>Object.fromEntries(Object.entries(listing.attributes||{}).filter(([key])=>!key.startsWith("_")).map(([key,value])=>[key,typeof value==="number"?String(value):value])));
  const [loc,setLoc]=useState<LocationValue>({provinceId:listing.provinceId,districtId:listing.districtId,neighborhood:listing.locationNote,neighborhoodId:listing.neighborhoodId});
  const [categoryOpen,setCategoryOpen]=useState(false),[photoMenu,setPhotoMenu]=useState(false),[advanced,setAdvanced]=useState(false);
  const [preview,setPreview]=useState(params.section==="preview"),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const [uploading,setUploading]=useState(false);
  const sectionApplied=useRef(false),locked=useRef(false),scroll=useRef<ScrollView>(null),sections=useRef<Record<string,number>>({});
  // Şema: kategori değiştiyse seçilen yoldan; değişmediyse KAYITLI _formKey (çözülen yol bir tahmin
  // olabilir — eskiden tahminin şeması gösterilip kaydederken _formKey sessizce değişiyordu).
  const savedFormKey=String(listing.attributes?._formKey||"");
  const schemaKey=categoryChanged&&path.length?resolveFormKey(path):savedFormKey||(path.length?resolveFormKey(path):"");
  const schema=getFormSchema(schemaKey), priceField=schema?.fields.find(f=>f.key==="price"||f.type==="number"&&f.suffix==="₺");
  const partnerable=draft.partnershipMode!=="none";
  const commissionNumber=draft.commissionType==="rate"?parseListingRate(commission):parseListingMoney(commission);
  const dirty=categoryChanged||(video?.url||null)!==originalVideo||JSON.stringify({draft,price,commission,maxPartners,photos,values,loc})!==JSON.stringify({draft:listing,price:listingNumberInput(listing.price),commission:listingNumberInput(listing.commissionValue),maxPartners:String(listing.attributes?._maxPartners||""),photos:listingPhotos(listing).filter(uri=>!isListingVideoUrl(uri)),values:Object.fromEntries(Object.entries(listing.attributes||{}).filter(([key])=>!key.startsWith("_")).map(([key,value])=>[key,typeof value==="number"?String(value):value])),loc:{provinceId:listing.provinceId,districtId:listing.districtId,neighborhood:listing.locationNote,neighborhoodId:listing.neighborhoodId}});
  function back(){if(saving)return;if(preview){setPreview(false);return;}if(!dirty){router.canGoBack()?router.back():router.replace("/seller");return;}Alert.alert("Kaydedilmemiş değişiklikler","Değişiklikleri kaydetmeden çıkmak istiyor musun?",[{text:"Düzenlemeye Devam Et",style:"cancel"},{text:"Kaydetmeden Çık",style:"destructive",onPress:()=>router.canGoBack()?router.back():router.replace("/seller")}]);}
  const backRef = useRef(back);
  backRef.current = back;
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { backRef.current(); return true; });
    return () => subscription.remove();
  }, []));
  function validation(){
    const titleCheck=validateListingTitle(draft.title); if(titleCheck.error)return titleCheck.error;
    if(draft.description.trim().length<LIMITS.description.min)return `Açıklama en az ${LIMITS.description.min} karakter olmalı.`;
    if(!photos.length||photos.length>5)return "Kapak dahil 1–5 fotoğraf eklemelisin.";
    if(videoStatus==="uploading")return "Video yükleniyor; yükleme bitince tekrar dene.";
    if(videoStatus==="error")return "Video yüklenemedi: tekrar dene ya da vazgeç.";
    const locationError=validateListingLocation(loc);if(locationError)return locationError;
    const parsedPrice = parseListingMoney(price.trim() ? price : 0);
    if(!Number.isFinite(parsedPrice)||parsedPrice>LIMITS.price.max||priceField?.required&&parsedPrice<=0)return LISTING_MONEY_ERROR;
    const commissionError = partnerable ? listingCommissionError(draft.commissionType, commission, maxPartners) : "";
    if(commissionError)return commissionError;
    const current=store.partnerships.filter(p=>p.listingId===listing.id&&p.status==="active").length;
    if(partnerable&&maxPartners&&Number(maxPartners)<Math.max(current,listing.partnerCount||0))return "Maksimum ortak sayısı mevcut aktif ortak sayısından az olamaz.";
    const missing=schema?.fields.find(f=>f.required&&!["title","description",priceField?.key||"price"].includes(f.key)&&(values[f.key]===undefined||values[f.key]===""||Array.isArray(values[f.key])&&!(values[f.key] as string[]).length));
    if(missing)return `${missing.label} alanını doldur.`;
    return "";
  }
  function build():Listing {
    const attrs:NonNullable<Listing["attributes"]>={};
    for(const [key,value] of Object.entries(draft.attributes||{}))if(key.startsWith("_"))attrs[key]=value;
    for(const def of schema?.fields||[]){if(["title","description","price"].includes(def.key))continue;const value=values[def.key];if(value!==undefined&&value!=="")attrs[def.key]=def.type==="number"?parseTrPrice(String(value)):value;}
    if(!schema)Object.assign(attrs,values);
    if(categoryChanged&&path.length)Object.assign(attrs,categoryPathAttributes(path));
    if(maxPartners&&partnerable)attrs._maxPartners=Number(maxPartners);else delete attrs._maxPartners;
    if(priceField&&priceField.key!=="price")attrs[priceField.key]=parseListingMoney(price.trim() ? price : 0);
    return {...draft,title:normalizeListingTitle(draft.title),description:draft.description.trim(),price:parseListingMoney(price.trim() ? price : 0),attributes:attrs,location:formatLocation(loc,draft.addressVisibility||"district_only")||draft.location,provinceId:loc.provinceId,districtId:loc.districtId,neighborhoodId:loc.neighborhoodId,locationNote:loc.neighborhood?.trim()||undefined,image:photos[0],imageUrl:photos[0],adAssets:withListingVideo(photos.slice(1),video?.url),commissionValue:partnerable?commissionNumber:0,commissionTiers:partnerable&&draft.commissionType==="rate"?draft.commissionTiers:undefined,bonusAmount:partnerable?draft.bonusAmount:undefined,bonusQuota:partnerable?draft.bonusQuota:undefined};
  }
  async function save(publish=false){
    if(locked.current||uploading)return;const problem=validation();setError(problem);if(problem){showToast(problem);return;}
    locked.current=true;setSaving(true);
    try {
      const next=build();
      const uploaded=await Promise.all(photos.map(uri=>store.backendMode==="supabase"?uploadListingImage(uri,store.currentUser.id):Promise.resolve(uri)));
      if(uploaded.some(uri=>!uri))throw new Error("Photo upload failed");
      next.image=uploaded[0];next.imageUrl=uploaded[0];next.adAssets=withListingVideo(uploaded.slice(1),video?.url);
      const ok=await store.updateListing(listing.id,next,publish);
      if(!ok){setError("Değişiklikler kaydedilemedi. Bilgilerin bu ekranda korunuyor; tekrar dene.");return;}
      // Değiştirilen/kaldırılan ESKİ video artık hiçbir ilana bağlı değil → depodan sil (en-iyi-çaba).
      if(originalVideo&&originalVideo!==video?.url)void deleteListingVideo(originalVideo,store.currentUser.id);
      showToast(publish?"İlanın yayın için kaydedildi.":"Değişiklikler kaydedildi.");router.replace("/seller");
    }catch{setError("Kaydedilemedi. Bağlantını kontrol edip tekrar dene; değişikliklerin bu ekranda korunuyor.");}
    finally{locked.current=false;setSaving(false);}
  }
  function remove(){Alert.alert("İlanı Sil","İlan kaldırılır. İşlem geçmişi olan kayıtlar arşivde korunur.",[{text:"Vazgeç",style:"cancel"},{text:"Sil",style:"destructive",onPress:()=>{if(locked.current)return;locked.current=true;setSaving(true);void store.removeListing(listing.id).then(ok=>{if(ok)router.replace("/seller");else setError("İlan kaldırılamadı. Tekrar dene.");}).finally(()=>{locked.current=false;setSaving(false);});}}]);}
  function edit(section:PreviewSection){setPreview(false);if(section==="category"){setCategoryOpen(true);return;}setTimeout(()=>scroll.current?.scrollTo({y:sections.current[section]||0,animated:true}),50);}
  async function pick(camera=false){if(uploading||saving)return;setUploading(true);try{
    const permission=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){showToast(camera?"Kamera izni gerekli.":"Galeri izni gerekli.");return;}
    const result=camera?await ImagePicker.launchCameraAsync({mediaTypes:["images"],quality:0.85}):await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:Math.max(1,5-photos.length),quality:0.85});
    if(!result.canceled)setPhotos(old=>[...new Set([...old,...result.assets.map(a=>a.uri)])].slice(0,5));
  }catch{showToast("Fotoğraf alınamadı. Tekrar dene.");}finally{setUploading(false);}}
  function field(def:FieldDef){const value=values[def.key];let options=def.options||[];if(def.key==="model"){const models=modelsForSchema(schemaKey,String(values.brand||""));if(models.length)options=[...models,"Diğer"];}
    const set=(value:string|boolean|string[])=>{
      setValues(old=>({...old,[def.key]:value,...(def.key==="brand"?{model:""}:{})}));
      // Marka değişti → ilan AYNI üst kategoride yeni markanın dalına taşınır (kategori satırında
      // hemen görünür). Eskiden etiket araması yapılıyordu: çoğu zaman [] dönüp kategoriyi boşaltıyor
      // ya da başka bir üst dala (Otomobil ↔ Arazi/SUV) atlıyordu. Yeni marka dalı yoksa yol korunur.
      if(def.key==="brand"){const next=rebrandPath(path,String(values.brand||""),String(value));if(next){setPath(next);setCategoryChanged(true);setDraft(d=>({...d,category:next[next.length-1].label}));}}
    };
    if(def.type==="bool")return <View style={ms.row}><Text style={[ms.muted,{flex:1}]}>{def.label}</Text><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} accessibilityLabel={def.label} value={value===true||value==="true"} onValueChange={set} trackColor={{false:mobile.line,true:mobile.teal}} thumbColor="#FFFFFF" ios_backgroundColor={mobile.line}/></View>;
    if(def.type==="multiselect"||def.type==="tags")return <View style={{gap:6}}><Text style={ms.label}>{def.label}</Text>{options.length?<View style={ms.wrap}>{options.map(v=><MobileChip key={v} label={v} selected={Array.isArray(value)&&value.includes(v)} onPress={()=>{const old=Array.isArray(value)?value:[];set(old.includes(v)?old.filter(x=>x!==v):[...old,v]);}}/>)}</View>:<MobileField value={attributeText(value)} onChange={v=>set(v.split(",").map(x=>x.trim()).filter(Boolean))}/>}</View>;
    return options.length?<MobileSelect label={def.label+(def.required?" *":"")} value={String(value??"")} options={options} onChange={set}/>:<MobileField label={def.label} required={def.required} numeric={def.type==="number"} multiline={def.type==="textarea"} value={String(value??"")} onChange={set}/>;
  }
  if(preview)return <MobileListingPreview listing={build()} editing onBack={()=>setPreview(false)} onEdit={edit} onConfirm={()=>void save(params.section==="preview"&&["draft","paused","expired"].includes(listing.status))} confirmLabel={params.section==="preview"&&listing.status!=="active"?"İlanı Yayınla":"Değişiklikleri Kaydet"} busy={saving} error={error}/>;
  return <MobileScreen title="İlan Düzenle" onBack={back} scroll={false} right={<MobileChip label="İlanı Sil" icon="trash-can-outline" onPress={remove}/>} bottom={<View style={[ms.row,{padding:12,backgroundColor:"white",borderTopWidth:1,borderColor:mobile.line}]}><MobileButton secondary icon="eye" disabled={saving||uploading} style={{flex:1}} onPress={()=>{const problem=validation();setError(problem);if(problem)showToast(problem);else setPreview(true);}}>Önizle</MobileButton><MobileButton icon="check-circle" disabled={saving||uploading} style={{flex:2}} onPress={()=>void save()}>{saving?"Kaydediliyor…":"Değişiklikleri Kaydet"}</MobileButton></View>}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:14,paddingBottom:24}} onContentSizeChange={()=>{if(params.section==="partnership"&&sections.current.partnership&&!sectionApplied.current){sectionApplied.current=true;scroll.current?.scrollTo({y:sections.current.partnership,animated:false});}}}>
      <MobileCard style={{backgroundColor:"#EFF2FC",flexDirection:"row"}}><Icon name="information" size={25} color={mobile.teal}/><Text style={[ms.muted,{flex:1}]}>İlanını güncel tutarak daha fazla kişiye ulaşabilirsin. Kaydedilen değişiklikler gerektiğinde yeniden incelemeye alınır.</Text></MobileCard>
      <View onLayout={e=>{sections.current.photos=e.nativeEvent.layout.y;}}><Text style={[ms.section,{marginVertical:10}]}>1. Fotoğraflar · {photos.length}/5</Text><HorizontalScroll  contentContainerStyle={{gap:7,paddingBottom:12}}>{photos.map((uri,i)=><View key={uri} testID={`edit-photo-${i}`} style={{width:92}}><SafeRemoteImage uri={uri} style={{width:92,height:96,borderRadius:9}}/><Pressable accessibilityRole="button" accessibilityLabel={`Düzenleme fotoğraf ${i+1} kaldır`} disabled={saving||uploading} hitSlop={8} onPress={()=>{setRemovedPhoto({uri,index:i});setPhotos(old=>old.filter((_,n)=>n!==i));}} style={{position:"absolute",right:2,top:2,backgroundColor:"white",borderRadius:13}}><Icon name="close-circle" size={23} color={mobile.ink}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Düzenleme fotoğraf ${i+1} kapak yap`} disabled={i===0||saving||uploading} onPress={()=>setPhotos(old=>movePhoto(old,i,0))} style={{backgroundColor:i===0?mobile.teal:"#EDEFF7",borderRadius:5,padding:4,minHeight:44,justifyContent:"center"}}><Text style={{fontSize:9,color:i===0?"white":mobile.teal,textAlign:"center"}}>{i===0?"★ Kapak Fotoğrafı":"Kapak yap"}</Text></Pressable><View style={{flexDirection:"row"}}><Pressable accessibilityRole="button" accessibilityLabel={`Düzenleme fotoğraf ${i+1} öne taşı`} disabled={i===0||saving||uploading} onPress={()=>setPhotos(old=>movePhoto(old,i,i-1))} style={{width:46,minHeight:44,alignItems:"center",justifyContent:"center",opacity:i===0?0.35:1}}><Icon name="chevron-left" size={24} color={mobile.teal}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Düzenleme fotoğraf ${i+1} arkaya taşı`} disabled={i===photos.length-1||saving||uploading} onPress={()=>setPhotos(old=>movePhoto(old,i,i+1))} style={{width:46,minHeight:44,alignItems:"center",justifyContent:"center",opacity:i===photos.length-1?0.35:1}}><Icon name="chevron-right" size={24} color={mobile.teal}/></Pressable></View></View>)}{photos.length<5&&<Pressable accessibilityRole="button" accessibilityLabel="Düzenleme fotoğraf ekle" disabled={uploading} onPress={()=>setPhotoMenu(true)} style={{width:92,height:116,borderWidth:1,borderStyle:"dashed",borderRadius:9,borderColor:"#BDC4DC",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="camera-plus" size={25} color={mobile.teal}/><Text style={ms.muted}>{uploading?"Alınıyor…":"Fotoğraf Ekle"}</Text></Pressable>}</HorizontalScroll><Text style={ms.muted}>İlk fotoğraf kapaktır. Oklarla sırayı değiştirebilirsin.</Text>{removedPhoto&&<View style={ms.row}><Text style={[ms.muted,{flex:1}]}>Fotoğraf kaldırıldı.</Text><MobileButton secondary disabled={saving||uploading||photos.length>=5||photos.includes(removedPhoto.uri)} onPress={()=>{setPhotos(old=>restorePhoto(old,removedPhoto));setRemovedPhoto(null);}}>Geri al</MobileButton></View>}<ListingVideoField value={video} onChange={setVideo} userId={store.currentUser.id} canUpload={store.backendMode==="supabase"&&store.currentUser.id.includes("-")} disabled={saving} keepUrl={originalVideo} onStatus={setVideoStatus}/></View>
      <View onLayout={e=>{sections.current.details=e.nativeEvent.layout.y;}}><Text style={[ms.section,{marginVertical:10}]}>2. Temel Bilgiler</Text><MobileCard><ListingTitleField value={draft.title} onChange={title=>setDraft(d=>({...d,title}))}/><Pressable accessibilityRole="button" accessibilityLabel={`Kategori: ${path.map(n=>n.label).join(" / ")||draft.category}. Değiştir`} onPress={()=>setCategoryOpen(true)} style={[ms.row,{minHeight:44,borderRadius:9,backgroundColor:"#F2F6FC",borderWidth:1,borderColor:mobile.line,paddingHorizontal:12,paddingVertical:9}]}><Icon name="folder" size={16} color={mobile.teal}/><Text style={{flex:1,minWidth:0,fontSize:12,lineHeight:17,color:mobile.ink}}>{path.map(n=>n.label).join(" › ")||draft.category}</Text><Text style={{color:mobile.teal,fontSize:12,fontWeight:"700"}}>Değiştir ›</Text></Pressable><View style={{gap:12}}>{schema?.fields.filter(f=>!["title","description",priceField?.key||"price"].includes(f.key)&&(advanced||f.required||["fuel","gear","bodyType","color","condition"].includes(f.key))).map(def=><View key={def.key}>{field(def)}</View>)}</View>{schema?.fields.some(f=>!f.required)&&<MobileChip label={advanced?"Diğer özellikleri gizle":"Diğer özellikleri düzenle"} icon="tune" onPress={()=>setAdvanced(v=>!v)}/>}</MobileCard></View>
      <Text style={[ms.section,{marginVertical:10}]}>3. Fiyat</Text><MobileCard><MobileField label={priceField?.label||"Fiyat"} required={!!priceField?.required} value={price} onChange={setPrice} numeric/><MobileSelect label="Para Birimi" value={draft.currency||"TRY"} options={["TRY","USD","EUR"]} onChange={currency=>setDraft(d=>({...d,currency:currency as Listing["currency"]}))}/></MobileCard>
      <Text style={[ms.section,{marginVertical:10}]}>4. Konum</Text><MobileCard><ListingLocationFields value={loc} onChange={setLoc} visibility={draft.addressVisibility || "neighborhood"} onVisibility={value=>setDraft(d=>({...d,addressVisibility:value}))}/></MobileCard>
      <Text style={[ms.section,{marginVertical:10}]}>5. Açıklama</Text><MobileCard><MobileField label="Açıklama" value={draft.description} onChange={description=>setDraft(d=>({...d,description}))} multiline maxLength={LIMITS.description.max}/></MobileCard>
      <View onLayout={e=>{sections.current.partnership=e.nativeEvent.layout.y;}}><Text style={[ms.section,{marginVertical:10}]}>6. Ortaklık Ayarları</Text><MobileCard style={{backgroundColor:"#F0F3FB"}}><View style={ms.row}><Icon name="account-group" size={30} color={mobile.teal}/><View style={{flex:1}}><Text style={ms.section}>{partnerable?"Ortaklığa Açık":"Ortaklığa Kapalı"}</Text><Text style={ms.muted}>Önceden kabul edilmiş ortaklıkların anlaşma koşulları korunur.</Text></View><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} accessibilityLabel="Ortaklığa Açık" value={partnerable} onValueChange={value=>setDraft(d=>({...d,partnershipMode:value?"approval":"none"}))} trackColor={{false:mobile.line,true:mobile.teal}} thumbColor="#FFFFFF" ios_backgroundColor={mobile.line}/></View>{partnerable&&<><View style={ms.row}><MobileChip label="Sabit Tutar (₺)" selected={draft.commissionType==="fixed"} onPress={()=>setDraft(d=>({...d,commissionType:"fixed"}))}/><MobileChip label="Yüzdelik (%)" selected={draft.commissionType==="rate"} onPress={()=>setDraft(d=>({...d,commissionType:"rate"}))}/></View><View style={ms.row}><MobileField label="Komisyon Tutarı" required numeric value={commission} onChange={setCommission}/><MobileField label="Maksimum Ortak Sayısı" numeric value={maxPartners} onChange={setMaxPartners} placeholder="Sınırsız"/></View><MobileSelect label="Ortaklık Onayı" value={draft.partnershipMode==="open"?"Anında ortaklık":draft.partnershipMode==="invite"?"Yalnız davetle":"Manuel onay (sen onaylıyorsun)"} options={["Manuel onay (sen onaylıyorsun)","Anında ortaklık","Yalnız davetle"]} onChange={value=>setDraft(d=>({...d,partnershipMode:value==="Anında ortaklık"?"open":value==="Yalnız davetle"?"invite":"approval"}))}/></>}</MobileCard></View>
      {error&&<Text accessibilityRole="alert" style={ms.error}>{error}</Text>}
      <MobileButton secondary onPress={()=>router.push({pathname:"/listing-edit/[id]",params:{id:listing.id,view:"advanced"}} as never)}>Stok, teslimat ve diğer satış ayarları</MobileButton>
    </ScrollView>
    <MobileCategorySelect visible={categoryOpen} initial={path} leafOnly onClose={()=>setCategoryOpen(false)} onSelect={next=>{if(!next.length)return;const key=resolveFormKey(next),nextSchema=getFormSchema(key);const seed=nextSchema?deriveFieldsFromPath(next,nextSchema):{};
      // Önceki yoldan TÜRETİLEN marka/model/ilan-tipi aynı şemada da bayat kalmasın (BMW dalından markasız dala geçince marka BMW kalıyordu).
      const oldSeed:Record<string,string>=path.length&&schema?deriveFieldsFromPath(path,schema):{};
      setValues(old=>({...(key===schemaKey?Object.fromEntries(Object.entries(old).filter(([k,v])=>!(k in oldSeed)||v!==oldSeed[k])):{}),...Object.fromEntries(Object.entries(seed).filter(([key])=>key!=="title"))}));setPath(next);setCategoryChanged(true);setDraft(d=>({...d,category:next[next.length-1]?.label||d.category}));}}/>
    <OptionSheet visible={photoMenu} title="Fotoğraf Ekle" options={["Galeriden Seç","Fotoğraf Çek"]} onClose={()=>setPhotoMenu(false)} onSelect={value=>{setPhotoMenu(false);void pick(value==="Fotoğraf Çek");}}/>
  </MobileScreen>;
}

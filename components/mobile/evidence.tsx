import { HorizontalScroll } from "@/components/horizontal-scroll";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { evidenceUrl, type EvidencePhoto } from "@/lib/mobile-evidence";
import { showToast } from "@/lib/toast";
import { IconButton, mobile, ms } from "./ui";

export function EvidencePicker({photos,onChange,disabled=false,publicReview=false}:{photos:EvidencePhoto[];onChange:(photos:EvidencePhoto[])=>void;disabled?:boolean;publicReview?:boolean}){
  const [busy,setBusy]=useState(false);
  async function pick(){if(busy||disabled||photos.length>=5)return;setBusy(true);try{
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){showToast("Fotoğraf eklemek için galeri izni gerekli.");return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:5-photos.length,quality:1});
    if(result.canceled)return;
    if(result.assets.some(a=>(a.fileSize||0)>5*1024*1024)){showToast("Her görsel en fazla 5 MB olabilir. Büyük görseli çıkarıp tekrar seç.");return;}
    onChange([...new Map([...photos,...result.assets.map(a=>({uri:a.uri,mime:a.mimeType}))].map(photo=>[photo.uri,photo])).values()].slice(0,5));
  }catch{showToast("Fotoğraf seçilemedi. Tekrar dene.");}finally{setBusy(false);}}
  return <View style={{gap:9}}><Text style={ms.section}>{publicReview?"Fotoğraflar (İsteğe Bağlı)":"Ekran Görüntüleri (İsteğe Bağlı)"}</Text><HorizontalScroll  contentContainerStyle={{gap:8}}>{photos.length<5&&<Pressable accessibilityRole="button" accessibilityLabel="Kanıt fotoğrafı ekle" disabled={disabled||busy} onPress={()=>void pick()} style={{height:99,width:99,borderWidth:1,borderStyle:"dashed",borderColor:mobile.teal,borderRadius:11,alignItems:"center",justifyContent:"center",gap:7}}><Icon name="camera-outline" size={27} color={mobile.teal}/><Text style={{fontSize:11,color:mobile.teal}}>{busy?"Açılıyor…":"Fotoğraf Ekle"}</Text></Pressable>}{photos.map((p,i)=><View key={p.uri} style={{width:99,height:99}}><Image source={{uri:p.uri}} contentFit="cover" style={{width:99,height:99,borderRadius:10}}/><Pressable accessibilityRole="button" accessibilityLabel={`Kanıt fotoğrafı ${i+1} kaldır`} disabled={disabled} onPress={()=>onChange(photos.filter((_,n)=>n!==i))} style={{position:"absolute",right:3,top:3,borderRadius:15,backgroundColor:"white",padding:3}}><Icon name="close" size={20} color={mobile.ink}/></Pressable></View>)}</HorizontalScroll><Text style={ms.muted}>En fazla 5 görsel; her biri en fazla 5 MB (JPG, PNG). {publicReview?"Yorum fotoğrafların herkes tarafından görülebilir. Kişisel bilgi içeren görsel ekleme.":"Ekler yalnız sen ve yetkili destek ekibi tarafından görülebilir."}</Text></View>;
}
export function EvidenceGallery({paths,bucket="private-evidence"}:{paths:string[];bucket?:"private-evidence"|"review-media"}){
  const [urls,setUrls]=useState<Record<string,string>>({}),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[full,setFull]=useState<string|null>(null),insets=useSafeAreaInsets();
  const key=paths.join(",");
  useEffect(()=>{let active=true;setFailed(false);setUrls({});void Promise.all(paths.map(async path=>[path,await evidenceUrl(path,bucket)] as const)).then(pairs=>{if(active)setUrls(Object.fromEntries(pairs));}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};
    // key represents all paths, including ordering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,retry,bucket]);
  if(!paths.length)return null;
  return <View style={{gap:8}}><HorizontalScroll  contentContainerStyle={{gap:7}}>{paths.map((path,i)=><Pressable key={path} accessibilityRole="button" accessibilityLabel={`Eklenen görsel ${i+1} aç`} onPress={()=>{void evidenceUrl(path,bucket).then(setFull).catch(()=>showToast("Görsel açılamadı. Tekrar dene."));}} style={{width:86,height:86,borderRadius:9,backgroundColor:"#EAF1F5",overflow:"hidden"}}>{urls[path]?<Image source={{uri:urls[path]}} contentFit="cover" style={{width:86,height:86}}/>:<Text style={{padding:12,color:mobile.muted}}>Görsel {i+1}</Text>}</Pressable>)}</HorizontalScroll>{failed&&<Pressable accessibilityRole="button" accessibilityLabel="Eklenen görselleri tekrar yükle" onPress={()=>setRetry(v=>v+1)}><Text style={ms.error}>Görseller yüklenemedi. Tekrar yükle.</Text></Pressable>}<Modal visible={!!full} onRequestClose={()=>setFull(null)}><View style={{flex:1,backgroundColor:"#101827",paddingTop:insets.top}}><IconButton name="close" label="Ek görselini kapat" color="white" onPress={()=>setFull(null)}/>{full&&<Image source={{uri:full}} contentFit="contain" style={{flex:1}}/>}</View></Modal></View>;
}

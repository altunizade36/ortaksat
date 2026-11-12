import { Platform } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { makeUuid } from "@/lib/live-service";

export type EvidencePhoto = { uri: string; mime?: string; path?: string };
export async function uploadEvidence(photo: EvidencePhoto, userId: string, bucket:"private-evidence"|"review-media"="private-evidence"): Promise<string> {
  if (photo.path) return photo.path;
  if (!supabase) throw new Error("Sunucu bağlantısı gerekli.");
  let uri=photo.uri, mime=photo.mime||"image/jpeg";
  if(Platform.OS!=="web"&&!['image/jpeg','image/png'].includes(mime)) {
    const image=await manipulateAsync(uri,[],{compress:0.9,format:SaveFormat.JPEG});uri=image.uri;mime="image/jpeg";
  }
  const response=await fetch(uri),blob=await response.blob();
  if(blob.size>5*1024*1024)throw new Error("Her görsel en fazla 5 MB olabilir.");
  if(Platform.OS==="web")mime=blob.type||mime;
  if(!['image/jpeg','image/png'].includes(mime))throw new Error("JPG veya PNG görsel seç.");
  // ArrayBuffer uploads work on React Native as well as the web Storage client.
  const buffer=await new Promise<ArrayBuffer>((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error("Görsel okunamadı."));reader.onload=()=>{
      try{const encoded=String(reader.result).split(",")[1],decoded=atob(encoded),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);resolve(bytes.buffer);}catch(error){reject(error);}
    };reader.readAsDataURL(blob);
  });
  const path=`${userId}/${makeUuid()}.${mime==='image/png'?'png':'jpg'}`;
  const {error}=await supabase.storage.from(bucket).upload(path,buffer,{contentType:mime,upsert:false});
  if(error)throw error;
  return path;
}
export async function evidenceUrl(path:string,bucket:"private-evidence"|"review-media"="private-evidence"){
  if(!supabase)throw new Error("Sunucu bağlantısı gerekli.");
  if(bucket==="review-media")return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,600);
  if(error||!data?.signedUrl)throw error||new Error("Görsel yüklenemedi.");
  return data.signedUrl;
}

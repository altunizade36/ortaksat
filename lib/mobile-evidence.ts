import { Platform } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { makeUuid } from "@/lib/live-service";

export type EvidencePhoto = { uri: string; mime?: string; path?: string };
export async function uploadEvidence(photo: EvidencePhoto, userId: string, bucket:"private-evidence"|"review-media"="private-evidence"): Promise<string> {
  if (photo.path) return photo.path;
  if (!supabase) throw new Error("Sunucu bağlantısı gerekli.");
  let uri=photo.uri, mime=photo.mime||"image/jpeg";
  const decode=(encoded:string)=>{const decoded=atob(encoded),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);return bytes.buffer;};
  let buffer:ArrayBuffer;
  if(Platform.OS!=="web"){
    // UYGULAMA: baytlar doğrudan görsel işleyiciden alınır. Yerel dosyayı fetch ile okumak bazı ortamlarda
    // dosya yerine "File not found" metnini döndürüyor ve bu metin ek diye yükleniyordu (bkz. live-service).
    const image=await manipulateAsync(uri,[],{compress:0.9,format:SaveFormat.JPEG,base64:true});
    if(!image.base64)throw new Error("Görsel okunamadı.");
    buffer=decode(image.base64);mime="image/jpeg";
    const head=new Uint8Array(buffer.slice(0,2));
    if(head[0]!==0xff||head[1]!==0xd8)throw new Error("Görsel okunamadı.");
  } else {
    const response=await fetch(uri);
    if(response.status&&!response.ok)throw new Error("Görsel okunamadı.");
    const blob=await response.blob();
    mime=blob.type||mime;
    if(!['image/jpeg','image/png'].includes(mime))throw new Error("JPG veya PNG görsel seç.");
    buffer=await new Promise<ArrayBuffer>((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=()=>reject(new Error("Görsel okunamadı."));reader.onload=()=>{
        try{resolve(decode(String(reader.result).split(",")[1]));}catch(error){reject(error);}
      };reader.readAsDataURL(blob);
    });
  }
  if(!buffer.byteLength)throw new Error("Görsel okunamadı.");
  if(buffer.byteLength>5*1024*1024)throw new Error("Her görsel en fazla 5 MB olabilir.");
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

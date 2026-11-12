import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { translateCopy } from "@/lib/i18n";
import { getActiveLanguage, localize } from "@/lib/locale";
import { storageBody } from "@/lib/storage-body";
import { supabase, supabaseConfig } from "@/lib/supabase";

/**
 * İLAN VİDEOSU — ilan başına EN FAZLA BİR, isteğe bağlı, kısa ve küçük klip.
 *
 * SÖZLEŞME (adAssets):
 *  - Video, ilanın `adAssets` dizisinde TEK bir giriş olarak, FOTOĞRAFLARDAN SONRA (son eleman) durur.
 *  - Değer `listing-videos` kovasındaki herkese açık URL'dir: `.../listing-videos/<userId>/<uuid>.(mp4|webm|mov)`.
 *  - Video `isListingVideoUrl(url)` ile ayırt edilir (uzantıya bakar; keşfet akışındaki `isVideoUri` ile aynı kural).
 *  - Kapak (`image`) HER ZAMAN fotoğraftır; video hiçbir zaman kapak olmaz ve 5 fotoğraf sınırına sayılmaz.
 *  - Okurken `splitListingMedia(adAssets)` → `{ photos, video }`; yazarken `withListingVideo(photos, video)`.
 *
 * Sınırlar istemcide yüklemeden ÖNCE doğrulanır; kova da sunucuda 25 MB + MIME sınırı uygular.
 * Dönüştürme (transcode) yapılmaz.
 */
/**
 * İlan videosu ŞİMDİLİK KAPALI (2026-11-12, ürün kararı: yük binmesin / uygulama hafif kalsın).
 * false iken ilan verme ve düzenleme ekranlarında video alanı hiç çizilmez; mevcut bir ilanın videosu
 * (varsa) korunur ve detayda gösterilmeye devam eder. Yeniden açmak için true yapmak yeterlidir.
 */
export const LISTING_VIDEO_ENABLED = false;

export const LISTING_VIDEO_LIMITS = { maxSeconds: 30, maxBytes: 25 * 1024 * 1024 } as const;
export const LISTING_VIDEO_BUCKET = "listing-videos";
export const LISTING_VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
export const LISTING_VIDEO_HELP = "En fazla 30 saniye ve 25 MB · MP4, WebM veya MOV · dikey ya da yatay, 1080p'ye kadar önerilir.";
/**
 * İLAN TASLAĞI (cihazda saklanan yarım ilan) — anahtar ve ömür TEK kaynaktan: ilan verme akışı taslağı
 * bu anahtarla yazar, sahipsiz video temizliği de AYNI anahtarı okuyup taslağın videosunu korur.
 */
export const LISTING_DRAFT_PREFIX = "ortaksat_listing_draft_v1";
export const LISTING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün
export const listingDraftKey = (userId?: string) => `${LISTING_DRAFT_PREFIX}:${userId || "anon"}`;
/** Kodlayıcı yuvarlaması (30,02 sn gibi) yüzünden tam 30 sn'lik klibi reddetmemek için küçük pay. */
const DURATION_TOLERANCE = 0.5;

const MIME_EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const EXTENSION_MIME: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ListingVideoValue = { url: string; durationSec?: number; sizeBytes?: number };
export type ListingVideoCandidate = {
  uri: string;
  /** Web: seçilen dosyanın kendisi (yükleme gövdesi). */
  blob?: Blob;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  durationSec?: number;
  width?: number;
  height?: number;
};

/** URL bir ilan videosu mu? (uzantı kuralı — keşfet akışındaki isVideoUri ile aynı) */
export function isListingVideoUrl(uri: unknown): boolean {
  return typeof uri === "string" && /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(uri);
}

/** adAssets (ya da herhangi bir medya listesi) → fotoğraflar + en fazla BİR video (ilk bulunan). */
export function splitListingMedia(assets: ReadonlyArray<string | null | undefined> | null | undefined): { photos: string[]; video: string | null } {
  const photos: string[] = [];
  let video: string | null = null;
  for (const item of assets ?? []) {
    if (typeof item !== "string" || !item.trim()) continue;
    if (isListingVideoUrl(item)) { if (!video) video = item; continue; }
    photos.push(item);
  }
  return { photos, video };
}

/** Fotoğraf listesinin SONUNA tek videoyu ekler (fotoğraflardaki olası video girişlerini ayıklar). */
export function withListingVideo(photos: ReadonlyArray<string>, video: string | null | undefined): string[] {
  const clean = photos.filter((item) => !isListingVideoUrl(item));
  return video && isListingVideoUrl(video) ? [...clean, video] : clean;
}

export function formatVideoDuration(seconds?: number): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatVideoSize(bytes?: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  // Ondalık ayırıcı seçili dile göre: TR "26,0 MB", EN "26.0 MB".
  return mb >= 0.1 ? `${mb.toFixed(1).replace(".", localize(",", "."))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Bu modülün ürettiği TÜM kullanıcı mesajları seçili dilde döner (Türkçede metin birebir aynıdır).
 * Sabit parçalar sözlükten (lib/i18n-dict) çevrilir; değişken kısım (dosya türü / boyut / süre)
 * çevrilmeden araya eklenir — bu yüzden değişkenli mesajlar TEK parça değil, parçalardan kurulur.
 */
const tr = (text: string) => translateCopy(text, getActiveLanguage());
const ONLY_VIDEO_TYPES = "Yalnızca MP4, WebM veya MOV video yükleyebilirsin.";
const UNSUPPORTED_TYPE = "Bu dosya türü desteklenmiyor. Yalnızca MP4, WebM veya MOV video yükleyebilirsin.";

function extensionOf(name?: string): string {
  return (name ?? "").split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
}

/** Bildirilen MIME + dosya adı → izinli MIME (yoksa ""). MIME varsa UZANTIYA DEĞİL MIME'a güvenilir. */
export function resolveListingVideoMime(mimeType?: string, fileName?: string): string {
  const declared = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (declared) return MIME_EXTENSION[declared] ? declared : "";
  return EXTENSION_MIME[extensionOf(fileName)] ?? "";
}

/**
 * Sınır doğrulamasının sonucu. `kind` dilden BAĞIMSIZDIR: çağıran, mesaj metnine bakmadan hangi kuralın
 * çiğnendiğini bilir ("type" | "size" | "duration" = kullanıcıya aynen gösterilecek tür/sınır sorunu).
 */
type ListingVideoProblem = { kind: "type" | "empty" | "size" | "unreadable" | "duration"; message: string };

function listingVideoProblem(candidate: Pick<ListingVideoCandidate, "mimeType" | "fileName" | "sizeBytes" | "durationSec">): ListingVideoProblem | null {
  if (!resolveListingVideoMime(candidate.mimeType, candidate.fileName)) {
    const actual = (candidate.mimeType || "").trim() || (extensionOf(candidate.fileName) ? `.${extensionOf(candidate.fileName)}` : tr("bilinmeyen tür"));
    return { kind: "type", message: `${tr("Bu dosya türü desteklenmiyor")} (${actual}). ${tr(ONLY_VIDEO_TYPES)}` };
  }
  if (typeof candidate.sizeBytes === "number") {
    if (candidate.sizeBytes <= 0) return { kind: "empty", message: tr("Video okunamadı: dosya boş görünüyor.") };
    if (candidate.sizeBytes > LISTING_VIDEO_LIMITS.maxBytes) return { kind: "size", message: `${tr("Video en fazla 25 MB olabilir; seçtiğin dosya")} ${formatVideoSize(candidate.sizeBytes)}.` };
  }
  if (typeof candidate.durationSec === "number") {
    if (!Number.isFinite(candidate.durationSec) || candidate.durationSec <= 0) return { kind: "unreadable", message: tr(VIDEO_UNREADABLE) };
    if (candidate.durationSec > LISTING_VIDEO_LIMITS.maxSeconds + DURATION_TOLERANCE) return { kind: "duration", message: `${tr("Video en fazla 30 saniye olabilir; seçtiğin video")} ${Math.round(candidate.durationSec)} ${tr("saniye")}.` };
  }
  return null;
}

/** Sınır doğrulaması. Hata varsa sınırı VE dosyanın gerçek değerini söyleyen (seçili dilde) mesaj; yoksa null. */
export function validateListingVideo(candidate: Pick<ListingVideoCandidate, "mimeType" | "fileName" | "sizeBytes" | "durationSec">): string | null {
  return listingVideoProblem(candidate)?.message ?? null;
}

export const VIDEO_UNREADABLE = "Video okunamadı. Dosya bozuk olabilir ya da biçimi bu cihazda açılamıyor; MP4 olarak kaydedip tekrar dene.";
const unreadableError = () => new Error(tr(VIDEO_UNREADABLE));

/** İlk baytlardan kapsayıcı ailesi: "webm" | "iso" (mp4/mov) | "" (tanınmadı). Uzantıya güvenmemek için. */
async function sniffContainer(blob: Blob): Promise<"webm" | "iso" | ""> {
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (head.length < 8) return "";
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
    const atom = String.fromCharCode(head[4], head[5], head[6], head[7]);
    return ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(atom) ? "iso" : "";
  } catch {
    return "";
  }
}

/** WEB: süre/boyut bilgisini bağımsız bir <video preload="metadata"> ile okur. Okunamazsa VIDEO_UNREADABLE fırlatır. */
function probeWebVideo(blob: Blob, timeoutMs = 10000): Promise<{ durationSec: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") { reject(unreadableError()); return; }
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    let settled = false;
    const finish = (error: Error | null, durationSec = 0) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const width = video.videoWidth, height = video.videoHeight;
      video.removeAttribute("src");
      try { video.load(); } catch { /* yoksay */ }
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve({ durationSec, width, height });
    };
    const timer = setTimeout(() => finish(unreadableError()), timeoutMs);
    const readDuration = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0) finish(null, d);
    };
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      // MediaRecorder çıktısı gibi bazı WebM dosyalarında süre başta Infinity gelir; sona sarınca gerçek süre oluşur.
      if (video.duration === Infinity) { try { video.currentTime = 1e7; } catch { /* yoksay */ } return; }
      readDuration();
      if (!settled) finish(unreadableError());
    };
    video.ondurationchange = readDuration;
    video.ontimeupdate = readDuration;
    video.onerror = () => finish(unreadableError());
    video.src = url;
  });
}

/**
 * WEB: seçilen dosyayı doğrular (MIME + ilk baytlar + boyut + süre). Geçerliyse yüklemeye hazır aday döner;
 * değilse sınırı ve gerçek değeri söyleyen mesajla Error fırlatır. `uri` bir object URL'dir — işi bitince
 * çağıran `URL.revokeObjectURL` ile bırakmalıdır.
 */
export async function inspectWebVideoFile(file: File): Promise<ListingVideoCandidate> {
  const base = { mimeType: file.type, fileName: file.name, sizeBytes: file.size };
  const early = validateListingVideo(base);
  if (early) throw new Error(early);
  const family = await sniffContainer(file);
  if (!family) throw new Error(`${tr("Bu dosya geçerli bir video değil")} (${file.type || file.name}). ${tr(ONLY_VIDEO_TYPES)}`);
  const declared = resolveListingVideoMime(file.type, file.name);
  const mimeType = family === "webm" ? "video/webm" : declared === "video/webm" ? "video/mp4" : declared;
  const meta = await probeWebVideo(file);
  const late = validateListingVideo({ ...base, mimeType, durationSec: meta.durationSec });
  if (late) throw new Error(late);
  return { uri: URL.createObjectURL(file), blob: file, mimeType, fileName: file.name, sizeBytes: file.size, durationSec: meta.durationSec, width: meta.width, height: meta.height };
}

/** WEB: gizli <input type=file> ile TEK video seçtirir. İptalde null. */
export function chooseWebVideoFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(null); return; }
    // "cancel" olayını desteklemeyen tarayıcılarda iptal edilen eski seçiciler DOM'da kalmasın.
    document.querySelectorAll('input[data-testid="listing-video-input"]').forEach((node) => node.remove());
    const input = document.createElement("input");
    input.type = "file";
    input.accept = LISTING_VIDEO_ACCEPT;
    input.multiple = false;
    input.style.display = "none";
    input.setAttribute("data-testid", "listing-video-input");
    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * NATIVE: galeriden TEK video seçtirir (expo-image-picker; `videoMaxDuration: 30`). Seçicinin bildirdiği
 * süre/boyut/MIME ile doğrular. İptalde null; izin yoksa ya da sınır aşılmışsa mesajlı Error fırlatır.
 */
export async function pickNativeListingVideo(): Promise<ListingVideoCandidate | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(tr("Galeri izni verilmedi. Ayarlardan izin verip tekrar dene."));
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: false, videoMaxDuration: LISTING_VIDEO_LIMITS.maxSeconds, quality: 1 });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const asset = result.assets[0];
  if (asset.type && asset.type !== "video") throw new Error(tr(UNSUPPORTED_TYPE));
  // expo-image-picker süreyi MİLİSANİYE verir.
  const durationSec = typeof asset.duration === "number" && asset.duration > 0 ? asset.duration / 1000 : undefined;
  const candidate: ListingVideoCandidate = {
    uri: asset.uri,
    mimeType: asset.mimeType ?? undefined,
    fileName: asset.fileName ?? asset.uri,
    sizeBytes: typeof asset.fileSize === "number" ? asset.fileSize : undefined,
    durationSec,
    width: asset.width,
    height: asset.height
  };
  // Süre bildirilmediyse sınır doğrulanamaz → güvenli tarafta kal, reddet.
  if (durationSec === undefined) throw unreadableError();
  const problem = validateListingVideo(candidate);
  if (problem) throw new Error(problem);
  return candidate;
}

function makeId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const UPLOAD_FAILED = "Video yüklenemedi. Bağlantını kontrol edip tekrar dene.";

/**
 * Yükleme zaman aşımı DOSYA BOYUTUYLA ölçeklenir. Eskiden sabit 3 dakikaydı: 25 MB'lık geçerli bir video
 * ~1,1 Mbit/sn altındaki bağlantıda HER denemede zaman aşımına düşüyor, "Tekrar dene" de sıfırdan başlıyordu.
 * Taban 3 dk; üstü ~256 kbit/sn (32 KB/sn) hıza göre hesaplanır (25 MB ≈ 14 dk). Boyut bilinmiyorsa üst sınır.
 */
export function listingVideoUploadTimeoutMs(sizeBytes?: number): number {
  const bytes = typeof sizeBytes === "number" && Number.isFinite(sizeBytes) && sizeBytes > 0 ? Math.min(sizeBytes, LISTING_VIDEO_LIMITS.maxBytes) : LISTING_VIDEO_LIMITS.maxBytes;
  return Math.max(180000, Math.ceil(bytes / (32 * 1024)) * 1000);
}

/** İlerleme bildiren XHR yüklemesi (web: ham gövde; native: multipart {uri}). */
function xhrUpload(endpoint: string, token: string, apiKey: string, contentType: string, body: Blob | FormData, onProgress?: (fraction: number) => void, timeoutMs = listingVideoUploadTimeoutMs()): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("x-upsert", "false");
    if (!(typeof FormData !== "undefined" && body instanceof FormData)) {
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("cache-control", "max-age=31536000");
    }
    if (xhr.upload && onProgress) xhr.upload.onprogress = (event) => { if (event.lengthComputable && event.total > 0) onProgress(Math.min(0.99, event.loaded / event.total)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}: ${String(xhr.responseText).slice(0, 200)}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = timeoutMs;
    xhr.send(body as never);
  });
}

/**
 * Videoyu `listing-videos/<userId>/<uuid>.<ext>` yoluna yükler, herkese açık URL döner.
 * `source`: web'de File/Blob ya da blob: URL; native'de file:// URI. Zaten uzak (http) URL ise aynen döner.
 * Sınırlar burada da (savunma amaçlı) kontrol edilir; süre doğrulaması seçim anında yapılır.
 */
export async function uploadListingVideo(source: string | Blob, userId: string, onProgress?: (fraction: number) => void, options: { mimeType?: string; fileName?: string; sizeBytes?: number } = {}): Promise<string> {
  if (typeof source === "string" && /^https?:\/\//i.test(source)) return source;
  if (!supabase || !supabaseConfig.url || !supabaseConfig.key) throw new Error(tr("Video yüklemek için canlı hesap gerekli."));
  if (!uuidPattern.test(userId) || !source) throw new Error(tr("Video için geçerli hesap ve dosya gerekli."));

  let blob: Blob | null = typeof source === "string" ? null : source;
  const isNativeFile = Platform.OS !== "web" && typeof source === "string";
  if (!blob && !isNativeFile) {
    try { blob = await (await fetch(source as string)).blob(); } catch { throw unreadableError(); }
  }
  const mimeType = resolveListingVideoMime(options.mimeType || blob?.type, options.fileName || (typeof source === "string" ? source : undefined));
  if (!mimeType) throw new Error(tr(UNSUPPORTED_TYPE));
  if (blob) {
    const problem = validateListingVideo({ mimeType, sizeBytes: blob.size });
    if (problem) throw new Error(problem);
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || data.session?.user?.id !== userId) throw new Error(tr("Oturumun sona ermiş görünüyor. Tekrar giriş yapıp videoyu yeniden ekle."));

  const path = `${userId}/${makeId()}.${MIME_EXTENSION[mimeType]}`;
  const endpoint = `${supabaseConfig.url}/storage/v1/object/${LISTING_VIDEO_BUCKET}/${path}`;
  onProgress?.(0);
  const timeoutMs = listingVideoUploadTimeoutMs(blob ? blob.size : options.sizeBytes);
  try {
    if (blob) {
      await xhrUpload(endpoint, token, supabaseConfig.key, mimeType, blob, onProgress, timeoutMs);
    } else {
      const form = new FormData();
      form.append("cacheControl", "31536000");
      form.append("", { uri: source as string, name: `video.${MIME_EXTENSION[mimeType]}`, type: mimeType } as unknown as Blob);
      await xhrUpload(endpoint, token, supabaseConfig.key, mimeType, form, onProgress, timeoutMs);
    }
  } catch (first) {
    const message = String((first as Error)?.message ?? "");
    if (/storage 413|too large|exceeded/i.test(message)) throw new Error(tr("Video en fazla 25 MB olabilir; dosyan bu sınırı aşıyor."));
    if (/storage 415|mime/i.test(message)) throw new Error(tr(UNSUPPORTED_TYPE));
    if (!isNativeFile) { console.warn("Video yüklenemedi", message); throw new Error(tr(UPLOAD_FAILED)); }
    // NATIVE yedek yol: fotoğraflarla aynı desen (dosyayı oku → ArrayBuffer → supabase-js).
    // Tür/sınır sorunu kullanıcıya AYNEN gösterilir; diğer her hata genel "yüklenemedi" mesajına düşer.
    // Ayrım mesaj metnine DEĞİL `kind` alanına bakar (mesaj seçili dilde üretildiği için metin eşleşmesi kırılırdı).
    let surfaced: string | null = null;
    try {
      const fileBlob = await (await fetch(source as string)).blob();
      const problem = listingVideoProblem({ mimeType, sizeBytes: fileBlob.size });
      if (problem) {
        if (problem.kind === "type" || problem.kind === "size" || problem.kind === "duration") surfaced = problem.message;
        throw new Error(problem.message);
      }
      const { error } = await supabase.storage.from(LISTING_VIDEO_BUCKET).upload(path, await storageBody(fileBlob), { contentType: mimeType, upsert: false, cacheControl: "31536000" });
      if (error) throw error;
    } catch (second) {
      console.warn("Video yüklenemedi", message, second);
      throw new Error(surfaced ?? tr(UPLOAD_FAILED));
    }
  }
  onProgress?.(1);
  return supabase.storage.from(LISTING_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Herkese açık video URL'sinden kova-içi yol; yalnız kullanıcının KENDİ klasöründeyse döner. */
export function ownListingVideoPath(url: string | null | undefined, userId: string): string | null {
  if (!url || !uuidPattern.test(userId)) return null;
  const marker = `/storage/v1/object/public/${LISTING_VIDEO_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  let path = url.slice(at + marker.length).split(/[?#]/)[0];
  try { path = decodeURIComponent(path); } catch { return null; }
  return path.startsWith(`${userId}/`) && !path.includes("..") ? path : null;
}

/** En-iyi-çaba silme: yalnız kullanıcının kendi klasöründeki video nesnesi silinir; hata yutulur. */
export async function deleteListingVideo(url: string | null | undefined, userId: string): Promise<boolean> {
  const path = ownListingVideoPath(url, userId);
  if (!path || !supabase) return false;
  try {
    // Depolama, satırı GÖREMEZSE (SELECT politikası yoksa) hata vermeden boş liste döner → gerçekten silindi mi bak.
    const { data, error } = await supabase.storage.from(LISTING_VIDEO_BUCKET).remove([path]);
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Yüklenmiş video depoda hâlâ duruyor mu? `true` = var, `false` = KESİN yok, `null` = bilinemedi
 * (çevrimdışı / zaman aşımı → çağıran videoya DOKUNMAMALI). Web ve native'de aynı çalışır.
 */
export function listingVideoExists(url: string | null | undefined, timeoutMs = 8000): Promise<boolean | null> {
  if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
  const check = fetch(url, { method: "HEAD", cache: "no-store" }).then((response) => response.ok, () => null);
  return Promise.race([check, new Promise<null>((resolve) => { setTimeout(() => resolve(null), timeoutMs); })]);
}

/** Sahipsiz sayılma yaşı: taslak ömründen (7 gün) 1 gün FAZLA → yaşayan bir taslağın videosu süpürülemez. */
const ORPHAN_VIDEO_AGE_MS = LISTING_DRAFT_TTL_MS + 24 * 60 * 60 * 1000;
const LISTING_PAGE = 1000;
const LISTING_PAGE_LIMIT = 50;
let orphanSweepFor: string | null = null;

/** Bu cihazdaki ilan taslağının videosu (kova-içi yol). Depo okunamazsa `null` → temizlik yapılmaz. */
async function storedDraftVideoPaths(userId: string): Promise<Set<string> | null> {
  const paths = new Set<string>();
  let raw: string | null;
  try { raw = await AsyncStorage.getItem(listingDraftKey(userId)); } catch { return null; }
  if (!raw) return paths;
  try {
    const url = (JSON.parse(raw) as { video?: { url?: unknown } | null } | null)?.video?.url;
    const path = typeof url === "string" ? ownListingVideoPath(url, userId) : null;
    if (path) paths.add(path);
  } catch { /* bozuk taslak geri yüklenemez (ilan verme akışı onu siler) → korunacak video yok */ }
  return paths;
}

/**
 * Kullanıcının TÜM ilanlarındaki videoların kova-içi yolları — sayfa sayfa okunur (PostgREST tek yanıtta en
 * fazla 1000 satır döner; eskiden tek sorgu vardı ve 1000'den fazla ilanı olan satıcıda kalan ilanların
 * videoları "sahipsiz" sanılıp siliniyordu). Herhangi bir sayfa okunamazsa `null` → HİÇBİR ŞEY silinmez.
 */
async function referencedVideoPaths(userId: string): Promise<Set<string> | null> {
  if (!supabase) return null;
  const used = new Set<string>();
  for (let page = 0; page < LISTING_PAGE_LIMIT; page++) {
    const { data, error } = await supabase.from("listings").select("id, ad_assets").eq("owner_id", userId).order("id", { ascending: true }).range(page * LISTING_PAGE, (page + 1) * LISTING_PAGE - 1);
    if (error || !data) return null;
    for (const row of data) {
      for (const asset of (row as { ad_assets?: string[] | null }).ad_assets ?? []) {
        const path = ownListingVideoPath(asset, userId);
        if (path) used.add(path);
      }
    }
    if (data.length < LISTING_PAGE) return used;
  }
  return null; // beklenmedik büyüklük: emin olunamıyor
}

/**
 * Sahipsiz video temizliği (oturum başına bir kez, en-iyi-çaba): kullanıcının kendi klasöründe taslak
 * ömründen (7 gün) + 1 gün daha eski olup HİÇBİR ilanına bağlı olmayan videoları siler. Yarıda bırakılan
 * taslakların yüklediği dosyalar böylece kovada birikmez.
 *
 * Bir dosya ancak ŞUNLARIN HEPSİ doğruysa silinir (herhangi biri doğrulanamazsa o dosya — ya da hepsi — kalır):
 *  1. Bu cihazdaki taslakta ve `protect` listesinde (formdaki / kayıtlı ilandaki video) geçmiyor.
 *  2. Sunucuda DOSYA BAŞINA sorgu: sahibin hiçbir ilanının `ad_assets` dizisi bu URL'yi içermiyor.
 *  3. Son teyit (yalnız silinecek aday kaldıysa): tüm ilanlar sayfalanarak YOL bazında yeniden bakılır —
 *     URL biçimi (alan adı vb.) değişmiş olsa bile kullanımda olan dosya silinmez.
 */
export async function pruneOrphanListingVideos(userId: string, protect: ReadonlyArray<string | null | undefined> = []): Promise<number> {
  const client = supabase;
  if (!client || !uuidPattern.test(userId) || orphanSweepFor === userId) return 0;
  orphanSweepFor = userId;
  try {
    const listed = await client.storage.from(LISTING_VIDEO_BUCKET).list(userId, { limit: 100 });
    if (listed.error || !listed.data?.length) return 0;
    const cutoff = Date.now() - ORPHAN_VIDEO_AGE_MS;
    const old = listed.data.filter((file) => {
      const created = Date.parse(file.created_at ?? "");
      return Boolean(file.name) && Number.isFinite(created) && created < cutoff;
    });
    if (!old.length) return 0;

    const kept = await storedDraftVideoPaths(userId);
    if (!kept) return 0;
    for (const url of protect) {
      const path = ownListingVideoPath(url, userId);
      if (path) kept.add(path);
    }

    const candidates: string[] = [];
    for (const file of old) {
      const path = `${userId}/${file.name}`;
      if (kept.has(path)) continue;
      const publicUrl = client.storage.from(LISTING_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
      const reference = await client.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", userId).contains("ad_assets", [publicUrl]);
      // Sorgu başarısızsa ya da sayı bilinmiyorsa bu dosyaya DOKUNMA: yayındaki ilanın videosunu kaybetmek kabul edilemez.
      if (reference.error || typeof reference.count !== "number" || reference.count > 0) continue;
      candidates.push(path);
    }
    if (!candidates.length) return 0;

    const used = await referencedVideoPaths(userId);
    if (!used) return 0;
    const orphans = candidates.filter((path) => !used.has(path));
    if (!orphans.length) return 0;
    const removed = await client.storage.from(LISTING_VIDEO_BUCKET).remove(orphans);
    return removed.error ? 0 : removed.data?.length ?? 0;
  } catch {
    return 0;
  }
}

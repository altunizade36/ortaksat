import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isMobileApp } from "@/lib/mobile-app";

/** Açılış sesi şimdilik tümden kapalı (aşağıdaki nota bak). false iken ses çalmaz, Ayarlar'daki anahtar da gizlenir. */
export const INTRO_SOUND_ENABLED = false;

/** Kullanıcı açılış sesini kapattıysa "1" (Ayarlar → Açılış sesi). */
export const INTRO_SOUND_OFF_KEY = "ortaksat.introSoundOff";

const BACKGROUND = "#E5F0FF"; // app.json → expo-splash-screen backgroundColor ile AYNI (geçiş görünmesin)
const LOGO = 220; // app.json → imageWidth ile AYNI
const HOLD_AFTER_MS = 480; // animasyon bittikten sonra en az bu kadar görünür kalır
const MAX_WAIT_MS = 4200; // oturum kontrolü gecikse de (uygulama çizildiyse) açılış en geç bu sürede kapanır
const HARD_LIMIT_MS = 15000; // hiçbir koşul sağlanmasa bile açılış katmanı bu süreden uzun kalmaz
const MOUNT_APP_AT_MS = 1000; // uygulama, eller yolun ~%93'ünü aldığında arkada kurulmaya başlar
const PARTS_WAIT_MS = 700; // görseller bu sürede gelmezse animasyon yine başlar

// YEREL AÇILIŞ EKRANIYLA HİZA (gerçek Android derlemesinde ekran kaydıyla ölçüldü, 2026-11-14):
//  • Bizim katman TAM ekranın ortasındadır. Android yerel açılış ekranı ise görseli durum çubuğu ile alt gezinme
//    çubuğu ARASINDAKİ alanın ortasına çizer → (üst boşluk − alt boşluk) / 2 kadar aşağıda (ölçüm: 5,5 dp).
//    İçerik o kadar aşağı kaydırılır (bkz. shiftY). İlk denemede tersini varsayıp katmanı ölçmüştüm; yanlıştı.
//  • Android yerel ekranı görseli bizim 220 dp'lik kutudan ~%4 küçük çizer. Halka o boyutta BAŞLAR, açılış
//    "nefesi" sırasında asıl boyutuna büyür.
// İkisi hizalı değilken geçiş anında eski halka yeni halkanın arkasında "hayalet" gibi görünüyordu.
const NATIVE_SCALE = Platform.OS === "android" ? 0.96 : 1;
// Yerel ekran eriyerek değil, tek karede kalksın: iki halka üst üste bir an bile görünmesin.
if (isMobileApp) { try { SplashScreen.setOptions({ fade: false, duration: 0 }); } catch { /* eski derlemede seçenek yok */ } }

const RING = require("../assets/splash/ring.png");
const HAND_LEFT = require("../assets/splash/hand-left.png");
const HAND_RIGHT = require("../assets/splash/hand-right.png");
const BRAND = require("../assets/brand-head-blue.png");

// Geliştirme ortamında (Expo Go) görseller sunucudan indirilir; indirmeyi modül yüklenirken başlat ki
// animasyon başladığında parçalar hazır olsun. Gerçek derlemede görseller uygulamaya gömülüdür (adres http
// değildir) → hiçbir şey yapılmaz.
if (isMobileApp) {
  try {
    const remote = [RING, HAND_LEFT, HAND_RIGHT, BRAND].map((part) => Asset.fromModule(part).uri).filter((uri) => /^https?:/.test(uri));
    if (remote.length) void Image.prefetch(remote, "memory-disk");
  } catch { /* ön indirme yapılamazsa görseller normal yoldan yüklenir */ }
}

// "Hareketi azalt" ayarı: yanıt gecikirse animasyonu BEKLETMEMEK için modül yüklenirken sorulur.
let reduceMotionKnown: boolean | null = null;
const reduceMotionQuery: Promise<boolean> = isMobileApp
  ? AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotionKnown = value; return value; }).catch(() => false)
  : Promise.resolve(false);

/**
 * UYGULAMA AÇILIŞ ANİMASYONU (yalnız iOS/Android, soğuk açılışta bir kez) — toplam ≈ 3,3 sn.
 *
 *   0,00 sn  halka bir kez "nefes alır" (hafif büyüyüp oturur)
 *   0,36 sn  iki el iki yandan, tutuş noktasına doğru dönerek uzanır (yavaş başlar, hızlanır, yavaşlar)
 *   1,03 sn  kavrama: eller birbirine hafifçe bastırıp sıkılaşır, halka karşılık verir, tek ince dalga yayılır
 *   1,20 sn  el sıkışma: tutuş noktası etrafında iki buçuk yumuşak salınım, her biri bir öncekinden küçük
 *   1,56 sn  marka adı aşağıdan yükselir, ardından slogan belirir
 *   2,60 sn  kısa bekleyiş → katman eriyerek uygulamayı açar
 *
 * DOĞALLIK KURALLARI (2026-11-14, kullanıcı: "el sıkışma doğal olsun", "etrafındaki gri alanı kaldır"):
 *   • Logonun arkasında daire/hale YOK; zemin düz. Yeniden ekleme.
 *   • Sallanma köşeli değil: sönümlü sinüs 40 noktadan örneklenir (üç-dört anahtar kareyle doğrusal
 *     gidip gelme "titreme" gibi görünüyordu).
 *   • Dönme ve sıkma, kutunun ortası değil ELLERİN TUTUŞ NOKTASI etrafındadır (GRIP); yoksa eller halkanın
 *     merkezine bağlı bir sarkaç gibi yana savruluyordu.
 *   • El parçaları özgün logoyla birebir örtüşür (scripts/splash-hand-parts.py) → son karedeki geçiş görünmez.
 *
 * NEDEN TEK ZAMAN ÇİZELGESİ: bütün hareket tek bir değerin (0→1) doğrusal ilerleyişinden `interpolate` ile
 * türetilir ve yerel (native) sürücüde çalışır; başladıktan sonra JS ne kadar meşgul olursa olsun akar.
 * `Animated.sequence` / `delay` ile yeniden zincirleme: adımlar arası JS geri çağrısı açılışta takılır.
 *
 * NEDEN ÖNCE YALNIZ BU KATMAN ÇİZİLİR (app/_layout.tsx → appMounted): animasyonun BAŞLAMASI JS'in boş
 * olmasına bağlıdır (yerleşim + görsel yüklenme olayları JS'e gelir). Eskiden bu katman bütün uygulamayla
 * AYNI anda çiziliyordu; uygulama kurulurken JS saniyelerce meşgul kaldığı için katman göründükten sonra
 * 2,8 sn HİÇBİR ŞEY kıpırdamıyordu (emülatör kaydı) ve kullanıcı "animasyon yok" dedi. Hiç beklemeden
 * (ilk çizimde) başlatmak da olmadı: hareketin ilk saniyesi ekran daha görünmeden geçti, eller birleşmiş
 * halde belirdi. Çözüm sıralama: (1) yalnız bu hafif katman çizilir → JS hemen boşalır, (2) üç parça görsel
 * yüklenip yerel açılış ekranı kalkınca hareket başlar, (3) eller birleşmek üzereyken (MOUNT_APP_AT_MS)
 * `onMountApp` ile uygulama arkada kurulur — hareket yerel sürücüde olduğundan bundan etkilenmez.
 *
 * "Hareketi azalt" açıksa kayma/sallanma yoktur; eller ve yazı yalnız yumuşakça belirir (erime).
 *
 * SES KAPALI (INTRO_SOUND_ENABLED = false). Kullanıcı 2026-11-13'te açılışta YALNIZ animasyon istedi;
 * bilgisayarla üretilen beş ses denemesini de beğenmedi. Yeniden açılacaksa önce kullanıcının onayladığı
 * gerçek bir ses dosyası gerekir. Açılırsa ses telefonun sessiz anahtarına uyar ve Ayarlar'dan kapatılabilir.
 */
const TIMELINE_MS = 2600;

// BEKLEME NOKTALARI: hareket bittiğinde uygulama henüz hazır değilse (yavaş cihaz, deneme kipi) logo donmuş
// gibi durmasın diye sloganın altında üç nokta sırayla yanıp söner. Ayrı, uzun ve doğrusal TEK bir yerel
// animasyondur (ana çizelgeyle aynı anda başlar, JS'e hiç dönmez); noktalar ancak IDLE_FROM_MS'den sonra belirir,
// yani uygulama zamanında hazırsa hiç görünmez.
const IDLE_MS = 15000; // HARD_LIMIT_MS ile aynı: katman en geç o zaman kapanır
const IDLE_FROM_MS = 3300; // ana hareket + olağan bekleyişten sonra
const IDLE_CYCLE_MS = 960;

/** Bekleme noktası k (0..2) için opaklık anahtar kareleri: önce görünmez, sonra sırayla parlayıp söner. */
function idleDot(idle: Animated.Value, k: number) {
  const inputRange: number[] = [0, IDLE_FROM_MS / IDLE_MS];
  const outputRange: number[] = [0, 0];
  const push = (ms: number, value: number) => {
    const x = Math.min(1, ms / IDLE_MS);
    if (x <= inputRange[inputRange.length - 1]) return; // artan sıra korunur
    inputRange.push(x); outputRange.push(value);
  };
  push(IDLE_FROM_MS + 260, 0.28); // noktalar yumuşakça belirir
  for (let start = IDLE_FROM_MS + 260 + k * 160; start + IDLE_CYCLE_MS <= IDLE_MS; start += IDLE_CYCLE_MS) {
    push(start + 1, 0.28);
    push(start + 240, 1);
    push(start + 520, 0.28);
  }
  push(IDLE_MS, 0.28);
  return idle.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
}

const at = (ms: number) => ms / TIMELINE_MS;
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const REACH = 0.8; // geliş süresinin bu kadarı uzanma, kalanı bastırıp geri oturma
/**
 * Elin uzanışı: yavaş başlar, hızlanır, tutuşa yaklaşırken yavaşlar (gerçek bir uzanma gibi — baştan en hızlı
 * başlayan eğride eller ekranda "birden beliriyordu"); tutuşta karşı ele ≈ %3,5 bastırıp geri oturur.
 */
const reachShape = (t: number) => t < REACH ? inOutSine(t / REACH) : 1 + 0.035 * Math.sin(Math.PI * (t - REACH) / (1 - REACH));

/**
 * Zaman çizelgesindeki [başlangıç, bitiş] (ms) aralığında `shape(0…1)` eğrisini örnekler. Aralığın dışında eğrinin
 * uç değerleri geçerlidir. Örnek sayısı eğrinin kıvrımına göre seçilir (salınım için sık, düz geçiş için seyrek).
 */
function track(master: Animated.Value, startMs: number, endMs: number, shape: (t: number) => number = (t) => t, steps = 12) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    inputRange.push(at(startMs + ((endMs - startMs) * i) / steps));
    outputRange.push(shape(i / steps));
  }
  return master.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
}

const bump = (t: number) => Math.sin(Math.PI * t); // 0 → 1 → 0, yumuşak tek tepe
const PUMPS = 2.5; // el sıkışmadaki salınım sayısı
/** El sıkışma: önce aşağı, sonra yukarı; genliği yumuşakça sönen sinüs (−1…1). */
const pumpShape = (t: number) => -Math.sin(2 * Math.PI * PUMPS * t) * Math.pow(1 - t, 1.5);

function buildTracks(master: Animated.Value) {
  return {
    breath: track(master, 0, 460, bump, 16), // halkanın açılıştaki tek nefesi (ortada tepe)
    settle: track(master, 0, 460, inOutSine, 12), // yerel açılış ekranındaki boyuttan asıl boyuta geçiş
    hands: track(master, 360, 1200, reachShape, 28), // 0: eller dışarıda → 1: birleşti (≈ 1,03 sn'de; bir an 1'i geçer: bastırma)
    squeeze: track(master, 1020, 1330, bump, 14), // kavrama anındaki kısa sıkılaşma
    pump: track(master, 1200, 2080, pumpShape, 44), // el sıkışma salınımı
    ripple: track(master, 1040, 1840, outCubic), // kavrama anında yayılan tek ince dalga
    word: track(master, 1560, 2040, outCubic), // marka adı
    slogan: track(master, 1820, 2260, inOutSine), // slogan
    exact: track(master, 2200, 2420) // özgün logoya çapraz geçiş (piksel-tam son kare)
  };
}

export function IntroSplash({ ready, appShown = true, onMountApp }: {
  /** Oturum kontrolü bitti VE uygulama ekrana çizildi → katman kapanabilir. */
  ready: boolean;
  /** Uygulamanın ilk ekranı çizildi mi? Çizilmeden zaman aşımıyla kapanılmaz (boş ekran görünmesin). */
  appShown?: boolean;
  /** Hareket başladıktan sonra (eller birleşirken) uygulamayı kurmak için çağrılır. */
  onMountApp?: () => void;
}) {
  const [visible, setVisible] = useState(isMobileApp);
  const [animationDone, setAnimationDone] = useState(false);
  const [reduced, setReduced] = useState(reduceMotionKnown === true);
  const started = useRef(false);
  const master = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current; // katmanın erimesi
  const idle = useRef(new Animated.Value(0)).current; // bekleme noktalarının zaman çizelgesi
  const dots = useRef<Animated.AnimatedInterpolation<number>[] | null>(null);
  if (!dots.current) dots.current = [0, 1, 2].map((k) => idleDot(idle, k));
  const tracks = useRef<ReturnType<typeof buildTracks> | null>(null);
  if (!tracks.current) tracks.current = buildTracks(master);
  const { breath, settle, hands, squeeze, pump, ripple, word, slogan, exact } = tracks.current;

  const laidOut = useRef(false);
  const insets = useSafeAreaInsets();
  // Yerel açılış ekranındaki halkanın yeri (yukarıdaki nota bak). iOS'ta yerel ekran tam ortadadır → 0.
  const shiftY = Platform.OS === "android" ? Math.round((insets.top - insets.bottom) / 2) : 0;
  const loaded = useRef(0);
  const mountAppRef = useRef(onMountApp);
  mountAppRef.current = onMountApp;

  // Hareket; katman yerleşti + üç parça görsel (halka, iki el) yüklendi + yerel açılış ekranı kalktı → başlar.
  // Bu sırada uygulamanın geri kalanı henüz kurulmadığı için JS boştur, bu olaylar gecikmeden gelir.
  const begin = () => {
    if (started.current) return;
    started.current = true;
    const hidden = SplashScreen.hideAsync().catch(() => {});
    const capped = new Promise<void>((resolve) => setTimeout(resolve, 250));
    void Promise.race([hidden, capped]).then(() => {
      if (INTRO_SOUND_ENABLED) void playChime();
      Animated.timing(master, { toValue: 1, duration: TIMELINE_MS, easing: Easing.linear, useNativeDriver: true }).start(() => setAnimationDone(true));
      Animated.timing(idle, { toValue: 1, duration: IDLE_MS, easing: Easing.linear, useNativeDriver: true }).start();
      // Uygulamayı eller birleşirken kur ("hareketi azalt"ta kayma yok → hemen).
      setTimeout(() => mountAppRef.current?.(), reduceMotionKnown ? 0 : MOUNT_APP_AT_MS);
    });
  };
  const onFirstLayout = () => {
    if (laidOut.current) return;
    laidOut.current = true;
    if (loaded.current >= 3) begin();
    else setTimeout(begin, PARTS_WAIT_MS);
  };
  const onPartLoad = () => {
    loaded.current += 1;
    if (loaded.current >= 3 && laidOut.current) begin();
  };

  // "Hareketi azalt" yanıtı animasyon başladıktan sonra gelirse kayma/sallanma genlikleri sıfırlanır.
  useEffect(() => {
    let alive = true;
    void reduceMotionQuery.then((value) => { if (alive && value) setReduced(true); });
    return () => { alive = false; };
  }, []);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  const [hardTimedOut, setHardTimedOut] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setHardTimedOut(true), HARD_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  // Kapanış: hareket bitti VE (hazır | süre doldu ama uygulama çizildi | mutlak üst sınır).
  const canClose = animationDone && (ready || (timedOut && appShown) || hardTimedOut);
  useEffect(() => {
    if (!visible || !canClose) return;
    const timer = setTimeout(() => {
      Animated.timing(out, { toValue: 1, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setVisible(false));
    }, ready ? HOLD_AFTER_MS : 0);
    return () => clearTimeout(timer);
  }, [visible, canClose, ready, out]);

  if (!visible) return null;

  const move = reduced ? 0 : 1; // "hareketi azalt": yer değiştirme yok, yalnız erime
  // Eller yolun başında (uzaktayken) belirir; yaklaşırken zaten tam görünürdür.
  const handOpacity = hands.interpolate({ inputRange: [0, reduced ? 1 : 0.09, 1], outputRange: [0, 1, 1], extrapolate: "clamp" });
  // Kavrama: eller bir an sıkılaşır (tutuş noktası etrafında, bkz. styles.grip).
  const handScale = squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.045 * move] });
  // Geliş: yandan ve biraz aşağıdan, tutuş noktasına doğru dönerek. `hands` sonda 1'i az geçer → eller birbirine bastırır.
  const approach = (side: -1 | 1) => ({
    opacity: handOpacity,
    transform: [
      { translateX: hands.interpolate({ inputRange: [0, 1], outputRange: [side * LOGO * 0.92 * move, 0] }) },
      { translateY: hands.interpolate({ inputRange: [0, 0.55, 1], outputRange: [LOGO * 0.13 * move, LOGO * 0.035 * move, 0], extrapolateRight: "clamp" }) },
      { rotate: hands.interpolate({ inputRange: [0, 1], outputRange: [`${side * 17 * move}deg`, "0deg"] }) },
      { scale: handScale }
    ]
  });
  const leftStyle = approach(-1);
  const rightStyle = approach(1);

  // El sıkışma: birleşen eller birlikte, tutuş noktası etrafında küçük dikey hareket + hafif dönüş.
  const pumpStyle = {
    transform: [
      { translateY: pump.interpolate({ inputRange: [-1, 1], outputRange: [-9 * move, 9 * move] }) },
      { rotate: pump.interpolate({ inputRange: [-1, 1], outputRange: [`${-2.8 * move}deg`, `${2.8 * move}deg`] }) }
    ]
  };

  // Halka: açılışta bir nefes, kavrama anında çok hafif bir karşılık.
  const ringStyle = {
    transform: [
      { scale: settle.interpolate({ inputRange: [0, 1], outputRange: [NATIVE_SCALE, 1] }) },
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.035 * move] }) },
      { scale: squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.018 * move] }) }
    ]
  };
  const rippleStyle = {
    opacity: ripple.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0, reduced ? 0 : 0.26, 0] }),
    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.5] }) }]
  };

  return (
    <Animated.View
      onLayout={onFirstLayout}
      accessibilityLabel="OrtakSat açılıyor"
      accessibilityRole="progressbar"
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.root, {
        opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }]
      }]}
    >
      <View style={[styles.logoBox, { transform: [{ translateY: shiftY }] }]}>
        {/* Kavrama anında dışa yayılan tek ince dalga (logonun arkasında başka hiçbir şekil yok). */}
        <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Image source={RING} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.grip, pumpStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.grip, leftStyle]}>
            <Image source={HAND_LEFT} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.grip, rightStyle]}>
            <Image source={HAND_RIGHT} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
        </Animated.View>
        {/* Son kare: özgün logo, parçaların ÜSTÜNE erir (kenar farklarını örter). Altına zemin KONMAZ:
            zeminle birlikte eriyince logo bir an soluk görünüyordu (kayıtta "yıkanmış" kare). */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: exact }]}>
          <Image source={BRAND} style={[StyleSheet.absoluteFill, styles.fill]} contentFit="contain" transition={0} />
        </Animated.View>
      </View>
      <View pointerEvents="none" style={[styles.wordWrap, { transform: [{ translateY: shiftY }] }]}>
        <Animated.View style={{
          opacity: word,
          transform: [
            { translateY: word.interpolate({ inputRange: [0, 1], outputRange: [18 * move, 0] }) },
            { scale: word.interpolate({ inputRange: [0, 1], outputRange: [1 - 0.06 * move, 1] }) }
          ]
        }}>
          <Text style={styles.word} allowFontScaling={false}><Text style={styles.wordDark}>Ortak</Text><Text style={styles.wordBlue}>Sat</Text></Text>
        </Animated.View>
        <Animated.View style={{ opacity: slogan, transform: [{ translateY: slogan.interpolate({ inputRange: [0, 1], outputRange: [8 * move, 0] }) }] }}>
          <Text style={styles.slogan} allowFontScaling={false}>Al, Sat, Ortak Ol</Text>
        </Animated.View>
        {/* Uygulama geç hazır olursa beliren bekleme noktaları (zamanında hazırsa hiç görünmez) */}
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {dots.current.map((opacity, k) => <Animated.View key={k} style={[styles.dot, { opacity }]} />)}
        </View>
      </View>
    </Animated.View>
  );
}

/** Kısa açılış sesi: kısık, sessiz moda saygılı, hata olursa sessizce atlanır (ses hiçbir şeyi bloklamaz). */
async function playChime() {
  try {
    if ((await AsyncStorage.getItem(INTRO_SOUND_OFF_KEY)) === "1") return;
    // Tembel yükleme: ses modülü yalnız açılışta, yalnız uygulamada gerekir (eski derlemede yoksa sessiz devam eder).
    const audio = require("expo-audio") as typeof import("expo-audio");
    // iOS: sessiz anahtarı açıksa çalma; başka uygulamanın müziğini kesme (karıştır).
    await audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
    const player = audio.createAudioPlayer(require("../assets/sounds/intro.wav"));
    player.volume = 0.55;
    player.play();
    setTimeout(() => { try { player.remove(); } catch { /* zaten bırakılmış */ } }, 3200);
  } catch {
    /* ses modülü yoksa (eski derleme) ya da çalınamadıysa: animasyon sessiz devam eder */
  }
}

const styles = StyleSheet.create({
  root: { alignItems: "center", backgroundColor: BACKGROUND, justifyContent: "center", zIndex: 10000 },
  logoBox: { height: LOGO, width: LOGO },
  fill: { height: "100%", width: "100%" },
  // Ellerin TUTUŞ NOKTASI (parça görsellerinde ellerin ortası: yatay %49, dikey %82). Dönme ve ölçek buradan
  // yapılır; kutunun ortasından yapılınca eller halkanın merkezine bağlı sarkaç gibi yana savruluyordu.
  grip: { transformOrigin: "49% 82%" },
  ripple: { borderColor: "#0645C9", borderRadius: LOGO, borderWidth: 2, height: LOGO, left: 0, position: "absolute", top: 0, width: LOGO },
  // Logo tam ortada kalsın diye marka adı akışın dışında, logonun hemen altında konumlanır.
  wordWrap: { alignItems: "center", left: 0, position: "absolute", right: 0, top: "50%", marginTop: LOGO / 2 + 26 },
  word: { fontSize: 36, fontWeight: "900", letterSpacing: -0.5 },
  wordDark: { color: "#09275E" },
  wordBlue: { color: "#0645C9" },
  slogan: { color: "#4A5A7A", fontSize: 15, fontWeight: "700", marginTop: 4 },
  dots: { flexDirection: "row", gap: 8, marginTop: 22 },
  dot: { backgroundColor: "#0645C9", borderRadius: 4, height: 8, width: 8 }
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

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
 *   0,00 sn  halka "nefes alır" (hafif büyüyüp oturur), arkasında yumuşak bir ışık halesi belirir
 *   0,42 sn  iki el iki yandan, hafif eğik gelip halkanın altında BİRLEŞİR (≈ 1 sn, görülerek)
 *   1,42 sn  el sıkışma: küçük bir sıkma, üç kez azalan sallanma, dışa yayılan iki dalga
 *   1,80 sn  marka adı aşağıdan yükselir, ardından slogan belirir
 *   2,60 sn  kısa bekleyiş → katman eriyerek uygulamayı açar
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

/** Zaman çizelgesindeki [başlangıç, bitiş] (ms) aralığını, yumuşatma eğrisi örneklenmiş 0→1 ilerlemeye çevirir. */
function track(master: Animated.Value, startMs: number, endMs: number, ease: (t: number) => number = (t) => t) {
  const steps = 12;
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    inputRange.push(at(startMs + ((endMs - startMs) * i) / steps));
    outputRange.push(ease(i / steps));
  }
  return master.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
}

function buildTracks(master: Animated.Value) {
  return {
    // Halkanın açılıştaki tek "nefesi": 0 → 1 → 0 (büyüyüp oturur).
    breath: master.interpolate({ inputRange: [0, at(110), at(240), at(360), at(480)], outputRange: [0, 0.55, 1, 0.45, 0], extrapolate: "clamp" }),
    // Arkadaki ışık halesi: belirir ve sonuna kadar durur (son karedeki logo zemini haleyle AYNI renkte olmalı).
    halo: track(master, 0, 560, outCubic),
    hands: track(master, 420, 1420, outCubic), // 0: eller dışarıda → 1: birleşti
    // Birleşme anındaki sıkma: hızlı çık, geri esneyip otur.
    squeeze: master.interpolate({ inputRange: [at(1420), at(1540), at(1670), at(1780), at(1880)], outputRange: [0, 1, -0.22, 0.08, 0], extrapolate: "clamp" }),
    // El sıkışma sallanması: üç salınım, her biri bir öncekinden küçük (−1…1 arası; genlik stilde çarpılır).
    shake: master.interpolate({
      inputRange: [at(1500), at(1600), at(1720), at(1840), at(1950), at(2050), at(2140), at(2220)],
      outputRange: [0, -1, 0.8, -0.55, 0.36, -0.18, 0.07, 0],
      extrapolate: "clamp"
    }),
    rippleA: track(master, 1420, 2150, outCubic), // dışa yayılan birinci dalga
    rippleB: track(master, 1620, 2400, outCubic), // ikinci dalga (biraz gecikmeli)
    word: track(master, 1800, 2280, outCubic), // marka adı
    slogan: track(master, 2060, 2500, inOutSine), // slogan
    exact: track(master, 2380, 2560) // özgün logoya çapraz geçiş (piksel-tam son kare)
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
  const { breath, halo, hands, squeeze, shake, rippleA, rippleB, word, slogan, exact } = tracks.current;

  const laidOut = useRef(false);
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
  const handOpacity = hands.interpolate({ inputRange: [0, reduced ? 1 : 0.16, 1], outputRange: [0, 1, 1] });
  const handScale = squeeze.interpolate({ inputRange: [-1, 0, 1], outputRange: [1 - 0.08 * move, 1, 1 + 0.08 * move] });
  const leftStyle = {
    opacity: handOpacity,
    transform: [
      { translateX: hands.interpolate({ inputRange: [0, 1], outputRange: [-LOGO * 1.05 * move, 0] }) },
      { translateY: hands.interpolate({ inputRange: [0, 0.6, 1], outputRange: [LOGO * 0.16 * move, LOGO * 0.03 * move, 0] }) },
      { rotate: hands.interpolate({ inputRange: [0, 1], outputRange: [`${-20 * move}deg`, "0deg"] }) },
      { scale: handScale }
    ]
  };
  const rightStyle = {
    opacity: handOpacity,
    transform: [
      { translateX: hands.interpolate({ inputRange: [0, 1], outputRange: [LOGO * 1.05 * move, 0] }) },
      { translateY: hands.interpolate({ inputRange: [0, 0.6, 1], outputRange: [LOGO * 0.16 * move, LOGO * 0.03 * move, 0] }) },
      { rotate: hands.interpolate({ inputRange: [0, 1], outputRange: [`${20 * move}deg`, "0deg"] }) },
      { scale: handScale }
    ]
  };

  // Sallanma: birleşen eller birlikte, küçük dikey hareket + hafif dönüşle (el sıkışma hissi).
  const shakeStyle = {
    transform: [
      { translateY: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9 * move, 9 * move] }) },
      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: [`${-3.2 * move}deg`, `${3.2 * move}deg`] }) }
    ]
  };

  const ringStyle = {
    transform: [
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.06 * move] }) },
      { scale: squeeze.interpolate({ inputRange: [-1, 0, 1], outputRange: [1 - 0.03 * move, 1, 1 + 0.03 * move] }) }
    ]
  };
  const rippleStyle = (progress: Animated.AnimatedInterpolation<number>, peak: number) => ({
    opacity: progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, peak, 0] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, reduced ? 0.9 : 1.62] }) }]
  });

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
      <View style={styles.logoBox}>
        {/* Arkadaki yumuşak ışık halesi: logoyu zeminden ayırır, açılışın ilk anında bile hareket vardır. */}
        <Animated.View pointerEvents="none" style={[styles.halo, {
          opacity: halo,
          transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.72, 1] }) }]
        }]} />
        {/* Buluşma anında dışa yayılan iki ince dalga */}
        <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle(rippleA, 0.42)]} />
        <Animated.View pointerEvents="none" style={[styles.ripple, styles.rippleThin, rippleStyle(rippleB, 0.3)]} />
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Image source={RING} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
            <Image source={HAND_LEFT} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
            <Image source={HAND_RIGHT} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
        </Animated.View>
        {/* Son kare: özgün logo, parçaların ÜSTÜNE erir (kenar farklarını örter). Altına zemin KONMAZ:
            zeminle birlikte eriyince logo bir an soluk görünüyordu (kayıtta "yıkanmış" kare). */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: exact }]}>
          <Image source={BRAND} style={[StyleSheet.absoluteFill, styles.fill]} contentFit="contain" transition={0} />
        </Animated.View>
      </View>
      <View pointerEvents="none" style={styles.wordWrap}>
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

const HALO = LOGO * 1.62;

const styles = StyleSheet.create({
  root: { alignItems: "center", backgroundColor: BACKGROUND, justifyContent: "center", zIndex: 10000 },
  logoBox: { height: LOGO, width: LOGO },
  fill: { height: "100%", width: "100%" },
  // Hale: zeminden bir ton açık, yumuşak kenarlı daire (logonun arkasında, ortalanmış).
  halo: {
    backgroundColor: "#F4F8FF", borderColor: "#FFFFFF", borderRadius: HALO, borderWidth: 7, height: HALO, width: HALO,
    left: (LOGO - HALO) / 2, position: "absolute", top: (LOGO - HALO) / 2
  },
  ripple: { borderColor: "#0645C9", borderRadius: LOGO, borderWidth: 3, height: LOGO, left: 0, position: "absolute", top: 0, width: LOGO },
  rippleThin: { borderWidth: 2 },
  // Logo tam ortada kalsın diye marka adı akışın dışında, logonun hemen altında konumlanır.
  wordWrap: { alignItems: "center", left: 0, position: "absolute", right: 0, top: "50%", marginTop: LOGO / 2 + 26 },
  word: { fontSize: 36, fontWeight: "900", letterSpacing: -0.5 },
  wordDark: { color: "#09275E" },
  wordBlue: { color: "#0645C9" },
  slogan: { color: "#4A5A7A", fontSize: 15, fontWeight: "700", marginTop: 4 },
  dots: { flexDirection: "row", gap: 8, marginTop: 22 },
  dot: { backgroundColor: "#0645C9", borderRadius: 4, height: 8, width: 8 }
});

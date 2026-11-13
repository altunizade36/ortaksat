import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { isMobileApp } from "@/lib/mobile-app";

/** Açılış sesi şimdilik tümden kapalı (yukarıdaki nota bak). false iken ses çalmaz, Ayarlar'daki anahtar da gizlenir. */
export const INTRO_SOUND_ENABLED = false;

/** Kullanıcı açılış sesini kapattıysa "1" (Ayarlar → Açılış sesi). */
export const INTRO_SOUND_OFF_KEY = "ortaksat.introSoundOff";

const BACKGROUND = "#E5F0FF"; // app.json → expo-splash-screen backgroundColor ile AYNI (geçiş görünmesin)
const LOGO = 220; // app.json → imageWidth ile AYNI
const HOLD_AFTER_MS = 650; // animasyon bittikten sonra en az bu kadar görünür kalır
const MAX_WAIT_MS = 3600; // uygulama verisi gecikse de açılış en geç bu sürede kapanır

/**
 * UYGULAMA AÇILIŞ ANİMASYONU (yalnız iOS/Android, soğuk açılışta bir kez).
 *
 * Yerel açılış ekranı yalnız mavi HALKAYI gösterir; bu katman aynı halkayı aynı yerde çizer, sonra
 * iki el iki yandan gelip halkanın altında BİRLEŞİR (el sıkışma), halka hafifçe nabız atar, marka adı
 * belirir ve katman eriyerek uygulamayı açar. "Hareketi azalt" açıksa eller kaymaz, yalnız kısa bir geçiş olur.
 *
 * SES KAPALI (INTRO_SOUND_ENABLED = false). Kullanıcı 2026-11-13'te açılışta YALNIZ animasyon istedi;
 * denenen sesleri (üç notalı çan, konuşan ses, koro/synth vokal, müzik kutusu melodisi, piyano cümlesi)
 * beğenmedi. Yeniden açılacaksa önce kullanıcının onayladığı gerçek bir ses dosyası gerekir — bilgisayarla
 * üretilmiş melodi koyup açma. Açılırsa ses telefonun sessiz anahtarına uyar ve Ayarlar'dan kapatılabilir.
 */
const TIMELINE_MS = 2140; // hareketin tamamı (eller 980 ms'de birleşir, ardından sıkışma + marka adı)

/** Zaman çizelgesindeki [başlangıç, bitiş] (ms) aralığını, yumuşatma eğrisi örneklenmiş 0→1 ilerlemeye çevirir. */
function track(master: Animated.Value, startMs: number, endMs: number, ease: (t: number) => number = (t) => t) {
  const steps = 10;
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    inputRange.push((startMs + ((endMs - startMs) * i) / steps) / TIMELINE_MS);
    outputRange.push(ease(i / steps));
  }
  return master.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
}

function buildTracks(master: Animated.Value) {
  const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const at = (ms: number) => ms / TIMELINE_MS;
  return {
    hands: track(master, 120, 1100, outCubic), // 0: eller dışarıda → 1: birleşti
    // birleşme anındaki küçük sıkma: hızlı çık, hafif geri esneyerek otur
    squeeze: master.interpolate({ inputRange: [at(1100), at(1250), at(1390), at(1500), at(1600)], outputRange: [0, 1, -0.12, 0.05, 0], extrapolate: "clamp" }),
    pulse: track(master, 1100, 1840, outCubic), // dışa yayılan halka
    shake: track(master, 1180, 1840, inOutQuad), // birleşen ellerin iki kez hafifçe sallanması
    exact: track(master, 1860, 2040), // özgün logoya çapraz geçiş
    word: track(master, 1500, 1980, outCubic) // marka adı
  };
}

export function IntroSplash({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(isMobileApp);
  const [animationDone, setAnimationDone] = useState(false);
  const started = useRef(false);
  // TEK ZAMAN ÇİZELGESİ: bütün hareket tek bir değerin (0→1) doğrusal ilerleyişinden türetilir ve yerel
  // (native) sürücüde çalışır. Eskiden adımlar art arda JS geri çağrılarıyla ve JS zamanlayıcılı
  // gecikmelerle başlatılıyordu; açılışta JS meşgulken (uygulama kuruluyor) eller birleştikten sonra
  // animasyon takılıp bekliyordu. Artık başladıktan sonra JS ne kadar meşgul olursa olsun akıcı ilerler.
  const master = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current; // katmanın erimesi
  const tracks = useRef<ReturnType<typeof buildTracks> | null>(null);
  if (!tracks.current) tracks.current = buildTracks(master);
  const { hands, squeeze, shake, pulse, exact, word } = tracks.current;
  const laidOut = useRef(false);
  const loaded = useRef(0);

  const begin = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().catch(() => {});
    void run();
  };
  // Hareket, katman yerleşip üç parça görsel (halka + iki el) çözüldükten sonra başlar; görsel geç
  // gelirse eller yolun ortasında belirmesin. Görsel hiç gelmezse 450 ms sonra yine başlar.
  const onFirstLayout = () => {
    if (laidOut.current) return;
    laidOut.current = true;
    if (loaded.current >= 3) begin();
    else setTimeout(begin, 450);
  };
  const onPartLoad = () => {
    loaded.current += 1;
    if (loaded.current >= 3 && laidOut.current) begin();
  };

  async function run() {
    let reduceMotion = false;
    try { reduceMotion = await AccessibilityInfo.isReduceMotionEnabled(); } catch { /* varsayılan: hareket açık */ }
    if (reduceMotion) {
      master.setValue(1);
      setAnimationDone(true);
      return;
    }
    if (INTRO_SOUND_ENABLED) void playChime();
    Animated.timing(master, { toValue: 1, duration: TIMELINE_MS, easing: Easing.linear, useNativeDriver: true }).start(() => setAnimationDone(true));
  }


  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  useEffect(() => {
    if (!visible || !animationDone || !(ready || timedOut)) return;
    const timer = setTimeout(() => {
      Animated.timing(out, { toValue: 1, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setVisible(false));
    }, timedOut ? 0 : HOLD_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, animationDone, ready, timedOut, out]);

  if (!visible) return null;

  const leftStyle = {
    opacity: hands.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: hands.interpolate({ inputRange: [0, 1], outputRange: [-LOGO * 0.92, 0] }) },
      { translateY: hands.interpolate({ inputRange: [0, 1], outputRange: [LOGO * 0.1, 0] }) },
      { rotate: hands.interpolate({ inputRange: [0, 1], outputRange: ["-16deg", "0deg"] }) },
      { scale: squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }
    ]
  };
  const rightStyle = {
    opacity: hands.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: hands.interpolate({ inputRange: [0, 1], outputRange: [LOGO * 0.92, 0] }) },
      { translateY: hands.interpolate({ inputRange: [0, 1], outputRange: [LOGO * 0.1, 0] }) },
      { rotate: hands.interpolate({ inputRange: [0, 1], outputRange: ["16deg", "0deg"] }) },
      { scale: squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }
    ]
  };

  // Sallanma, ellerin birleştiği nokta (kutunun alt-ortası) çevresinde: küçük dikey hareket + hafif dönüş.
  const shakeStyle = {
    transform: [
      { translateY: shake.interpolate({ inputRange: [0, 0.2, 0.45, 0.7, 1], outputRange: [0, -7, 5, -3, 0] }) },
      { rotate: shake.interpolate({ inputRange: [0, 0.2, 0.45, 0.7, 1], outputRange: ["0deg", "-2.5deg", "2deg", "-1deg", "0deg"] }) }
    ]
  };

  return (
    <Animated.View
      onLayout={onFirstLayout}
      accessibilityLabel="OrtakSat açılıyor"
      accessibilityRole="progressbar"
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, styles.root, {
        opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }]
      }]}
    >
      <View style={styles.logoBox}>
        {/* Buluşma anında dışa yayılan ince halka */}
        <Animated.View pointerEvents="none" style={[styles.pulse, {
          opacity: pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.34, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.5] }) }]
        }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: squeeze.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]}>
          <Image source={require("../assets/splash/ring.png")} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
            <Image source={require("../assets/splash/hand-left.png")} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
            <Image source={require("../assets/splash/hand-right.png")} style={styles.fill} contentFit="contain" transition={0} priority="high" onLoad={onPartLoad} onError={onPartLoad} />
          </Animated.View>
        </Animated.View>
        {/* Son kare: özgün logo (katmanların birleşimindeki küçük kenar farklarını örter) */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: exact }]}>
          <View style={[styles.fill, { backgroundColor: BACKGROUND }]} />
          <Image source={require("../assets/brand-head-blue.png")} style={[StyleSheet.absoluteFill, styles.fill]} contentFit="contain" transition={0} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.wordWrap, {
        opacity: word,
        transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
      }]}>
        <Text style={styles.word} allowFontScaling={false}><Text style={{ color: "#09275E" }}>Ortak</Text><Text style={{ color: "#0645C9" }}>Sat</Text></Text>
        <Text style={styles.slogan} allowFontScaling={false}>Al, Sat, Ortak Ol</Text>
      </Animated.View>
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
  pulse: { borderColor: "#0645C9", borderRadius: LOGO, borderWidth: 3, height: LOGO, left: 0, position: "absolute", top: 0, width: LOGO },
  // Logo tam ortada kalsın diye marka adı akışın dışında, logonun hemen altında konumlanır.
  wordWrap: { alignItems: "center", left: 0, position: "absolute", right: 0, top: "50%", marginTop: LOGO / 2 + 18 },
  word: { fontSize: 34, fontWeight: "900", letterSpacing: -0.5 },
  slogan: { color: "#4A5A7A", fontSize: 14.5, fontWeight: "700", marginTop: 4 }
});

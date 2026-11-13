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
const MAX_WAIT_MS = 4800; // uygulama verisi gecikse de açılış en geç bu sürede kapanır

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
export function IntroSplash({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(isMobileApp);
  const [animationDone, setAnimationDone] = useState(false);
  const started = useRef(false);
  const hands = useRef(new Animated.Value(0)).current; // 0: eller dışarıda → 1: birleşti
  const squeeze = useRef(new Animated.Value(0)).current; // birleşme anındaki küçük sıkma
  const shake = useRef(new Animated.Value(0)).current; // birleşen ellerin iki kez hafifçe sallanması (el sıkışma)
  const pulse = useRef(new Animated.Value(0)).current; // dışa yayılan halka
  const exact = useRef(new Animated.Value(0)).current; // özgün logoya çapraz geçiş (piksel-tam son kare)
  const word = useRef(new Animated.Value(0)).current; // marka adı
  const out = useRef(new Animated.Value(0)).current; // katmanın erimesi

  // Bu ilk kare çizilince yerel açılış ekranını kaldır: altında aynı renk + aynı halka var → sıçrama olmaz.
  const onFirstLayout = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().catch(() => {});
    void run();
  };

  async function run() {
    let reduceMotion = false;
    try { reduceMotion = await AccessibilityInfo.isReduceMotionEnabled(); } catch { /* varsayılan: hareket açık */ }
    if (reduceMotion) {
      hands.setValue(1); exact.setValue(1); shake.setValue(1);
      Animated.timing(word, { toValue: 1, duration: 260, useNativeDriver: true }).start(() => setAnimationDone(true));
      return;
    }
    if (INTRO_SOUND_ENABLED) void playChime();
    // TEMPO (kullanıcı isteği, 2026-11-13): eller GÖRÜLEREK yaklaşsın — eski telefon açılışlarındaki gibi
    // sakin bir buluşma. Yaklaşma ~1 sn, sıkışma + sallanma ~0,9 sn; toplam açılış yaklaşık 3 sn'yi geçmez.
    Animated.sequence([
      Animated.delay(160),
      // Eller iki yandan gelir ve tam ortada buluşur (sıçramasız, yavaşlayarak).
      Animated.timing(hands, { toValue: 1, duration: 980, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        // Buluşma: küçük bir sıkma + dışa yayılan nabız + özgün logoya geçiş.
        Animated.sequence([
          Animated.timing(squeeze, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(squeeze, { toValue: 0, friction: 5, tension: 110, useNativeDriver: true })
        ]),
        Animated.timing(pulse, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        // El sıkışma: birleşen eller iki kez hafifçe aşağı-yukarı sallanır.
        Animated.timing(shake, { toValue: 1, duration: 680, delay: 80, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(exact, { toValue: 1, duration: 200, delay: 780, useNativeDriver: true }),
        Animated.timing(word, { toValue: 1, duration: 480, delay: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ])
    ]).start(() => setAnimationDone(true));
  }

  // Animasyon bitti + (uygulama hazır ya da üst süre doldu) → kısa bir bekleyişten sonra eriyerek kapan.
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
          <Image source={require("../assets/splash/ring.png")} style={styles.fill} contentFit="contain" transition={0} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
            <Image source={require("../assets/splash/hand-left.png")} style={styles.fill} contentFit="contain" transition={0} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
            <Image source={require("../assets/splash/hand-right.png")} style={styles.fill} contentFit="contain" transition={0} />
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

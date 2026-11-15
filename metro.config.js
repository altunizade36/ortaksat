// Paketleyici (Metro) ayarı: uygulama kodu olmayan büyük klasörler İZLENMEZ.
//
// Neden (2026-11-15): ayar dosyası yokken paketleyici proje kökündeki her şeyi izliyordu — test tarayıcıları ve
// Node çalışma zamanı (audit/), web derleme çıktıları (dist-web/, dist-check-*/), dağıtım önbelleği (.vercel/),
// yerel Android derlemesi (android/). Bu klasörlerde binlerce dosya oluşup silinince (her web derlemesinde olur)
// telefon için çalışan sunucu %100 işlemciyle dakikalarca kilitleniyor, telefonda görseller boş geliyor ya da
// "Something went wrong" çıkıyordu. Bu klasörlerde uygulamanın içe aktardığı hiçbir dosya yoktur.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootPattern = __dirname.split(/[\\/]/).map(escapeRegex).join("[\\\\/]");
const ignoredFolders = ["audit", "dist", "dist-web", "dist-check-[^\\\\/]*", "\\.vercel", "android", "ios", "playwright-report", "test-results", "e2e-artifacts"];
const ignored = new RegExp(`^${rootPattern}[\\\\/](?:${ignoredFolders.join("|")})(?:[\\\\/].*)?$`);

const previous = config.resolver.blockList;
config.resolver.blockList = [].concat(previous ? previous : [], ignored);

module.exports = config;

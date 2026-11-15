# Vercel güvenlik duvarı — Türkiye dışı erişim kuralları (2026-11-16).
#
# Proje kökünden çalıştır:
#   python scripts/vercel-firewall.py durum          → etkin kuralları ve bot korumasını gösterir
#   python scripts/vercel-firewall.py kapat          → "Türkiye dışı erişim" kuralını KAPATIR (site her ülkeden açılır)
#   python scripts/vercel-firewall.py ac             → kuralı yeniden AÇAR
#   python scripts/vercel-firewall.py kur            → kurallar hiç yoksa scripts/firewall-rules.json'dan kurar
#   python scripts/vercel-firewall.py guncelle       → firewall-rules.json'daki değişikliği kurulu kurallara işler (ada göre eşler)
#
# Erişim anahtarı .env içindeki VERCEL_TOKEN'dan okunur; hiçbir yere yazdırılmaz.
# Kuralların ne yaptığı ve muaf adresler: scripts/firewall-rules.json. Ücretsiz planda en çok 3 özel kural olur.
import json, os, sys, urllib.request, urllib.error

PROJECT = "prj_jfXjc5NkBfaNOJaUXmUE4O09fKep"
TEAM = "team_Sy48TubgrQ9rFn5ULSY3yr2j"
GEO_RULE_NAME = "Türkiye dışı erişim"
RULES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firewall-rules.json")
BASE = "https://api.vercel.com/v1/security/firewall/config"
QUERY = f"?projectId={PROJECT}&teamId={TEAM}"


def token():
    env = dict(l.strip().split("=", 1) for l in open(".env", encoding="utf-8") if "=" in l and not l.startswith("#"))
    return env["VERCEL_TOKEN"].strip().strip('"')


def call(method, url, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:600]}


def config():
    status, cfg = call("GET", BASE + "/active" + QUERY)
    if status != 200:
        sys.exit(f"Ayarlar okunamadı ({status}): {json.dumps(cfg, ensure_ascii=False)[:400]}")
    return cfg


def show(cfg):
    print("Güvenlik duvarı açık:", cfg.get("firewallEnabled"))
    bot = (cfg.get("managedRules") or {}).get("bot_protection") or {}
    print("Bot koruması:", "kapalı" if not bot.get("active") else f"açık ({bot.get('action')})")
    rules = cfg.get("rules") or []
    if not rules:
        print("Özel kural yok.")
    for index, rule in enumerate(rules, 1):
        print(f"{index}. [{'AÇIK' if rule.get('active') else 'KAPALI'}] {rule.get('name')} → {rule['action']['mitigate']['action']}")


def set_geo(active):
    rule = next((r for r in config().get("rules") or [] if str(r.get("name", "")).startswith(GEO_RULE_NAME)), None)
    if not rule:
        sys.exit("Türkiye dışı erişim kuralı bulunamadı. Önce: python scripts/vercel-firewall.py kur")
    value = {key: rule[key] for key in ("name", "description", "conditionGroup", "action") if key in rule}
    value["active"] = active
    status, result = call("PATCH", BASE + QUERY, {"action": "rules.update", "id": rule["id"], "value": value})
    if status != 200:
        sys.exit(f"Kural güncellenemedi ({status}): {json.dumps(result, ensure_ascii=False)[:400]}")
    show(config())


def install():
    if config().get("rules"):
        sys.exit("Kurallar zaten kurulu. Değiştirmek için önce panelden silin ya da 'kapat' kullanın.")
    for body in json.load(open(RULES_FILE, encoding="utf-8")):
        status, result = call("PATCH", BASE + QUERY, body)
        print(body["value"]["name"], "→", status, json.dumps(result, ensure_ascii=False)[:300])
    show(config())


def update():
    live = {str(r.get("name")): r for r in config().get("rules") or []}
    for body in json.load(open(RULES_FILE, encoding="utf-8")):
        value = body["value"]
        rule = live.get(value["name"])
        if not rule:
            print(value["name"], "→ kurulu değil, atlandı (önce 'kur')")
            continue
        # Açık/kapalı durumu canlıdaki gibi kalır: 'kapat' ile kapatılmış kural güncellemeyle sessizce açılmasın.
        payload = {key: value[key] for key in ("name", "description", "conditionGroup", "action")}
        payload["active"] = bool(rule.get("active"))
        status, result = call("PATCH", BASE + QUERY, {"action": "rules.update", "id": rule["id"], "value": payload})
        print(value["name"], "→", status, json.dumps(result, ensure_ascii=False)[:300])
    show(config())


command = sys.argv[1] if len(sys.argv) > 1 else "durum"
if command == "durum":
    show(config())
elif command == "kapat":
    set_geo(False)
elif command == "ac":
    set_geo(True)
elif command == "kur":
    install()
elif command == "guncelle":
    update()
else:
    sys.exit("Kullanım: python scripts/vercel-firewall.py durum | kapat | ac | kur | guncelle")

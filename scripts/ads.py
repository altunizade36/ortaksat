"""
Web sitesindeki yan reklam alanları (Google AdSense): kurulum ve aç / kapat.

    python scripts/ads.py durum
    python scripts/ads.py kur ca-pub-XXXXXXXXXXXXXXXX 1234567890   # yayıncı kimliği + yan reklam biriminin numarası
    python scripts/ads.py ac        # yalnız AdSense siteyi onayladıktan ve kimlikler yayına girdikten sonra
    python scripts/ads.py kapat     # istenmeyen bir reklam görülürse: anında, yeniden yayın gerekmez

"kur" yalnız dosyaları yazar (lib/ads-config.ts + public/ads.txt); canlıya çıkması için commit + push gerekir.
"ac" / "kapat" sunucudaki anahtarı değiştirir (platform_settings.ads_enabled); açık sayfalar birkaç saniyede güncellenir.
Anahtarlar .env'den okunur.
"""
import io, json, re, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
CONFIG = "lib/ads-config.ts"
ADS_TXT = "public/ads.txt"

def env():
    values = {}
    for line in open(".env", encoding="utf-8"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            values[m[1]] = m[2].strip().strip("\"'")
    return values

def sql(query):
    e = env()
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{e['SUPABASE_PROJECT_REF']}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": "Bearer " + e["SUPABASE_MGMT_TOKEN"], "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode())

def read_config():
    text = io.open(CONFIG, encoding="utf-8", newline="").read()
    client = re.search(r'const FILE_CLIENT = "([^"]*)";', text)
    slot = re.search(r'const FILE_SIDE_SLOT = "([^"]*)";', text)
    return text, (client[1] if client else ""), (slot[1] if slot else "")

command = sys.argv[1] if len(sys.argv) > 1 else "durum"
if command == "kur":
    if len(sys.argv) != 4 or not re.fullmatch(r"ca-pub-\d{10,20}", sys.argv[2]) or not re.fullmatch(r"\d{6,20}", sys.argv[3]):
        sys.exit("Kullanım: python scripts/ads.py kur ca-pub-XXXXXXXXXXXXXXXX <reklam birimi no>")
    client, slot = sys.argv[2], sys.argv[3]
    text, _, _ = read_config()
    text = re.sub(r'const FILE_CLIENT = "[^"]*";', f'const FILE_CLIENT = "{client}";', text)
    text = re.sub(r'const FILE_SIDE_SLOT = "[^"]*";', f'const FILE_SIDE_SLOT = "{slot}";', text)
    io.open(CONFIG, "w", encoding="utf-8", newline="").write(text)
    # ads.txt: yetkili satıcı bildirimi. f08c47fec0942fa0 Google'ın sabit sertifika kimliğidir.
    io.open(ADS_TXT, "w", encoding="utf-8", newline="\n").write(f"google.com, {client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n")
    print("Yazıldı:", CONFIG, "+", ADS_TXT, "→ çerez politikasını güncelle, commit + push et.")
elif command in ("ac", "kapat"):
    _, client, slot = read_config()
    if command == "ac" and not (client and slot):
        sys.exit("Önce kimlikleri kur: python scripts/ads.py kur ca-pub-… <reklam birimi no>")
    sql(f"update public.platform_settings set ads_enabled = {'true' if command == 'ac' else 'false'} where id = 1")
elif command != "durum":
    sys.exit("Kullanım: python scripts/ads.py durum | kur <ca-pub-…> <birim no> | ac | kapat")

_, client, slot = read_config()
row = sql("select ads_enabled from public.platform_settings where id = 1")
print("Kimlikler:", f"{client} / birim {slot}" if client and slot else "TANIMLI DEĞİL")
print("Reklam alanları:", "AÇIK" if row and row[0].get("ads_enabled") else "KAPALI")

"""
Web sitesindeki "App Store'dan indir" bağlantılarını açar / kapatır (platform_settings.ios_app_link).

    python scripts/app-link.py durum
    python scripts/app-link.py ac        # yalnız düzeltilmiş sürüm mağazada yayındayken
    python scripts/app-link.py kapat

Yeniden yayın gerekmez; açık sayfalar birkaç saniye içinde güncellenir. Anahtarlar .env'den okunur.
"""
import json, re, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
env = {}
for line in open(".env", encoding="utf-8"):
    m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
    if m:
        env[m[1]] = m[2].strip().strip("\"'")

def sql(query):
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{env['SUPABASE_PROJECT_REF']}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": "Bearer " + env["SUPABASE_MGMT_TOKEN"], "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode())

command = sys.argv[1] if len(sys.argv) > 1 else "durum"
if command in ("ac", "kapat"):
    sql(f"update public.platform_settings set ios_app_link = {'true' if command == 'ac' else 'false'} where id = 1")
elif command != "durum":
    sys.exit("Kullanım: python scripts/app-link.py durum | ac | kapat")
row = sql("select ios_app_link from public.platform_settings where id = 1")
print("Uygulama bağlantıları:", "AÇIK" if row and row[0].get("ios_app_link") else "KAPALI")

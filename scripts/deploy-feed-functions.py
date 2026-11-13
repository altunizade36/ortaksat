"""
XML bağlantısı işlevlerini (feed-fetch, feed-sync) yayınlar ve otomatik eşitleme zamanlayıcısını kurar.

    python scripts/deploy-feed-functions.py

Adımlar:
  1) lib/xml-feed.ts → supabase/functions/_shared/xml-feed.ts (TEK kaynak lib'dedir; kopyayı elle düzenleme)
  2) İki işlevi Management API ile yayınlar (feed-fetch oturum ister; feed-sync kendi denetimini yapar)
  3) FEED_SYNC_SECRET gizli anahtarını ve yarım saatlik pg_cron kaydını kurar (anahtar mevcut zamanlayıcıdan
     okunur; yoksa yenisi üretilir). Anahtar ekrana ve depoya yazılmaz.
Gerekli .env değerleri: SUPABASE_MGMT_TOKEN, SUPABASE_PROJECT_REF (ya da EXPO_PUBLIC_SUPABASE_URL).
"""
import io
import json
import os
import re
import secrets
import sys
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNCS = os.path.join(ROOT, "supabase", "functions")


def env():
    out = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8", errors="ignore"):
        m = re.match(r"^([A-Z0-9_]+)\s*=\s*[\"']?([^\"'\r\n]*)", line)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


E = env()
REF = E.get("SUPABASE_PROJECT_REF") or re.match(r"https://([^.]+)\.", E["EXPO_PUBLIC_SUPABASE_URL"]).group(1)
BASE = f"https://api.supabase.com/v1/projects/{REF}"
AUTH = {"Authorization": "Bearer " + E["SUPABASE_MGMT_TOKEN"], "User-Agent": "curl/8.5.0"}


def call(path, method="GET", body=None, headers=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {**AUTH, **({"Content-Type": "application/json"} if raw is None and body is not None else {}), **(headers or {})}
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


def sql(query):
    status, data = call("/database/query", "POST", {"query": query})
    if status >= 300:
        raise RuntimeError(f"SQL {status}: {data}")
    return data


def read(path):
    return io.open(path, encoding="utf-8").read()


def deploy(slug, verify_jwt):
    files = {
        "index.ts": read(os.path.join(FUNCS, slug, "index.ts")).replace('"../_shared/', '"./_shared/'),
        "_shared/feed-http.ts": read(os.path.join(FUNCS, "_shared", "feed-http.ts")),
    }
    if slug == "feed-sync":
        files["_shared/feed-plan.ts"] = read(os.path.join(FUNCS, "_shared", "feed-plan.ts"))
        files["_shared/xml-feed.ts"] = read(os.path.join(FUNCS, "_shared", "xml-feed.ts"))
    boundary = "----ortaksat" + uuid.uuid4().hex
    parts = []
    meta = {"name": slug, "entrypoint_path": "index.ts", "verify_jwt": verify_jwt}
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n'.encode())
    for name, content in files.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/typescript\r\n\r\n'.encode() + content.encode("utf-8") + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    status, out = call(f"/functions/deploy?slug={slug}", "POST", raw=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    print(f"işlev {slug}: {status}", (out if status >= 300 else f"sürüm {out.get('version')} {out.get('status')}"))
    return status < 300


def main():
    # 1) Ayrıştırıcının kopyası
    src = read(os.path.join(ROOT, "lib", "xml-feed.ts"))
    header = "// OTOMATİK KOPYA — kaynak: lib/xml-feed.ts. Burada düzenleme; scripts/deploy-feed-functions.py yeniden yazar.\n"
    io.open(os.path.join(FUNCS, "_shared", "xml-feed.ts"), "w", encoding="utf-8", newline="\n").write(header + src)

    # 2) Zamanlayıcı anahtarı: varsa mevcut kayıttan oku, yoksa üret
    existing = sql("select command from cron.job where jobname = 'feed-sync'")
    secret = None
    if existing:
        m = re.search(r'"x-feed-secret"\s*:\s*"([A-Za-z0-9_-]{20,})"', existing[0]["command"])
        secret = m.group(1) if m else None
    if not secret:
        secret = secrets.token_urlsafe(36)
    status, out = call("/secrets", "POST", [{"name": "FEED_SYNC_SECRET", "value": secret}])
    print("gizli anahtar ayarlandı:", status, (out if status >= 300 else ""))

    ok = deploy("feed-fetch", True) and deploy("feed-sync", False)
    if not ok:
        sys.exit(1)

    # 3) Yarım saatte bir tetikle
    command = (
        "select net.http_post(url := 'https://" + REF + ".supabase.co/functions/v1/feed-sync', "
        "headers := '{\"Content-Type\":\"application/json\",\"x-feed-secret\":\"" + secret + "\"}'::jsonb, "
        "body := '{}'::jsonb, timeout_milliseconds := 8000)"
    )
    sql("select cron.unschedule(jobid) from cron.job where jobname = 'feed-sync'")
    sql("select cron.schedule('feed-sync', '*/30 * * * *', $cmd$" + command + "$cmd$)")
    print("zamanlayıcı:", sql("select jobname, schedule, active from cron.job where jobname = 'feed-sync'"))


if __name__ == "__main__":
    main()

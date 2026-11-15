"""
"Apple ile giriş" belirteç işlevini (supabase/functions/apple-token) yayınlar; isteğe bağlı olarak Apple anahtarlarını kurar.

    python scripts/deploy-apple-token.py                      → yalnız işlevi yayınlar
    python scripts/deploy-apple-token.py <AuthKey_XXXX.p8> <TEAM_ID>
        → işlevi yayınlar + APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_CLIENT_ID gizli anahtarlarını kurar.
          Anahtar kimliği dosya adından okunur (AuthKey_<KEY_ID>.p8). Anahtar içeriği ekrana ve depoya YAZILMAZ.

Apple Developer → Certificates, IDs & Profiles → Keys → yeni anahtar → "Sign in with Apple" işaretli → .p8 indir.
Ekip Kimliği: Apple Developer → Membership.
"""
import io, json, os, re, sys, urllib.request, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def deploy():
    src = io.open(os.path.join(ROOT, "supabase", "functions", "apple-token", "index.ts"), encoding="utf-8").read()
    boundary = "----ortaksat" + uuid.uuid4().hex
    meta = {"name": "apple-token", "entrypoint_path": "index.ts", "verify_jwt": True}
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n'.encode(),
             f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n'.encode() + src.encode("utf-8") + b"\r\n",
             f"--{boundary}--\r\n".encode()]
    status, out = call("/functions/deploy?slug=apple-token", "POST", raw=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    print("işlev apple-token:", status, out if status >= 300 else f"sürüm {out.get('version')} {out.get('status')}")
    return status < 300


if not deploy():
    sys.exit(1)
if len(sys.argv) >= 3:
    key_path, team_id = sys.argv[1], sys.argv[2].strip()
    m = re.search(r"AuthKey_([A-Z0-9]{10})\.p8$", os.path.basename(key_path))
    if not m:
        sys.exit("Dosya adı AuthKey_<KEY_ID>.p8 biçiminde olmalı.")
    pem = open(key_path, encoding="utf-8").read().strip()
    if "PRIVATE KEY" not in pem:
        sys.exit("Geçerli bir .p8 anahtar dosyası değil.")
    secrets = [{"name": "APPLE_TEAM_ID", "value": team_id}, {"name": "APPLE_KEY_ID", "value": m.group(1)},
               {"name": "APPLE_PRIVATE_KEY", "value": pem}, {"name": "APPLE_CLIENT_ID", "value": "com.ortaksat.app"}]
    status, out = call("/secrets", "POST", secrets)
    print("Apple anahtarları kuruldu:", status, out if status >= 300 else "")

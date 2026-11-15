# Mağaza İNCELEME HESABI (App Store / Google Play incelemecileri için giriş bilgisi).
#
# Proje kökünden:
#   python scripts/review-account.py olustur   → hesabı açar (e-postası onaylı), yeni şifreyi YALNIZ ekrana yazar
#   python scripts/review-account.py sifre     → şifreyi yeniler (her gönderimde yeni şifre önerilir)
#   python scripts/review-account.py sil       → hesabı ve bağlı verisini siler (inceleme bitince)
#   python scripts/review-account.py durum
#
# Hesap boş bir kullanıcıdır: ilan, mesaj, yorum ÜRETİLMEZ (sahte veri yasağı). İncelemeci uygulamayı
# gerçek içerikle gezer; isterse kendisi ilan açabilir. Şifre hiçbir dosyaya yazılmaz; mağaza panelinin
# "inceleme bilgileri" alanına elle girilir. Erişim .env içindeki SUPABASE_MGMT_TOKEN ile (yazdırılmaz).
import json, secrets, string, sys, urllib.request

EMAIL = "inceleme@ortaksat.com"
NAME = "Mağaza İnceleme"


def env():
    return dict(l.strip().split("=", 1) for l in open(".env", encoding="utf-8") if "=" in l and not l.startswith("#"))


E = env()
TOKEN = E["SUPABASE_MGMT_TOKEN"].strip().strip('"')
REF = E.get("SUPABASE_PROJECT_REF", "akyzzdwbzgsnhdircuce").strip().strip('"')


def sql(query):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
                                 data=json.dumps({"query": query}).encode("utf-8"), method="POST",
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8") or "[]")


def new_password():
    alphabet = string.ascii_letters + string.digits
    return "Os-" + "".join(secrets.choice(alphabet) for _ in range(14)) + "!7"


def user_id():
    rows = sql(f"select id from auth.users where email = '{EMAIL}' limit 1")
    return rows[0]["id"] if rows else None


cmd = sys.argv[1] if len(sys.argv) > 1 else "durum"
if cmd == "durum":
    uid = user_id()
    print("Hesap:", EMAIL, "→", "VAR" if uid else "yok")
elif cmd == "olustur":
    if user_id():
        sys.exit("Hesap zaten var. Şifreyi yenilemek için: python scripts/review-account.py sifre")
    pw = new_password()
    sql(f"""insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change,
            email_change_token_new, recovery_token)
          values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            '{EMAIL}', crypt('{pw}', gen_salt('bf')), now(), '{{"provider":"email","providers":["email"]}}'::jsonb,
            '{{"full_name":"{NAME}"}}'::jsonb, now(), now(), '', '', '', '')""")
    print("Hesap açıldı.\n  E-posta:", EMAIL, "\n  Şifre:  ", pw, "\nBu şifreyi mağaza panelindeki inceleme bilgilerine gir; başka yere kaydetme.")
elif cmd == "sifre":
    if not user_id():
        sys.exit("Hesap yok. Önce: python scripts/review-account.py olustur")
    pw = new_password()
    sql(f"update auth.users set encrypted_password = crypt('{pw}', gen_salt('bf')), updated_at = now() where email = '{EMAIL}'")
    print("Yeni şifre:", pw)
elif cmd == "sil":
    uid = user_id()
    if not uid:
        sys.exit("Hesap zaten yok.")
    sql(f"delete from auth.users where id = '{uid}'")
    print("Silindi:", EMAIL)
else:
    sys.exit("Kullanım: python scripts/review-account.py olustur | sifre | sil | durum")

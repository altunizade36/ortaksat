"""
Supabase kimlik doğrulama e-postalarını (kod, bildirim, davet) OrtakSat markasıyla ve Türkçe olarak ayarlar.

    python scripts/apply-auth-email-templates.py          # canlıya uygular
    python scripts/apply-auth-email-templates.py --dry    # yalnız üretir, göndermez

Neden: kod e-postaları eski turkuaz görünümdeydi; "şifren değişti", "giriş yöntemi eklendi" gibi güvenlik
bildirimleri ise Supabase'in İngilizce varsayılan metniyle gidiyordu (kullanıcı şifre sıfırlayınca İngilizce
e-posta alıyordu). Tüm şablonlar tek gövdeden üretilir: marka mavisi (#0645C9), yeşil/turkuaz yok.
Gerekli .env değerleri: SUPABASE_MGMT_TOKEN, SUPABASE_PROJECT_REF (ya da EXPO_PUBLIC_SUPABASE_URL).
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUPPORT = "destek@ortaksat.com"


def env():
    out = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8", errors="ignore"):
        m = re.match(r"^([A-Z0-9_]+)\s*=\s*[\"']?([^\"'\r\n]*)", line)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


CODE_BOX = """
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div class="os-code" style="display:inline-block;background:#EEF4FF;border:1px solid #BFD3FF;border-radius:12px;padding:16px 26px;font-size:34px;font-weight:800;letter-spacing:10px;color:#06318F;font-family:'SFMono-Regular',Consolas,Menlo,monospace;">{{ .Token }}</div>
          </td></tr></table>"""


def button(label, href):
    return f"""
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0645C9;border-radius:12px;">
            <a href="{href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:800;color:#FFFFFF;text-decoration:none;">{label}</a>
          </td></tr></table>"""


def page(title, intro, middle="", note="", footer="Bu e-postayı sen istemediysen dikkate alma; hesabın güvende."):
    note_html = f'\n          <p class="os-muted" style="margin:22px 0 0 0;font-size:13px;line-height:20px;color:#5B6B86;">{note}</p>' if note else ""
    return f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {{
    .os-bg {{ background:#0B1220 !important; }}
    .os-card {{ background:#111827 !important; }}
    .os-ink {{ color:#F1F5F9 !important; }}
    .os-muted {{ color:#9FB0CC !important; }}
    .os-brand {{ color:#E6EEFF !important; }}
    .os-code {{ background:#0B1220 !important; color:#9DBBFF !important; border-color:#24365C !important; }}
  }}
</style></head>
<body class="os-bg" style="margin:0;padding:0;background:#F1F5FB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="os-bg" style="background:#F1F5FB;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:6px 4px 18px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:38px;height:38px;vertical-align:middle;"><img src="https://www.ortaksat.com/logo-mark.png" width="38" height="38" alt="" style="display:block;border:0;border-radius:10px;"></td>
            <td class="os-brand" style="padding-left:10px;font-size:21px;font-weight:800;color:#09275E;">Ortak<span style="color:#0645C9;">Sat</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="os-card" style="background:#FFFFFF;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(9,39,94,.08);">
          <h1 class="os-ink" style="margin:0 0 10px 0;font-size:21px;font-weight:800;color:#0F172A;">{title}</h1>
          <p class="os-muted" style="margin:0 0 22px 0;font-size:14.5px;line-height:22px;color:#5B6B86;">{intro}</p>{middle}{note_html}
        </td></tr>
        <tr><td style="padding:18px 8px;text-align:center;">
          <p class="os-muted" style="margin:0 0 4px 0;font-size:12px;color:#5B6B86;">OrtakSat — ilan ve ortak satış platformu · ortaksat.com</p>
          <p class="os-muted" style="margin:0;font-size:11.5px;color:#5B6B86;">{footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
"""


NOT_ME = f"Bu değişikliği sen yapmadıysan hemen şifreni sıfırla ve bize yaz: {SUPPORT}"
SECURITY_FOOTER = "Bu e-posta hesap güvenliğin için otomatik gönderilmiştir."

TEMPLATES = {
    "confirmation": ("OrtakSat doğrulama kodun: {{ .Token }}", page(
        "E-postanı doğrula",
        "OrtakSat hesabını tamamlamak için aşağıdaki 6 haneli doğrulama kodunu gir. Kod <b>10 dakika</b> geçerlidir.",
        CODE_BOX, "Kodu kimseyle paylaşma. OrtakSat ekibi senden bu kodu asla istemez.")),
    "recovery": ("OrtakSat şifre sıfırlama kodun: {{ .Token }}", page(
        "Şifre sıfırlama kodu",
        "Şifreni sıfırlamak için aşağıdaki 6 haneli kodu gir ve yeni şifreni belirle. Kod <b>10 dakika</b> geçerlidir.",
        CODE_BOX, "Bu talebi sen yapmadıysan şifreni değiştirmene gerek yok; hesabın güvende. Kodu kimseyle paylaşma.")),
    "magic_link": ("OrtakSat giriş kodun: {{ .Token }}", page(
        "Giriş kodun",
        "OrtakSat'a giriş için aşağıdaki 6 haneli kodu gir. Kod <b>10 dakika</b> geçerlidir.",
        CODE_BOX, "Bu girişi sen başlatmadıysan kodu kullanma.")),
    "email_change": ("OrtakSat e-posta değişikliği kodun: {{ .Token }}", page(
        "E-posta değişikliğini onayla",
        "Hesabının e-posta adresini değiştirme talebini onaylamak için aşağıdaki 6 haneli kodu gir. Kod <b>10 dakika</b> geçerlidir.",
        CODE_BOX, "Bu değişikliği sen istemediysen hesap güvenliğin için şifreni hemen değiştir.")),
    "reauthentication": ("OrtakSat doğrulama kodun: {{ .Token }}", page(
        "Kimliğini doğrula",
        "Bu işlemi onaylamak için aşağıdaki 6 haneli kodu gir. Kod <b>10 dakika</b> geçerlidir.",
        CODE_BOX, "Bu işlemi sen başlatmadıysan kodu kullanma ve şifreni değiştir.")),
    "invite": ("OrtakSat'a davet edildin", page(
        "OrtakSat'a davet edildin",
        "OrtakSat'ta hesap oluşturman için bir davet aldın. Daveti kabul etmek için aşağıdaki düğmeye dokun.",
        button("Daveti kabul et", "{{ .ConfirmationURL }}"),
        "Düğme çalışmazsa bu bağlantıyı tarayıcına yapıştır: {{ .ConfirmationURL }}",
        "Bu daveti beklemiyorsan e-postayı dikkate alma.")),
    "password_changed_notification": ("OrtakSat şifren değiştirildi", page(
        "Şifren değiştirildi", "<b>{{ .Email }}</b> hesabının şifresi az önce değiştirildi.", "", NOT_ME, SECURITY_FOOTER)),
    "email_changed_notification": ("OrtakSat e-posta adresin değiştirildi", page(
        "E-posta adresin değiştirildi",
        "Hesabının e-posta adresi <b>{{ .OldEmail }}</b> yerine <b>{{ .Email }}</b> olarak değiştirildi.", "", NOT_ME, SECURITY_FOOTER)),
    "phone_changed_notification": ("OrtakSat telefon numaran değiştirildi", page(
        "Telefon numaran değiştirildi",
        "Hesabının telefon numarası <b>{{ .OldPhone }}</b> yerine <b>{{ .Phone }}</b> olarak değiştirildi.", "", NOT_ME, SECURITY_FOOTER)),
    "identity_linked_notification": ("OrtakSat hesabına yeni bir giriş yöntemi eklendi", page(
        "Yeni bir giriş yöntemi eklendi",
        "<b>{{ .Email }}</b> hesabına <b>{{ .Provider }}</b> ile giriş yöntemi bağlandı.", "", NOT_ME, SECURITY_FOOTER)),
    "identity_unlinked_notification": ("OrtakSat hesabından bir giriş yöntemi kaldırıldı", page(
        "Bir giriş yöntemi kaldırıldı",
        "<b>{{ .Email }}</b> hesabından <b>{{ .Provider }}</b> ile giriş yöntemi kaldırıldı.", "", NOT_ME, SECURITY_FOOTER)),
    "mfa_factor_enrolled_notification": ("OrtakSat hesabına yeni bir doğrulama yöntemi eklendi", page(
        "Yeni bir doğrulama yöntemi eklendi",
        "Hesabına iki adımlı doğrulama yöntemi eklendi: <b>{{ .FactorType }}</b>.", "", NOT_ME, SECURITY_FOOTER)),
    "mfa_factor_unenrolled_notification": ("OrtakSat hesabından bir doğrulama yöntemi kaldırıldı", page(
        "Bir doğrulama yöntemi kaldırıldı",
        "Hesabından iki adımlı doğrulama yöntemi kaldırıldı: <b>{{ .FactorType }}</b>.", "", NOT_ME, SECURITY_FOOTER)),
}


def main():
    body = {}
    for key, (subject, html) in TEMPLATES.items():
        body[f"mailer_subjects_{key}"] = subject
        body[f"mailer_templates_{key}_content"] = html
    if "--dry" in sys.argv:
        out = os.environ.get("EMAIL_PREVIEW_DIR")
        if out:
            for key, (_, html) in TEMPLATES.items():
                open(os.path.join(out, f"email-{key}.html"), "w", encoding="utf-8").write(html)
        print(len(TEMPLATES), "şablon üretildi (gönderilmedi)")
        return
    e = env()
    ref = e.get("SUPABASE_PROJECT_REF") or re.match(r"https://([^.]+)\.", e["EXPO_PUBLIC_SUPABASE_URL"]).group(1)
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/config/auth",
        data=json.dumps(body).encode(),
        method="PATCH",
        headers={"Authorization": "Bearer " + e["SUPABASE_MGMT_TOKEN"], "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        print("uygulandı:", r.status, "-", len(TEMPLATES), "şablon")


if __name__ == "__main__":
    main()

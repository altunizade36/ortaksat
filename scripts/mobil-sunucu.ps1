# Telefonda (Expo Go) deneme için sunucuyu başlatır ve GERÇEKTEN donarsa kendiliğinden yeniden başlatır.
#
# Kullanım (proje klasöründe, PowerShell):   powershell -ExecutionPolicy Bypass -File scripts\mobil-sunucu.ps1
#   -Gelistirme   → geliştirme kipi (kod değişince telefonda anında yenilenir; uygulama belirgin biçimde YAVAŞ çalışır)
# Durdurmak için: Ctrl+C
#
# VARSAYILAN KİP HIZLIDIR (2026-11-15): telefona üretim kipinde, küçültülmüş paket sunulur (--no-dev --minify).
#   - Uygulama geliştirme kipine göre kat kat hızlı çalışır (geliştirme denetimleri ve sıcak yenileme yok).
#   - Bilgisayarda kod değişirken telefondaki uygulama kendi kendine yeniden yüklenmez / hata ekranı vermez.
#   - Yeni değişikliği görmek için uygulamayı kapatıp yeniden açmak yeterlidir.
#
# Neden var: sunucu bu bilgisayarda zaman zaman yanıt vermeyi bırakıyor (kapı açık kalıyor ama istekler cevapsız).
# O zaman telefonda görseller boş gelir ya da "Something went wrong" çıkar.
#
# YANLIŞ ALARM DERSİ (2026-11-15): eski sürüm 20 sn'de bir yoklayıp art arda üç cevapsızlıkta sunucuyu öldürüyordu.
# Sunucu paket hazırlarken ya da bilgisayar başka bir derlemeyle meşgulken /status geç yanıt veriyor; betik bunu
# "dondu" sanıp bir akşamda on kez yeniden başlattı → telefondaki uygulama her seferinde koptu ("her şey çöküyor").
# Artık: (1) yoklama 15 sn bekler, (2) sunucu İŞLEMCİ KULLANIYORSA (yani çalışıyorsa) cevapsızlık sayılmaz,
# (3) yeniden başlatma için art arda 5 gerçek cevapsızlık gerekir, (4) açılışta paket önceden hazırlanır.
param([switch]$Gelistirme)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$nodeDir = Join-Path $root "audit\runtime\node-v24.14.1-win-x64"
$env:Path = "$nodeDir;" + $env:Path
$env:EXPO_NO_TELEMETRY = "1"
$port = 8081

# Telefonun bağlanacağı yerel ağ adresi (kare kod bu adresi taşır).
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } |
  Select-Object -First 1).IPAddress
if ($ip) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip }

function Stamp { return (Get-Date -Format "HH:mm:ss") }

function Stop-Server {
  $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
  if ($owner) { & taskkill /PID $owner /T /F 2>$null | Out-Null }
}

function Start-Server {
  Stop-Server
  $kip = if ($Gelistirme) { "geliştirme kipi" } else { "hızlı kip" }
  Write-Host ("[{0}] Sunucu başlatılıyor — {1} (telefon adresi: exp://{2}:{3})" -f (Stamp), $kip, $ip, $port)
  $arguments = @("node_modules\expo\bin\cli", "start", "--port", "$port", "--lan")
  if (-not $Gelistirme) { $arguments += @("--no-dev", "--minify") }
  return Start-Process -FilePath (Join-Path $nodeDir "node.exe") -ArgumentList $arguments -NoNewWindow -PassThru
}

function Test-Server {
  # DİKKAT: sunucunun /status yanıtında içerik türü başlığı YOK; PowerShell 5.1 bu durumda .Content'i metin değil
  # BAYT DİZİSİ verir. Bayt dizisini -like ile karşılaştırmak her zaman boş döner. Bu yüzden yanıt önce metne çevrilir.
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/status" -TimeoutSec 15 -UseBasicParsing
    $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
    return ($r.StatusCode -eq 200 -and $body -like "packager-status:running*")
  } catch { return $false }
}

# Sunucunun (ve alt süreçlerinin) o ana kadar harcadığı işlemci süresi, saniye. Artıyorsa sunucu çalışıyordur.
function Get-ServerCpu {
  try {
    $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
    if (-not $owner) { return 0 }
    $ids = @($owner) + @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$owner" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId)
    $total = 0
    foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $total += $p.TotalProcessorTime.TotalSeconds } }
    return $total
  } catch { return 0 }
}

# Paketi telefon istemeden ÖNCE hazırlat: ilk açılışta telefon dakikalarca bekleyip zaman aşımına düşmesin.
# Arka planda çalışır; yoklama döngüsünü tutmaz.
function Start-Warmup {
  Get-Job -Name "os-isinma" -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
  Start-Job -Name "os-isinma" -ArgumentList $port -ScriptBlock {
    param($port)
    $ready = $false
    for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
      Start-Sleep -Seconds 5
      try { $s = Invoke-WebRequest -Uri "http://127.0.0.1:$port/status" -TimeoutSec 10 -UseBasicParsing; $ready = ($s.StatusCode -eq 200) } catch {}
    }
    if (-not $ready) { return "sunucu hazır olmadı" }
    $done = @()
    foreach ($platform in @("ios", "android")) {
      try {
        $m = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -Headers @{ "expo-platform" = $platform; "accept" = "multipart/mixed,application/expo+json,application/json" } -TimeoutSec 60 -UseBasicParsing
        $text = if ($m.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($m.Content) } else { [string]$m.Content }
        $match = [regex]::Match($text, '"launchAsset"\s*:\s*\{.*?"url"\s*:\s*"([^"]+)"', "Singleline")
        if (-not $match.Success) { continue }
        $url = $match.Groups[1].Value -replace '\\u0026', '&'
        $started = Get-Date
        Invoke-WebRequest -Uri $url -TimeoutSec 900 -UseBasicParsing | Out-Null
        $done += ("{0}: {1:N0} sn" -f $platform, ((Get-Date) - $started).TotalSeconds)
      } catch { $done += ("{0}: hazırlanamadı" -f $platform) }
    }
    return ($done -join ", ")
  } | Out-Null
}

$proc = Start-Server
Start-Warmup
$misses = 0
$silent = 0
$lastCpu = 0
$warmReported = $false
$graceUntil = (Get-Date).AddSeconds(120)   # ilk açılışta paketleme sürer; bu sürede yoklama sayılmaz
try {
  while ($true) {
    Start-Sleep -Seconds 20
    if (-not $warmReported) {
      $job = Get-Job -Name "os-isinma" -ErrorAction SilentlyContinue
      if ($job -and $job.State -ne "Running") {
        $result = Receive-Job $job -ErrorAction SilentlyContinue
        Write-Host ("[{0}] Paket hazır ({1}). Telefonda uygulamayı şimdi açabilirsin." -f (Stamp), $result)
        Remove-Job $job -Force -ErrorAction SilentlyContinue
        $warmReported = $true
      }
    }
    if ($proc.HasExited) {
      Write-Host ("[{0}] Sunucu kapanmış, yeniden başlatılıyor." -f (Stamp))
      $proc = Start-Server; Start-Warmup; $warmReported = $false; $misses = 0; $lastCpu = 0; $graceUntil = (Get-Date).AddSeconds(120); continue
    }
    $cpu = Get-ServerCpu
    $busy = ($cpu - $lastCpu) -ge 1.5      # son 20 sn'de en az 1,5 sn işlemci kullandı → çalışıyor (paket hazırlıyor)
    $lastCpu = $cpu
    if (Test-Server) { $misses = 0; $silent = 0; continue }
    if ((Get-Date) -lt $graceUntil) { continue }
    $silent += 1
    # KİLİTLENME DERSİ (2026-11-15): sunucu %100 işlemciyle saatlerce asılı kaldı; "meşgul" sayıldığı için hiç yeniden
    # başlatılmadı. Meşgul görünse de 10 dakikadır (30 yoklama) hiç yanıt vermiyorsa kilitlenmiştir.
    if ($busy -and $silent -lt 30) { continue }
    $misses += 1
    if ($misses -ge 5 -or $silent -ge 30) {
      Write-Host ("[{0}] Sunucu yanıt vermiyor ve çalışmıyor, yeniden başlatılıyor. Telefonda uygulamayı kapatıp yeniden aç." -f (Stamp))
      $proc = Start-Server; Start-Warmup; $warmReported = $false; $misses = 0; $silent = 0; $lastCpu = 0; $graceUntil = (Get-Date).AddSeconds(120)
    }
  }
} finally {
  Get-Job -Name "os-isinma" -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
  Stop-Server
}

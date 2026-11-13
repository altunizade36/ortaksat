# Telefonda (Expo Go) deneme için geliştirme sunucusunu başlatır ve DONARSA kendiliğinden yeniden başlatır.
#
# Kullanım (proje klasöründe, PowerShell):   powershell -ExecutionPolicy Bypass -File scripts\mobil-sunucu.ps1
# Durdurmak için: Ctrl+C
#
# Neden var: sunucu bu bilgisayarda zaman zaman yanıt vermeyi bırakıyor (kapı açık kalıyor ama istekler
# cevapsız). O zaman telefonda görseller boş gelir ya da "Something went wrong" çıkar. Bu betik 20 saniyede
# bir yoklar; art arda üç yoklama cevapsız kalırsa sunucuyu kapatıp yeniden açar.

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

function Stop-Server {
  $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
  if ($owner) { & taskkill /PID $owner /T /F 2>$null | Out-Null }
}

function Start-Server {
  Stop-Server
  Write-Host ("[{0}] Sunucu başlatılıyor (telefon adresi: exp://{1}:{2})" -f (Get-Date -Format "HH:mm:ss"), $ip, $port)
  return Start-Process -FilePath (Join-Path $nodeDir "node.exe") -ArgumentList @("node_modules\expo\bin\cli", "start", "--port", "$port", "--lan") -NoNewWindow -PassThru
}

function Test-Server {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$port/status" -TimeoutSec 8 -UseBasicParsing
    return ($r.Content -like "packager-status:running*")
  } catch { return $false }
}

$proc = Start-Server
$misses = 0
$graceUntil = (Get-Date).AddSeconds(90)   # ilk açılışta paketleme sürer; bu sürede yoklama sayılmaz
try {
  while ($true) {
    Start-Sleep -Seconds 20
    if ($proc.HasExited) {
      Write-Host ("[{0}] Sunucu kapanmış, yeniden başlatılıyor." -f (Get-Date -Format "HH:mm:ss"))
      $proc = Start-Server; $misses = 0; $graceUntil = (Get-Date).AddSeconds(90); continue
    }
    if (Test-Server) { $misses = 0; continue }
    if ((Get-Date) -lt $graceUntil) { continue }
    $misses += 1
    if ($misses -ge 3) {
      Write-Host ("[{0}] Sunucu yanıt vermiyor, yeniden başlatılıyor. Telefonda uygulamayı kapatıp yeniden aç." -f (Get-Date -Format "HH:mm:ss"))
      $proc = Start-Server; $misses = 0; $graceUntil = (Get-Date).AddSeconds(90)
    }
  }
} finally {
  Stop-Server
}

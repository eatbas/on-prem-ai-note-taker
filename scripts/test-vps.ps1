param(
    [Parameter(Mandatory=$true)][string]$VpsHost,
    [string]$User = 'root',
    [int[]]$Ports = @(22,80,443,11434,8000),
    [int]$TimeoutSec = 5
)

Write-Host "Testing VPS connectivity for" $VpsHost -ForegroundColor Cyan
Write-Host ("=" * 50)

function Test-TcpPort {
    param([string]$Target,[int]$Port,[int]$TimeoutSec=5)
    try {
        $r = Test-NetConnection -ComputerName $Target -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
        return [bool]$r
    } catch { return $false }
}

function Test-Http {
    param([string]$Url,[int]$TimeoutSec=5)
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing
        return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400
    } catch { return $false }
}

# Resolve DNS if hostname provided
if ($VpsHost -notmatch '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$') {
    try {
        $dns = Resolve-DnsName -Name $VpsHost -ErrorAction Stop | Where-Object {$_.IPAddress} | Select-Object -First 1 -ExpandProperty IPAddress
        Write-Host "Resolved $VpsHost -> $dns" -ForegroundColor Green
    } catch {
        Write-Host "DNS resolution failed for $VpsHost" -ForegroundColor Yellow
    }
}

# ICMP Ping
try {
    $pingOk = Test-Connection -TargetName $VpsHost -Count 2 -Quiet -ErrorAction SilentlyContinue
    if ($pingOk) { Write-Host "Ping: reachable" -ForegroundColor Green } else { Write-Host "Ping: unreachable" -ForegroundColor Red }
} catch {
    Write-Host "Ping test failed to run" -ForegroundColor Yellow
}

Write-Host ""; Write-Host "TCP Ports" -ForegroundColor Cyan
foreach ($p in $Ports) {
    $ok = Test-TcpPort -Target $VpsHost -Port $p -TimeoutSec $TimeoutSec
    $svc = switch ($p) { 22 {'SSH'} 80 {'HTTP'} 443 {'HTTPS'} 11434 {'Ollama'} 8000 {'Backend'} default {"Port $p"} }
    if ($ok) { Write-Host "$svc ($p): OPEN" -ForegroundColor Green } else { Write-Host "$svc ($p): CLOSED" -ForegroundColor Red }
}

Write-Host ""; Write-Host "HTTP Endpoints" -ForegroundColor Cyan
$ollamaVersion = "http://$VpsHost:11434/api/version"
$ollamaTags    = "http://$VpsHost:11434/api/tags"
$backendHealth = "http://$VpsHost:8000/api/health"

$v1 = Test-Http -Url $ollamaVersion -TimeoutSec $TimeoutSec
$v2 = Test-Http -Url $ollamaTags -TimeoutSec $TimeoutSec
$v3 = Test-Http -Url $backendHealth -TimeoutSec $TimeoutSec

if ($v1) { Write-Host "Ollama /api/version: OK" -ForegroundColor Green } else { Write-Host "Ollama /api/version: FAIL" -ForegroundColor Red }
if ($v2) { Write-Host "Ollama /api/tags: OK" -ForegroundColor Green } else { Write-Host "Ollama /api/tags: FAIL" -ForegroundColor Red }
if ($v3) { Write-Host "Backend /api/health: OK" -ForegroundColor Green } else { Write-Host "Backend /api/health: FAIL" -ForegroundColor Red }

Write-Host ""; Write-Host "Summary" -ForegroundColor Cyan
$okCount = 0
foreach ($r in @($pingOk,$v1,$v2,$v3)) { if ($r) { $okCount++ } }
Write-Host ("Successful checks: {0}/4" -f $okCount)

if (-not $v1 -and -not $v2) {
    Write-Host "Hint: Ollama may not be running or port 11434 blocked on the VPS." -ForegroundColor Yellow
}
if (-not $v3) {
    Write-Host "Hint: Backend port 8000 may be closed or the backend container is down." -ForegroundColor Yellow
}



# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-proxy.ps1 -ProxyUrl "http://user:pass@host:port"

param(
    [Parameter(Mandatory=$false)][string]$ProxyUrl
)

if (-not $ProxyUrl) {
    $ProxyUrl = $env:EXCHANGE_PROXY_URL
}

if (-not $ProxyUrl) {
    Write-Host "Proxy URL not provided. Use -ProxyUrl or set EXCHANGE_PROXY_URL." -ForegroundColor Yellow
    exit 1
}

$env:HTTP_PROXY = $ProxyUrl
$env:HTTPS_PROXY = $ProxyUrl
$env:NO_PROXY = "localhost,127.0.0.1,::1"

[Environment]::SetEnvironmentVariable("HTTP_PROXY", $ProxyUrl, "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", $ProxyUrl, "User")
[Environment]::SetEnvironmentVariable("NO_PROXY", $env:NO_PROXY, "User")

Write-Host "Proxy variables set for current session and user profile." -ForegroundColor Green

# Configure Docker Desktop proxy if config exists
$dockerConfig = "$env:USERPROFILE\.docker\config.json"
if (Test-Path $dockerConfig) {
    try { $cfg = Get-Content $dockerConfig -Raw | ConvertFrom-Json } catch { $cfg = @{} }
    if (-not $cfg.proxies) { $cfg | Add-Member -NotePropertyName proxies -NotePropertyValue (@{}) }
    $cfg.proxies.default = @{ httpProxy = $ProxyUrl; httpsProxy = $ProxyUrl; noProxy = $env:NO_PROXY }
    ($cfg | ConvertTo-Json -Depth 5) | Set-Content -Path $dockerConfig -Encoding UTF8
    Write-Host "Docker proxy configured in $dockerConfig" -ForegroundColor Green
} else {
    Write-Host "Docker config not found; skipping Docker proxy config." -ForegroundColor Yellow
}

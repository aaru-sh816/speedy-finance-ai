# Continuous UI snapshot verification - run while dev server is up (e.g. npm run dev)
# Usage:
#   .\scripts\verify-ui-snapshot.ps1              # one run, auto-detect port
#   .\scripts\verify-ui-snapshot.ps1 -BaseUrl http://localhost:3003
#   .\scripts\verify-ui-snapshot.ps1 -Continuous -IntervalMinutes 5   # run every 5 min until Ctrl+C

param([string]$BaseUrl = "", [switch]$Continuous, [int]$IntervalMinutes = 5)

$ports = @(3003, 3000, 3002)
if ($BaseUrl) { $ports = @($BaseUrl -replace "http://localhost:(\d+)", "http://localhost:`$1") }
$base = ""
foreach ($p in $ports) {
  if ($BaseUrl -and $p -eq $BaseUrl) { $base = $p; break }
  $url = if ($BaseUrl) { $BaseUrl } else { "http://localhost:$p" }
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
    if ($r.StatusCode -eq 200) { $base = $url; break }
  } catch {}
}
if (-not $base) {
  $base = "http://localhost:3003"
  Write-Host "Could not detect server; using $base"
} else {
  Write-Host "Using server: $base"
}

$results = @()
$results += "=========================================="
$results += "UI SNAPSHOT VERIFICATION - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$results += "Base: $base"
$results += "=========================================="

# 1. Home
try {
  $r = Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 25
  $ok = $r.StatusCode -eq 200 -and $r.Content -match "Speedy|Bulk Deals|Market"
  $results += "1. Home /          : $(if($ok){'OK'}else{'FAIL'}) (HTTP $($r.StatusCode))"
} catch { $results += "1. Home /          : FAIL ($($_.Exception.Message))" }

# 2. Market page
try {
  $r = Invoke-WebRequest -Uri "$base/market" -UseBasicParsing -TimeoutSec 25
  $ok = $r.StatusCode -eq 200 -and $r.Content -match "Market Intelligence|GAINERS|LOSERS"
  $results += "2. Market /market  : $(if($ok){'OK'}else{'FAIL'}) (HTTP $($r.StatusCode))"
} catch { $results += "2. Market /market  : FAIL" }

# 3. Market APIs
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/market-movers?type=gainers" -UseBasicParsing -TimeoutSec 20
  $j = $r.Content | ConvertFrom-Json
  $results += "3. API market-movers : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'}) (count=$($j.data.Count))"
} catch { $results += "3. API market-movers : FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/advance-decline" -UseBasicParsing -TimeoutSec 15
  $results += "4. API advance-decline: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "4. API advance-decline: FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/near-52week" -UseBasicParsing -TimeoutSec 15
  $results += "5. API near-52week   : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "5. API near-52week   : FAIL" }

# 6. Corporate actions
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/corporate-actions?days=90" -UseBasicParsing -TimeoutSec 20
  $j = $r.Content | ConvertFrom-Json
  $results += "6. API corporate-actions: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'}) (actions=$($j.actions.Count))"
} catch { $results += "6. API corporate-actions: FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/corporate-actions" -UseBasicParsing -TimeoutSec 20
  $results += "7. Page corporate-actions: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "7. Page corporate-actions: FAIL" }

# 8. Result calendar
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/result-calendar" -UseBasicParsing -TimeoutSec 15
  $results += "8. API result-calendar: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "8. API result-calendar: FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/result-calendar" -UseBasicParsing -TimeoutSec 20
  $results += "9. Page result-calendar: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "9. Page result-calendar: FAIL" }

# 10. Announcements
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/announcements" -UseBasicParsing -TimeoutSec 20
  $results += "10. API announcements  : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "10. API announcements  : FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/announcements" -UseBasicParsing -TimeoutSec 25
  $results += "11. Page announcements  : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "11. Page announcements  : FAIL" }

# 12. Quote
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/quote?symbol=500325" -UseBasicParsing -TimeoutSec 15
  $j = $r.Content | ConvertFrom-Json
  $results += "12. API quote (BSE)     : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'}) price=$($j.price) source=$($j.source)"
} catch { $results += "12. API quote (BSE)     : FAIL" }

# 13. Bulk deals
try {
  $r = Invoke-WebRequest -Uri "$base/api/bulk-deals/history?days=7" -UseBasicParsing -TimeoutSec 15
  $j = $r.Content | ConvertFrom-Json
  $results += "13. API bulk-deals hist: $(if($r.StatusCode -eq 200 -and $j.success){'OK'}else{'FAIL'}) count=$($j.count)"
} catch { $results += "13. API bulk-deals hist: FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/bulk-deals" -UseBasicParsing -TimeoutSec 25
  $results += "14. Page bulk-deals    : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "14. Page bulk-deals    : FAIL" }

# 15. Company page
try {
  $r = Invoke-WebRequest -Uri "$base/company/500325" -UseBasicParsing -TimeoutSec 30
  $results += "15. Page company/500325: $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "15. Page company/500325: FAIL" }

# 16. Indices
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/indices" -UseBasicParsing -TimeoutSec 15
  $results += "16. API indices        : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "16. API indices        : FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/indices" -UseBasicParsing -TimeoutSec 20
  $results += "17. Page indices       : $(if($r.StatusCode -eq 200){'OK'}else{'FAIL'})"
} catch { $results += "17. Page indices       : FAIL" }

# 18. Enhanced quote (can be slow - nse-bse-api fallback)
try {
  $r = Invoke-WebRequest -Uri "$base/api/bse/enhanced-quote?scripCode=500325" -UseBasicParsing -TimeoutSec 25
  $ok = $r.StatusCode -eq 200
  if ($ok) { try { $j = $r.Content | ConvertFrom-Json; $ok = $j.success -eq $true } catch {} }
  $results += "18. API enhanced-quote : $(if($ok){'OK'}else{'FAIL'})"
} catch { $results += "18. API enhanced-quote : FAIL" }

# 19. NSE IPOs (nse-bse-api)
try {
  $r = Invoke-WebRequest -Uri "$base/api/nse/ipos" -UseBasicParsing -TimeoutSec 20
  $j = $r.Content | ConvertFrom-Json
  $cur = if ($j.current) { $j.current.Count } else { 0 }
  $up = if ($j.upcoming) { $j.upcoming.Count } else { 0 }
  $results += "19. API NSE IPOs      : $(if($r.StatusCode -eq 200 -and $j.success){'OK'}else{'FAIL'}) (current=$cur upcoming=$up)"
} catch { $results += "19. API NSE IPOs      : FAIL" }
try {
  $r = Invoke-WebRequest -Uri "$base/market/ipos" -UseBasicParsing -TimeoutSec 20
  $ok = $r.StatusCode -eq 200 -and $r.Content -match "NSE IPOs|Current|Upcoming"
  $results += "20. Page market/ipos  : $(if($ok){'OK'}else{'FAIL'})"
} catch { $results += "20. Page market/ipos  : FAIL" }

$results += "=========================================="
$results | ForEach-Object { Write-Host $_ }
$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) "docs\UI_SNAPSHOT_LATEST.txt"
$results | Out-File -FilePath $outPath -Encoding utf8
Write-Host ""
Write-Host "Snapshot written to docs/UI_SNAPSHOT_LATEST.txt"

if ($Continuous) {
  Write-Host "Continuous mode: re-running in $IntervalMinutes minute(s). Press Ctrl+C to stop."
  Start-Sleep -Seconds ($IntervalMinutes * 60)
  & $PSCommandPath -BaseUrl $base -Continuous -IntervalMinutes $IntervalMinutes
}

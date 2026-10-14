# Pushes a random fill every 2 seconds to the dev-only endpoint (Ctrl+C to stop).
# Usage: .\scripts\simulate-fills.ps1 -Account ACC-1006 -Symbol MES -Price 5643.25
param([string]$Account = "ACC-1006", [string]$Symbol = "MES", [double]$Price = 5643.25, [string]$Api = "http://localhost:4000")
while ($true) {
  $side = if ((Get-Random -Maximum 2) -eq 0) { "BUY" } else { "SELL" }
  $qty = Get-Random -Minimum 1 -Maximum 4
  $body = @{ account_id = $Account; instrument_symbol = $Symbol; side = $side; quantity = $qty; price = $Price; commission_usd = [math]::Round($qty * 0.70, 2) } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$Api/dev/fills" -ContentType "application/json" -Body $body
  Start-Sleep -Seconds 2
}

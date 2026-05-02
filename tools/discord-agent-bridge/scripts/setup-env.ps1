$ErrorActionPreference = "Stop"

$BridgeRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $BridgeRoot ".env"
$ExamplePath = Join-Path $BridgeRoot ".env.example"

if (-not (Test-Path $EnvPath)) {
  Copy-Item $ExamplePath $EnvPath
}

Write-Host ""
Write-Host "This writes Discord/OpenClaw/Hermes settings to:"
Write-Host $EnvPath
Write-Host ""
Write-Host "Do not paste the bot token into chat or commit .env to GitHub."
Write-Host ""

function Set-EnvValue {
  param(
    [string]$Key,
    [string]$Value
  )

  $content = Get-Content $EnvPath
  $escaped = [regex]::Escape($Key)
  $line = "$Key=$Value"
  if ($content -match "^$escaped=") {
    $content = $content | ForEach-Object {
      if ($_ -match "^$escaped=") { $line } else { $_ }
    }
  } else {
    $content += $line
  }
  Set-Content -Path $EnvPath -Value $content -Encoding UTF8
}

$token = Read-Host "Discord bot token"
$clientId = Read-Host "Discord application/client ID"
$guildId = Read-Host "Discord server/guild ID"
$allowedUsers = Read-Host "Allowed Discord user IDs, comma-separated. Leave blank for now if you do not know yours yet"

Set-EnvValue "DISCORD_TOKEN" $token
Set-EnvValue "DISCORD_CLIENT_ID" $clientId
Set-EnvValue "DISCORD_GUILD_ID" $guildId
Set-EnvValue "DISCORD_ALLOWED_USER_IDS" $allowedUsers

Write-Host ""
Write-Host "Saved .env. Next:"
Write-Host "  npm install"
Write-Host "  npm run setup"
Write-Host "  npm start"

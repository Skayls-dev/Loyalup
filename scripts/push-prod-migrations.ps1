param(
  [string]$ProjectRef = "yyftqivizzgvveeczbpv",
  [string]$DbHost = "db.yyftqivizzgvveeczbpv.supabase.co",
  [string]$DbName = "postgres",
  [string]$DbUser = "postgres",
  [Parameter(Mandatory = $true)]
  [string]$DbPassword,
  [switch]$Apply,
  [switch]$DryRun
)

if ($Apply -and $DryRun) {
  Write-Host "[FAIL] Use either -Apply or -DryRun, not both."
  exit 1
}

if (-not $Apply -and -not $DryRun) {
  $DryRun = $true
}

if (
  [string]::IsNullOrWhiteSpace($DbPassword) -or
  $DbPassword -eq "%npm_config_dbpassword%" -or
  $DbPassword -eq "%SUPABASE_DB_PASSWORD%"
) {
  Write-Host "[FAIL] Missing database password."
  Write-Host '[HINT] Provide -DbPassword explicitly, or set env var: $env:SUPABASE_DB_PASSWORD="<DB_PASSWORD>"'
  Write-Host '[HINT] Then run: npm run db:push:prod:win:dry-run'
  exit 1
}

Write-Host "[INFO] Target project: $ProjectRef"
Write-Host "[INFO] Database host: $DbHost"

$encodedPassword = [System.Uri]::EscapeDataString($DbPassword)
$dbUrl = "postgresql://${DbUser}:${encodedPassword}@${DbHost}:5432/${DbName}?sslmode=require"

$cliArgs = @("supabase", "db", "push", "--db-url", $dbUrl)
if ($Apply) {
  $cliArgs += "--yes"
  Write-Host "[RUN] Applying migrations to production..."
} else {
  $cliArgs += "--dry-run"
  Write-Host "[RUN] Dry-run (no changes applied)..."
}

npx @cliArgs
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Migration push failed"
  exit $LASTEXITCODE
}

if ($Apply) {
  Write-Host "[OK] Production migrations applied successfully"
} else {
  Write-Host "[OK] Dry-run completed"
}
Param(
  [switch]$Apply,
  [string]$ProjectRef = 'yyftqivizzgvveeczbpv'
)

$ErrorActionPreference = 'Stop'

Write-Host '=== Secret Rotation Checklist (Production) ===' -ForegroundColor Cyan
Write-Host '1) Generate new secrets in provider dashboards' -ForegroundColor Yellow
Write-Host '2) Update secret manager values (Supabase/Vercel)' -ForegroundColor Yellow
Write-Host '3) Deploy functions/app' -ForegroundColor Yellow
Write-Host '4) Validate smoke tests' -ForegroundColor Yellow
Write-Host '5) Revoke old secrets' -ForegroundColor Yellow

$required = @(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUMUP_CLIENT_SECRET',
  'SUM_UP_API_KEY'
)

$missing = @()
foreach ($name in $required) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $name
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing env vars in current shell: $($missing -join ', ')" -ForegroundColor Red
  Write-Host 'Load secure values in shell before applying rotation.' -ForegroundColor Red
  exit 1
}

if (-not $Apply) {
  Write-Host 'Validation passed. Run with -Apply to push updated values to Supabase secrets.' -ForegroundColor Green
  exit 0
}

Write-Host 'Applying Supabase secrets...' -ForegroundColor Cyan
$serviceRole = [Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY')
$sumupClientSecret = [Environment]::GetEnvironmentVariable('SUMUP_CLIENT_SECRET')
$sumupApiKey = [Environment]::GetEnvironmentVariable('SUM_UP_API_KEY')

npx supabase secrets set --project-ref $ProjectRef SUPABASE_SERVICE_ROLE_KEY=$serviceRole SUMUP_CLIENT_SECRET=$sumupClientSecret SUMUP_SANDBOX_API_KEY=$sumupApiKey

Write-Host 'Supabase secrets updated. Next: deploy functions and validate runtime smoke tests.' -ForegroundColor Green

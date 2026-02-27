param(
  [switch]$NoServer,
  [switch]$SkipPrecheck
)

$ErrorActionPreference = 'Stop'

function Run-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host "\n==> $Label" -ForegroundColor Cyan
  & $Action
}

Run-Step -Label 'Runtime smoke checklist (targeted issues)' -Action {
  Write-Host '1) Router warning check: no React Router future warning in browser console' -ForegroundColor Yellow
  Write-Host '2) Promotions loop check: no "Maximum update depth exceeded" after opening promotions page and waiting 30s' -ForegroundColor Yellow
  Write-Host '3) Transactions API check: no 400 on transactions history/recent requests in browser network tab' -ForegroundColor Yellow
}

if (-not $SkipPrecheck) {
  Run-Step -Label 'Build validation' -Action {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  }

  Run-Step -Label 'Targeted loyalty service test' -Action {
    npm run test:run -- src/modules/loyalty/services/loyaltyService.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Targeted test failed.' }
  }
}

if (-not $NoServer) {
  Run-Step -Label 'Start dev server' -Action {
    Write-Host 'Server starts in this terminal. Open http://127.0.0.1:5173 and execute the 3 checks above.' -ForegroundColor Green
    Write-Host 'Press Ctrl+C to stop once checks are complete.' -ForegroundColor Green
    npm run dev -- --host 127.0.0.1 --port 5173
    if ($LASTEXITCODE -ne 0) { throw 'Dev server exited with non-zero code.' }
  }
}

Write-Host "\nRuntime smoke script completed." -ForegroundColor Green

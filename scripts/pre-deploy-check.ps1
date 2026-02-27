Write-Host "[CHECK] Running pre-deploy checks..."

npm run test:run
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Tests failed"
  exit 1
}
Write-Host "[OK] All tests passed"

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] TypeScript errors"
  exit 1
}
Write-Host "[OK] TypeScript OK"

npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Build failed"
  exit 1
}
Write-Host "[OK] Build successful"

# Check if port 8888 is in use; skip bundle analysis if it is
$portInUse = Test-NetConnection -ComputerName 127.0.0.1 -Port 8888 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded

if ($portInUse) {
  Write-Host "[WARN] Port 8888 already in use, skipping bundle analysis"
} else {
  npx vite-bundle-analyzer dist
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Bundle analysis had issues, continuing anyway"
  }
}

Write-Host "[READY] Ready to deploy!"

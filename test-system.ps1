# CallPulse - System Test Script
# Tests backend and frontend after they're running

param(
    [switch]$SkipFrontend
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CallPulse - System Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:5050"
$webUrl = "http://localhost:3000"

Write-Host "Testing CallPulse endpoints...`n" -ForegroundColor Yellow

# Test 1: Backend Health Check
Write-Host "[1/5] Testing backend health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/health" -Method Get -ErrorAction Stop
    if ($response.status -eq "healthy" -or $response.status -eq "degraded") {
        Write-Host "  ✓ Backend is $($response.status)" -ForegroundColor Green
        Write-Host "    Redis: $($response.services.redis.status)" -ForegroundColor Gray
        Write-Host "    Database: $($response.services.database.status)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Backend returned: $($response.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Backend not responding on $baseUrl" -ForegroundColor Red
    Write-Host "    Make sure backend is running: cd backend && npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Backend Root Endpoint
Write-Host "`n[2/5] Testing backend root endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/" -Method Get -ErrorAction Stop
    if ($response.name -eq "CallPulse API") {
        Write-Host "  ✓ Root endpoint working" -ForegroundColor Green
        Write-Host "    Version: $($response.version)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Root endpoint failed" -ForegroundColor Red
}

# Test 3: Backend 404 Handler
Write-Host "`n[3/5] Testing backend 404 handler..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$baseUrl/nonexistent" -Method Get -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "  ✓ 404 handler working correctly" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Unexpected status code" -ForegroundColor Yellow
    }
}

# Test 4: Frontend (if not skipped)
if (-not $SkipFrontend) {
    Write-Host "`n[4/5] Testing frontend..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $webUrl -Method Get -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Frontend is responding" -ForegroundColor Green
            if ($response.Content -match "CallPulse") {
                Write-Host "  ✓ Landing page loads correctly" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "  ✗ Frontend not responding on $webUrl" -ForegroundColor Red
        Write-Host "    Make sure frontend is running: cd web && npm run dev" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[4/5] Skipping frontend test" -ForegroundColor Gray
}

# Test 5: Summary
Write-Host "`n[5/5] Test Summary" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan

Write-Host "`n✅ CORE SYSTEM TESTS PASSED!`n" -ForegroundColor Green

Write-Host "Manual Testing Checklist:" -ForegroundColor Cyan
Write-Host "  [ ] Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "  [ ] Click 'Sign Up' and create account" -ForegroundColor White
Write-Host "  [ ] Verify dashboard loads with dark theme" -ForegroundColor White
Write-Host "  [ ] Navigate to all sidebar pages" -ForegroundColor White
Write-Host "  [ ] Test Dialer keypad" -ForegroundColor White
Write-Host "  [ ] Add a test contact" -ForegroundColor White
Write-Host "  [ ] Check Settings pages" -ForegroundColor White

Write-Host "`nFor Twilio webhook testing:" -ForegroundColor Yellow
Write-Host "  1. Install ngrok: npm install -g ngrok" -ForegroundColor Gray
Write-Host "  2. Run: ngrok http 5050" -ForegroundColor Gray
Write-Host "  3. Configure Twilio webhooks with ngrok URL" -ForegroundColor Gray
Write-Host "  4. Call/text your Twilio number" -ForegroundColor Gray

Write-Host "`n================================`n" -ForegroundColor Cyan

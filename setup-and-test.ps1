# CallPulse - Setup and Test Script
# This script helps you set up and test the entire system

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CallPulse - Local Setup & Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if running in correct directory
if (-not (Test-Path "backend") -or -not (Test-Path "web")) {
    Write-Host "ERROR: Please run this script from the callcenter root directory" -ForegroundColor Red
    exit 1
}

# Step 1: Check Node.js version
Write-Host "[1/8] Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($nodeVersion -match "v(\d+)") {
    $major = [int]$matches[1]
    if ($major -lt 20) {
        Write-Host "  ⚠ Node.js $nodeVersion detected. Recommended: v20+" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green
    }
}

# Step 2: Check if dependencies are installed
Write-Host "`n[2/8] Checking dependencies..." -ForegroundColor Yellow

if (Test-Path "backend/node_modules") {
    Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend dependencies missing" -ForegroundColor Red
    Write-Host "    Run: cd backend && npm install" -ForegroundColor Yellow
    exit 1
}

if (Test-Path "web/node_modules") {
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend dependencies missing" -ForegroundColor Red
    Write-Host "    Run: cd web && npm install" -ForegroundColor Yellow
    exit 1
}

# Step 3: Check environment files
Write-Host "`n[3/8] Checking environment configuration..." -ForegroundColor Yellow

$backendEnv = "backend/.env"
$frontendEnv = "web/.env.local"

if (Test-Path $backendEnv) {
    Write-Host "  ✓ backend/.env exists" -ForegroundColor Green
    
    # Check for required variables
    $envContent = Get-Content $backendEnv -Raw
    $required = @(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GROQ_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "JWT_SECRET"
    )
    
    $missing = @()
    foreach ($var in $required) {
        if (-not ($envContent -match "$var=.+")) {
            $missing += $var
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "  ⚠ Missing or empty variables:" -ForegroundColor Yellow
        foreach ($var in $missing) {
            Write-Host "    - $var" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ All required backend environment variables set" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ backend/.env not found" -ForegroundColor Red
    Write-Host "    Run: cp backend/.env.example backend/.env" -ForegroundColor Yellow
    Write-Host "    Then edit with your API keys" -ForegroundColor Yellow
    exit 1
}

if (Test-Path $frontendEnv) {
    Write-Host "  ✓ web/.env.local exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ web/.env.local not found (optional)" -ForegroundColor Yellow
    Write-Host "    Run: cp web/.env.example web/.env.local" -ForegroundColor Yellow
}

# Step 4: Check Redis (optional)
Write-Host "`n[4/8] Checking Redis..." -ForegroundColor Yellow

try {
    $redis = Test-Connection -ComputerName localhost -Port 6379 -ErrorAction SilentlyContinue
    if ($redis) {
        Write-Host "  ✓ Redis is running on localhost:6379" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ Redis not detected (optional - graceful degradation works without it)" -ForegroundColor Yellow
    Write-Host "    To install: docker run -d -p 6379:6379 redis:7-alpine" -ForegroundColor Gray
}

# Step 5: Test backend compilation
Write-Host "`n[5/8] Testing backend TypeScript compilation..." -ForegroundColor Yellow

Push-Location backend
$typecheckResult = npm run typecheck 2>&1
Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend compiles successfully (0 errors)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend has TypeScript errors" -ForegroundColor Red
    Write-Host $typecheckResult
    exit 1
}

# Step 6: Test backend build
Write-Host "`n[6/8] Testing backend build..." -ForegroundColor Yellow

Push-Location backend
$buildResult = npm run build 2>&1
Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend builds successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend build failed" -ForegroundColor Red
    exit 1
}

# Step 7: Test frontend build
Write-Host "`n[7/8] Testing frontend build..." -ForegroundColor Yellow

Push-Location web
$webBuildResult = npm run build 2>&1
Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Frontend builds successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend build failed" -ForegroundColor Red
    Write-Host "    Check web/.env.local has correct NEXT_PUBLIC_* variables" -ForegroundColor Yellow
    exit 1
}

# Step 8: Summary
Write-Host "`n[8/8] Setup Summary" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan

Write-Host "`n✅ SYSTEM IS READY FOR TESTING!`n" -ForegroundColor Green

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Start Backend:" -ForegroundColor White
Write-Host "     cd backend && npm run dev`n" -ForegroundColor Gray

Write-Host "  2. Start Frontend (in new terminal):" -ForegroundColor White
Write-Host "     cd web && npm run dev`n" -ForegroundColor Gray

Write-Host "  3. Open Browser:" -ForegroundColor White
Write-Host "     http://localhost:3000`n" -ForegroundColor Gray

Write-Host "  4. Test Health Check:" -ForegroundColor White
Write-Host "     curl http://localhost:5050/api/v1/health`n" -ForegroundColor Gray

Write-Host "For detailed testing guide, see: LOCAL_SETUP_GUIDE.md" -ForegroundColor Yellow

Write-Host "`n================================`n" -ForegroundColor Cyan

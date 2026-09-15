#!/usr/bin/env pwsh
# CallPulse Setup Validation Script
# Run this AFTER you've created your .env files

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "   CallPulse Setup Validator" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$errors = 0
$warnings = 0

# Function to check if file exists
function Test-EnvFile {
    param($Path, $Name)
    
    Write-Host "`nChecking $Name..." -ForegroundColor Yellow
    
    if (Test-Path $Path) {
        Write-Host "  [OK] File exists: $Path" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  [FAIL] File missing: $Path" -ForegroundColor Red
        $script:errors++
        return $false
    }
}

# Function to check environment variable in file
function Test-EnvVar {
    param($FilePath, $VarName, $Required = $true)
    
    $content = Get-Content $FilePath -Raw
    $pattern = "^$VarName=(.+)$"
    $match = [regex]::Match($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    
    if ($match.Success) {
        $value = $match.Groups[1].Value.Trim()
        
        # Check if placeholder value
        if ($value -match "xxxxx|your-|paste|here|\.\.\.") {
            Write-Host "  [WARN] $VarName is set but looks like a placeholder" -ForegroundColor Yellow
            $script:warnings++
            return $false
        }
        
        Write-Host "  [OK] $VarName is set" -ForegroundColor Green
        return $true
    } else {
        if ($Required) {
            Write-Host "  [FAIL] $VarName is missing" -ForegroundColor Red
            $script:errors++
        } else {
            Write-Host "  [WARN] $VarName is missing (optional)" -ForegroundColor Yellow
            $script:warnings++
        }
        return $false
    }
}

# Check backend .env file
Write-Host "`n---------------------------------" -ForegroundColor Cyan
Write-Host "Backend Environment Check" -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

$backendEnv = ".\backend\.env"
if (Test-EnvFile $backendEnv "Backend .env") {
    Test-EnvVar $backendEnv "SUPABASE_URL"
    Test-EnvVar $backendEnv "SUPABASE_SERVICE_ROLE_KEY"
    Test-EnvVar $backendEnv "SUPABASE_ANON_KEY"
    Test-EnvVar $backendEnv "TWILIO_ACCOUNT_SID"
    Test-EnvVar $backendEnv "TWILIO_AUTH_TOKEN"
    Test-EnvVar $backendEnv "TWILIO_PHONE_NUMBER"
    Test-EnvVar $backendEnv "GROQ_API_KEY"
    Test-EnvVar $backendEnv "JWT_SECRET"
    Test-EnvVar $backendEnv "REDIS_HOST" $false
    Test-EnvVar $backendEnv "REDIS_PORT" $false
}

# Check frontend .env.local file
Write-Host "`n---------------------------------" -ForegroundColor Cyan
Write-Host "Frontend Environment Check" -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

$frontendEnv = ".\web\.env.local"
if (Test-EnvFile $frontendEnv "Frontend .env.local") {
    Test-EnvVar $frontendEnv "NEXT_PUBLIC_SUPABASE_URL"
    Test-EnvVar $frontendEnv "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    Test-EnvVar $frontendEnv "NEXT_PUBLIC_API_URL"
}

# Check if backend is running
Write-Host "`n---------------------------------" -ForegroundColor Cyan
Write-Host "Backend Service Check" -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

Write-Host "`nChecking backend health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5050/api/v1/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  [OK] Backend is running!" -ForegroundColor Green
        Write-Host "       Status: $($json.status)" -ForegroundColor Cyan
        
        if ($json.redis -and $json.redis.connected) {
            Write-Host "       Redis: Connected" -ForegroundColor Green
        } else {
            Write-Host "       Redis: Not connected (optional)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  [WARN] Backend is not running on port 5050" -ForegroundColor Yellow
    Write-Host "         Start it with: cd backend ; npm run dev" -ForegroundColor Gray
    $warnings++
}

# Check if frontend is running
Write-Host "`nChecking frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] Frontend is running!" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARN] Frontend is not running on port 3000" -ForegroundColor Yellow
    Write-Host "         Start it with: cd web ; npm run dev" -ForegroundColor Gray
    $warnings++
}

# Check node_modules
Write-Host "`n---------------------------------" -ForegroundColor Cyan
Write-Host "Dependencies Check" -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

Write-Host "`nChecking backend dependencies..." -ForegroundColor Yellow
if (Test-Path ".\backend\node_modules") {
    Write-Host "  [OK] Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Backend node_modules missing" -ForegroundColor Red
    Write-Host "         Run: cd backend ; npm install" -ForegroundColor Gray
    $errors++
}

Write-Host "`nChecking frontend dependencies..." -ForegroundColor Yellow
if (Test-Path ".\web\node_modules") {
    Write-Host "  [OK] Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Frontend node_modules missing" -ForegroundColor Red
    Write-Host "         Run: cd web ; npm install" -ForegroundColor Gray
    $errors++
}

# Summary
Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "   Validation Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "`n🎉 Perfect! Everything looks good!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Start backend: cd backend ; npm run dev" -ForegroundColor Gray
    Write-Host "  2. Start frontend: cd web ; npm run dev" -ForegroundColor Gray
    Write-Host "  3. Open browser: http://localhost:3000" -ForegroundColor Gray
} elseif ($errors -eq 0) {
    Write-Host "`n✅ Setup complete with $warnings warning(s)" -ForegroundColor Yellow
    Write-Host "   You can proceed, but review warnings above." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Found $errors error(s) and $warnings warning(s)" -ForegroundColor Red
    Write-Host "   Please fix the errors above before proceeding." -ForegroundColor Red
    Write-Host "`n   Need help? Check SETUP_NOW.md for detailed instructions." -ForegroundColor Gray
}

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host ""

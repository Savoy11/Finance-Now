#Requires -Version 5
# -----------------------------------------------
#  Finance Now - Multi-Asset Financial Analytics
#  Setup & Launch Script
# -----------------------------------------------

# Enforce PowerShell 7+ at runtime with a clear message
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host ""
    Write-Host "  ERROR: This script requires PowerShell 7 or newer." -ForegroundColor Red
    Write-Host "  You are running PowerShell $($PSVersionTable.PSVersion)." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Download PowerShell 7 from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/PowerShell/PowerShell/releases/latest" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  After installing, open 'PowerShell 7' (not the blue 'Windows PowerShell')" -ForegroundColor Yellow
    Write-Host "  and run this script again." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$FRONTEND_DIR = Join-Path $PSScriptRoot "frontend"
$ENV_FILE     = Join-Path $FRONTEND_DIR ".env.local"

function Write-Header {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "   Finance Now - Multi-Asset Financial Analytics" -ForegroundColor Cyan
    Write-Host "   Setup Script" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "`n   ERROR: $msg" -ForegroundColor Red ; exit 1 }

# ---------------------------------------------------
# 1. Verify Node.js is installed
# ---------------------------------------------------
function Install-Node {
    Write-Step "Checking for Node.js..."

    # Refresh PATH in case Node was just installed
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")

    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Ok "Node.js $(node --version)  /  npm $(npm --version)"
        return
    }

    Write-Host "   Node.js not found. Installing via winget..." -ForegroundColor Yellow

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Fail "winget not available. Install Node.js from https://nodejs.org (LTS) then re-run this script."
    }

    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "   Node.js installed — but you need to open a new PowerShell window for it to be available." -ForegroundColor Yellow
        Write-Host "   Close this window, open a new one, and run:  .\start.ps1" -ForegroundColor White
        Write-Host ""
        exit 0
    }

    Write-Ok "Node.js installed: $(node --version)"
}

# ---------------------------------------------------
# 2. Create .env.local if missing
# ---------------------------------------------------
function Setup-Env {
    Write-Step "Checking environment..."

    if (Test-Path $ENV_FILE) {
        Write-Ok ".env.local already exists — skipping"
        return
    }

    @"
# The legacy Python backend is OPTIONAL and dormant; the app runs live-only without
# it. This is the ORIGIN ONLY — next.config.mjs's rewrite appends /api/:path itself,
# so a /api or /api/v1 suffix here yields /api/v1/api/v1 and every legacy call 404s.
NEXT_PUBLIC_API_URL=http://localhost:8000
"@ | Set-Content -Path $ENV_FILE -Encoding utf8

    Write-Ok ".env.local created (the app runs live-only; there is no mock data path)"
}

# ---------------------------------------------------
# 3. Install npm dependencies
# ---------------------------------------------------
function Install-Deps {
    Write-Step "Installing dependencies..."
    Write-Host "   (First run takes 1-3 minutes)" -ForegroundColor DarkGray

    Set-Location $FRONTEND_DIR
    npm install

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed — check errors above."
    }

    Write-Ok "Dependencies ready"
}

# ---------------------------------------------------
# 4. Start the dev server
# ---------------------------------------------------
function Start-App {
    Write-Step "Starting Finance Now..."
    Write-Host ""
    Write-Host "   Open in your browser: " -NoNewline
    Write-Host "http://localhost:3000" -ForegroundColor Green
    Write-Host "   Press Ctrl+C to stop." -ForegroundColor DarkGray
    Write-Host ""

    Set-Location $FRONTEND_DIR
    npm run dev
}

# ---------------------------------------------------
# Main
# ---------------------------------------------------
Write-Header
Install-Node
Setup-Env
Install-Deps
Start-App

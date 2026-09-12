#Requires -Version 5
# -----------------------------------------------
#  Finance Now - Multi-Asset Financial Analytics
#  Setup & Launch Script
# -----------------------------------------------
#
#  KEEP THE UTF-8 BOM ON THIS FILE. Do not "clean" it up.
#
#  Windows PowerShell 5.1 - still the default shell on Windows - reads a BOM-less
#  file as ANSI (Windows-1252), not UTF-8. This file contains em-dashes, whose UTF-8
#  bytes E2 80 94 then decode as three Windows-1252 characters ending in 0x94 =
#  U+201D RIGHT DOUBLE QUOTATION MARK. PowerShell accepts smart quotes as STRING
#  DELIMITERS, so every such line silently closes a string early and the parse
#  desyncs: "The string is missing the terminator" plus a cascade of brace errors.
#
#  Measured 2026-09-12 before the BOM was added: this file did not parse at all under
#  5.1, which made the friendly PS7 check below UNREACHABLE - a 5.1 user got a cryptic
#  parser cascade instead of "Please install PowerShell 7". start.bat was unaffected
#  because it launches pwsh (7+), where UTF-8 is the default.
#
#  PowerShell 7 reads the BOM without complaint, so this costs nothing there.
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
function Write-Warn { param($msg) Write-Host "   WARN: $msg" -ForegroundColor Yellow }
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

    # Copy .env.example, the same step README.md and docs/deployment/local-setup.md
    # tell you to run by hand. This script used to write its own one-line file, so
    # .\start.ps1 and "follow the README" produced DIFFERENT .env.local files — and
    # the script's version silently omitted every annotated optional key (API keys,
    # DATABASE_URL, AUTH_SECRET), so features looked absent rather than unconfigured.
    $ENV_EXAMPLE = Join-Path $FRONTEND_DIR ".env.example"
    if (Test-Path $ENV_EXAMPLE) {
        Copy-Item -Path $ENV_EXAMPLE -Destination $ENV_FILE
        Write-Ok ".env.local created from .env.example — every variable annotated with what it unlocks"
    } else {
        # Fallback only if the example is missing. NEXT_PUBLIC_API_URL is the ORIGIN
        # ONLY — next.config.mjs's rewrite appends /api/:path itself, so a /api or
        # /api/v1 suffix here yields /api/v1/api/v1 and every legacy call 404s.
        Write-Warn ".env.example not found — writing a minimal .env.local instead"
        @"
# The legacy Python backend is OPTIONAL and dormant; the app runs live-only without it.
NEXT_PUBLIC_API_URL=http://localhost:8000
"@ | Set-Content -Path $ENV_FILE -Encoding utf8
        Write-Ok ".env.local created (minimal; the app runs live-only — there is no mock data path)"
    }
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

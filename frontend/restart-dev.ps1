# Finance Now dev server restart: stop this project's dev server on the port,
# clear .next, start `npm run dev`. The repo root's restart-dev.ps1 opens a
# window that runs this file, so this is the one implementation.
#
# Until 2026-10-14 this stored the process id in $pid, which is PowerShell's own
# read-only process id. The assignment failed, the script carried on, and
# Stop-Process -Id $pid stopped the PowerShell running it: whenever the port was
# in use, the script killed itself and restarted nothing. Never assign an
# automatic variable here ($pid, $host, $input, $args...); restartScript.test.ts
# fails on one. Keep this file ASCII: PowerShell 5.1 reads it as Windows-1252.

param([int]$Port = 3000)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
try { $Host.UI.RawUI.WindowTitle = 'Finance Now Dev Server' } catch { }

function Test-FromThisFolder($proc) {
  return $proc -and $proc.CommandLine -and
    $proc.CommandLine.IndexOf($PSScriptRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

# Only a dev server started from this folder is stopped. Anything else on the
# port (another Next.js app, say) is named and left running.
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
foreach ($procId in @($listeners | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId"
  if (-not (Test-FromThisFolder $proc)) {
    Write-Host "Port $Port is held by PID $procId, which is not this project's dev server:" -ForegroundColor Yellow
    Write-Host "  $($proc.CommandLine)"
    Write-Host "Nothing was stopped. Free the port, then run this again." -ForegroundColor Yellow
    exit 1
  }
  # `next dev` is a parent process with a child that holds the port. Stop the
  # parent first, so it cannot start a fresh child, then the child.
  $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)"
  if (Test-FromThisFolder $parent) { Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped the dev server on port $Port (PID $procId)." -ForegroundColor Green
}

$deadline = (Get-Date).AddSeconds(10)
while ((Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Port $Port is still in use after 10 seconds. Nothing was started." -ForegroundColor Yellow
  exit 1
}

# .next is build output, rebuilt on start, and the fix for the OneDrive lock that
# kills the dev server mid-session. Its full path, so it is never another folder's.
$buildDir = Join-Path $PSScriptRoot '.next'
if (Test-Path $buildDir) {
  try {
    Remove-Item -Recurse -Force $buildDir
    Write-Host 'Cleared .next' -ForegroundColor Green
  } catch {
    Write-Host "Could not clear .next: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host 'OneDrive may be holding a file in it. Pause syncing or wait a moment, then run this again.' -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "Starting the dev server at http://localhost:$Port ..." -ForegroundColor Cyan
if ($Port -eq 3000) { npm run dev } else { npm run dev -- --port $Port }

# Finance Now dev server restart, from the repo root (restart-dev.bat runs this).
# Opens a window that runs frontend\restart-dev.ps1: stop this project's dev
# server on port 3000, clear .next, start `npm run dev`. That file is the one
# implementation, so a fix lands once: until 2026-10-14 this file carried its own
# copy of the stop step, with the same $pid bug that made it stop itself.

$Script = Join-Path $PSScriptRoot 'frontend\restart-dev.ps1'

Write-Host 'Finance Now Dev Server Restart' -ForegroundColor Cyan
Write-Host '========================' -ForegroundColor Cyan

# -NoExit keeps the window open: it shows the server's output, or why nothing started.
Start-Process powershell.exe -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$Script`""

Write-Host 'Opened the Finance Now Dev Server window. The server starts at http://localhost:3000' -ForegroundColor Green
Start-Sleep -Seconds 1

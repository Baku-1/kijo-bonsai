# resume-all.ps1 — Resume all active Claude Code sessions after a restart
# Run this after your machine reboots or after closing all terminals.
$tracker = "$env:USERPROFILE\.claude\active-sessions.json"

if (!(Test-Path $tracker)) {
    Write-Host "No active sessions file found at $tracker"
    exit 0
}

$sessions = Get-Content $tracker -Raw | ConvertFrom-Json
if ($sessions -isnot [System.Collections.IEnumerable] -or $sessions -is [string]) {
    Write-Host "No sessions to resume."
    exit 0
}

$active = @($sessions | Where-Object { $_.active -eq $true })

if ($active.Count -eq 0) {
    Write-Host "No active sessions to resume."
    exit 0
}

Write-Host "Resuming $($active.Count) session(s)..."

foreach ($s in $active) {
    $title = if ($s.session_title) { $s.session_title } else { $s.session_id }
    $dir   = if ($s.cwd) { $s.cwd } else { $env:USERPROFILE }
    Write-Host "  -> $title (id: $($s.session_id), dir: $dir)"

    # Launch each session in a new Windows Terminal tab
    Start-Process wt -ArgumentList @(
        'new-tab',
        '--title', "`"$title`"",
        '-d', "`"$dir`"",
        'claude', '--resume', $s.session_id
    )

    # Small delay to avoid overwhelming the terminal
    Start-Sleep -Milliseconds 500
}

Write-Host "All sessions launched."

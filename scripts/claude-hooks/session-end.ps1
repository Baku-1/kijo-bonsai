# session-end.ps1 — Claude Code SessionEnd hook
# Marks the session inactive in active-sessions.json
$ErrorActionPreference = 'SilentlyContinue'
$input_json = [Console]::In.ReadToEnd() | ConvertFrom-Json

$tracker = "$env:USERPROFILE\.claude\active-sessions.json"
if (!(Test-Path $tracker)) { exit 0 }

$sessions = Get-Content $tracker -Raw | ConvertFrom-Json
if ($sessions -isnot [System.Collections.IEnumerable] -or $sessions -is [string]) { exit 0 }

$updated = @($sessions | ForEach-Object {
    if ($_.session_id -eq $input_json.session_id) {
        $_.active = $false
        $_ | Add-Member -NotePropertyName 'ended_at' -NotePropertyValue (Get-Date -Format 'o') -Force
    }
    $_
})

$updated | ConvertTo-Json -Depth 3 | Set-Content $tracker -Encoding UTF8

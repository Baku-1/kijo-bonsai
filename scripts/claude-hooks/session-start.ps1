# session-start.ps1 — Claude Code SessionStart hook
# Reads JSON from stdin, logs session to active-sessions.json
$ErrorActionPreference = 'SilentlyContinue'
$input_json = [Console]::In.ReadToEnd() | ConvertFrom-Json

$tracker = "$env:USERPROFILE\.claude\active-sessions.json"

# Load existing sessions or start fresh
if (Test-Path $tracker) {
    $sessions = Get-Content $tracker -Raw | ConvertFrom-Json
    if ($sessions -isnot [System.Collections.IEnumerable] -or $sessions -is [string]) {
        $sessions = @()
    }
} else {
    $sessions = @()
}

# Convert to mutable list
$list = [System.Collections.ArrayList]@($sessions)

# Remove any stale entry with same session_id
$list = [System.Collections.ArrayList]@($list | Where-Object { $_.session_id -ne $input_json.session_id })

# Add current session
$entry = @{
    session_id    = $input_json.session_id
    session_title = $input_json.session_title
    cwd           = $input_json.cwd
    source        = $input_json.source
    started_at    = (Get-Date -Format 'o')
    active        = $true
}
[void]$list.Add($entry)

# Write back
$list | ConvertTo-Json -Depth 3 | Set-Content $tracker -Encoding UTF8

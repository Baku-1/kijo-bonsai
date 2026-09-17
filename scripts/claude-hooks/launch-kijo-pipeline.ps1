# launch-kijo-pipeline.ps1 - Start the 3 standing Kijo pipeline sessions
# Run from anywhere. Each opens in a new Windows Terminal tab.
$kijoDir = "C:\Users\jerem\.gemini\antigravity\playground\kijo"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$promptDir = Join-Path $scriptDir "prompts"

if (!(Test-Path $promptDir)) { New-Item -ItemType Directory -Path $promptDir | Out-Null }

$sessions = @(
    @{ Name = "kijo-architect";    PromptFile = "architect.txt"    },
    @{ Name = "kijo-implementer";  PromptFile = "implementer.txt"  },
    @{ Name = "kijo-auditor";      PromptFile = "auditor.txt"      }
)

foreach ($s in $sessions) {
    $pf = Join-Path $promptDir $s.PromptFile
    if (!(Test-Path $pf)) {
        Write-Host "WARNING: prompt file missing: $pf - skipping $($s.Name)"
        continue
    }
    Write-Host "Launching $($s.Name)..."
    $prompt = Get-Content $pf -Raw
    Start-Process wt -ArgumentList "new-tab --title `"$($s.Name)`" -d `"$kijoDir`" -- claude -n `"$($s.Name)`" -p `"$prompt`""
    Start-Sleep -Milliseconds 800
}

Write-Host "All Kijo pipeline sessions launched."

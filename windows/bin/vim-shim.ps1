# Editor shim behind vim.cmd. Runs Neovim with the given arguments.
#
# Special case: hunk (the diff viewer) inside a herdr pane. hunk suspends its
# terminal and spawns $EDITOR in the same pane, but on Windows the child never
# receives keystrokes, so Neovim sits frozen. When the caller is hunk and we
# are inside herdr, Neovim runs in a new herdr pane instead, and this script
# waits until that pane closes so hunk resumes only after editing is done.
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $EditorArgs = @()
)

# Native commands write JSON errors to stderr. Under 'Stop' PowerShell 5.1
# would turn that into a terminating error and exit 1, which hunk then
# reports as an editor failure.
$ErrorActionPreference = 'Continue'

function Test-LaunchedByHunk {
    # Chain is: hunk.exe -> cmd.exe (vim.cmd) -> powershell.exe (this script).
    try {
        $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name
        $byId = @{}
        foreach ($p in $all) { $byId[[int] $p.ProcessId] = $p }
        $current = $byId[[int] $PID]
        for ($depth = 0; $depth -lt 3 -and $current; $depth++) {
            $current = $byId[[int] $current.ParentProcessId]
            if ($current -and $current.Name -ieq 'hunk.exe') { return $true }
        }
    } catch { }
    return $false
}

$insideHerdr = [bool] $env:HERDR_PANE_ID
if (-not ($insideHerdr -and (Test-LaunchedByHunk))) {
    & nvim @EditorArgs
    exit $LASTEXITCODE
}

$herdr = if ($env:HERDR_BIN_PATH) { $env:HERDR_BIN_PATH } else { 'herdr' }

# PowerShell single quotes keep backslashes and non-ASCII characters literal.
$quotedArgs = ($EditorArgs | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join ' '

$splitJson = (& $herdr pane split --current --direction right --cwd (Get-Location).Path --focus 2>&1) -join "`n"
$split = $null
try { $split = $splitJson | ConvertFrom-Json } catch { }
$paneId = $split.result.pane.pane_id
if (-not $paneId) {
    [Console]::Error.WriteLine("vim-shim: herdr pane split failed: $splitJson")
    exit 1
}

& $herdr pane run $paneId "nvim $quotedArgs; exit" | Out-Null

# Block until the pane is gone, which happens when Neovim and its shell exit.
while ($true) {
    Start-Sleep -Milliseconds 500
    $state = (& $herdr pane get $paneId 2>&1) -join "`n"
    if ($state -match 'pane_not_found') { break }
    if ($LASTEXITCODE -ne 0 -and $state -notmatch '"result"') { break }
}
exit 0

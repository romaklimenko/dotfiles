# Keeps a herdr workspace when its last tab or pane goes away. herdr closes a
# workspace together with its last tab, so before the last pane of the last
# tab closes, this opens a fresh shell tab in the same workspace.
#
#   -Closing tab         prefix+shift+x in config.toml: close the active tab
#   -Closing pane        prefix+x in config.toml: close the active pane
#   -Closing shell-exit  PowerShell profile, on exit: only add the fresh tab,
#                        because the exiting shell closes its own pane
#
# herdr runs key binding commands with the focused pane in
# HERDR_ACTIVE_PANE_ID. The profile passes its own pane in HERDR_PANE_ID.
param(
    [ValidateSet('tab', 'pane', 'shell-exit')]
    [string] $Closing = 'tab'
)

$herdr = if ($env:HERDR_BIN_PATH) { $env:HERDR_BIN_PATH } else { 'herdr' }
$paneId = if ($Closing -eq 'shell-exit') { $env:HERDR_PANE_ID } else { $env:HERDR_ACTIVE_PANE_ID }
if (-not $paneId) { exit 1 }

# Ask herdr where the pane is now. A moved pane gets new workspace and tab IDs.
$pane = (& $herdr pane get $paneId | ConvertFrom-Json).result.pane
if ($LASTEXITCODE -ne 0 -or -not $pane) { exit 1 }
$tabs = @((& $herdr tab list --workspace $pane.workspace_id | ConvertFrom-Json).result.tabs)
if ($LASTEXITCODE -ne 0 -or $tabs.Count -eq 0) { exit 1 }

$tab = @($tabs | Where-Object tab_id -eq $pane.tab_id)[0]
$closesWorkspace = $tabs.Count -eq 1 -and ($Closing -eq 'tab' -or $tab.pane_count -le 1)
if ($closesWorkspace) {
    # Without --cwd the new tab follows terminal.new_cwd, as prefix+c does.
    $created = & $herdr tab create --workspace $pane.workspace_id | ConvertFrom-Json
    # Without a replacement tab, closing would take the workspace with it.
    if ($LASTEXITCODE -ne 0 -or -not $created.result.tab.tab_id) { exit 1 }
}

switch ($Closing) {
    'tab' { & $herdr tab close $pane.tab_id }
    'pane' { & $herdr pane close $paneId }
}
exit $LASTEXITCODE

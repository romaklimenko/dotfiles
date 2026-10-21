# Closes the active herdr tab but keeps its workspace. herdr closes a
# workspace together with its last tab, so when the active tab is the last
# one, this opens a fresh shell tab first. config.toml binds it to
# prefix+shift+x in place of the built-in close_tab. herdr runs it with the
# active workspace and tab in HERDR_ACTIVE_WORKSPACE_ID and HERDR_ACTIVE_TAB_ID.

$herdr = if ($env:HERDR_BIN_PATH) { $env:HERDR_BIN_PATH } else { 'herdr' }
$workspaceId = $env:HERDR_ACTIVE_WORKSPACE_ID
$tabId = $env:HERDR_ACTIVE_TAB_ID
if (-not $workspaceId -or -not $tabId) { exit 1 }

$list = & $herdr tab list --workspace $workspaceId | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $list.result) { exit 1 }

if (@($list.result.tabs).Count -le 1) {
    # Without --cwd the new tab follows terminal.new_cwd, as prefix+c does.
    $created = & $herdr tab create --workspace $workspaceId | ConvertFrom-Json
    # Without a replacement tab, closing would take the workspace with it.
    if ($LASTEXITCODE -ne 0 -or -not $created.result.tab.tab_id) { exit 1 }
}

& $herdr tab close $tabId
exit $LASTEXITCODE

# Pick a pane from every psmux session with fzf and switch to it.
# Bound to prefix + Space in ~/.psmux.conf, where it runs in a popup.
# Each line shows the session, the window and pane number, and the pane
# label. The preview on the right shows the pane's screen.
#
# The hidden first field is the target, such as =webshop:2.%7. psmux resolves
# window.pane numbers wrongly when pane-base-index is 1, and pane ids repeat
# across sessions, so the target names the session, the window and the id.

# Session names and agent titles can hold characters such as æ and ✳.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# psmux reads new pane titles only for sessions that have a client attached,
# and list-panes does not refresh them. display-message does, so touch each
# session first, or the other projects show stale titles.
foreach ($session in tmux list-sessions -F '#{session_name}') {
    tmux display-message -t "=${session}:" -p '' | Out-Null
}

$format = "=#{session_name}:#{window_index}.#{pane_id}`t#{p16:#{=16:session_name}} #{p5:#{window_index}.#{pane_index}} #{E:@pane_label}"
$choice = tmux list-panes -a -F $format |
    fzf --delimiter "`t" --with-nth 2 --reverse --prompt 'pane> ' `
        --preview 'tmux capture-pane -ep -t {1}' --preview-window 'right,55%'

if ($choice) {
    tmux switch-client -t ($choice -split "`t")[0]
}

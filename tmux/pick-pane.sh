#!/bin/sh
# Pick a pane from every tmux session with fzf and switch to it.
# Bound to prefix + Space in ~/.tmux.conf, where it runs in a popup.
# Each line shows the session, the window and pane number, and the pane
# label. The preview on the right shows the pane's screen.
#
# The hidden first field is the target, such as =webshop:2.%7. psmux resolves
# window.pane numbers wrongly when pane-base-index is 1, so the target uses
# the pane id, which works in both tmux and psmux.

target=$(
    tmux list-panes -a -F '=#{session_name}:#{window_index}.#{pane_id}	#{p16:#{=16:session_name}} #{p5:#{window_index}.#{pane_index}} #{E:@pane_label}' |
        fzf --delimiter '	' --with-nth 2 --reverse --prompt 'pane> ' \
            --preview 'tmux capture-pane -ep -t {1}' --preview-window 'right,55%' |
        cut -f1
)
[ -n "$target" ] && tmux switch-client -t "$target"

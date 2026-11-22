#!/bin/sh
# ============================================================================
# ws.sh - open a workspace as a tmux session named after its folder
#
# The ws shell function (shell/aliases.sh) and the :ws command in tmux
# (tmux/tmux.conf) both run this script.
#
# "ws" opens the current folder, "ws backstage" opens ./backstage, or
# $DEV_HOME/backstage if there is no ./backstage. Outside tmux it attaches;
# inside tmux it switches to the session instead of nesting.
# ============================================================================

folder="${1:-.}"
dev_home="${DEV_HOME:-$HOME/Work}"
if [ ! -d "$folder" ] && [ -d "$dev_home/$folder" ]; then
    folder="$dev_home/$folder"
fi
# CDPATH would make cd print the folder, and that would end up in $dir.
dir=$(CDPATH='' cd "$folder" && pwd) || exit
# tmux does not allow . or : in session names.
name=$(basename "$dir" | tr '.:' '__')
tmux has-session -t "=$name" 2>/dev/null || tmux new-session -d -s "$name" -c "$dir" || exit
if [ -n "$TMUX" ]; then
    exec tmux switch-client -t "=$name"
else
    exec tmux attach-session -t "=$name"
fi

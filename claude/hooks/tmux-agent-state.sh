#!/bin/sh
# ============================================================================
# tmux-agent-state.sh - mark a coding agent's tmux window as done or waiting
#
# Claude Code hooks (claude/settings.json) and Codex notify run this script.
# It sets the tmux window option @agent, and tmux/tmux.conf shows it as a
# glyph in front of the window name: ✅ for done, ❓ for waiting. tmux clears
# done when you open the window. The next prompt or tool call clears both.
#
# Usage: tmux-agent-state.sh done|waiting|clear
#
# The script always exits 0 after a tmux error. Exit code 2 would block the
# tool call in a Claude Code PreToolUse hook.
# ============================================================================

# Outside tmux there is no window to mark.
[ -n "$TMUX_PANE" ] || exit 0

state=$1

# You're already looking at this window, so there's nothing to flag.
if [ "$state" = done ] &&
    [ "$(tmux display-message -p -t "$TMUX_PANE" '#{&&:#{window_active},#{session_attached}}' 2>/dev/null)" = 1 ]; then
    state=clear
fi

case $state in
    done | waiting) tmux set-option -w -t "$TMUX_PANE" @agent "$state" 2>/dev/null ;;
    clear) tmux set-option -wu -t "$TMUX_PANE" @agent 2>/dev/null ;;
    *)
        echo "usage: tmux-agent-state.sh done|waiting|clear" >&2
        exit 1
        ;;
esac
exit 0

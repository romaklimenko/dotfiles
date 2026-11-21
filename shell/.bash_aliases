# ============================================================================
# .bash_aliases - bash versions of the oh-my-zsh aliases
# Author: Roman Klimenko (@romaklimenko)
#
# zsh gets these from oh-my-zsh (lib, git, common-aliases, extract, ubuntu).
# bash has no oh-my-zsh, so this file defines the same names by hand. Only
# .bashrc loads it.
# ============================================================================

# -----------------------------------------------------------------------------
# Navigation (oh-my-zsh lib/directories)
# -----------------------------------------------------------------------------

alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias -- -='cd -'
alias md='mkdir -p'
alias rd='rmdir'

mkcd() {
    mkdir -p "$1" && cd "$1"
}
alias take='mkcd'

# -----------------------------------------------------------------------------
# Listing (oh-my-zsh common-aliases)
# -----------------------------------------------------------------------------

if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
fi
alias grep='grep --color'
alias l='ls -lFh'
alias la='ls -lAFh'
alias ll='ls -l'
alias lt='ls -ltFh'
alias lsa='ls -lah'
alias ldot='ls -ld .*'

alias h='history'
alias hgrep='history | grep'
alias dud='du -d 1 -h'
alias ff='find . -type f -name'
command -v fd >/dev/null 2>&1 || alias fd='find . -type d -name'
alias t='tail -f'

# -----------------------------------------------------------------------------
# Git (oh-my-zsh git plugin)
# -----------------------------------------------------------------------------

alias g='git'
alias gst='git status'
alias gss='git status --short'
alias ga='git add'
alias gaa='git add --all'
alias gc='git commit --verbose'
alias gca='git commit --verbose --all'
alias gcmsg='git commit --message'
alias gp='git push'
alias gl='git pull'
alias gf='git fetch'
alias gd='git diff'
alias gds='git diff --staged'
alias gco='git checkout'
alias gcb='git checkout -b'
alias gsw='git switch'
alias gswc='git switch --create'
alias gb='git branch'
alias gba='git branch --all'
alias gm='git merge'
alias grv='git remote --verbose'
alias glo='git log --oneline --decorate'
alias glog='git log --oneline --decorate --graph'
alias glol='git log --graph --pretty="%Cred%h%Creset -%C(auto)%d%Creset %s %Cgreen(%ar) %C(bold blue)<%an>%Creset"'

# -----------------------------------------------------------------------------
# Archives (oh-my-zsh extract plugin)
# -----------------------------------------------------------------------------

extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"     ;;
            *.tar.gz)    tar xzf "$1"     ;;
            *.tar.xz)    tar xJf "$1"     ;;
            *.bz2)       bunzip2 "$1"     ;;
            *.rar)       unrar x "$1"     ;;
            *.gz)        gunzip "$1"      ;;
            *.tar)       tar xf "$1"      ;;
            *.tbz2)      tar xjf "$1"     ;;
            *.tgz)       tar xzf "$1"     ;;
            *.zip)       unzip "$1"       ;;
            *.Z)         uncompress "$1"  ;;
            *.7z)        7z x "$1"        ;;
            *)           echo "'$1' cannot be extracted via extract()" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}
alias x='extract'

# -----------------------------------------------------------------------------
# Python (oh-my-zsh python plugin)
# -----------------------------------------------------------------------------

alias pyfind='find . -name "*.py"'
alias pyserver='python3 -m http.server'

# -----------------------------------------------------------------------------
# apt (oh-my-zsh ubuntu plugin)
# -----------------------------------------------------------------------------

if command -v apt >/dev/null 2>&1; then
    alias agu='sudo apt update'
    alias agug='sudo apt upgrade'
    alias agi='sudo apt install'
    alias agr='sudo apt remove'
    alias agar='sudo apt autoremove'
    alias acs='apt-cache search'
fi

# ============================================================================
# .bash_aliases - Bash aliases
# Author: Roman Klimenko (@romaklimenko)
# ============================================================================

# -----------------------------------------------------------------------------
# Navigation
# -----------------------------------------------------------------------------

alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias ~='cd ~'

# Quick navigation to common directories
alias dots='cd ~/dotfiles'

# -----------------------------------------------------------------------------
# List Commands
# -----------------------------------------------------------------------------

# Enable color support of ls
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# List aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias lh='ls -lh'
alias lt='ls -ltr'

# Tree with color and formatting
if command -v tree &> /dev/null; then
    alias tree='tree -C'
fi

# -----------------------------------------------------------------------------
# Safety Aliases
# -----------------------------------------------------------------------------

# Interactive mode for destructive commands
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Safer alternatives
alias rmdir='rmdir -v'

# -----------------------------------------------------------------------------
# Git Shortcuts
# -----------------------------------------------------------------------------

alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gca='git commit -a'
alias gcm='git commit -m'
alias gp='git push'
alias gpl='git pull'
alias gl='git log --oneline --graph --decorate'
alias gd='git diff'
alias gds='git diff --staged'
alias gco='git checkout'
alias gb='git branch'
alias gba='git branch -a'
alias gm='git merge'
alias gr='git remote -v'
alias gf='git fetch'
alias glog='git log --graph --pretty=format:"%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset" --abbrev-commit'

# -----------------------------------------------------------------------------
# Editor
# -----------------------------------------------------------------------------

alias vim='nvim'
alias vi='nvim'
alias v='nvim'

# -----------------------------------------------------------------------------
# Utility Commands
# -----------------------------------------------------------------------------

# Make directory and cd into it
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Extract various archive formats
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"     ;;
            *.tar.gz)    tar xzf "$1"     ;;
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

# Find process by name
psg() {
    ps aux | grep -v grep | grep -i -e VSZ -e "$1"
}

# Create backup of file
backup() {
    cp "$1"{,.backup-$(date +%Y%m%d-%H%M%S)}
}

# Quick file search
ff() {
    find . -type f -name "*$1*"
}

# Quick directory search
fd() {
    find . -type d -name "*$1*"
}

# -----------------------------------------------------------------------------
# System Information
# -----------------------------------------------------------------------------

# Show disk usage
alias df='df -h'
alias du='du -h'
alias duh='du -h --max-depth=1'

# Show system info
alias meminfo='free -h'
alias cpuinfo='lscpu'

# Show open ports
alias ports='netstat -tulanp'

# -----------------------------------------------------------------------------
# Shortcuts
# -----------------------------------------------------------------------------

# Clear screen
alias c='clear'
alias cls='clear'

# History
alias h='history'
alias hg='history | grep'

# Reload bash configuration
alias reload='source ~/.bashrc'

# Edit configuration files
alias bashrc='$EDITOR ~/dotfiles/linux/.bashrc'
alias aliases='$EDITOR ~/dotfiles/linux/.bash_aliases'

# -----------------------------------------------------------------------------
# Apt Shortcuts (Ubuntu/Debian)
# -----------------------------------------------------------------------------

if command -v apt &> /dev/null; then
    alias update='sudo apt update'
    alias upgrade='sudo apt upgrade'
    alias install='sudo apt install'
    alias remove='sudo apt remove'
    alias search='apt search'
    alias show='apt show'
fi

# -----------------------------------------------------------------------------
# Docker Shortcuts (if Docker is installed)
# -----------------------------------------------------------------------------

if command -v docker &> /dev/null; then
    alias d='docker'
    alias dc='docker-compose'
    alias dps='docker ps'
    alias dpsa='docker ps -a'
    alias di='docker images'
    alias drm='docker rm'
    alias drmi='docker rmi'
    alias dstop='docker stop'
    alias dstart='docker start'
fi

# -----------------------------------------------------------------------------
# Python Shortcuts (if Python is installed)
# -----------------------------------------------------------------------------

if command -v python3 &> /dev/null; then
    alias python='python3'
    alias pip='pip3'
    alias py='python3'
fi

# Create Python virtual environment
alias venv='python3 -m venv venv'
alias activate='source venv/bin/activate'

# -----------------------------------------------------------------------------
# Network Utilities
# -----------------------------------------------------------------------------

# Show external IP
alias myip='curl -s ifconfig.me'

# Show local IPs
alias localip='hostname -I'

# Ping with 5 count
alias ping='ping -c 5'

# Fast ping
alias fastping='ping -c 100 -i.2'

# -----------------------------------------------------------------------------
# Miscellaneous
# -----------------------------------------------------------------------------

# Weather
alias weather='curl wttr.in'

# Quick webserver
alias serve='python3 -m http.server'

# Copy to clipboard (if xclip is installed)
if command -v xclip &> /dev/null; then
    alias clip='xclip -selection clipboard'
fi

# Generate random password
alias genpass='openssl rand -base64 20'

# Show PATH in readable format
alias path='echo -e ${PATH//:/\\n}'

@echo off
rem Editor shim named "vim" that runs Neovim.
rem When hunk launches it inside a herdr pane, Neovim opens in a new herdr
rem pane instead, because hunk's suspended terminal on Windows never
rem forwards keystrokes to a child editor. See vim-shim.ps1.
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0vim-shim.ps1" %*
exit /b %ERRORLEVEL%

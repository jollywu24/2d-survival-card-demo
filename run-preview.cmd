@echo off
setlocal
set "NODE_HOME=%~dp0.tools\node-v20.19.2-win-x64"
set "PATH=%NODE_HOME%;%PATH%"
call "%NODE_HOME%\npm.cmd" run preview -- %*

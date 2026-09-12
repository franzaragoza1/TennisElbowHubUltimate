@echo off
REM Bridge solution while the bot doesn't have a permanent home (see docs/decisiones.md
REM for the Docker/home-server setup this mirrors) — runs "npm run bot" in a restart
REM loop, so a crash or a lost Discord connection doesn't just leave the bot offline
REM until someone notices. Meant to be launched at Windows logon (see the Startup
REM shortcut created alongside this file), not run by hand normally.
cd /d "%~dp0.."

:loop
echo [%date% %time%] Starting Discord bot...
call npm run bot
echo [%date% %time%] Bot exited (code %errorlevel%) - restarting in 10s...
timeout /t 10 /nobreak >nul
goto loop

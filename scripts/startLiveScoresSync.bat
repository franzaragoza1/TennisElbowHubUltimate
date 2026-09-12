@echo off
REM Bridge solution while there's no dedicated server for this yet — runs
REM "npm run live-scores-sync" in a restart loop, same pattern as startBot.bat.
cd /d "%~dp0.."

:loop
echo [%date% %time%] Starting live-scores sync...
call npm run live-scores-sync
echo [%date% %time%] Sync process exited (code %errorlevel%) - restarting in 10s...
timeout /t 10 /nobreak >nul
goto loop

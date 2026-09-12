@echo off
REM Windows equivalent of scripts/autoScrapeLoop.sh (the home server's Docker loop) —
REM runs "npm run autoscrape" (refreshes ongoing tournaments + recent results only,
REM never rankings or a full backfill) every 10 minutes, forever. A failed pass
REM (anti-bot challenge, network blip) doesn't stop the loop, same tolerance as the
REM Linux version.
cd /d "%~dp0.."

:loop
echo [%date% %time%] Running autoscrape pass...
call npm run autoscrape
echo [%date% %time%] Pass finished (code %errorlevel%) - next pass in 10 min.
timeout /t 600 /nobreak >nul
goto loop

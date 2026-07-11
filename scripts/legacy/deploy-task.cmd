@echo off
chcp 65001 >nul
rem Auto-deploy wrapper (launched hidden via run-hidden.vbs from Task Scheduler)
cd /d C:\Users\newuser8\shimanto-projects\nishimatsuya-coorde
echo ==== %DATE% %TIME% deploy start ==== >> deploy.log
call npm run deploy >> deploy.log 2>&1
echo ==== %DATE% %TIME% deploy end (exit %ERRORLEVEL%) ==== >> deploy.log

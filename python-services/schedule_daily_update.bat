@echo off
REM Daily Bulk Deals Update Script
REM Schedule this in Windows Task Scheduler to run at 6:02 PM IST daily

cd /d "%~dp0"
python daily_update.py >> daily_update.log 2>&1

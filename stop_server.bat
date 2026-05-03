@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8053 ^| findstr LISTENING') do (
    taskkill /F /PID %%a
)

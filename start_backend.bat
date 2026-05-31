@echo off
title FastAPI Backend
cd /d "%~dp0"
echo Starte FastAPI Backend auf http://localhost:8000 ...
echo Docs: http://localhost:8000/docs
echo.
call .venv\Scripts\activate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
pause

@echo off
title Dashboard Starter
cd /d "%~dp0"
echo ============================================
echo   Finanz-Dashboard wird gestartet...
echo ============================================
echo.
echo [1/2] Starte FastAPI Backend (Port 8000)...
start "FastAPI Backend" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000"

echo Warte 3 Sekunden bis Backend bereit ist...
timeout /t 3 /nobreak >nul

echo [2/2] Starte Streamlit Frontend (Port 8501)...
start "Streamlit Frontend" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && streamlit run frontend\app\dashboard.py"

echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:8501
echo   API Docs: http://localhost:8000/docs
echo ============================================
timeout /t 3 /nobreak >nul

@echo off
title Streamlit Frontend
cd /d "%~dp0"
echo Starte Streamlit Dashboard auf http://localhost:8501 ...
echo.
call .venv\Scripts\activate
streamlit run frontend\app\dashboard.py
pause

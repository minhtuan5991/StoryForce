@echo off
cd /d "%~dp0.."
".venv\Scripts\python.exe" "launcher\main.py" --helper stop

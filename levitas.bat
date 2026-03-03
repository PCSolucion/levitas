@echo off
title Levitas Dev Server
cd /d "%~dp0"

echo [1/2] Iniciando el servidor de desarrollo (Vite)...
echo.

:: Abrir el navegador en la ruta del dashboard
start "" "http://localhost:5173/dashboard.html"

:: Ejecutar el servidor de desarrollo
npm run dev

pause

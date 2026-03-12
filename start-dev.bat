@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   LUGs App - Inicio local
echo ==========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm no esta disponible en este terminal.
  echo Instala Node.js y vuelve a intentar.
  pause
  exit /b 1
)

echo [1/3] Abriendo shell de desarrollo...
start "LUGs Dev" cmd /k "call "%~dp0dev-shell.bat""

echo [2/3] Esperando unos segundos para levantar el servidor...
timeout /t 5 /nobreak >nul

echo [3/3] Abriendo navegador en http://localhost:3000
start "" "http://localhost:3000"

echo.
echo Listo. Revisa la ventana "LUGs Dev" para ver logs en vivo.
endlocal

@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   LUGs App - Dev Shell
echo ==========================================
echo.

if not exist node_modules (
  echo Instalando dependencias...
  npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo npm install.
    pause
    exit /b 1
  )
)

echo Iniciando Next.js en http://localhost:3000 ...
npm run dev

endlocal

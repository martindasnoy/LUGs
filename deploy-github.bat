@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ==========================================
echo   LUGs App - GitHub + Deploy
echo ==========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] git no esta disponible en este terminal.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm no esta disponible en este terminal.
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Esta carpeta no es un repositorio git.
  exit /b 1
)

set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: update and deploy"
set "VERCEL_SCOPE=martindasnoys-projects"

for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%i"
if "%BRANCH%"=="" set "BRANCH=main"

echo [1/5] Ejecutando build...
npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Fallo el build. No se sube nada.
  exit /b 1
)

echo [2/5] Agregando cambios...
git add -A

echo [3/5] Creando commit si hay cambios...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo el commit.
    exit /b 1
  )
) else (
  echo No hay cambios para commitear.
)

echo [4/5] Subiendo a GitHub en origin/%BRANCH%...
git push origin "%BRANCH%"
if errorlevel 1 (
  echo.
  echo [ERROR] Fallo el push a GitHub.
  exit /b 1
)

echo [5/5] Ejecutando deploy (Vercel)...
where npx >nul 2>&1
if errorlevel 1 (
  echo [WARN] npx no disponible. Se omite deploy CLI.
  echo       Si tenes deploy por integracion GitHub, se dispara con el push.
  exit /b 0
)

if defined VERCEL_TOKEN (
  npx vercel deploy --prod --yes --scope "%VERCEL_SCOPE%" --token "%VERCEL_TOKEN%"
) else (
  npx vercel deploy --prod --yes --scope "%VERCEL_SCOPE%"
)

if errorlevel 1 (
  echo.
  echo [WARN] El push fue exitoso pero fallo el deploy por CLI.
  echo       Revisa login/config de Vercel o deploy por GitHub integration.
  exit /b 1
)

echo.
echo Listo. Push y deploy ejecutados.
exit /b 0

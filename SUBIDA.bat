@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ==========================================
echo   SUBIDA - GitHub + Vercel Deploy
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

set "TARGET_BRANCH=%~2"
if "%TARGET_BRANCH%"=="" (
  for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set "TARGET_BRANCH=%%i"
)
if "%TARGET_BRANCH%"=="" set "TARGET_BRANCH=main"

set "DEPLOY_MODE=%~3"
if "%DEPLOY_MODE%"=="" set "DEPLOY_MODE=prod"

set "BUILD_MODE=%~4"
if "%BUILD_MODE%"=="" set "BUILD_MODE=build"

echo Commit msg : %COMMIT_MSG%
echo Branch     : %TARGET_BRANCH%
echo Deploy mode: %DEPLOY_MODE%
echo Build mode : %BUILD_MODE%
echo.

if /i "%BUILD_MODE%"=="nobuild" (
  echo [1/5] Se omite build por parametro.
) else (
  echo [1/5] Ejecutando build...
  npm run build
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo el build. No se sube nada.
    exit /b 1
  )
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

echo [4/5] Subiendo a GitHub en origin/%TARGET_BRANCH%...
git push origin "%TARGET_BRANCH%"
if errorlevel 1 (
  echo.
  echo [ERROR] Fallo el push a GitHub.
  exit /b 1
)

echo [5/5] Ejecutando deploy en Vercel...
where npx >nul 2>&1
if errorlevel 1 (
  echo [WARN] npx no disponible. Se omite deploy CLI.
  echo       Si hay integracion GitHub-Vercel, el deploy se dispara con el push.
  exit /b 0
)

if /i "%DEPLOY_MODE%"=="preview" goto DEPLOY_PREVIEW
goto DEPLOY_PROD

:DEPLOY_PROD
if defined VERCEL_SCOPE (
  if defined VERCEL_TOKEN (
    npx vercel deploy --prod --yes --scope "%VERCEL_SCOPE%" --token "%VERCEL_TOKEN%"
  ) else (
    npx vercel deploy --prod --yes --scope "%VERCEL_SCOPE%"
  )
) else (
  if defined VERCEL_TOKEN (
    npx vercel deploy --prod --yes --token "%VERCEL_TOKEN%"
  ) else (
    npx vercel deploy --prod --yes
  )
)
goto DEPLOY_END

:DEPLOY_PREVIEW
if defined VERCEL_SCOPE (
  if defined VERCEL_TOKEN (
    npx vercel deploy --yes --scope "%VERCEL_SCOPE%" --token "%VERCEL_TOKEN%"
  ) else (
    npx vercel deploy --yes --scope "%VERCEL_SCOPE%"
  )
) else (
  if defined VERCEL_TOKEN (
    npx vercel deploy --yes --token "%VERCEL_TOKEN%"
  ) else (
    npx vercel deploy --yes
  )
)

:DEPLOY_END
if errorlevel 1 (
  echo.
  echo [WARN] El push fue exitoso pero fallo el deploy por CLI.
  exit /b 1
)

echo.
echo Listo. Push y deploy ejecutados.
echo.
echo Uso:
echo   SUBIDA.bat "mensaje commit" [branch] [prod^|preview] [build^|nobuild]
echo Ejemplo:
echo   SUBIDA.bat "fix: ajustar contador" main prod build

exit /b 0

@echo off
chcp 1251 >nul
title CargoPlanner
setlocal EnableExtensions

:: Переход в папку скрипта — работает из любой папки
cd /d "%~dp0"

:: -- 1. Проверка Node.js ----------------------------------
where node >nul 2>nul
if errorlevel 1 goto nonode
for /f "delims=." %%M in ('node -v') do set "NODE_MAJOR=%%M"
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if %NODE_MAJOR% LSS 20 goto oldnode

:: -- 2. Длина пути > 200 символов > виртуальный диск Z: ----
powershell -NoProfile -Command "if ((Get-Location).Path.Length -le 200) { exit 1 } else { exit 0 }" >nul
if errorlevel 1 goto onedrive
subst Z: "%CD%" >nul
cd /d "Z:\"
echo Проект в длинном пути. Создан временный диск Z:.

:: -- 3. Предупреждение про OneDrive -----------------------
:onedrive
echo %~dp0 | findstr /C:"OneDrive" >nul
if not errorlevel 1 goto odwarn
goto envset
:odwarn
echo ВАЖНО: проект находится в OneDrive. Синхронизация может замедлить работу.
:envset

:: -- 4. Переменные окружения ------------------------------
set "NPM_CONFIG_CACHE=C:\npm-cache"
set "NODE_OPTIONS=--max-old-space-size=4096"

:: -- 5. Зависимости (первый запуск) -----------------------
if exist "node_modules\" goto buildcheck
echo Установка зависимостей (первый запуск, занимает 1-3 минуты)...
call npm install
if errorlevel 1 goto errnpm
:buildcheck

:: -- 6. Сборка, если out/ отсутствует или исходники новее --
if not exist "out\index.html" goto rebuild
powershell -NoProfile -Command "$src = @(); foreach ($d in 'app','components','hooks','lib','store','types','public') { $src += Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue }; $src += Get-Item 'next.config.ts','package.json' -ErrorAction SilentlyContinue; $out = Get-Item 'out\index.html' -ErrorAction SilentlyContinue; $newst = $src | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $out -or ($newst -and $newst.LastWriteTime -gt $out.LastWriteTime)) { exit 0 } else { exit 1 }" >nul
if errorlevel 1 goto portfind
:rebuild
echo Сборка проекта (npm run build)...
call npm run build
if errorlevel 1 goto errbuild
:portfind

:: -- 7. Поиск свободного порта (3000..3010) ----------------
set "APP_PORT=3000"
for /l %%P in (3000,1,3010) do (
  powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %%P); $c.Close(); exit 1 } catch { exit 0 }" >nul
  if errorlevel 1 ( set "APP_PORT=%%P" ) else ( goto portok )
)
:portok
set "PORT=%APP_PORT%"

:: -- 8. Браузер + сервер ----------------------------------
start "" "http://localhost:%APP_PORT%"
echo СЕРВЕР ЗАПУЩЕН: http://localhost:%APP_PORT%
echo Для остановки закройте окно или нажмите Ctrl+C.
echo ============================================
node server.js

echo.
echo Сервер остановлен.
pause
exit /b 0

:: -- Обработка ошибок -------------------------------------
:nonode
echo Node.js не найден.
echo Установите Node.js 20+ с nodejs.org
pause
exit /b 1

:oldnode
echo Установлена старая версия Node.js: %NODE_MAJOR%
echo Установите Node.js 20+ с nodejs.org
pause
exit /b 1

:errnpm
echo.
echo Ошибка установки зависимостей (npm install).
pause
exit /b 1

:errbuild
echo.
echo Ошибка сборки проекта (npm run build).
pause
exit /b 1
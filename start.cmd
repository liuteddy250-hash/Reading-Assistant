@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   ReadEasy - 英语阅读辅助
echo ==========================================
echo.

if exist "%~dp0..\.ollama-portable\app\ollama.exe" (
  echo [0/3] 启动本地大模型（Ollama）...
  start "Ollama" "%~dp0start-ollama.cmd"
) else (
  echo [0/3] 未发现本地大模型，使用离线分析模式。
)

if not exist "node_modules\next\package.json" (
  echo [1/3] 首次运行，正在安装依赖（可能需要几分钟）...
  call npm install
  if errorlevel 1 goto :failed
) else (
  echo [1/3] 依赖已安装，跳过。
)

if not exist "prisma\dev.db" (
  echo [2/3] 正在初始化数据库...
  call npm run db:push
  if errorlevel 1 (
    echo       db:push 失败，尝试使用内置建表脚本...
    call npm run db:init
    if errorlevel 1 goto :failed
  )
) else (
  echo [2/3] 数据库已存在，跳过。
)

echo [3/3] 启动服务：http://127.0.0.1:3000
echo       关闭本窗口即停止服务。
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://127.0.0.1:3000'"
call npm start
goto :eof

:failed
echo.
echo 启动失败，请把上面的报错发给我。
pause

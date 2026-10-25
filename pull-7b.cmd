@echo off
chcp 65001 >nul
set "BASE=%~dp0..\.ollama-portable"

echo 检查本地模型服务...
curl.exe -s -o nul --max-time 3 http://127.0.0.1:11434/api/tags
if errorlevel 1 (
  echo 模型服务未启动：请先双击 start-ollama.cmd，等窗口出现 "Listening" 后再运行本脚本。
  pause
  exit /b 1
)

echo 正在续传 qwen2.5:7b（约 4.7GB，已下载的分片会自动复用）...
set "USERPROFILE=%BASE%\home"
set "HOME=%USERPROFILE%"
set "OLLAMA_HOST=127.0.0.1:11434"
"%BASE%\app\ollama.exe" pull qwen2.5:7b

echo.
echo 下载完成后：
echo   1) 把 .env 里的 LLM_MODEL 改成 qwen2.5:7b，LLM_TIMEOUT_MS 改成 600000
echo   2) 在项目目录执行 npm run build 并重启站点
pause

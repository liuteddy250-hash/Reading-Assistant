@echo off
chcp 65001 >nul
set "BASE=%~dp0..\.ollama-portable"

if not exist "%BASE%\app\ollama.exe" (
  echo 未找到便携版 Ollama：%BASE%\app\ollama.exe
  echo 请从 https://ollama.com/download 下载 Windows 版并解压到该目录。
  pause
  exit /b 1
)

set "USERPROFILE=%BASE%\home"
set "HOME=%USERPROFILE%"
set "OLLAMA_MODELS=%BASE%\models"
set "OLLAMA_HOST=127.0.0.1:11434"
set "OLLAMA_CONTEXT_LENGTH=8192"

echo Ollama 启动中：http://127.0.0.1:11434
echo 关闭本窗口即停止本地模型服务。
"%BASE%\app\ollama.exe" serve

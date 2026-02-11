@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title 数据标注平台 - 启动器

:: ANSI Color Codes
set "ESC= "
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do set "ESC=%%b"
set "GREEN=%ESC%[32m"
set "BLUE=%ESC%[34m"
set "YELLOW=%ESC%[33m"
set "RED=%ESC%[31m"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"

cls
echo %BLUE%================================================%RESET%
echo %BLUE%%BOLD%        数据标注平台 - 高级启动界面%RESET%
echo %BLUE%================================================%RESET%
echo.

:: 1. Check Node.js
echo [%BLUE%INFO%RESET%] 正在检查环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [%RED%ERROR%RESET%] 未找到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)
echo [%GREEN%OK%RESET%] Node.js 已就绪.

:: 2. Check Ports
echo [%BLUE%INFO%RESET%] 检查端口占用...
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 echo [%YELLOW%WARN%RESET%] 端口 5000 后端已被占用

netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel% equ 0 echo [%YELLOW%WARN%RESET%] 端口 5173 前端已被占用

:: 3. Dependencies
if not exist "node_modules" (
    echo [%BLUE%INFO%RESET%] 正在安装后端依赖...
    call npm install
)

if not exist "client\node_modules" (
    echo [%BLUE%INFO%RESET%] 正在安装前端依赖...
    cd client && call npm install && cd ..
)

:: 4. Build/Dev Logic
echo [%BLUE%INFO%RESET%] 启动服务中 (全部在当前窗口运行)...

:: Start Backend in background
echo [%GREEN%OK%RESET%] 正在启动后端...
start /b node server.js

:: Start Frontend in background
echo [%GREEN%OK%RESET%] 正在启动前端...
cd client
start /b npm run dev > ../frontend.log 2>&1
cd ..

:: 5. Open Browser
echo [%BLUE%INFO%RESET%] 等待服务器响应并打开浏览器...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo %GREEN%================================================%RESET%
echo %GREEN%   服务已成功启动！(无外部弹窗)%RESET%
echo %GREEN%================================================%RESET%
echo.
echo   后端日志已记录至: backend.log
echo   前端日志已记录至: frontend.log
echo.
echo   %BLUE%后端接口:%RESET%  http://localhost:5000
echo   %BLUE%前端界面:%RESET%  http://localhost:5173
echo.
echo %YELLOW%提示: 按 Ctrl+C 可以停止当前窗口的所有服务。%RESET%
echo.
pause


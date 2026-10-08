@echo off
chcp 65001 >nul
title 部署到 GitHub Pages

echo ===================================================
echo   正在自动提交并推送到 GitHub Pages...
echo ===================================================
echo.

cd /d "%~dp0"

git add .
git status -s

set /p msg="请输入更新说明(直接回车默认: update site): "
if "%msg%"=="" set msg=update site

git commit -m "%msg%"
if %errorlevel% neq 0 (
    echo.
    echo [提示] 没有检测到新改动，无需推送。
) else (
    echo.
    echo 正在推送到 GitHub...
    git push origin main
    if %errorlevel% equ 0 (
        echo.
        echo ===================================================
        echo   [成功] 代码已推送至 GitHub!
        echo   GitHub Pages 将在 30 秒至 1 分钟内自动刷新：
        echo   https://lilycarry.github.io/biped-lab-profile/
        echo ===================================================
    ) else (
        echo.
        echo [错误] 推送失败，请检查网络或 SSH 连接。
    )
)

echo.
echo 按任意键退出...
pause >nul

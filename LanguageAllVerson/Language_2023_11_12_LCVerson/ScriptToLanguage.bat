@echo off

REM 定义要安装的 Node.js 版本
set "node_version=v16.13.2"

REM 定义安装目录
set "install_dir=C:\Program Files\Node.js"

REM 检查是否已安装 Node.js
node -v > nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js No installation step is required. Procedure
    goto :done
)

REM 创建安装目录
mkdir "%install_dir%"

REM 下载 Node.js 安装程序
curl -o "%install_dir%\node_installer.msi" https://nodejs.org/dist/%node_version%/node-%node_version%-x64.msi

REM 静默安装 Node.js
msiexec /i "%install_dir%\node_installer.msi" /qn

REM 验证安装结果
node -v
npm -v

REM 清理临时文件
del "%install_dir%\node_installer.msi"

:done

REM 获取当前批处理文件的路径
set "currentPath=%~dp0"

cd /d C:\Program Files\
node -v
node %currentPath%\ToLanguage.js
pause
@echo off
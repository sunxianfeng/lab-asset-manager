#!/bin/bash

# Lab Asset Manager - 快速启动脚本
# 自动检查并启动 PocketBase 和 Next.js 开发服务器

set -e

echo "🚀 Lab Asset Manager - Quick Start"
echo "=================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 PocketBase
PB_COMMAND=""
if command -v pocketbase &> /dev/null; then
    PB_COMMAND="pocketbase"
    echo "✅ PocketBase 已安装（全局）"
elif [ -f "./pocketbase" ]; then
    PB_COMMAND="./pocketbase"
    echo "✅ PocketBase 已安装（本地）"
else
    echo "❌ PocketBase 未找到"
    echo ""
    echo "请先安装 PocketBase："
    echo "  macOS: brew install pocketbase"
    echo "  或从 https://github.com/pocketbase/pocketbase/releases 下载"
    exit 1
fi

# 检查 web 目录
if [ ! -d "web" ]; then
    echo "❌ 未找到 web 目录，请在项目根目录运行此脚本"
    exit 1
fi

# 检查 node_modules
if [ ! -d "web/node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    cd web
    npm install
    cd ..
    echo "✅ 依赖安装完成"
fi

# 检查是否已有 pb_data（是否首次运行）
FIRST_RUN=false
if [ ! -d "pb_data" ]; then
    FIRST_RUN=true
    echo ""
    echo "⚠️  检测到首次运行"
fi

# 启动 PocketBase（后台）
echo ""
echo "🗄️  启动 PocketBase..."
$PB_COMMAND serve --dir ./pb_data > pocketbase.log 2>&1 &
PB_PID=$!
echo "✅ PocketBase 已启动 (PID: $PB_PID)"
echo "   - 管理界面: http://127.0.0.1:8090/_/"
echo "   - 日志文件: pocketbase.log"

# 等待 PocketBase 启动
echo ""
echo "⏳ 等待 PocketBase 准备就绪..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8090/api/health > /dev/null 2>&1; then
        echo "✅ PocketBase 已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PocketBase 启动超时"
        kill $PB_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# 首次运行提示
if [ "$FIRST_RUN" = true ]; then
    echo ""
    echo "📝 首次运行设置："
    echo "   1. 打开 http://127.0.0.1:8090/_/ 创建管理员账户"
    echo "   2. 然后运行以下命令初始化数据库："
    echo ""
    echo "      export PB_ADMIN_EMAIL=你的邮箱"
    echo "      export PB_ADMIN_PASSWORD=你的密码"
    echo "      cd web && npm run init-db"
    echo ""
    echo "   3. 完成后手动为 users collection 添加 role 字段"
    echo "      详见: SETUP_GUIDE.md"
    echo ""
    read -p "完成上述步骤后按回车继续..."
fi

# 启动 Next.js
echo ""
echo "⚛️  启动 Next.js 开发服务器..."
cd web
npm run dev &
NEXT_PID=$!
cd ..

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📍 访问地址："
echo "   - 应用: http://localhost:3000"
echo "   - PocketBase 管理: http://127.0.0.1:8090/_/"
echo ""
echo "🛑 停止服务："
echo "   按 Ctrl+C 或运行: kill $PB_PID $NEXT_PID"
echo ""
echo "📝 进程 ID："
echo "   - PocketBase: $PB_PID"
echo "   - Next.js: $NEXT_PID"
echo ""

# 保存 PID 到文件
echo "$PB_PID" > .pocketbase.pid
echo "$NEXT_PID" > .nextjs.pid

# 等待任意进程退出
wait -n

# 清理
echo ""
echo "🧹 清理进程..."
kill $PB_PID $NEXT_PID 2>/dev/null || true
rm -f .pocketbase.pid .nextjs.pid

echo "✅ 已停止所有服务"

#!/bin/bash

# Lab Asset Manager - 停止脚本
# 停止所有运行中的服务

echo "🛑 停止 Lab Asset Manager 服务..."

# 从 PID 文件读取并停止
if [ -f ".pocketbase.pid" ]; then
    PB_PID=$(cat .pocketbase.pid)
    if kill -0 $PB_PID 2>/dev/null; then
        echo "   停止 PocketBase (PID: $PB_PID)..."
        kill $PB_PID
    fi
    rm -f .pocketbase.pid
fi

if [ -f ".nextjs.pid" ]; then
    NEXT_PID=$(cat .nextjs.pid)
    if kill -0 $NEXT_PID 2>/dev/null; then
        echo "   停止 Next.js (PID: $NEXT_PID)..."
        kill $NEXT_PID
    fi
    rm -f .nextjs.pid
fi

# 强制停止所有相关进程（备用方案）
pkill -f "pocketbase serve" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

echo "✅ 所有服务已停止"

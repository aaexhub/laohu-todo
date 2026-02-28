#!/bin/bash
# 老胡任务清单启动脚本
# 端口: 8889

PORT=8889
DIR="/Users/humengjie/胡孟杰/todo-app"

check_port() {
    if curl -s http://localhost:$PORT > /dev/null 2>&1; then
        if curl -s http://localhost:$PORT | grep -q "任务清单"; then
            echo "✅ 任务清单已在运行 (端口 $PORT)"
            return 0
        else
            echo "⚠️ 端口 $PORT 被其他程序占用！"
            return 1
        fi
    fi
    return 2
}

start_service() {
    echo "🚀 启动任务清单..."
    cd "$DIR"
    nohup python3 -m http.server $PORT --bind 0.0.0.0 > /tmp/todo-app.log 2>&1 &
    sleep 1
    if curl -s http://localhost:$PORT > /dev/null 2>&1; then
        echo "✅ 启动成功！"
        echo ""
        echo "📖 访问地址："
        echo "   本机: http://localhost:$PORT"
    else
        echo "❌ 启动失败"
    fi
}

case "$1" in
    start)
        check_port
        result=$?
        if [ $result -eq 0 ]; then
            echo ""
            echo "📖 访问地址: http://localhost:$PORT"
            exit 0
        elif [ $result -eq 1 ]; then
            exit 1
        else
            start_service
        fi
        ;;
    stop)
        echo "🛑 停止服务..."
        pkill -f "http.server $PORT"
        echo "✅ 已停止"
        ;;
    status)
        check_port
        if [ $? -eq 0 ]; then
            echo ""
            echo "📖 访问地址: http://localhost:$PORT"
        fi
        ;;
    *)
        echo "用法: $0 {start|stop|status}"
        ;;
esac

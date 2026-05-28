#!/bin/zsh
cd "$(dirname "$0")"

PORT="${PORT:-4174}"
URL="http://127.0.0.1:${PORT}"

if ! lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  npm start &
  SERVER_PID=$!
  sleep 1
fi

open "$URL"

echo "行动清单已打开：$URL"
echo "如果这个窗口是本脚本启动的服务窗口，关闭窗口会停止本地服务。"
echo "按 Ctrl+C 可以手动停止。"

if [ -n "$SERVER_PID" ]; then
  wait "$SERVER_PID"
fi

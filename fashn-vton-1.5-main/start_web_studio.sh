#!/usr/bin/env bash
# ======================================================================
# FASHN VTON 1.5 - Virtual Try-On Studio Server (Linux / Docker / Colab)
# ======================================================================

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-7860}"
WEIGHTS_DIR="${WEIGHTS_DIR:-./weights}"

echo "======================================================================"
echo " Starting FASHN VTON 1.5 Web Studio Server..."
echo " Listening on: http://${HOST}:${PORT}"
echo " Accessible via your server IP (e.g., http://172.28.0.12:${PORT})"
echo "======================================================================"

python3 web_server.py --host "$HOST" --port "$PORT" --weights-dir "$WEIGHTS_DIR" "$@"

#!/usr/bin/env bash
# ======================================================================
# FASHN VTON 1.5 - Virtual Try-On Studio Server (Linux / Docker / Colab)
# ======================================================================

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-7860}"
SERVER_IP="${SERVER_IP:-172.28.0.12}"
WEIGHTS_DIR="${WEIGHTS_DIR:-./weights}"

echo "======================================================================"
echo " Starting FASHN VTON 1.5 Web Studio Server..."
echo " Host URL:      http://${SERVER_IP}:${PORT}"
echo " Local URL:     http://localhost:${PORT}"
echo " Listening on:  http://${HOST}:${PORT} (0.0.0.0 binds to all IPs)"
echo "======================================================================"

python3 web_server.py --host "$HOST" --port "$PORT" --weights-dir "$WEIGHTS_DIR" "$@"

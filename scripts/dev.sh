#!/usr/bin/env bash
# 并行启动源码 Hub + Vite Web（多 worktree 友好）。
# 入口：just dev · 亦可：./scripts/dev.sh
#
# 环境变量：
#   HUB_PORT      固定 Hub 端口（默认随机 ≥10000）
#   WEB_DEV_PORT  Vite 起始端口（默认 5000；占用则 Vite 自增）
#   FREEANIMA_URL 由本脚本写入，仅作 Vite /hub|/mcp proxy 目标
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

hub_port="${HUB_PORT:-}"
if [[ -z "$hub_port" ]]; then
  hub_port="$(bun -e '
    import { pickRandomAvailableTcpPort, DEV_HUB_PORT_MIN } from "./src/app/cli/tcp-port-available.ts";
    const p = await pickRandomAvailableTcpPort("127.0.0.1", DEV_HUB_PORT_MIN);
    process.stdout.write(String(p));
  ')"
fi

export FREEANIMA_URL="http://127.0.0.1:${hub_port}"
export WEB_DEV_PORT="${WEB_DEV_PORT:-5000}"

echo "dev · Hub ${FREEANIMA_URL} · Web from :${WEB_DEV_PORT} (proxy only; browser hub = page origin)"

bun run dev:hub -- --port "${hub_port}" --strict-port &
hub_pid=$!
bun run dev:web &
web_pid=$!

cleanup() {
  kill "$hub_pid" "$web_pid" 2>/dev/null || true
  wait "$hub_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$hub_pid" "$web_pid"

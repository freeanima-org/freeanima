#!/usr/bin/env bash
# 并行启动源码 Hub + Vite Web（多 worktree 友好）。
# 入口：just dev · 亦可：./scripts/dev.sh
#
# 环境变量：
#   HUB_PORT      固定 Hub 端口（默认随机 ≥10000）
#   WEB_DEV_PORT  Vite 起始端口（默认 5000；占用则 Vite 自增）
#   FREEANIMA_URL 由本脚本写入，仅作 Vite /hub|/mcp proxy 目标
set -euo pipefail
# 后台 job 各自成进程组（pgid == 首进程 pid），便于 Ctrl+C / EXIT 时整组杀掉，
# 避免只 kill「bun run」包装进程而留下 dev-hub / vite 孙进程。
set -m

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
  trap - EXIT INT TERM
  # 负 pid = 杀整个进程组（含 bun run → bun/node 孙进程）
  kill -TERM -- -"$hub_pid" -"$web_pid" 2>/dev/null || true
  wait "$hub_pid" "$web_pid" 2>/dev/null || true
  # 仍存活则强杀（个别子进程忽略 TERM 时）
  kill -KILL -- -"$hub_pid" -"$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$hub_pid" "$web_pid"

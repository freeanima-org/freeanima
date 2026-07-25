#!/usr/bin/env bash
# 并行启动源码 Habitat + Vite Web（多 worktree 友好）。
# 入口：just dev · 亦可：./scripts/dev.sh
#
# 环境变量：
#   HABITAT_PORT  固定 Habitat 端口（默认随机 ≥10000）
#   WEB_DEV_PORT  Vite 起始端口（默认 5000；占用则 Vite 自增）
#   FREEANIMA_URL 由本脚本写入，仅作 Vite /rpc|/mcp proxy 目标
set -euo pipefail
# 后台 job 各自成进程组（pgid == 首进程 pid），便于 Ctrl+C / EXIT 时整组杀掉，
# 避免只 kill「bun run」包装进程而留下 dev-habitat / vite 孙进程。
set -m

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

habitat_port="${HABITAT_PORT:-}"
if [[ -z "$habitat_port" ]]; then
  habitat_port="$(bun -e '
    import { pickRandomAvailableTcpPort, DEV_HABITAT_PORT_MIN } from "./src/portal/cli/tcp-port-available.ts";
    const p = await pickRandomAvailableTcpPort("127.0.0.1", DEV_HABITAT_PORT_MIN);
    process.stdout.write(String(p));
  ')"
fi

export FREEANIMA_URL="http://127.0.0.1:${habitat_port}"
export WEB_DEV_PORT="${WEB_DEV_PORT:-5000}"

echo "dev · Habitat ${FREEANIMA_URL} · Web from :${WEB_DEV_PORT} (proxy only; browser habitat = page origin)"

bun src/portal/cli/dev-habitat.ts --port "${habitat_port}" --strict-port &
habitat_pid=$!
bun scripts/dev-web.ts &
web_pid=$!

cleanup() {
  trap - EXIT INT TERM
  # 负 pid = 杀整个进程组（含 bun → vite/habitat 孙进程）
  kill -TERM -- -"$habitat_pid" -"$web_pid" 2>/dev/null || true
  wait "$habitat_pid" "$web_pid" 2>/dev/null || true
  # 仍存活则强杀（个别子进程忽略 TERM 时）
  kill -KILL -- -"$habitat_pid" -"$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$habitat_pid" "$web_pid"

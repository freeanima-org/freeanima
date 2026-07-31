#!/usr/bin/env bash
# 先起源码 Habitat，就绪后再起 Vite Web（多 worktree 友好）。
# Habitat 启动失败或超时未就绪时不启动 Web。
# 入口：just dev · 亦可：./scripts/dev.sh
#
# 环境变量：
#   HABITAT_PORT  固定 Habitat 端口（默认随机 ≥10000）
#   WEB_DEV_PORT  Vite 起始端口（默认 5000；占用则 Vite 自增）
#   FREEANIMA_URL 由本脚本写入，仅作 Vite /rpc|/mcp proxy 目标
#   FREEANIMA_HABITAT_READY_TIMEOUT_MS  等 Habitat 就绪超时（默认 900000）
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

habitat_pid=""
web_pid=""

cleanup() {
  trap - EXIT INT TERM
  # 负 pid = 杀整个进程组（含 bun → vite/habitat 孙进程）
  if [[ -n "${web_pid}" ]]; then
    kill -TERM -- -"$web_pid" 2>/dev/null || true
  fi
  if [[ -n "${habitat_pid}" ]]; then
    kill -TERM -- -"$habitat_pid" 2>/dev/null || true
  fi
  if [[ -n "${web_pid}" ]]; then
    wait "$web_pid" 2>/dev/null || true
  fi
  if [[ -n "${habitat_pid}" ]]; then
    wait "$habitat_pid" 2>/dev/null || true
  fi
  # 仍存活则强杀（个别子进程忽略 TERM 时）
  if [[ -n "${web_pid}" ]]; then
    kill -KILL -- -"$web_pid" 2>/dev/null || true
  fi
  if [[ -n "${habitat_pid}" ]]; then
    kill -KILL -- -"$habitat_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

bun src/portal/cli/dev-habitat.ts --port "${habitat_port}" --strict-port &
habitat_pid=$!

echo "dev · waiting for Habitat ready before starting Web…"
if ! bun -e "
  import { waitForHabitatReady } from './src/portal/cli/wait-habitat-ready.ts';
  const port = ${habitat_port};
  const pid = ${habitat_pid};
  const alive = (): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const ok = await waitForHabitatReady('127.0.0.1', port, { stillAlive: alive });
  if (!ok) {
    if (!alive()) {
      console.error('dev · Habitat 启动失败（进程已退出），不启动 Web');
    } else {
      console.error('dev · Habitat 未在超时内就绪，不启动 Web');
    }
    process.exit(1);
  }
"; then
  exit 1
fi

echo "dev · Habitat ready · starting Web…"
bun scripts/dev-web.ts &
web_pid=$!

wait "$habitat_pid" "$web_pid"

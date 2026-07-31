#!/usr/bin/env bash
# 委托 scripts/dev.ts（跨平台编排）。保留本入口供直接调用与旧文档链接。
# 环境变量见 scripts/dev.ts / just/dev.just。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bun "${ROOT}/scripts/dev.ts"

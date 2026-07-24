# 各 just/*.just 模块共用（import）；勿单独 just。
set shell := ["bash", "-euo", "pipefail", "-c"]

# 模块默认 cwd 为 just/；配方加 [no-cd] 后 cwd 保持调用目录（仓库根）。
[private]
[no-cd]
_deps:
  bun install

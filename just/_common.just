# 各 just/*.just 模块共用（import）；勿单独 just。
# Windows：与根 Justfile 相同，需 PATH 上的 bash（优先 Git Bash，勿让 System32\bash.exe / WSL 抢先）。
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["bash", "-euo", "pipefail", "-c"]

# WSL 作 just 的 bash 时裸 `bun` 常 127；`bun.exe` 在 Git Bash / WSL 皆可用。
bun := if os_family() == "windows" { "bun.exe" } else { "bun" }

# 模块默认 cwd 为 just/；配方加 [no-cd] 后 cwd 保持调用目录（仓库根）。
[private]
[no-cd]
_deps:
  {{ bun }} install --frozen-lockfile

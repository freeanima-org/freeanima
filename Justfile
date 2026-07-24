# FreeAnima 日常入口。实现见 scripts/；package.json 仅留 prepare（husky）。
# 安装 just: https://github.com/casey/just · 列出：just --list · 模块：just pack --list
# 公开配方均依赖 `_deps`（bun install）；已装好时通常 <1s。

set shell := ["bash", "-euo", "pipefail", "-c"]

mod dev 'just/dev.just'
mod pack 'just/pack.just'
mod qa 'just/qa.just'
mod db 'just/db.just'
mod install 'just/install.just'
mod i18n 'just/i18n.just'
mod misc 'just/misc.just'

default:
  @just --choose

# 仅装依赖（根配方用；模块各自 import just/_common.just）
[private]
_deps:
  bun install

deps: _deps

# ─── 高频短别名（顶层刻意很少；`just dev` = mod default）──────────
alias check := qa::check
alias fmt := qa::fmt
alias test := qa::test

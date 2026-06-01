# 变更日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
新版本节由 [semantic-release](https://semantic-release.gitbook.io/) 根据 Conventional Commits 自动写入顶部。


## [0.1.1](https://github.com/freeanima-org/freeanima/compare/v0.1.0...v0.1.1) (2026-06-01)

### Features

* 增加discord的自动重连机制 ([a5c5dd5](https://github.com/freeanima-org/freeanima/commit/a5c5dd59150c696d169d0e87fee47f9acb5a9895))

## [Unreleased]

对应根 `package.json` **0.1.0**，尚未打 git tag。

### Added

- **Agent 运行时**：`anima service`（systemd）、Hono HTTP / SSE、WebUI（会客厅 / 卧室 / 创作室）
- **Gateway**：Discord、微信 iLink；按 platform / thread / peer 路由会话
- **记忆 L1–L4**：PostgreSQL Session、L2 蒸馏、L3 事实库（`recall` / `remember`）、L4 检索
- **工具**：本地 / MCP / ACP 注册；`execute_code`、浏览器、Cron、推送等
- **凭证**：pass GPG；CLI `credential list|get|add`（YAML 多字段）；LLM 仅见路径元数据
- **工程**：pnpm + turbo monorepo；Vitest；GitHub Actions + semantic-release 发版

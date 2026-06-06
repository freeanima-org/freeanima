# 变更日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
新版本节由 [semantic-release](https://semantic-release.gitbook.io/) 根据 Conventional Commits 自动写入顶部。


## [0.1.4](https://github.com/freeanima-org/freeanima/compare/v0.1.3...v0.1.4) (2026-06-06)

### Features

* **acp:** 增强 ACP Cursor 长生命周期与多模式支持 ([b6000d5](https://github.com/freeanima-org/freeanima/commit/b6000d5f80ad0d046df00a6c8faef2119fad5575))

## [0.1.3](https://github.com/freeanima-org/freeanima/compare/v0.1.2...v0.1.3) (2026-06-06)

### Bug Fixes

- **ci:** 补全 workspace 直接依赖以修复 typecheck ([5a09702](https://github.com/freeanima-org/freeanima/commit/5a09702a4012ae6d77475e4af400e5b730dadb75))

## [0.1.2](https://github.com/freeanima-org/freeanima/compare/v0.1.1...v0.1.2) (2026-06-05)

### Features

- **discord:** 优化discord遇到网络抖动也会重试，直到最终编辑 ([5463a48](https://github.com/freeanima-org/freeanima/commit/5463a48989693b97aa92c72c21d9fe2cb8231351))
- **engine:** 拆分 engine-tool 与 Engine 聚合包（RFC Step 3） ([cc764f6](https://github.com/freeanima-org/freeanima/commit/cc764f6cb2241e5c1bd10b58d3bd6dd265a9ee92))
- **event-bus:** 新增 EventBus 框架与 Sqlite 适配器并接入 legacy 栈 ([f243347](https://github.com/freeanima-org/freeanima/commit/f24334725d44f4977f10e17198cdb41d60cf9adf))
- **kernel:** Kernel 与 HookRegistry 接入 Logger，统一服务端日志 ([8b737fd](https://github.com/freeanima-org/freeanima/commit/8b737fd9b67f9ed0a1a475ce0f2ce1e7bd7fbca6))
- **kernel:** 新增 hooks 包与 Kernel，legacy 栈迁移至 token Hook API ([17a5bac](https://github.com/freeanima-org/freeanima/commit/17a5bacd4d4dffb5c74c1b801bc10f7f4f264870))
- **life:** 新增 life-self 与 life-estate 空壳包 ([927fe59](https://github.com/freeanima-org/freeanima/commit/927fe59dd4c1fda4d451b451fe613d271496b0e2))
- **llm:** 切换到新的llm provider ([16fcd59](https://github.com/freeanima-org/freeanima/commit/16fcd598d7e1ec08da0c60e94d9a2658c74d23f0))
- **llm:** 增加llm接口层和openai的实现 ([205724c](https://github.com/freeanima-org/freeanima/commit/205724c1c03b60be2339b8d9f57b9692ef6c38f1))
- **logging:** 新增 @freeanima/logging 内核日志契约与内置 sink ([3e95c98](https://github.com/freeanima-org/freeanima/commit/3e95c98c7c8534f7bec437a7396d88b93327df5c))
- **logging:** 新增 file sink 并抽取共用格式化逻辑 ([106eaaa](https://github.com/freeanima-org/freeanima/commit/106eaaa53b53669f2ba4480403e2d996ceedb9b5))
- **service:** K1 新建 @freeanima/service 注册 hub ([a35d965](https://github.com/freeanima-org/freeanima/commit/a35d96587b52831bad3f3cf22e50068dac80b094))
- **webui:** Bun fullstack + tRPC 全链路，移除 Vite/TanStack Start ([dda1b2e](https://github.com/freeanima-org/freeanima/commit/dda1b2e549d350f1681de04499cbc13cbf01a150))
- 阶梯重试与日志治理，合并 Agent 文档 ([6f4719d](https://github.com/freeanima-org/freeanima/commit/6f4719d2b4c571789aa754c51e6b3f72196d9241))

### Bug Fixes

- **ci:** 修复 release workflow 因缺少 config 导致测试超时 ([1dbd8e6](https://github.com/freeanima-org/freeanima/commit/1dbd8e64855f6edd2353c71005d3c3fc78b1f621)), closes [freeanima-org/freeanima#18](https://github.com/freeanima-org/freeanima/issues/18)
- **discord:** 修复消息卡在思考中与 👀 反应不更新 ([b2a7af7](https://github.com/freeanima-org/freeanima/commit/b2a7af7d32bf44e1c7678a6dd7012b93d3ea15ab)), closes [#7](https://github.com/freeanima-org/freeanima/issues/7)
- **gateway:** 修复 Discord 单回合内 tool 与答案消息顺序混乱 ([2af0861](https://github.com/freeanima-org/freeanima/commit/2af0861fb49d156ed69f6f3444e2f0efccbf72f0)), closes [#17](https://github.com/freeanima-org/freeanima/issues/17)
- **gateway:** 修复微信出站并重构工具消息分片展示 ([a4c9bf2](https://github.com/freeanima-org/freeanima/commit/a4c9bf2d9173ce38ab8159f1e946571d82ed5797))
- **test:** 修复 CI 无 config.yaml 时测试失败 ([10f9de2](https://github.com/freeanima-org/freeanima/commit/10f9de2e61182b1e69d029024cbde47d71d5f2bf))
- **test:** 隔离单测 error.log 并增强 Gateway 诊断 ([e292e36](https://github.com/freeanima-org/freeanima/commit/e292e366abaa319f3ea6d176fa053dc8511a0bd1))
- **webui:** systemd 启动时 chdir 到仓库根以加载 Tailwind 插件 ([81b736a](https://github.com/freeanima-org/freeanima/commit/81b736a0bd560d56fad73c312f6259dfe8ff13ed))

## [0.1.1](https://github.com/freeanima-org/freeanima/compare/v0.1.0...v0.1.1) (2026-06-01)

### Features

- 增加discord的自动重连机制 ([a5c5dd5](https://github.com/freeanima-org/freeanima/commit/a5c5dd59150c696d169d0e87fee47f9acb5a9895))

## 0.1.0 (2026-06-01)

### Features

- **Agent 运行时**：`anima service`（systemd）、Hono HTTP / SSE、WebUI（会客厅 / 卧室 / 创作室）
- **Gateway**：Discord、微信 iLink；按 platform / thread / peer 路由会话
- **记忆 L1–L4**：PostgreSQL Session、L2 蒸馏、L3 事实库（`recall` / `remember`）、L4 检索
- **工具**：本地 / MCP / ACP 注册；`execute_code`、浏览器、Cron、推送等
- **凭证**：pass GPG；CLI `credential list|get|add`（YAML 多字段）；LLM 仅见路径元数据
- **工程**：pnpm + turbo monorepo；Vitest；GitHub Actions + semantic-release 发版

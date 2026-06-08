# 变更日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
新版本节由 [semantic-release](https://semantic-release.gitbook.io/) 根据 Conventional Commits 自动写入顶部。


## [0.3.5](https://github.com/freeanima-org/freeanima/compare/v0.3.4...v0.3.5) (2026-06-08)

### Features

* **site:** P0 — Astro + Starlight 脚手架 + 营销首页 ([19fce0d](https://github.com/freeanima-org/freeanima/commit/19fce0db204e34c976e2993827e7b23cb84535fd))
* **site:** P1 — 统一 Header/Footer + 设计 token + Tailwind ([4b51d8b](https://github.com/freeanima-org/freeanima/commit/4b51d8b569016d62aae148fcc72406bac66421ad))
* **site:** P2 + P3 — CI 部署 + docs 接入 Starlight ([673f41c](https://github.com/freeanima-org/freeanima/commit/673f41c8de253b14fbfbf0d8e82a8f4f46e0c6b4))

## [0.3.4](https://github.com/freeanima-org/freeanima/compare/v0.3.3...v0.3.4) (2026-06-08)

### Features

- **estate:** email 模块 — 账户注册表、收发信、WebUI 只读界面 ([bb2f02a](https://github.com/freeanima-org/freeanima/commit/bb2f02a53623849baeb24fa4adea2c4ef826d241))

### Refactoring

- **config:** 统一值展开引擎 — credential/env/明文三种语法 ([c526aa0](https://github.com/freeanima-org/freeanima/commit/c526aa021eefd0aae854cb25f0afec3829ad7dbb))

## [0.3.3](https://github.com/freeanima-org/freeanima/compare/v0.3.2...v0.3.3) (2026-06-08)

### Bug Fixes

- **release:** 使用 RELEASE_PAT 触发下游 Docker workflow ([b4362eb](https://github.com/freeanima-org/freeanima/commit/b4362eb1f14ae512f0794db765a036971cfb8eb9))

## [0.3.2](https://github.com/freeanima-org/freeanima/compare/v0.3.1...v0.3.2) (2026-06-08)

### Bug Fixes

- **release:** 用 bunx npm@11 发布并移除 setup-node ([#70](https://github.com/freeanima-org/freeanima/issues/70)) ([41f76ad](https://github.com/freeanima-org/freeanima/commit/41f76ad21299f417bf090a9e46b8f14a8c276dd9))

### Miscellaneous

- **deps:** bump docker/login-action from 3 to 4 ([#68](https://github.com/freeanima-org/freeanima/issues/68)) ([dcfdd39](https://github.com/freeanima-org/freeanima/commit/dcfdd39fcaa4cb2180f13857f25f00ed8e2b28ef))

## [0.3.1](https://github.com/freeanima-org/freeanima/compare/v0.3.0...v0.3.1) (2026-06-08)

### Bug Fixes

- **release:** 改用 publish-cli.sh 原生 OIDC 发布 CLI ([#69](https://github.com/freeanima-org/freeanima/issues/69)) ([bcdad6a](https://github.com/freeanima-org/freeanima/commit/bcdad6a526355ff85b05b9f4b94805965495d04a))

## [0.3.0](https://github.com/freeanima-org/freeanima/compare/v0.2.1...v0.3.0) (2026-06-08)

### ⚠ BREAKING CHANGES

- **credential:** 严格 YAML 凭证并新增 set 合并更新

### Features

- **ci:** 接入 GitHub Code Coverage 上传 ([612fd35](https://github.com/freeanima-org/freeanima/commit/612fd35dbe9877b5767e211a807d36fea931b654))
- **credential:** 严格 YAML 凭证并新增 set 合并更新 ([8c0a976](https://github.com/freeanima-org/freeanima/commit/8c0a9768c097485041e33d5680fe554ee8933dfb))
- **webui:** 仪表盘展示 PG/Redis 状态并迁移至 Bun 原生 Redis ([a0a0aec](https://github.com/freeanima-org/freeanima/commit/a0a0aecc2d4089eef4679ed0fe3b2390d3333b08))

### Bug Fixes

- **deps:** 修复 openai v6 升级后的 typecheck 与 lint ([67fce0e](https://github.com/freeanima-org/freeanima/commit/67fce0eb48213cd6f8631b20ce7df5d66b0f50dd))
- **release:** 修正 publishConfig.registry 尾斜杠以启用 OIDC ([73bc79d](https://github.com/freeanima-org/freeanima/commit/73bc79d6af9f3e101d575a2317912031c19e2345))
- **security:** 消除 CodeQL 告警的 shell 注入、ReDoS 与随机数偏差 ([ba0c931](https://github.com/freeanima-org/freeanima/commit/ba0c9318d8a9f24848b64d20b4ef5bb2bd1b2bb6))
- **test:** 修复 redis scan mock 的 glob 匹配以消除 CodeQL 告警 ([49c0a00](https://github.com/freeanima-org/freeanima/commit/49c0a00eda642b40448fc135c0081152c622d9cb))

### Miscellaneous

- **ci:** 覆盖率阈值置 0 并移除 bunfig.coverage.toml ([6351281](https://github.com/freeanima-org/freeanima/commit/635128102011fca0dfce7bd35e0d6e60fd3662f5))
- **deps:** bump actions/checkout from 4 to 6 ([04e000e](https://github.com/freeanima-org/freeanima/commit/04e000e7a7db1e81b586104efd59067b7299aa39))
- **deps:** bump actions/setup-node from 4 to 6 ([292e4dc](https://github.com/freeanima-org/freeanima/commit/292e4dc21fd12e0ecd02eac66ac42dcdde4c58ff))
- **deps:** bump docker/build-push-action from 6 to 7 ([302f98e](https://github.com/freeanima-org/freeanima/commit/302f98ef3d295fa50239fbc5c6296ccd43eceaa3))
- **deps:** bump docker/setup-buildx-action from 3 to 4 ([57ddd24](https://github.com/freeanima-org/freeanima/commit/57ddd24db500f374c0e02b956be797167fe2499b))
- **deps:** bump github/codeql-action from 3 to 4 ([12fa0e4](https://github.com/freeanima-org/freeanima/commit/12fa0e4f753d09e8bdb55c97461731b2b572352a))
- **deps:** bump the production-dependencies group with 2 updates ([4ab7c08](https://github.com/freeanima-org/freeanima/commit/4ab7c08ccde050a3adf7df51fce4cf9d56c99745))

### CI

- **release:** 支持 npm Trusted Publishing OIDC 发布 CLI ([94bb7f0](https://github.com/freeanima-org/freeanima/commit/94bb7f00e86aa43b65eac09b1c761103d3fcb7d4))
- **release:** 用 semantic-release/npm 发布 CLI 并精简 workflow ([5fd66cb](https://github.com/freeanima-org/freeanima/commit/5fd66cb20851e478c688c31df5b4c1b96ea62233))
- **release:** 移除 setup-node registry-url 修复 OIDC 鉴权冲突 ([0bea7f3](https://github.com/freeanima-org/freeanima/commit/0bea7f34189e8f8433b25616027ec55959501d8f))
- 重组 workflows 并启用 Dependabot 与安全扫描 ([bc96687](https://github.com/freeanima-org/freeanima/commit/bc96687caec5b25d6a9166bfc76553c144e18e72))

## [0.2.1](https://github.com/freeanima-org/freeanima/compare/v0.2.0...v0.2.1) (2026-06-08)

### Bug Fixes

- **release:** NPM_TOKEN 未配置时跳过 npm 发布 ([4a3c128](https://github.com/freeanima-org/freeanima/commit/4a3c12851a58ea64850320e8b504e132a7c79da3))

## [0.2.0](https://github.com/freeanima-org/freeanima/compare/v0.1.6...v0.2.0) (2026-06-08)

### ⚠ BREAKING CHANGES

- **memory:** 废除记忆层 L 编号，统一语义/情景术语
- **webui:** WebUI HTTP 路径改为 /api/_；终端 WS 为 /api/studio/terminal/ws；
  聊天流式为 POST /api/messages/stream（SSE）。移除 @trpc/_ 与 /api/trpc。
  SPA 仍由 Bun.serve routes 提供，index.html 改为启动时动态加载并在 close 时释放。

Co-authored-by: Cursor <cursoragent@cursor.com>

### Features

- **cron,tools,config:** Phase 0 Bun 原生接入收尾 ([d95d6dc](https://github.com/freeanima-org/freeanima/commit/d95d6dc623fb6688f9c500db50503bac5f796e22)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
- **db:** Bun.sql 驱动 PoC 与 JSONB 回归 ([0e6864a](https://github.com/freeanima-org/freeanima/commit/0e6864a5289aa7805cb09996bd8febe6975ee438)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
- **prompt:** 优化 system prompt 两层结构与段落顺序 ([d975e52](https://github.com/freeanima-org/freeanima/commit/d975e524ff7fa92b1536a720badcd3ab55913654)), closes [#6](https://github.com/freeanima-org/freeanima/issues/6)
- **release:** Docker Compose、Bun CLI 打包与 config 环境变量插值 ([00a61db](https://github.com/freeanima-org/freeanima/commit/00a61db67071ad9b8f74ed1157409a5d7e4b7e23)), closes [#3](https://github.com/freeanima-org/freeanima/issues/3)
- **tools:** read_file 与 glob 搜索改用 Bun 原生 API ([90c9dd7](https://github.com/freeanima-org/freeanima/commit/90c9dd77e0383174e5675ed4a92e163668993df7)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
- **webui:** dev 模式启用 Bun.serve console 回流 ([79166a1](https://github.com/freeanima-org/freeanima/commit/79166a1336b7232f88e9b319fe203b9549578128)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
- **webui:** 卧室会话列表分页与会话详情页 ([2a971ef](https://github.com/freeanima-org/freeanima/commit/2a971ef260eabd6709e2d7853124ce7854344a79))
- 冰箱贴（fridge-magnet）——跨轮对话临时状态共享黑板 ([4c9f321](https://github.com/freeanima-org/freeanima/commit/4c9f3218518fe1a2bd18e0fbcf7a2ab5edf73526))
- 冰箱贴重构 + 待办清单（tasks）系统 ([1c139c6](https://github.com/freeanima-org/freeanima/commit/1c139c682f0c08a6ca90ef15995fd559449685c6))

### Bug Fixes

- **ci:** 拆分 e2e/gitleaks job 并修复 WebView Chromium 崩溃 ([2cc570c](https://github.com/freeanima-org/freeanima/commit/2cc570c71dcb2d3b7be8bc0906f79af2d292bd14))
- **e2e:** 放宽 WebView smoke 测试超时并指定 CI Chromium 路径 ([559f7af](https://github.com/freeanima-org/freeanima/commit/559f7afd5793a3270e97f096fc85fe92b7caf31c))
- **webui:** 补全 service-config 依赖以修复 CI typecheck ([595b4a7](https://github.com/freeanima-org/freeanima/commit/595b4a71b3461ecb15f7dfb19c57286922c3e252))

### Performance

- **ci:** E2E 用 Playwright Chromium 缓存替代 apt 安装 ([f5723dc](https://github.com/freeanima-org/freeanima/commit/f5723dca16fee6126a01db05644c073faa2700a3))

### Refactoring

- **db-pg:** 移除未使用的 pg-profile 诊断层 ([21c815b](https://github.com/freeanima-org/freeanima/commit/21c815babac5d44918dc1c469348e711e1706537))
- **memory:** 废除记忆层 L 编号，统一语义/情景术语 ([390ab0d](https://github.com/freeanima-org/freeanima/commit/390ab0dc579a3eeaa5c99d78011646e00e9376f8))
- **self:** 彻底清除 SOUL.md 与自我层 seed ([09b22c4](https://github.com/freeanima-org/freeanima/commit/09b22c4e2461ff24c174b85699e6f883d8c1adb9))
- **webui:** 单 Bun.serve 统一 HTTP 与 WebSocket ([c2b5596](https://github.com/freeanima-org/freeanima/commit/c2b5596559c87f90af3a14d98694acf230e14854)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
- **webui:** 将 API 从 tRPC 迁移至 Elysia REST + Eden Treaty ([0512d9b](https://github.com/freeanima-org/freeanima/commit/0512d9bc64b0e10fad80c1b0e9f6f7039603d086))
- **webui:** 移除卧室记忆文件页面 ([f998c38](https://github.com/freeanima-org/freeanima/commit/f998c38b4eefc953c948319b9305f0c49ea1cd4d))

### Tests

- **e2e:** WebView 卧室 dashboard smoke ([e17b82f](https://github.com/freeanima-org/freeanima/commit/e17b82fd8b05777cc5f9b6fdec886b06ec330d8c)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)

## [0.1.6](https://github.com/freeanima-org/freeanima/compare/v0.1.5...v0.1.6) (2026-06-07)

### Features

- limbic_memory 建表 + fact_id→semantic_memory_id 术语统一 ([1bd2110](https://github.com/freeanima-org/freeanima/commit/1bd211066af9a53f5c3f026e04cc304730393bd7))
- self_blocks + autobiographical_memory — 自我层独立建表 ([b199157](https://github.com/freeanima-org/freeanima/commit/b19915750dce25f14757fca27e891f5c09120406))
- ToolSet 注册机制（能力面罩基础设施） ([2b7d057](https://github.com/freeanima-org/freeanima/commit/2b7d05748e6fd8b3eda8e7986b989a0403090942))
- 能力面罩（Mask）系统 ([1d036d5](https://github.com/freeanima-org/freeanima/commit/1d036d57a3b3b66507c01676c4f1f117bc407b27))

## [0.1.5](https://github.com/freeanima-org/freeanima/compare/v0.1.4...v0.1.5) (2026-06-07)

### Features

- **acp:** 支持 acp_cursor 异步执行与进度推送 ([99d75c3](https://github.com/freeanima-org/freeanima/commit/99d75c370a023bb8454c355c7d5db5db02cb4539))
- **cron:** migrate storage from file JSON to PostgreSQL + Bun.cron scheduling ([17288e6](https://github.com/freeanima-org/freeanima/commit/17288e60dd945c106643f0fe3915e8479750dde4))
- **memory:** L3 语义记忆从文件系统迁移到 PG ([291a80b](https://github.com/freeanima-org/freeanima/commit/291a80b0e7bee91c452ba260ca0f9210f77448fb))
- **memory:** PG FTS 替代 L2 蒸馏 + L4 SQLite 索引 ([40f7908](https://github.com/freeanima-org/freeanima/commit/40f7908801fe2891e50af62874a476ddcdf1a69c))
- **service:** 启动时自动运行数据库迁移 ([c396491](https://github.com/freeanima-org/freeanima/commit/c3964914b8d9e7a4872b97b104f9e2625d377d40))
- 实现深睡机制 (deep sleep) ([0a82262](https://github.com/freeanima-org/freeanima/commit/0a8226266ed3a339b08ba8d0daebb41d69897642))
- 浅睡替代反思，作为语义记忆唯一增量提取通道 ([7cbd3de](https://github.com/freeanima-org/freeanima/commit/7cbd3ded361e57942511918d5139a84774a6a8b4))

### Bug Fixes

- **acp:** Cursor ACP 新建 session 默认使用 Auto 模型 ([1e4ec78](https://github.com/freeanima-org/freeanima/commit/1e4ec78074b1fb02713567689ab4e92f1f986bb4))
- **cron:** listJobs/getJob gracefully return empty when module not initialized ([e4a60e5](https://github.com/freeanima-org/freeanima/commit/e4a60e50346997cffe72bf1da0fd47795ef88703))
- **cron:** persistJob/runJobById/getJobSync handle uninit gracefully ([bf836ef](https://github.com/freeanima-org/freeanima/commit/bf836ef4d86d64ed2d4602e4afaf7231bc8ba397))
- **engine:** 修复空 assistant 消息导致 DeepSeek 400 错误 ([dace94d](https://github.com/freeanima-org/freeanima/commit/dace94d18f1d32e72f5c7d84f7d17568c8dd0f9d))
- **gateway:** Discord 单条消息超长时自动拆分 ([9a7317f](https://github.com/freeanima-org/freeanima/commit/9a7317fde5c447dce352b8fc7e2af92d610f12f2))
- **life-memory:** add missing engine-loop devDependency ([62e5080](https://github.com/freeanima-org/freeanima/commit/62e50804708f76624ff8d5ab24cca875398ced1c))
- **logging:** error.log 序列化时保留 err.cause 链 ([02a4ae4](https://github.com/freeanima-org/freeanima/commit/02a4ae4e5083a9781c29fadaae7c9ba6e706c189))

### Performance

- **conversation:** 已压缩会话 beginTurn 按 pos 窗口加载 ([b3e61cd](https://github.com/freeanima-org/freeanima/commit/b3e61cdd1f81489f74bd2e7b026f7e53a5d0c05d))
- **service:** 次级路径避免全量消息加载 ([c2049eb](https://github.com/freeanima-org/freeanima/commit/c2049eb94d078513a23f1bd9a68169c5cb642716))

## [0.1.4](https://github.com/freeanima-org/freeanima/compare/v0.1.3...v0.1.4) (2026-06-06)

### Features

- **acp:** 增强 ACP Cursor 长生命周期与多模式支持 ([b6000d5](https://github.com/freeanima-org/freeanima/commit/b6000d5f80ad0d046df00a6c8faef2119fad5575))

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

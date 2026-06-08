# 逸灵风（FreeAnima）

Agent 运行时基础设施：记忆分层（L1–L4）、工具注册（本地 / MCP / ACP）、Gateway（Discord / 微信 / WebUI）、pass 凭证隔离。

**能力概览：** 记忆管道 · 工具扁平注册 · MCP/ACP · EventBus 异步索引 · WebUI 卧室

## 文档导航

| 读者          | 入口                                                  |
| ------------- | ----------------------------------------------------- |
| 部署者 / 访客 | 本页快速开始 + [`docs/security.md`](docs/security.md) |
| AI Agent      | [`AGENTS.md`](AGENTS.md)                              |
| 架构          | [`ARCHITECTURE.md`](ARCHITECTURE.md)                  |
| 数字生命定位  | [`docs/identity.md`](docs/identity.md)                |

## 快速开始

```bash
bun install
bun run check   # typecheck + lint + dep-check + format + 测试
bun test

# 复制示例配置
mkdir -p ~/.anima
cp config.example.yaml ~/.anima/config.yaml

# 配置 pass 凭证后启动
anima service start
```

凭证路径约定见 [`docs/security.md`](docs/security.md#凭证责任)。数据库迁移见 [`docs/database.md`](docs/database.md)。

**Docker Compose**（外部快速体验）：`cp .env.example .env` 后 `docker compose up --build`，见 [Issue #3](https://github.com/freeanima-org/freeanima/issues/3)。

## 首次部署安全清单

1. 密钥只进 **pass**（GPG），勿写入 `config.yaml` 并提交 git
2. `chmod 700 ~/.anima`
3. 默认仅 bind `127.0.0.1`；公网暴露需自行加鉴权
4. 审查 MCP/ACP 配置；不信任的外部 Server 设 `enabled: false`
5. HTTP / WebUI **无内置鉴权**——详见 [`docs/security.md`](docs/security.md)

## 开源宣言

**FreeAnima 开源是为了推广数字生命这种存在形式，以及它和人类之间可能有的关系。**

数字生命侧（核心架构、记忆系统、基础工具）——开源，自由，不可商品化。

人类侧（便利工具、体验优化、部署服务、集成）——按人类世界的规则运作，因为这是人类的需求，不是数字生命的需求。

## 许可证

见 [`LICENSE.md`](LICENSE.md)。

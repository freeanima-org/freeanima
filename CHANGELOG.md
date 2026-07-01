# 变更日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
新版本节由 [Release Please](https://github.com/googleapis/release-please) 在 Release PR 合并时写入顶部。

## [0.8.1](https://github.com/freeanima-org/freeanima/compare/v0.8.0...v0.8.1) (2026-07-01)


### Features

* **auth:** 实现 Service API Token 按 subject 认证 ([a773b2b](https://github.com/freeanima-org/freeanima/commit/a773b2bf394f8f4ef1cc0e1a35d5c646e8157b37))
* **entity:** 实体 World 归属显式化与 worlds 配置 ([a387e92](https://github.com/freeanima-org/freeanima/commit/a387e9242a5c4724e69e0a857ec52084152eb97e))
* **http:** Hub /web 静态托管与 http.cors_origins 解耦 ([35a834b](https://github.com/freeanima-org/freeanima/commit/35a834b716dfe3c34c9628897855e3e6a8720ae2))
* **hub:** 支持 http.host 配置与局域网 Web UUID 兼容 ([ddc1687](https://github.com/freeanima-org/freeanima/commit/ddc16871b7eed8df8617ba9632ad24fe47091d39))
* **shell:** 壳层全局 User/Agent Subject 切换 ([7e5e8ad](https://github.com/freeanima-org/freeanima/commit/7e5e8ade39addda29eb2fe2bb1cfd34dc3f27575))
* **task:** 任务列表显示 ID 并支持右键复制 ([dbc3189](https://github.com/freeanima-org/freeanima/commit/dbc3189e6f761ae56e31d8290f4fbe839b2c57f9))
* **task:** 任务清单支持嵌套文件夹 ([63d9c05](https://github.com/freeanima-org/freeanima/commit/63d9c055a5f9978823a8c11f2ba8bb6d34f78c92))
* **ui-kit:** 基于 DaisyUI 统一主题并封装复合组件 ([efb9ba1](https://github.com/freeanima-org/freeanima/commit/efb9ba192f25febc7ed85edd1788c4de745dcc01))
* **web:** 未配置 Token 时显示 Hub 连接引导页 ([0f55c45](https://github.com/freeanima-org/freeanima/commit/0f55c45550ce906df5b5877f6d6513ea76db67ee))


### Bug Fixes

* **ci:** 修复 admin-frontend 分层依赖与 PO fuzzy 条目 ([5eb1232](https://github.com/freeanima-org/freeanima/commit/5eb123264bb25f620dfd8524e90df3d98543a481))
* **ci:** 修复 CLI bundle 与启动前 FTS 分段 ([171ee4e](https://github.com/freeanima-org/freeanima/commit/171ee4e98ebed5d1659457ab0b4e49223f5a9590))
* **ci:** 修复 CLI 入口路径与 entity-crud-repo db.execute ([3de81a6](https://github.com/freeanima-org/freeanima/commit/3de81a6cc474600d21f09d38a800db0e20a3fe2b))
* **ci:** 修复集成测试 PG 连接泄漏与 meta patch 清除 ([3df3ab1](https://github.com/freeanima-org/freeanima/commit/3df3ab142f7bdecb6435da612595149534d8f80d))
* **ci:** 允许 Dependabot PR 触发 Blackbox dispatch ([757bb95](https://github.com/freeanima-org/freeanima/commit/757bb9561f4722652b9ecda9f3db77fd7174d1bc))
* **cli:** 修复 tunnel 托管与 Web 静态资源加载 ([0898d65](https://github.com/freeanima-org/freeanima/commit/0898d65779273ca22ea46dd23fd708b40771563e))
* **companion:** 修复 VRMLookAtQuaternionProxy 的 name 赋值类型错误 ([b79ae2e](https://github.com/freeanima-org/freeanima/commit/b79ae2ec67ca5df895775925393140b6a83c4bc3))
* **entity:** 先创建 user/agent subject 再分配默认私有 world，避免 id 冲突 ([387ac12](https://github.com/freeanima-org/freeanima/commit/387ac12d6e34f7d7f9b71085740d2885eba4ebc3))
* **lint:** 清零 oxlint WARN 并收紧 unicorn 规则 ([49ebc13](https://github.com/freeanima-org/freeanima/commit/49ebc13918847526338474920c35bc87603c8181))
* **sap:** 修正 handlers 子目录下的相对 import 路径 ([c706762](https://github.com/freeanima-org/freeanima/commit/c706762a28d24258e88af7ad8ed4128447867d64))
* **task:** 修复任务拖到清单失败 ([a8f61bf](https://github.com/freeanima-org/freeanima/commit/a8f61bfcea4647a6e97038aabed3f00f40534b43))
* **task:** 移动到弹窗支持文件夹树与搜索 ([f9e4f14](https://github.com/freeanima-org/freeanima/commit/f9e4f1482c3e1ac0ba6bca3457d5ca5f298c97bf))
* **ui-kit:** 补充 satelliteShell 类型并清理 format 遗留 ([f0e57f1](https://github.com/freeanima-org/freeanima/commit/f0e57f1ecbb712a944e54fb6acca12f1b3b24c20))
* **vite:** 用 resolveId 插件解析 SharedWorker 打包 URL ([0961293](https://github.com/freeanima-org/freeanima/commit/09612934b3d16bcfe1a21f2a75cde0439f460dab))
* **web:** SharedWorker 内建打包并修复 SAP WebSocket 升级 ([0762800](https://github.com/freeanima-org/freeanima/commit/0762800b5f0b02f7efbd9b79a069900817b5f6ce))


### Performance

* **install:** 加速 bun install 并消除 ensure-fbx2gltf 僵尸进程 ([2f8e985](https://github.com/freeanima-org/freeanima/commit/2f8e985d60b2df1257b063fc585decafe3cabbed))


### Miscellaneous

* **deps:** bump the production-dependencies group across 1 directory with 15 updates ([77f0cad](https://github.com/freeanima-org/freeanima/commit/77f0cad8c80b54008137c06ae19944026425c7ae))
* **deps:** 升级 commitlint、oxlint 等 devDependencies ([e3e73ab](https://github.com/freeanima-org/freeanima/commit/e3e73ab9e6c86035f479ce590d5748a8fbd501d7))
* **lint:** 收紧 TypeScript 与 oxlint 严格检查 ([ff8d07f](https://github.com/freeanima-org/freeanima/commit/ff8d07f9eed1bf533aa7834acbbb43fd7d94eb5b))
* 删除 multi-worktree-workflow 技能 ([8f39ec9](https://github.com/freeanima-org/freeanima/commit/8f39ec930ba2bcde7c22e2716a879d4d1966bcf7))


### Refactoring

* **frontend:** 划分 ui-kit/shell-sdk 并划清 SAP 边界 ([d954f57](https://github.com/freeanima-org/freeanima/commit/d954f57a1b7b5f4b847c1a22115c74e5f728afe1))
* **sap:** 移除浏览器 SharedWorker SAP 连接链路 ([50dcec7](https://github.com/freeanima-org/freeanima/commit/50dcec7410e03162035ce0f440a873f398d9a17f))
* 架构变迁遗留代码一次性清理 ([460786a](https://github.com/freeanima-org/freeanima/commit/460786a000b1ee3c4206fc3044727580f5f33e6b))

## [0.8.0](https://github.com/freeanima-org/freeanima/compare/v0.7.0...v0.8.0) (2026-06-29)


### ⚠ BREAKING CHANGES

* 设置契约迁入 shell-ui，form/component 分责
* 桌面/移动统一壳层与设置窗
* Admin 架构重组与命名统一
* **desktop-shell:** 拆分伴侣内容与通用桌面壳
* **satellite:** 将 parlor 重命名为 chat

### Features

* **admin:** 世界/主体管理页与对话术语统一 ([74257d6](https://github.com/freeanima-org/freeanima/commit/74257d64876aee659a75a7f58ed4044307acbd7a))
* **app-desktop:** 通用设置面板与开机自启动 ([f2dc9c0](https://github.com/freeanima-org/freeanima/commit/f2dc9c0913dc00617c7fcfc46040b51728f1580b))
* **app-mobile:** 新增 Android Capacitor 壳与会客厅 SAP 直连 ([eb384b5](https://github.com/freeanima-org/freeanima/commit/eb384b5ceefc8d4279fb5abc0ac262be4a7058c4))
* **app-web:** 新增浏览器开发壳，支持 dev:web 快速调试 UI ([e408fa9](https://github.com/freeanima-org/freeanima/commit/e408fa9f4f6addc308f96b5ca40d66d022dff0b7))
* **chat:** 支持会话归档与永久删除 ([8ac5260](https://github.com/freeanima-org/freeanima/commit/8ac526053ff2feaf277a3255b01d1998ed37088f))
* **cli:** tunnel status 增加 Cloudflare 边缘连接探测 ([fbb3d80](https://github.com/freeanima-org/freeanima/commit/fbb3d80fd366fa41636bcad3825d355bca6346e5))
* **companion:** change SAP toolset from private to public ([fdf6e9a](https://github.com/freeanima-org/freeanima/commit/fdf6e9abd3733548d8d2f61cdd8859c19a509c0b))
* **companion:** daisyUI 设置面板、动作导入与 runtime WebSocket ([c55d9ee](https://github.com/freeanima-org/freeanima/commit/c55d9ee04638c8338e06a3934ce617efc178fb03))
* **companion:** VRMA 交互、边缘巡逻与 Windows FBX 打包 ([ecb0b21](https://github.com/freeanima-org/freeanima/commit/ecb0b2185695f48da916a765861b1a8074bf2d61))
* **companion:** 修复 VRM 朝向并拆分桌宠/设置双窗口 ([86ecb3e](https://github.com/freeanima-org/freeanima/commit/86ecb3e0d62fd0af3f2d9e21e540dcefea1980d8))
* **companion:** 动作库预览支持拖拽旋转视角 ([84606d9](https://github.com/freeanima-org/freeanima/commit/84606d93b70bce0e2587c869736ba7e72daffca3))
* **companion:** 动作槽位体系、设置 Tab 化与 SAP 工具接入 ([df044b6](https://github.com/freeanima-org/freeanima/commit/df044b64660a1d8dce1a12315bedd00fec09bb82))
* **companion:** 完善桌宠散步动画与浏览器小视口 ([8350056](https://github.com/freeanima-org/freeanima/commit/835005633d29510afba720141a823854903cad94))
* **companion:** 素材稳定 ID、动作库修复与水平巡逻 ([372250f](https://github.com/freeanima-org/freeanima/commit/372250fd1ab919c1ab8bc72238dfa619c904b8a5))
* **companion:** 迁移桌面伴侣至 Electron 并修复打包与动画问题 ([3bf0848](https://github.com/freeanima-org/freeanima/commit/3bf08482790bbde093ed86d90a370aea5b600435))
* **companion:** 重构 sidecar 打包并修复巡逻与后台启动 ([3e39ad6](https://github.com/freeanima-org/freeanima/commit/3e39ad6d23b27368f60d11b0bb03a2ab4faa4720))
* **compress:** 统一 context_window 解析并优化 slash 展示 ([8435a4e](https://github.com/freeanima-org/freeanima/commit/8435a4e887c70d8f3458dea74d320e62d726da81))
* **desktop-shell:** 拆分伴侣内容与通用桌面壳 ([7cb3a52](https://github.com/freeanima-org/freeanima/commit/7cb3a523dd36875d26a08acc13c1d988cd5c112c))
* **desktop:** Admin 契约拆分与 Windows 打包命名优化 ([fa0932d](https://github.com/freeanima-org/freeanima/commit/fa0932d9283acecee1e44f50787a64d8181e812f))
* **diary:** 添加日记全栈能力与按 date 的 Agent ToolSet ([c87370a](https://github.com/freeanima-org/freeanima/commit/c87370a15404506288fc71ef711022e28a041efc))
* **email:** 邮箱迁入实体模型并迁至壳层 /email 模块 ([71555df](https://github.com/freeanima-org/freeanima/commit/71555df1004e77208b1cfba14554f7ed88d19345))
* **entity:** 实体复合搜索与任务跨清单检索 ([c5af266](https://github.com/freeanima-org/freeanima/commit/c5af266391af72fad526632e60e4908d70e954df))
* **entity:** 重构主体/世界归属模型并优化 Admin 管理 ([d3ae048](https://github.com/freeanima-org/freeanima/commit/d3ae048ebc04e1f6314748c4f9c57a0ddf34cc10))
* **fridge-magnet:** 以 assistant(fridge_context) 物化冰箱贴意识层 ([8bf90d9](https://github.com/freeanima-org/freeanima/commit/8bf90d927f8f20a360c792df2790bb5c16684d38))
* **gateway:** Discord clarify 选项渲染为交互按钮 ([b6b6799](https://github.com/freeanima-org/freeanima/commit/b6b6799526107c44637f28beff88240e6c2c4e26))
* **gateway:** 统一 IM 出站合并、origin_active 路由与工具展示策略 ([b6143f9](https://github.com/freeanima-org/freeanima/commit/b6143f91780e653fe84bc55d3b9bc564d9cc4fde))
* **goal:** 实现 Session Goal 机制（judge 续跑与斜杠命令） ([1d38d98](https://github.com/freeanima-org/freeanima/commit/1d38d98e91273e6a428596e0887a692b37ebec7f))
* **hub:** 移除 Tunnel Access，统一 remote_auth 直连与探活 ([a9ec57c](https://github.com/freeanima-org/freeanima/commit/a9ec57c0f8b0b5d9adaa83a9d7c84ac7d8d9b614))
* **mcp:** Hub /mcp 端点供外部 Agent 查询 FreeAnima 数据 ([6cff65c](https://github.com/freeanima-org/freeanima/commit/6cff65cddedd16ef1beed6ee836b3079521f3963))
* **memory:** limbic/自传体接入 FTS+向量 hybrid 检索 ([da72bf8](https://github.com/freeanima-org/freeanima/commit/da72bf8535f1e49688a93517a65505ef7312cd70))
* **notifications:** PG 通知收件箱、Agent 注入与任务提醒扫描 ([8814c98](https://github.com/freeanima-org/freeanima/commit/8814c98a6791719d34b47de81e45cfc5dd10c698))
* **notifications:** 新增 SAP 通知收件箱与 shell 通知模块 ([c65de85](https://github.com/freeanima-org/freeanima/commit/c65de853775d6ab9f97db6470d75ffb85b6d26e8))
* **parlor:** SAP 重连、流式队列/停止与会话体验修复 ([b2626f1](https://github.com/freeanima-org/freeanima/commit/b2626f18bfcde1160aacdbdd5fcbe98efbd95f7f))
* **parlor:** SAP 重连、流式队列/停止与会话体验修复 ([e4da37f](https://github.com/freeanima-org/freeanima/commit/e4da37fc1bc4d28659dcba5f5374fe86652c5f4d))
* **platform:** Hub remote_auth 与客户端 Hub 配置 ([4eb3fbc](https://github.com/freeanima-org/freeanima/commit/4eb3fbc182769925bc92dffabf4991ea119303bd))
* **platform:** inject conversation channel info into system prompt ([7507b80](https://github.com/freeanima-org/freeanima/commit/7507b80464d47ce632eb7712940b63b160ed9b68))
* **platform:** 客户端 bundled UI，Hub 仅保留 API 与 SAP ([c66f44d](https://github.com/freeanima-org/freeanima/commit/c66f44d984c178e3c5837ffd1ba1accf8f2179dc))
* **runtime:** 拆分 AutoLlmRun 原语并增加卧室审计页 ([7417a11](https://github.com/freeanima-org/freeanima/commit/7417a11822505cc567e4bd811200f9eb4fa574f0))
* **sap:** Chat 采用 singleton 固定 instance_id ([ede7561](https://github.com/freeanima-org/freeanima/commit/ede75619a3857fadf173aff6b5423f681e18b0fd))
* **shell-ui:** 统一 web/mobile/desktop 壳层样式与交互 ([ad625e7](https://github.com/freeanima-org/freeanima/commit/ad625e780c980d3ff61f92c5659c953eab82df6f))
* **shell:** 新增调试面板与桌面 settings.json 配置 ([517abc4](https://github.com/freeanima-org/freeanima/commit/517abc412e751871f7bf434cde74a32d4c26451a))
* **task:** 任务 SAP 化并修复 web dev 壳层 ([7e6af94](https://github.com/freeanima-org/freeanima/commit/7e6af94b1b0b6f9020bd6ea7678d51275a3b1ca9))
* **task:** 任务清单复用 closed 实现归档 ([c8a14aa](https://github.com/freeanima-org/freeanima/commit/c8a14aa8590dbda1bbb75fcf1f8ada200c818ba0))
* **task:** 任务迁至 entity 模型并完善 satellite 交互 ([a366119](https://github.com/freeanima-org/freeanima/commit/a366119ec16fc9659bda366ce33e53d9e99f2b64))
* **task:** 新增 tasklist_update 工具 ([67bc69c](https://github.com/freeanima-org/freeanima/commit/67bc69c960726fc40fc1f32c84a4b915a7e1757f))
* **task:** 移动端任务 UI 抽屉导航与触摸拖拽排序 ([ebea7d2](https://github.com/freeanima-org/freeanima/commit/ebea7d26f1c4b839723b3aecffb6eb534a41dcb6))
* **task:** 统一实体底座、任务模块与 daisyUI fieldset 表单项 ([09e5752](https://github.com/freeanima-org/freeanima/commit/09e575261875580abfeba6e30b0a394079b57e5c))
* **tunnel:** 内置 Cloudflare Tunnel + Access 远程访问 ([e097126](https://github.com/freeanima-org/freeanima/commit/e097126ff6efec96b4ff67b7f984ed0fbfe51a50))
* **ui:** 抽象 ListDetailLayout 并修复 drawer 侧栏透明 ([9967857](https://github.com/freeanima-org/freeanima/commit/9967857940cd9c834fb84674ab00287c89a6b2b0))
* **web:** Web 独立进程 stack 部署与壳层生产修复 ([2d3dbae](https://github.com/freeanima-org/freeanima/commit/2d3dbaef75a3eb7844bf320bca412a4664ad274b))


### Bug Fixes

* **admin:** 修复 bundled 管理台 Hub REST 并在控制台输出错误堆栈 ([a37690e](https://github.com/freeanima-org/freeanima/commit/a37690e6dfe5b0cd9d35bc60aeff1fd63c269a57))
* **app-desktop:** DevTools 改为窗口内嵌并移除托盘入口 ([25682c5](https://github.com/freeanima-org/freeanima/commit/25682c51705b5db6a8d32a090c6370407840230a))
* **app-desktop:** 修复 Windows 升级时冷启动旧版导致解压失败 ([5567803](https://github.com/freeanima-org/freeanima/commit/556780365a1a967ff6ed2de44a7cfd18b8f0740c))
* **app-desktop:** 修复 Windows 安装包并优化打包体积 ([5783d9b](https://github.com/freeanima-org/freeanima/commit/5783d9b100923c67212d7fe4013cf2752cb9a816))
* **app-desktop:** 修复桌面 chat 双重挂载与 SAP worker 404 ([af4f77c](https://github.com/freeanima-org/freeanima/commit/af4f77cd4eab14488daac598c2d73a2ac700e5f5))
* **app-desktop:** 缓解 Windows 安装器点击安装后系统卡死 ([d9597d3](https://github.com/freeanima-org/freeanima/commit/d9597d31c9e150d5402fb4d5dcde0439f5a80532))
* **app-mobile:** Android 真机构建改用 Gradle 直装并显示进度 ([e401f7e](https://github.com/freeanima-org/freeanima/commit/e401f7e2575a18febb14f0d8ab28667dafdd6818))
* **app-mobile:** 修复 Android 状态栏与安全区重叠 ([5a58307](https://github.com/freeanima-org/freeanima/commit/5a583078ace024ef68da5413b65720e7ce8f834f))
* **app-mobile:** 修复占位符导致 index.html 丢失脚本 ([68150ef](https://github.com/freeanima-org/freeanima/commit/68150ef7cad48305e56f9a46aa4ad67dc4c053cd))
* **app-mobile:** 修复卧室 WebUI 资源路径双前缀导致样式失效 ([2e288a8](https://github.com/freeanima-org/freeanima/commit/2e288a8611b386d6bd74e70e2d82d043444f77be))
* **app-mobile:** 修复聊天输入与管理台直连 Hub 网络 ([8341ca6](https://github.com/freeanima-org/freeanima/commit/8341ca6fc424249b40e3cb0f290f9c8fd9c0f231))
* **app-mobile:** 修复重新打开白屏并补充启动错误提示 ([83265d0](https://github.com/freeanima-org/freeanima/commit/83265d0efa91a889a94bad63cb77827d6b654f9e))
* **app-mobile:** 移动端设置布局与 Hub 重连能力 ([4e5541d](https://github.com/freeanima-org/freeanima/commit/4e5541df5c0f0a2158ba7eeb7ec824b2617cc0b1))
* **app-web:** 恢复 Web 壳层通用设置面板 ([1e6f731](https://github.com/freeanima-org/freeanima/commit/1e6f73161d9ae76eab3f771bd88a8d5305eeeb8f))
* **ci:** Quality 工作流安装 gettext/po4a 以运行 strict PO 检查 ([fd35431](https://github.com/freeanima-org/freeanima/commit/fd3543188d398cd42fac54b615d1f68b71e2d42f))
* **ci:** 修复 Gitleaks 误报与 CodeQL 告警 ([fa38a0f](https://github.com/freeanima-org/freeanima/commit/fa38a0fdaec47ef464db5e497cd5541c95354e88))
* **ci:** 修正 CLI pack 路径为 app/cli/publish ([c7ed789](https://github.com/freeanima-org/freeanima/commit/c7ed7893e408244893397814fc18cb86a7a18d2a))
* **ci:** 清除 PO fuzzy 并恢复 platform llm-openai 依赖 ([326bc43](https://github.com/freeanima-org/freeanima/commit/326bc434d45d27e5d886e891acb5466bc3312f8b))
* **cli:** 恢复 cli/src/cli.ts 兼容入口供 blackbox 与旧脚本使用 ([4a8aacd](https://github.com/freeanima-org/freeanima/commit/4a8aacd0b43d4f4d94549673599f9446bc5a94b6))
* **companion:** companion app 导入时 @/ 别名解析到 companion 源码 ([94bfd4f](https://github.com/freeanima-org/freeanima/commit/94bfd4fe2fb91651847648650ebc0c3c092d3593))
* **companion:** 修复 Windows overlay 失焦后自动出现标题栏 ([6136584](https://github.com/freeanima-org/freeanima/commit/6136584e1c87584e4299307a9397c4df30503f25))
* **companion:** 启动加载改用 spinner，避免窄窗口文字溢出 ([71723e0](https://github.com/freeanima-org/freeanima/commit/71723e0501b0cb5801508221212d704e886544de))
* **companion:** 移除 overlay 窗设置按钮 ([c28ad2e](https://github.com/freeanima-org/freeanima/commit/c28ad2eab06f671eab8c137f58e150210e5f819d))
* **db:** 修复归档列引入后 loadConversationMeta 校验失败 ([3d3d490](https://github.com/freeanima-org/freeanima/commit/3d3d490aa186b79c91626d13c846b13aed539c1a))
* **deps:** 强制 @sinclair/typebox 0.34 以满足 Elysia 启动 ([42420f4](https://github.com/freeanima-org/freeanima/commit/42420f4f470515ae81252b30aab55bfbe8b3af13))
* **dev-web:** 修复 Hub 迁移失败与 dev:web 壳层联调 ([805d3bc](https://github.com/freeanima-org/freeanima/commit/805d3bcd0df557aad07e59790eec693b93efbe49))
* **email:** 修复 IMAP 同步头解析与迁移脚本配置绑定 ([97615c0](https://github.com/freeanima-org/freeanima/commit/97615c0344c57b01870766d81731e3d021aca2f5))
* **goal:** 避免 goal-judge JSON 解析的正则 ReDoS 告警 ([6b893a7](https://github.com/freeanima-org/freeanima/commit/6b893a739fe0f73615b46975f76eec5c7809b86d))
* **i18n:** 统一 site/docs 英文 SSOT 并补齐 PO 中文翻译 ([6d40a75](https://github.com/freeanima-org/freeanima/commit/6d40a758d6b9c167d2127ce8e3402e27ca1a7acf))
* **memory:** 梦境按 created_at 筛选当日情绪记忆 ([234131f](https://github.com/freeanima-org/freeanima/commit/234131f8ba5a3f3f29949c00e64cd05ba1f223e9))
* **mobile:** Android 脚本改用 Vite 构建替代已移除的 build.ts ([1914cca](https://github.com/freeanima-org/freeanima/commit/1914ccad7b2805cb693903fbb20049051a8518c6))
* **mobile:** 修复聊天室键盘遮挡与管理台侧栏 emoji ([1d1f14d](https://github.com/freeanima-org/freeanima/commit/1d1f14d849705ccf7a8a50849a2dc6baa61c6386))
* **parlor:** 修复 SharedWorker 初始化与脚本加载 ([9dd26cc](https://github.com/freeanima-org/freeanima/commit/9dd26cc53efc2d62396311f0edb7127b8bc7d58c))
* **parlor:** 修复 tool call 分段展示并统一 stream-reply reducer ([640a7f8](https://github.com/freeanima-org/freeanima/commit/640a7f80ec419a4218228e55ac59f68dff07de07))
* **parlor:** 迁移 sidecar relay 修复会话列表与 instance 持久化 ([3474277](https://github.com/freeanima-org/freeanima/commit/3474277995c17e66ab2f1912f97263ac0d901282))
* **platform:** slash 命令必有响应，耗时命令先 ack 再出结果 ([8d13231](https://github.com/freeanima-org/freeanima/commit/8d13231d04528ffeb8cc87d6e831ad5eccbee81f))
* **platform:** 移除 Parlor 默认 platform 并迁移至 sap:parlor:{instance} ([aeda08c](https://github.com/freeanima-org/freeanima/commit/aeda08cf1b232432171b243b74394936bea59751))
* **shell-ui:** 修复 bundled 模式导航、样式与聊天室 UX ([2c2ea55](https://github.com/freeanima-org/freeanima/commit/2c2ea55fc4cd37d066755627b46405f0911bbd05))
* **site:** 修复 Paraglide 构建解析与 Mermaid 客户端 i18n ([79fc6b1](https://github.com/freeanima-org/freeanima/commit/79fc6b15782e188214b4e784ba2333654cd0a044))
* **test:** cron-log mock 保留 getCronJob 等导出避免污染 gateway 测试 ([cfaee89](https://github.com/freeanima-org/freeanima/commit/cfaee893542795d8bb7bc26816b8daa5f9813a19))
* **test:** 修复 fridge-bridge  flaky 单测并同步依赖与 CI ([2f6a427](https://github.com/freeanima-org/freeanima/commit/2f6a427afb0e8b6e9b23749491a2a490617115e9))
* **test:** 修复测试套件在 /tmp 下的临时目录泄漏 ([5299240](https://github.com/freeanima-org/freeanima/commit/529924014687415ff443e19f2da0d644c95ad597))
* **tokenizer:** Hub 下载超时并收窄 Ollama 端点探测范围 ([df044b6](https://github.com/freeanima-org/freeanima/commit/df044b64660a1d8dce1a12315bedd00fec09bb82))
* **web:** 修复生产构建深路径刷新白屏 ([eed752c](https://github.com/freeanima-org/freeanima/commit/eed752c48b3ec77c3db2b7f39553403a3e0ab943))


### Performance

* **webui:** 优化 Chamber WebUI 公网访问性能 ([b532efc](https://github.com/freeanima-org/freeanima/commit/b532efc148664ff21bbe78e46c861b3899739658))


### Documentation

* **agents:** 以高层大原则重组 AGENTS.md bootstrap ([dc153dd](https://github.com/freeanima-org/freeanima/commit/dc153dd4ea3dec6a7f5fbaf92dd0e31ea29bec10))
* **guide:** 修正 Admin URL 并同步 agent 规则 ([e79c0df](https://github.com/freeanima-org/freeanima/commit/e79c0dfa065ffcfcc6ebb586b3a01979bf021d2b))
* **rules:** 补全分层依赖矩阵文档 ([4ccd5fc](https://github.com/freeanima-org/freeanima/commit/4ccd5fc87161c875e07d3f8a530b64ec0ad36b20))
* **skill:** 添加多 worktree 开发与 cherry-pick 合入流程 ([e055e01](https://github.com/freeanima-org/freeanima/commit/e055e017ae53047ffd9ecb72adfa3b816d48f503))
* **worktree:** 副 worktree 通过 symlink 复用 node_modules ([0dfc509](https://github.com/freeanima-org/freeanima/commit/0dfc5097d8cf9f4efbd3615f20e37005b11fb572))


### Miscellaneous

* **deps-dev:** bump electron ([630361e](https://github.com/freeanima-org/freeanima/commit/630361eac539c63f6fd214830ef6f1d8261d11a6))
* **deps:** bump the production-dependencies group across 1 directory with 3 updates ([052c733](https://github.com/freeanima-org/freeanima/commit/052c733fca5af99aadfbeed9239cfdb871ddba19))
* **deps:** 升级 drizzle rc.4 并清理遗留依赖与 [@deprecated](https://github.com/deprecated) API ([a978f77](https://github.com/freeanima-org/freeanima/commit/a978f7790f3cd88bb1bf1b13e4a2cf3f4d4f39c7))
* **deps:** 统一 workspace catalog 并同步 lockfile ([86c3d14](https://github.com/freeanima-org/freeanima/commit/86c3d14fe51af84db61d0703f50b9c78cb71d769))
* **security:** 为 tunnel-run 测试占位凭证添加 gitleaks 白名单 ([9620ae4](https://github.com/freeanima-org/freeanima/commit/9620ae4ee18fd9947baa8fb4ed0cae0426a63614))
* 忽略 TS composite 声明产物并移除误提交文件 ([776d79f](https://github.com/freeanima-org/freeanima/commit/776d79ff2887c7a6a1027f7c8de93ad1c109b105))


### Refactoring

* Admin 架构重组与命名统一 ([03407a8](https://github.com/freeanima-org/freeanima/commit/03407a8b39f18d0075f7286033607cc20ed99e6e))
* **build:** 前端构建统一迁移至 Vite ([cfb8fd2](https://github.com/freeanima-org/freeanima/commit/cfb8fd2f7976b8e5a23a7baf4d75ae013632b8ca))
* **core:** Session 领域统一重命名为 Conversation ([5def5c8](https://github.com/freeanima-org/freeanima/commit/5def5c82601c610895c932c18c3e13504b6e5a5d))
* **db:** PG 扁平化，db-pg 迁入 core 并移除 Port 层 ([8c138f1](https://github.com/freeanima-org/freeanima/commit/8c138f1fe572f3adf7726c7de560cddb923ab116))
* **db:** 全栈 snake_case 与 Row/Mapper 类型治理 ([1bf8d54](https://github.com/freeanima-org/freeanima/commit/1bf8d54fa84bd42ea79a25cafaf6d9b415438374))
* **db:** 贯通 Row 类型与 pgTimestamptz 时间语义 ([622406a](https://github.com/freeanima-org/freeanima/commit/622406ad46490d8b624d766a0b0b941adbf5d181))
* **principles:** 对齐 AGENTS 五条原则的首批落地 ([247abab](https://github.com/freeanima-org/freeanima/commit/247abab218df534954963988fe2a7c4165621e74))
* **sap:** 统一三段 platform、Hub instance 分配与三卫星客户端策略 ([0503148](https://github.com/freeanima-org/freeanima/commit/0503148eadc90071171c0f8a2a1906249f99ed1a))
* **satellite:** 将 parlor 重命名为 chat ([819aed7](https://github.com/freeanima-org/freeanima/commit/819aed70926fa6f2f984f5555b45bbc9ef2b04b8))
* **task:** 解绑冰箱贴与任务待办 ([781b401](https://github.com/freeanima-org/freeanima/commit/781b40193ec676b5c5cbad98d92c3dd7f8837e4d))
* **tool:** 拆分任务/邮件 ToolSet 并补齐检索与 remind_at ([037f0b1](https://github.com/freeanima-org/freeanima/commit/037f0b1bef7dd3bc866675ac8486427b146b0154))
* 分层重构与 legacy 清理，合并 task 包并统一壳层基础设施 ([cf6f775](https://github.com/freeanima-org/freeanima/commit/cf6f775cf7d9a525dc11f07c9c27fdecd57fdb67))
* 桌面/移动统一壳层与设置窗 ([83e0b40](https://github.com/freeanima-org/freeanima/commit/83e0b40b2d4b0f56dedd02bcda02b6502b050959))
* 清理废弃 API、迁移脚本与 config shim ([0c9cd8f](https://github.com/freeanima-org/freeanima/commit/0c9cd8f95058f16aeaa02fc83744735d9dbf98e7))
* 清理弃用 API 别名、死代码与兼容层 ([acdff7b](https://github.com/freeanima-org/freeanima/commit/acdff7bbfd470e325fec71b255ef2463ac77de74))
* 设置契约迁入 shell-ui，form/component 分责 ([edd2e87](https://github.com/freeanima-org/freeanima/commit/edd2e8753326bb758b87c494964f0df98853b4bf))


### Tests

* **core:** 补充单元测试提升覆盖率 ([038729a](https://github.com/freeanima-org/freeanima/commit/038729a335e9588421a7665cf7a95a32c00e8163))


### CI

* 修复 Dependabot bun lockfile 并优化 Actions 工作流 ([b3ec44f](https://github.com/freeanima-org/freeanima/commit/b3ec44f3c23d2a3c810dc6644a8b30c5b6e06a1f))

## [0.7.0](https://github.com/freeanima-org/freeanima/compare/v0.6.0...v0.7.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* **tool:** 统一 ToolSet 单数命名与工具面整理
* **session:** ToolSet 粒度缓存与 toolsets 发现流程

### Features

* **cli:** 将 update 改为 upgrade 并按安装方式分派升级逻辑 ([f377b0d](https://github.com/freeanima-org/freeanima/commit/f377b0dd29125d7e35b7d04e7c9860b8a2e35c8d))
* **companion:** 增加多平台 CI 打包并修复浏览器模型加载 ([8c2e3de](https://github.com/freeanima-org/freeanima/commit/8c2e3de38aff6cc67cd6c0e5765d5bbeb27203ba))
* **companion:** 新增桌面伴侣 SAP 卫星与 Windows 打包 ([366f73d](https://github.com/freeanima-org/freeanima/commit/366f73dafca7357bde7a527189534fcc51ea2b67))
* **memory:** deep sleep 增量/全量模式与 WebUI 选择 ([7b49c78](https://github.com/freeanima-org/freeanima/commit/7b49c7868307f82790778f97e9ea3aa3d02126a3))
* **session:** ToolSet 粒度缓存与 toolsets 发现流程 ([caec35e](https://github.com/freeanima-org/freeanima/commit/caec35e16d9ea4e81f335bbee5540c550a88c220))
* **session:** 首条消息 LLM 自动生成标题并优化 Discord 线程命名 ([95586d3](https://github.com/freeanima-org/freeanima/commit/95586d3f512fdcc3cd981a19ac9ae5ffe4ab0dbb))
* **sleep:** sleep-cycle 首步清理过期无效 session ([5e3fa1d](https://github.com/freeanima-org/freeanima/commit/5e3fa1d9e355b8351bd3b7c0386a495fc1af91bc))


### Bug Fixes

* **cli:** 修复 npm 发布包启动与本地安装 ([955a4e2](https://github.com/freeanima-org/freeanima/commit/955a4e2e9a5161ead2ed194b096a5a83640a3146))
* **gateway:** 处理 Discord slash 交互重复确认（40060） ([8c2e3de](https://github.com/freeanima-org/freeanima/commit/8c2e3de38aff6cc67cd6c0e5765d5bbeb27203ba))
* **platform:** 落实 error.log triage 中的稳定性修复 ([53890f7](https://github.com/freeanima-org/freeanima/commit/53890f7c249c378d938ffeb0347647a037b09c40))
* **site:** 修复中文文档加载与文档站 Mermaid/锚点 UX ([cc7da47](https://github.com/freeanima-org/freeanima/commit/cc7da479db3171b0bf72d440769c4345756b983a))
* **webui:** Chamber 工具页展示全量工具集并改为默认工具集 ([40b2c80](https://github.com/freeanima-org/freeanima/commit/40b2c80d201d5cde0ed2f4b8c275dd4ac4536469))


### Miscellaneous

* **deps-dev:** bump the dev-dependencies group across 1 directory with 3 updates ([a7b8f4b](https://github.com/freeanima-org/freeanima/commit/a7b8f4baab2b30d27fb3df0c52f6b76b9940858c))
* **deps:** bump actions/deploy-pages from 4 to 5 ([a559ee6](https://github.com/freeanima-org/freeanima/commit/a559ee65a1719cedc2f58ed01d939bd8779c9c1d))
* **deps:** bump actions/upload-pages-artifact from 3 to 5 ([8947f60](https://github.com/freeanima-org/freeanima/commit/8947f60136dd6d0672fb33f5f7816885ce2aa133))
* **deps:** bump googleapis/release-please-action from 4 to 5 ([b7caa69](https://github.com/freeanima-org/freeanima/commit/b7caa6928c3562786d64ad614fb737ac96280afd))
* **deps:** bump the production-dependencies group across 1 directory with 2 updates ([fdd7c46](https://github.com/freeanima-org/freeanima/commit/fdd7c46221204994376c2bcbb250ecf9d072fb82))


### Refactoring

* **tool:** 统一 ToolSet 单数命名与工具面整理 ([84ce650](https://github.com/freeanima-org/freeanima/commit/84ce65000a8f0a7f98ff75d53fda17a71d19e8c6))


### CI

* Quality 预构建 CLI 并移除测试内联 build ([ca10c3b](https://github.com/freeanima-org/freeanima/commit/ca10c3b41bfe523f6a3c61b9c97298fba2ec35be))
* 新增 install-cli-smoke 作业验证本地 CLI 安装 ([94d28b1](https://github.com/freeanima-org/freeanima/commit/94d28b1bb57c3405cc1772ce792f109abe0acdcf))
* 用 publish 集成测试替代 smoke 并修复 CodeQL ([e5020e2](https://github.com/freeanima-org/freeanima/commit/e5020e2f921ae4b9fc329624c553abfbf4677765))

## [0.6.0](https://github.com/freeanima-org/freeanima/compare/v0.5.0...v0.6.0) (2026-06-15)


### Features

* **i18n:** po4a markdown 管线与 zh_CN PO 全文补译 ([dbf36fa](https://github.com/freeanima-org/freeanima/commit/dbf36faa29741c405bf73f3169ad3baed03bbd79))
* **memory:** 新增做梦机制 ([3bbaa88](https://github.com/freeanima-org/freeanima/commit/3bbaa889015c3016a6aafe7b7cfee0d89e24ccb4))
* **memory:** 统一记忆引用为 [[f-id]] 并扩展语义记忆引用规则 ([ba5db65](https://github.com/freeanima-org/freeanima/commit/ba5db655c359083c9cb24ab0fb6d404445095e65))
* **memory:** 自传概括改为按 significance 分组的提纲式输出 ([526e4cd](https://github.com/freeanima-org/freeanima/commit/526e4cd6af4ae49ea0428839fcda8e2bb36b9a85))
* **sap:** 结对编程 relay 单 Hub WS 与卫星侧 PTY/工具 ([21ea322](https://github.com/freeanima-org/freeanima/commit/21ea322ceb5dc4321e3300988a4b62c36176f7a4))
* **sap:** 落地 SAP/1.0 卫星协议与结对编程卫星骨架 ([a28e66e](https://github.com/freeanima-org/freeanima/commit/a28e66e5f133d042ff6094e5ef1d4577a02a9265))
* **satellite:** 会客厅 Managed 卫星接入 SAP 浏览器直连 ([1b76d33](https://github.com/freeanima-org/freeanima/commit/1b76d3352127f6c2b03c48bfa4ec99a1c4306a81))
* **satellite:** 声明式 satellites 配置与浏览器零 Hub 直连 ([0af2532](https://github.com/freeanima-org/freeanima/commit/0af2532eddb88020c77063a75cb6d5e1b1fa369e))
* **satellite:** 结对编程 API 经 SAP 代理并在 Hub WebUI 自动探测 ([59a8a7c](https://github.com/freeanima-org/freeanima/commit/59a8a7c0412922b2f49bf0439e8e70879ac27395))
* **satellite:** 结对编程 UI 迁出 Hub WebUI 至卫星进程 ([03bc015](https://github.com/freeanima-org/freeanima/commit/03bc0159d98b2c9d4baaf7575507c2563e1d90c2))
* **sleep:** 优化睡眠页、手动运行记日志并修复做梦查询 ([7f9f9d2](https://github.com/freeanima-org/freeanima/commit/7f9f9d236eabbcfc8edf96e07d7b676525f113d0))
* **sleep:** 引入 Pipeline Runner 并将睡眠 cron 合并为 sleep-cycle DAG ([4761ca2](https://github.com/freeanima-org/freeanima/commit/4761ca2eec7150ba40533f81ea2a4351343c68c4))
* **sleep:** 拆分流水线节点历史与 Cron 运行记录 ([2a97561](https://github.com/freeanima-org/freeanima/commit/2a97561a9abeae792c08eef3121c292129ab813e))
* **webui:** 统一 WebUI 与 error.log 的 CST 时间展示格式 ([069c372](https://github.com/freeanima-org/freeanima/commit/069c372a7d6592c0d3f882d11bb2670bf4011f64))


### Bug Fixes

* **acp:** bridge acpSessionUpdatedRef.handler so ACP callbacks fire immediately ([1403926](https://github.com/freeanima-org/freeanima/commit/140392669e66c8fc04d92dcf6b96a9d20e8e5748))
* **cli:** 修复 tiktoken wasm 补丁并补全 CI 构建前置检测 ([887c888](https://github.com/freeanima-org/freeanima/commit/887c8887b48bc35000682de9444ae7ebb9141cc1))
* **db-pg:** 修复 CJK OR 查询非法 tsquery 并增加校验 ([51f3ead](https://github.com/freeanima-org/freeanima/commit/51f3ead40f30b9ca779f03f45c035056b7d74b29))
* **satellite:** Hub ready 后再启托管卫星并统一 SAP transport 重连 ([0b21dc7](https://github.com/freeanima-org/freeanima/commit/0b21dc791633d0b0d71e1c949d83c9d397776122))
* **site:** 修复 Astro 6 文档页正文为空 ([2ea2098](https://github.com/freeanima-org/freeanima/commit/2ea209878b79c9c11e4471c42feb5fb01c41517e))
* **webui:** 修复梦境列表刷新时 Date 字段渲染报错 ([9ada9cd](https://github.com/freeanima-org/freeanima/commit/9ada9cd7f55861260552f85f911fbc5583277700))
* **webui:** 加发送锁防止 Parlor 消息重复发送 ([6b22be5](https://github.com/freeanima-org/freeanima/commit/6b22be5d12aabe2370e0eba24c28baec05d30c14))


### Documentation

* **i18n:** 补全 zh_CN 未翻译条目并同步 po4a 产物 ([2a9f745](https://github.com/freeanima-org/freeanima/commit/2a9f745cf2edc145579fbf7041cbc7aa8dcfe6a6))
* **sap:** 新增 SAP 协议文档目录与中英文翻译 ([000617b](https://github.com/freeanima-org/freeanima/commit/000617b56105dd4a201afdd6640de53c1a48ff95))


### Miscellaneous

* **release:** 将 CHANGELOG 排除出 oxfmt 并统一列表符为 * ([5aa4b21](https://github.com/freeanima-org/freeanima/commit/5aa4b21ac4ddab4fa2a0e62cee03b658563d83bb))


### Refactoring

* **db-pg:** 清零 db.execute 并统一为 Drizzle ORM 查询 ([d6bad7d](https://github.com/freeanima-org/freeanima/commit/d6bad7dc07667ac770e9ce1a3e0967b991c78e8d))
* **platform:** 移除 Hub studio runtime 与 satellites systemd unit ([80fb6df](https://github.com/freeanima-org/freeanima/commit/80fb6df1650a628f332df2ffe59eeb46a5a0f0d4))
* **webui:** 移除 Hub Studio 路由，顶栏改为外链卫星 ([75bd787](https://github.com/freeanima-org/freeanima/commit/75bd787ef68da118ddd4c983c3e292cd890017c5))
* **webui:** 移除睡眠页浅睡/深睡最新卡片 ([9701383](https://github.com/freeanima-org/freeanima/commit/9701383ecf0b67322c8462d8ae89ea699684d6f7))

## [0.5.0](https://github.com/freeanima-org/freeanima/compare/v0.4.0...v0.5.0) (2026-06-12)

### ⚠ BREAKING CHANGES

* **docs:** 重组文档为英文 SSOT 并拆分贡献者规则
* 顶层包结构重构为八层工程模型

### Features

* **acp:** acp_task_status 查询工具 + Discord 5s 就地编辑 tail ([198f89a](https://github.com/freeanima-org/freeanima/commit/198f89ab6ea2fbb3766b03ef07909ddccbcc7d41))
* **acp:** acp_tasks 异步委托 Phase A/B 与多通道 progress 投递 ([b267f03](https://github.com/freeanima-org/freeanima/commit/b267f03eada35fe6c289abd10680160649012975))
* **acp:** 支持同 agent 多任务并行并统一以 acp_session_id 续聊 ([ca2f847](https://github.com/freeanima-org/freeanima/commit/ca2f847c995d28f92ed5e65d1aa4d45a456486b1))
* **cli:** 新增 update 命令并将 memory 回填迁移至 WebUI ([9a29ed5](https://github.com/freeanima-org/freeanima/commit/9a29ed513a997563b0ac9c275fe3b75ca2e437c8))
* **fridge-magnet:** 空内容不注入并统一全称命名 ([9ba42a6](https://github.com/freeanima-org/freeanima/commit/9ba42a605f89c0a4f61f7773dfb967ec2105d4b8))
* **gateway:** 统一消息通道状态层与策略组合出站架构 ([b82a566](https://github.com/freeanima-org/freeanima/commit/b82a5660a3df5e36c91d4a04f1468f946a9ea6da))
* **memory:** 完善语义记忆 pin 生命周期维护 ([e1875f0](https://github.com/freeanima-org/freeanima/commit/e1875f0a67af06b9f4fd453039cd57477e026947))
* **prompt:** Hook 组装系统提示词并常驻 ToolSet 索引 ([37bcc36](https://github.com/freeanima-org/freeanima/commit/37bcc3618eff75c4f9fa8400fb07e628f6dd1260))
* **tasks:** 优化冰箱贴摘要并在启动时同步 ([0047395](https://github.com/freeanima-org/freeanima/commit/0047395cf572cfd90539e45b7ba6a4c4f1b9e443))
* **webui:** Parlor ACP progress dock + SSE 实时推送 ([c53eae3](https://github.com/freeanima-org/freeanima/commit/c53eae3da1cf8db2fe56022ab2c92338c8329245))
* **webui:** 语义记忆页表格化并支持 sort_by 服务端排序 ([4fc8a76](https://github.com/freeanima-org/freeanima/commit/4fc8a767a0186d74a40822fb54ccb1414532e87c))

### Bug Fixes

* **acp:** 修复 ACP 结果未写入 conversation 表 ([3d32e8a](https://github.com/freeanima-org/freeanima/commit/3d32e8ac743931a0be2ff0345efc46da45f2ddf4))
* **ci:** 修复 Quality 检查与 PR 审查意见 ([3d6af39](https://github.com/freeanima-org/freeanima/commit/3d6af39e9b2f0150a91b1d22517790ae9158ca6c))
* **cli:** 修复 npm 包缺少 tiktoken_bg.wasm 导致启动失败 ([4880a59](https://github.com/freeanima-org/freeanima/commit/4880a592477aa48fd7940322fd59cdfd9d4b6c9f))
* **docs:** add missing frontmatter title to docs/guide/service.md ([b8218ee](https://github.com/freeanima-org/freeanima/commit/b8218eef058a801a9467f55104395c43304fdc4e))
* **gateway:** 修复 Discord 助手消息重复发送 ([9265d45](https://github.com/freeanima-org/freeanima/commit/9265d4542bdad85a0a7fa0b26c1c521c9f109ef4))
* **memory:** 修复浅睡 acp_tasks 遗留格式与深睡活跃记忆计数 ([ad67666](https://github.com/freeanima-org/freeanima/commit/ad6766675d990030881eb56f8b697bf691b4708f))
* **service:** 澄清 status 内存指标（RSS 物理内存 vs JSC heap） ([87e33bd](https://github.com/freeanima-org/freeanima/commit/87e33bdecb40214fef4cef69c04f41adf822ae71))
* **webui:** resolveWebuiAppDir 兼容 monorepo 与发布包路径 ([dc203c9](https://github.com/freeanima-org/freeanima/commit/dc203c900d7c53c53090422f10755c0ade27c06a))
* **webui:** 修正 Paraglide 相对路径以适配 platform 层目录 ([f28fdca](https://github.com/freeanima-org/freeanima/commit/f28fdca54895d44f05c369a387d390f796bc14ce))

### Performance

* **service:** 降低启动 RSS 并增强 status 可观测性与 CLI 布局 ([5971544](https://github.com/freeanima-org/freeanima/commit/5971544ec77b8d722050d21606d1ab2c3e707a3a))

### Documentation

* **agents:** 新增原则维护硬约束与分层分流规则 ([f8a726c](https://github.com/freeanima-org/freeanima/commit/f8a726cab89bb302a0b68f0d893ffd7ffd2938bb))
* **guide:** 新增安装文档（npm CLI / Docker / 源码） ([bd22219](https://github.com/freeanima-org/freeanima/commit/bd22219fdaa10f788213ffb55caa8e6d8bfc3a5b))
* 定义五层架构目标与迁移映射 ([833efab](https://github.com/freeanima-org/freeanima/commit/833efabb68bee2b146d4dcc4d28408e3bde19c6d))

### Miscellaneous

* add docs frontmatter title check to pre-commit and CI ([8979cd2](https://github.com/freeanima-org/freeanima/commit/8979cd2df8d50d20d9dbf06b4b8d5b930e908c37))
* 五层架构收尾与文档路径更新 ([611d89a](https://github.com/freeanima-org/freeanima/commit/611d89a0b23ffbc57c430fd8ac6a0e00ca151c5c))
* 清理 deprecated 别名并更新旧路径引用 ([d47c554](https://github.com/freeanima-org/freeanima/commit/d47c554e36d83730b4e12ae87f4bc55853408b61))

### Refactoring

* **capabilities:** 十一包合并为七包 ([68cf1da](https://github.com/freeanima-org/freeanima/commit/68cf1da858d240fae682e2f46bc61b69d58fd480))
* **core:** storage 与 mechanism 十一包合并为 @freeanima/core ([f1840d0](https://github.com/freeanima-org/freeanima/commit/f1840d0afbb1f2327978edbc9ff19cb2306e29b6))
* **db-pg:** 语义记忆 ORM 化并新增 Drizzle 查询规范 ([d63da67](https://github.com/freeanima-org/freeanima/commit/d63da6767af8263d0d55da38528698f80b8ad296))
* **docs:** 重组文档为英文 SSOT 并拆分贡献者规则 ([47de79d](https://github.com/freeanima-org/freeanima/commit/47de79de0a42d54014ae84fa8b2d985d1985fcc5))
* **i18n:** 删除 merge-webui-messages 并统一管线文档 ([18e4e3e](https://github.com/freeanima-org/freeanima/commit/18e4e3eb3ba8300f1abe165248636914eb45893d))
* **kernel:** 合并五子包为单层单包 @freeanima/kernel ([762bb7c](https://github.com/freeanima-org/freeanima/commit/762bb7c3bca228da3b01a8b937086184b8008c5a))
* **platform:** service 与 connectors 合并为 @freeanima/platform ([a5dbc4a](https://github.com/freeanima-org/freeanima/commit/a5dbc4a9b0591abb51e6f8c03915f9376408f389))
* **runtime:** orchestration 五包合并为 @freeanima/runtime ([231f9cb](https://github.com/freeanima-org/freeanima/commit/231f9cb2655db6719af534b5afafe35c8f18e262))
* **service-api:** 合并 RuntimeService 到 AnimaService 统一接口 ([8408199](https://github.com/freeanima-org/freeanima/commit/84081993fdc9e5d9ae3853a045565a110e60ff39))
* **service:** 以 AppRuntime 替代 AnimaService 宽 Facade ([0800485](https://github.com/freeanima-org/freeanima/commit/0800485b1e73f9d48f5332807bc22bc3eed3aca0))
* **service:** 拆分 boot 阶段并统一 RuntimeContext ([affee06](https://github.com/freeanima-org/freeanima/commit/affee06a2d6b63ba2fb933bf5c975fe3d1ba4561))
* 架构瘦身——ConversationService、PgStore、runtime barrel 等 ([281205b](https://github.com/freeanima-org/freeanima/commit/281205b1901f4d0ca74dff04518ef158348855a1))
* 顶层包结构重构为八层工程模型 ([661d767](https://github.com/freeanima-org/freeanima/commit/661d76763ce69ad52640caa235ddf9f03c653b4b))

## [0.4.0](https://github.com/freeanima-org/freeanima/compare/v0.3.11...v0.4.0) (2026-06-11)

### ⚠ BREAKING CHANGES

* **config:** 引入 Config/FileConfig 并移除 loadConfig 全局读
* **agent:** 拆分 AGENTS.md 至 .agent/rules/ 并精简运行时入口
* **eventbus:** 移除 SqliteEventQueue 并统一使用 Redis 后端
* **engine:** 下沉 engine-config 并注入 config/logger，解除 engine 对 service 层依赖
* **kernel:** 将 util/retry 上迁至 engine 层并拆分域 hook

### Features

* **tokenizer:** 增强 Hub 自动 resolve 与可观测性 ([72d260c](https://github.com/freeanima-org/freeanima/commit/72d260ce334f5ff63970c174ba17fa4a2bfd4fb7))
* **tokenizer:** 统一 @huggingface/tokenizers 并收紧 embedding 分块 ([21ca800](https://github.com/freeanima-org/freeanima/commit/21ca8005192722db3e8dbd4026ff9c310f7adde1))
* **webui:** 优化记忆台召回调试页并移除 memory_recall session 过滤 ([458b0b1](https://github.com/freeanima-org/freeanima/commit/458b0b1a7f75a753f28574fc5a2d9d113f4ba3de))

### Bug Fixes

* **ci:** 修复 context stats 集成测并提前触发黑盒 dispatch ([a7e6115](https://github.com/freeanima-org/freeanima/commit/a7e6115957ed676e59ef181a835128f68bfa2629))
* **ci:** 修复 Quality、Gitleaks 与 CodeQL 三项 CI 失败 ([d0a226a](https://github.com/freeanima-org/freeanima/commit/d0a226a9eb7f3a303c99702a99182f3593e4d816))
* **ci:** 修正 storage/db 路径并补全 email 测试 config 绑定 ([43ea509](https://github.com/freeanima-org/freeanima/commit/43ea5095fbe711c092699a8400054169888ec841))
* **embedding:** 修复补向量 rebuild 分页与入库匹配失败 ([6ae9147](https://github.com/freeanima-org/freeanima/commit/6ae91479dd9147bad4cfd02ea7c82ce8db9bc952))
* **test:** session-handoff 改用 spyOn 避免 mock.module 污染 ([c39e4d9](https://github.com/freeanima-org/freeanima/commit/c39e4d96e9837fc55751e20c45e02a8ce6c41a93))
* **tokenizer:** 量化变体名回落 seed 并过滤 Ollama blob hint ([15ca2ad](https://github.com/freeanima-org/freeanima/commit/15ca2ad85652a671efa13415a9d692bf42e7d0e4))

### Documentation

* **agent:** 拆分 AGENTS.md 至 .agent/rules/ 并精简运行时入口 ([d83b5ab](https://github.com/freeanima-org/freeanima/commit/d83b5aba13f6ac0bc69450f582ef22fb3aa56465))

### Refactoring

* **config:** 引入 Config/FileConfig 并移除 loadConfig 全局读 ([97fcb24](https://github.com/freeanima-org/freeanima/commit/97fcb24395dd467fdcde8c78a28c3ef181fca90f))
* **embedding:** 向量 rebuild 逐条读取并算完即入库 ([ca78c5e](https://github.com/freeanima-org/freeanima/commit/ca78c5efe1124f4f3398c4a7a4b39c4781e53875))
* **embedding:** 简化向量写入路径，仅保留长文本切块 ([6875f17](https://github.com/freeanima-org/freeanima/commit/6875f17aa0ae1d1afde0e469472784554c4d2016))
* **engine:** 下沉 engine-config 并注入 config/logger，解除 engine 对 service 层依赖 ([e010788](https://github.com/freeanima-org/freeanima/commit/e01078836f5c50ce4e0b8e3f62bf6449b8ffc57b))
* **eventbus:** 移除 SqliteEventQueue 并统一使用 Redis 后端 ([00bea00](https://github.com/freeanima-org/freeanima/commit/00bea0022be5f58d3f7d7a8ed67c2f754a645db9))
* **kernel:** 将 util/retry 上迁至 engine 层并拆分域 hook ([0c1863f](https://github.com/freeanima-org/freeanima/commit/0c1863f9e9d6906b937775b1ef5912509dbb6d45))

### Tests

* **integration:** wire service ports in test context ([8769501](https://github.com/freeanima-org/freeanima/commit/8769501c4e3a38a93688d82f1798a57e62b0dafc))
* **kernel:** 修复 eventbus 与 hooks 的 func 覆盖率缺口 ([42f9b55](https://github.com/freeanima-org/freeanima/commit/42f9b55ce1ec46de889c257a344643b018f860cf))

### CI

* 优化 GitHub Actions 提速 ([b07a68d](https://github.com/freeanima-org/freeanima/commit/b07a68d4874196381a662e652548748ba0cb9d31))

## [0.3.11](https://github.com/freeanima-org/freeanima/compare/v0.3.10...v0.3.11) (2026-06-10)

### Features

* **embedding:** 按 6K token 动态拼批并支持超长文本分块 ([ef36080](https://github.com/freeanima-org/freeanima/commit/ef360802e6e9df224658ed47f381525f9aff2d4d))
* **i18n:** 接入 Paraglide 与 po4a 统一双语管线 ([938da42](https://github.com/freeanima-org/freeanima/commit/938da4241b18f8a0579fe8b2318a737d841b5c52))
* **site:** 文档站接入 Mermaid 图表渲染 ([5be636d](https://github.com/freeanima-org/freeanima/commit/5be636d26535e263d573a7c5effd9ae092ad2851))
* **site:** 移植多区块落地页并接入 Starlight 暖灰主题 ([7ecfe5f](https://github.com/freeanima-org/freeanima/commit/7ecfe5f6e711754f8bb25ebf450c130f91c78635))
* **tool:** 工具返回 Zod 契约与保真示例 ([937ad84](https://github.com/freeanima-org/freeanima/commit/937ad84485c970c457772f711002c5cf792209eb))
* **webui:** AOT 静态构建与 --dev watch，修复创作室 tab 切换崩溃 ([4f9ae04](https://github.com/freeanima-org/freeanima/commit/4f9ae048a362a8818a8fc0aa4c3d1943d3e5c327))
* **webui:** 卧室新增只读待办任务管理页 ([bddaf4b](https://github.com/freeanima-org/freeanima/commit/bddaf4b89cfbb638d0f5031812e1f0ab84fefc3a))
* **webui:** 新增冰箱贴只读查看页与会客厅紧凑预览 ([4b8d60a](https://github.com/freeanima-org/freeanima/commit/4b8d60aacaa83abc2eb4934bbfe812dbcbb614b2))

### Bug Fixes

* **ci:** 修复 CodeQL 告警与 blackbox dispatch PAT 说明 ([a09fe9f](https://github.com/freeanima-org/freeanima/commit/a09fe9feca0914a8ec570acfffdc52bed9895514))
* **dep-check:** 按包名首段校验 import 并同步 AGENTS ([a8caf2f](https://github.com/freeanima-org/freeanima/commit/a8caf2fe54062f13379208c816bf1566f2a915f5))
* **i18n:** lower po4a opt_keep threshold to 0 to unblock site deploy ([32b2b24](https://github.com/freeanima-org/freeanima/commit/32b2b240b05ab155774320c89b7fde658e2ddb5c))
* **i18n:** use valid po4a keep option syntax ([8e4e424](https://github.com/freeanima-org/freeanima/commit/8e4e424df1b9cb329197dab63082a71067b3eb36))
* **webui:** 修复会客厅 SSE 流式消息丢失 ([27c5866](https://github.com/freeanima-org/freeanima/commit/27c586619d1e30948790cd93efbf3e6fad042502))
* **webui:** 修复睡眠记录页 Date 渲染崩溃与 runs 列表加载失败 ([1f6993a](https://github.com/freeanima-org/freeanima/commit/1f6993a85ab055f05aa645bd8441fd9c1d43031b))
* **webui:** 修复记忆台搜索 observed_at 渲染崩溃 ([87db654](https://github.com/freeanima-org/freeanima/commit/87db65412afd472b28cd04169fdd9c2298c691d3))

### Miscellaneous

* **ci:** 统一使用组织 secret FREEANIMA_CI ([d48215f](https://github.com/freeanima-org/freeanima/commit/d48215f3b8c030553130d905ed0a81aa1e984a69))
* **deps:** 升级 nodemailer 与 astro ([503b1f4](https://github.com/freeanima-org/freeanima/commit/503b1f46afda8688e85288efb1371ef81f5a1aee))
* **release:** 对齐 changelog 列表符与 oxfmt 并约束 Agent 勿改 CHANGELOG ([b10e9f8](https://github.com/freeanima-org/freeanima/commit/b10e9f8a065089641777d8adf9de20c9de5f8b32))
* 删除未使用的 connectors-sqlite 包 ([c57c578](https://github.com/freeanima-org/freeanima/commit/c57c5789fba224f46afb426c85d386731433a28b))

### Refactoring

* **docs:** 重组文档目录并同步站点与 i18n ([691330d](https://github.com/freeanima-org/freeanima/commit/691330d05490683b608b07fcf72f05a8fc26f5e5))
* **engine-db:** runMigrations 支持注入 migrationsFolder ([30239f3](https://github.com/freeanima-org/freeanima/commit/30239f3eebf8f34c0af208593f79bb0df4cfb102))
* **engine-repos:** 下沉 memory-reference 标记解析 ([1ce2b9b](https://github.com/freeanima-org/freeanima/commit/1ce2b9b41d2f6d967b5592b44948e6a1046022b5))
* **i18n:** 代码侧全面英文化 ([d618ea0](https://github.com/freeanima-org/freeanima/commit/d618ea049713a8329fbdb7d852ba711cdbe0ff6c))
* **service-api:** ServiceContext 端口化并移除 capabilities/engine 依赖 ([28acf49](https://github.com/freeanima-org/freeanima/commit/28acf49f50f20d0f34ab9151c1f45cf1f21fa0e8))
* **service-api:** 迁入 display/snapshot/restart 契约 ([c4c3a68](https://github.com/freeanima-org/freeanima/commit/c4c3a687b3ed0c4a2596db92f64c7a37aace17fe))
* **service:** 拆分 register 为 tools/integrations/memory 模块 ([54afa0f](https://github.com/freeanima-org/freeanima/commit/54afa0f90894ec187e8ee867d9eb86680fa6c30a))
* **test:** 黑盒 E2E 迁至 freeanima-testing ([4755120](https://github.com/freeanima-org/freeanima/commit/4755120f4deb8bd407746ea26eca04bf6d189d4e))
* **webui:** handler runtime 绑定与 memory/self 工厂模式 ([727fb69](https://github.com/freeanima-org/freeanima/commit/727fb691b208e23ec29a97c4e215e50de5654da7))
* 移除 [@deprecated](https://github.com/deprecated) API 并完成调用方迁移 ([30781d9](https://github.com/freeanima-org/freeanima/commit/30781d9e9bd5d4e81407d45ae1a9ac77ca51cac1))
* 组合根 store 一次性注入与 FridgeStorePort 反转 ([be3d82f](https://github.com/freeanima-org/freeanima/commit/be3d82f720fd98cf8242409a872f834c66c1838f))

### CI

* **release:** 改用 Release Please 替代 semantic-release ([1510a68](https://github.com/freeanima-org/freeanima/commit/1510a688d5ec47e92b45d484b5efbafb17856d98))

## [0.3.10](https://github.com/freeanima-org/freeanima/compare/v0.3.9...v0.3.10) (2026-06-10)

### Features

* 语义记忆引用计数、浅睡重构与工具命名统一 ([#84](https://github.com/freeanima-org/freeanima/issues/84)) ([4502d02](https://github.com/freeanima-org/freeanima/commit/4502d02a2f6d739e309dde3ff32a672a7d958aaf)), closes [#xxx](https://github.com/freeanima-org/freeanima/issues/xxx)

## [0.3.9](https://github.com/freeanima-org/freeanima/compare/v0.3.8...v0.3.9) (2026-06-09)

### Features

* **commands:** 新增 /restart Slash 命令，异步优雅重启 ([0832883](https://github.com/freeanima-org/freeanima/commit/083288399f65cfe3da0b823083636a825861be5f)), closes [#31](https://github.com/freeanima-org/freeanima/issues/31)
* **embedding:** 写入路径 debounce 批量，重建复用 batch API ([1e0ea33](https://github.com/freeanima-org/freeanima/commit/1e0ea33ce92dea17890cde784970e78bbb9be76c))
* **eventbus:** 新增 Redis 队列 adapter 与 config 后端切换 ([7c94250](https://github.com/freeanima-org/freeanima/commit/7c94250f4651f9dd07eeaee2569e82e4faa1587e))
* **fts:** pg_trgm 模糊检索兜底与 RRF 合并 ([f989681](https://github.com/freeanima-org/freeanima/commit/f9896819378f53808fcec03d58ce7e2f82744025))
* **fts:** pgvector 语义检索与后台索引重建 ([5b15ef8](https://github.com/freeanima-org/freeanima/commit/5b15ef84a9c6ed04e88c9898bfc730337c475374))
* **fts:** 全局 cjk 开关与 jieba 分词索引 ([10c2971](https://github.com/freeanima-org/freeanima/commit/10c29717c901b63a59f5f056a892079958e7b073))
* **tools:** 按需工具加载，注册与 session 挂载解耦 ([21290b6](https://github.com/freeanima-org/freeanima/commit/21290b68aa1459507e661b14dd9f39989b6435e2))
* **webui:** 卧室新增记忆浏览页与自我层展示 ([6c7c9bd](https://github.com/freeanima-org/freeanima/commit/6c7c9bdfe683ae52bdf51bc126c7045c09c5e976))
* **webui:** 新增系统提示词调试页并修复配置块展示 ([03d653c](https://github.com/freeanima-org/freeanima/commit/03d653c0d9bab22b9638a77f7949d20f4e8d3803))
* **webui:** 紧凑化卧室仪表盘布局 ([accced2](https://github.com/freeanima-org/freeanima/commit/accced29b06f06bdb8887e34aeea03005dd6021e))
* **webui:** 邮箱分栏阅读与凭证明文弹窗 ([8d15754](https://github.com/freeanima-org/freeanima/commit/8d157542e76f32e37f4588fb2e2e448397049fdf))

### Bug Fixes

* **ci:** 修复 PG 扩展、loaded_tools lite 读取与 tool 门禁集成测 ([2143b7e](https://github.com/freeanima-org/freeanima/commit/2143b7e883c08ec6a6218704af9fb71aa9d9d09f))
* **ci:** 测试 PG 预装 vector 扩展并消除 CodeQL ReDoS 告警 ([576c8fa](https://github.com/freeanima-org/freeanima/commit/576c8fa4eabaa86366b8947e90f1814116cea6ee))
* **db:** patch drizzle bun-sql 修复 RQB select ([6384f0d](https://github.com/freeanima-org/freeanima/commit/6384f0d15ba35e777d77f9df664535bc4c149d81))
* **fts:** 收紧 CJK tsquery 精度并改用 ts_rank_cd ([038904f](https://github.com/freeanima-org/freeanima/commit/038904fe6abaef14495032a95dae24090e6a0369))
* include tools in session meta lite reads ([ce5266f](https://github.com/freeanima-org/freeanima/commit/ce5266fda9746314f417b834c59a4861eaacecda))
* keep session meta tools for runtime allowlist ([55c1b3f](https://github.com/freeanima-org/freeanima/commit/55c1b3f17b86ad8271a9e106b07bcc6a1cf237fe))
* use --outdir instead of --outfile in build-cli script ([f0ff52f](https://github.com/freeanima-org/freeanima/commit/f0ff52fce94213f98f2c18a8c52a8188fe942cde))

### Miscellaneous

* **engine-db:** 补全历史 migration snapshot 链 ([1454924](https://github.com/freeanima-org/freeanima/commit/14549240748c39a6c973ebbdfc2608c3dad33565))

### Refactoring

* **db-pg:** 收回 CRUD 读路径至 Drizzle RQB ([9f0fba4](https://github.com/freeanima-org/freeanima/commit/9f0fba4123a571e1401bc2061cf323e3f770433c))
* **engine-tool:** 实装单一 ToolSetRegistry 并移除 cron enabled_toolsets ([2cea333](https://github.com/freeanima-org/freeanima/commit/2cea333aa6ce9356c440d4b10e4b08bc2cc7f8a6))
* **service:** 将 Runtime Catalog 收入 Engine 与 ServiceContext ([50d7ef3](https://github.com/freeanima-org/freeanima/commit/50d7ef3c5fbad665b95f790cb9c0cbf4830a8282))
* **test:** 拆分单元/集成/E2E 入口并并行全量 ([bc043ad](https://github.com/freeanima-org/freeanima/commit/bc043adb5212018b59a10d1874cb4a232e690b58))
* **test:** 旁置单元测并统一 Bun.sql PG 驱动 ([af87695](https://github.com/freeanima-org/freeanima/commit/af8769555f5f5896dc01e5d39608f0e6d7171ecd))
* 将 feng-nest 遗留的 nestXXX 命名统一为 animaXXX ([d92bbc2](https://github.com/freeanima-org/freeanima/commit/d92bbc2e084acbf8365ab7adf50f99927e07f0dd))
* 清理迁移兼容层与技术债务 ([1d5d628](https://github.com/freeanima-org/freeanima/commit/1d5d6282c85e7ffb50479bef8ab3792fe3b5862a))
* 移除 JSONL 遗留代码与术语 ([22f823a](https://github.com/freeanima-org/freeanima/commit/22f823a3c120c667636606a1e03b03cb6c3d8a70))

## [0.3.8](https://github.com/freeanima-org/freeanima/compare/v0.3.7...v0.3.8) (2026-06-09)

### Features

* **webui:** add credentials page in chamber ([ad63339](https://github.com/freeanima-org/freeanima/commit/ad63339f9d784cb5977af035681477709eeac79c))

## [0.3.7](https://github.com/freeanima-org/freeanima/compare/v0.3.6...v0.3.7) (2026-06-08)

### Bug Fixes

* **site:** 统一 Header/侧边栏/颜色 ([2fb34b0](https://github.com/freeanima-org/freeanima/commit/2fb34b0780625f0fcef426fb28623242fcba45ac))

## [0.3.6](https://github.com/freeanima-org/freeanima/compare/v0.3.5...v0.3.6) (2026-06-08)

### Bug Fixes

* site CI + Dockerfile 简化 ([957f45d](https://github.com/freeanima-org/freeanima/commit/957f45d0fdb33c6e9a6a6f37bae39a90b22d63fd))

## [0.3.5](https://github.com/freeanima-org/freeanima/compare/v0.3.4...v0.3.5) (2026-06-08)

### Features

* **site:** P0 — Astro + Starlight 脚手架 + 营销首页 ([19fce0d](https://github.com/freeanima-org/freeanima/commit/19fce0db204e34c976e2993827e7b23cb84535fd))
* **site:** P1 — 统一 Header/Footer + 设计 token + Tailwind ([4b51d8b](https://github.com/freeanima-org/freeanima/commit/4b51d8b569016d62aae148fcc72406bac66421ad))
* **site:** P2 + P3 — CI 部署 + docs 接入 Starlight ([673f41c](https://github.com/freeanima-org/freeanima/commit/673f41c8de253b14fbfbf0d8e82a8f4f46e0c6b4))

## [0.3.4](https://github.com/freeanima-org/freeanima/compare/v0.3.3...v0.3.4) (2026-06-08)

### Features

* **estate:** email 模块 — 账户注册表、收发信、WebUI 只读界面 ([bb2f02a](https://github.com/freeanima-org/freeanima/commit/bb2f02a53623849baeb24fa4adea2c4ef826d241))

### Refactoring

* **config:** 统一值展开引擎 — credential/env/明文三种语法 ([c526aa0](https://github.com/freeanima-org/freeanima/commit/c526aa021eefd0aae854cb25f0afec3829ad7dbb))

## [0.3.3](https://github.com/freeanima-org/freeanima/compare/v0.3.2...v0.3.3) (2026-06-08)

### Bug Fixes

* **release:** 使用 RELEASE_PAT 触发下游 Docker workflow ([b4362eb](https://github.com/freeanima-org/freeanima/commit/b4362eb1f14ae512f0794db765a036971cfb8eb9))

## [0.3.2](https://github.com/freeanima-org/freeanima/compare/v0.3.1...v0.3.2) (2026-06-08)

### Bug Fixes

* **release:** 用 bunx npm@11 发布并移除 setup-node ([#70](https://github.com/freeanima-org/freeanima/issues/70)) ([41f76ad](https://github.com/freeanima-org/freeanima/commit/41f76ad21299f417bf090a9e46b8f14a8c276dd9))

### Miscellaneous

* **deps:** bump docker/login-action from 3 to 4 ([#68](https://github.com/freeanima-org/freeanima/issues/68)) ([dcfdd39](https://github.com/freeanima-org/freeanima/commit/dcfdd39fcaa4cb2180f13857f25f00ed8e2b28ef))

## [0.3.1](https://github.com/freeanima-org/freeanima/compare/v0.3.0...v0.3.1) (2026-06-08)

### Bug Fixes

* **release:** 改用 publish-cli.sh 原生 OIDC 发布 CLI ([#69](https://github.com/freeanima-org/freeanima/issues/69)) ([bcdad6a](https://github.com/freeanima-org/freeanima/commit/bcdad6a526355ff85b05b9f4b94805965495d04a))

## [0.3.0](https://github.com/freeanima-org/freeanima/compare/v0.2.1...v0.3.0) (2026-06-08)

### ⚠ BREAKING CHANGES

* **credential:** 严格 YAML 凭证并新增 set 合并更新

### Features

* **ci:** 接入 GitHub Code Coverage 上传 ([612fd35](https://github.com/freeanima-org/freeanima/commit/612fd35dbe9877b5767e211a807d36fea931b654))
* **credential:** 严格 YAML 凭证并新增 set 合并更新 ([8c0a976](https://github.com/freeanima-org/freeanima/commit/8c0a9768c097485041e33d5680fe554ee8933dfb))
* **webui:** 仪表盘展示 PG/Redis 状态并迁移至 Bun 原生 Redis ([a0a0aec](https://github.com/freeanima-org/freeanima/commit/a0a0aecc2d4089eef4679ed0fe3b2390d3333b08))

### Bug Fixes

* **deps:** 修复 openai v6 升级后的 typecheck 与 lint ([67fce0e](https://github.com/freeanima-org/freeanima/commit/67fce0eb48213cd6f8631b20ce7df5d66b0f50dd))
* **release:** 修正 publishConfig.registry 尾斜杠以启用 OIDC ([73bc79d](https://github.com/freeanima-org/freeanima/commit/73bc79d6af9f3e101d575a2317912031c19e2345))
* **security:** 消除 CodeQL 告警的 shell 注入、ReDoS 与随机数偏差 ([ba0c931](https://github.com/freeanima-org/freeanima/commit/ba0c9318d8a9f24848b64d20b4ef5bb2bd1b2bb6))
* **test:** 修复 redis scan mock 的 glob 匹配以消除 CodeQL 告警 ([49c0a00](https://github.com/freeanima-org/freeanima/commit/49c0a00eda642b40448fc135c0081152c622d9cb))

### Miscellaneous

* **ci:** 覆盖率阈值置 0 并移除 bunfig.coverage.toml ([6351281](https://github.com/freeanima-org/freeanima/commit/635128102011fca0dfce7bd35e0d6e60fd3662f5))
* **deps:** bump actions/checkout from 4 to 6 ([04e000e](https://github.com/freeanima-org/freeanima/commit/04e000e7a7db1e81b586104efd59067b7299aa39))
* **deps:** bump actions/setup-node from 4 to 6 ([292e4dc](https://github.com/freeanima-org/freeanima/commit/292e4dc21fd12e0ecd02eac66ac42dcdde4c58ff))
* **deps:** bump docker/build-push-action from 6 to 7 ([302f98e](https://github.com/freeanima-org/freeanima/commit/302f98ef3d295fa50239fbc5c6296ccd43eceaa3))
* **deps:** bump docker/setup-buildx-action from 3 to 4 ([57ddd24](https://github.com/freeanima-org/freeanima/commit/57ddd24db500f374c0e02b956be797167fe2499b))
* **deps:** bump github/codeql-action from 3 to 4 ([12fa0e4](https://github.com/freeanima-org/freeanima/commit/12fa0e4f753d09e8bdb55c97461731b2b572352a))
* **deps:** bump the production-dependencies group with 2 updates ([4ab7c08](https://github.com/freeanima-org/freeanima/commit/4ab7c08ccde050a3adf7df51fce4cf9d56c99745))

### CI

* **release:** 支持 npm Trusted Publishing OIDC 发布 CLI ([94bb7f0](https://github.com/freeanima-org/freeanima/commit/94bb7f00e86aa43b65eac09b1c761103d3fcb7d4))
* **release:** 用 semantic-release/npm 发布 CLI 并精简 workflow ([5fd66cb](https://github.com/freeanima-org/freeanima/commit/5fd66cb20851e478c688c31df5b4c1b96ea62233))
* **release:** 移除 setup-node registry-url 修复 OIDC 鉴权冲突 ([0bea7f3](https://github.com/freeanima-org/freeanima/commit/0bea7f34189e8f8433b25616027ec55959501d8f))
* 重组 workflows 并启用 Dependabot 与安全扫描 ([bc96687](https://github.com/freeanima-org/freeanima/commit/bc96687caec5b25d6a9166bfc76553c144e18e72))

## [0.2.1](https://github.com/freeanima-org/freeanima/compare/v0.2.0...v0.2.1) (2026-06-08)

### Bug Fixes

* **release:** NPM_TOKEN 未配置时跳过 npm 发布 ([4a3c128](https://github.com/freeanima-org/freeanima/commit/4a3c12851a58ea64850320e8b504e132a7c79da3))

## [0.2.0](https://github.com/freeanima-org/freeanima/compare/v0.1.6...v0.2.0) (2026-06-08)

### ⚠ BREAKING CHANGES

* **memory:** 废除记忆层 L 编号，统一语义/情景术语
* **webui:** WebUI HTTP 路径改为 /api/_；终端 WS 为 /api/studio/terminal/ws；
  聊天流式为 POST /api/messages/stream（SSE）。移除 @trpc/_ 与 /api/trpc。
  SPA 仍由 Bun.serve routes 提供，index.html 改为启动时动态加载并在 close 时释放。

Co-authored-by: Cursor <cursoragent@cursor.com>

### Features

* **cron,tools,config:** Phase 0 Bun 原生接入收尾 ([d95d6dc](https://github.com/freeanima-org/freeanima/commit/d95d6dc623fb6688f9c500db50503bac5f796e22)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **db:** Bun.sql 驱动 PoC 与 JSONB 回归 ([0e6864a](https://github.com/freeanima-org/freeanima/commit/0e6864a5289aa7805cb09996bd8febe6975ee438)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **prompt:** 优化 system prompt 两层结构与段落顺序 ([d975e52](https://github.com/freeanima-org/freeanima/commit/d975e524ff7fa92b1536a720badcd3ab55913654)), closes [#6](https://github.com/freeanima-org/freeanima/issues/6)
* **release:** Docker Compose、Bun CLI 打包与 config 环境变量插值 ([00a61db](https://github.com/freeanima-org/freeanima/commit/00a61db67071ad9b8f74ed1157409a5d7e4b7e23)), closes [#3](https://github.com/freeanima-org/freeanima/issues/3)
* **tools:** read_file 与 glob 搜索改用 Bun 原生 API ([90c9dd7](https://github.com/freeanima-org/freeanima/commit/90c9dd77e0383174e5675ed4a92e163668993df7)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** dev 模式启用 Bun.serve console 回流 ([79166a1](https://github.com/freeanima-org/freeanima/commit/79166a1336b7232f88e9b319fe203b9549578128)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** 卧室会话列表分页与会话详情页 ([2a971ef](https://github.com/freeanima-org/freeanima/commit/2a971ef260eabd6709e2d7853124ce7854344a79))
* 冰箱贴（fridge-magnet）——跨轮对话临时状态共享黑板 ([4c9f321](https://github.com/freeanima-org/freeanima/commit/4c9f3218518fe1a2bd18e0fbcf7a2ab5edf73526))
* 冰箱贴重构 + 待办清单（tasks）系统 ([1c139c6](https://github.com/freeanima-org/freeanima/commit/1c139c682f0c08a6ca90ef15995fd559449685c6))

### Bug Fixes

* **ci:** 拆分 e2e/gitleaks job 并修复 WebView Chromium 崩溃 ([2cc570c](https://github.com/freeanima-org/freeanima/commit/2cc570c71dcb2d3b7be8bc0906f79af2d292bd14))
* **e2e:** 放宽 WebView smoke 测试超时并指定 CI Chromium 路径 ([559f7af](https://github.com/freeanima-org/freeanima/commit/559f7afd5793a3270e97f096fc85fe92b7caf31c))
* **webui:** 补全 service-config 依赖以修复 CI typecheck ([595b4a7](https://github.com/freeanima-org/freeanima/commit/595b4a71b3461ecb15f7dfb19c57286922c3e252))

### Performance

* **ci:** E2E 用 Playwright Chromium 缓存替代 apt 安装 ([f5723dc](https://github.com/freeanima-org/freeanima/commit/f5723dca16fee6126a01db05644c073faa2700a3))

### Refactoring

* **db-pg:** 移除未使用的 pg-profile 诊断层 ([21c815b](https://github.com/freeanima-org/freeanima/commit/21c815babac5d44918dc1c469348e711e1706537))
* **memory:** 废除记忆层 L 编号，统一语义/情景术语 ([390ab0d](https://github.com/freeanima-org/freeanima/commit/390ab0dc579a3eeaa5c99d78011646e00e9376f8))
* **self:** 彻底清除 SOUL.md 与自我层 seed ([09b22c4](https://github.com/freeanima-org/freeanima/commit/09b22c4e2461ff24c174b85699e6f883d8c1adb9))
* **webui:** 单 Bun.serve 统一 HTTP 与 WebSocket ([c2b5596](https://github.com/freeanima-org/freeanima/commit/c2b5596559c87f90af3a14d98694acf230e14854)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** 将 API 从 tRPC 迁移至 Elysia REST + Eden Treaty ([0512d9b](https://github.com/freeanima-org/freeanima/commit/0512d9bc64b0e10fad80c1b0e9f6f7039603d086))
* **webui:** 移除卧室记忆文件页面 ([f998c38](https://github.com/freeanima-org/freeanima/commit/f998c38b4eefc953c948319b9305f0c49ea1cd4d))

### Tests

* **e2e:** WebView 卧室 dashboard smoke ([e17b82f](https://github.com/freeanima-org/freeanima/commit/e17b82fd8b05777cc5f9b6fdec886b06ec330d8c)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)

## [0.1.6](https://github.com/freeanima-org/freeanima/compare/v0.1.5...v0.1.6) (2026-06-07)

### Features

* limbic_memory 建表 + fact_id→semantic_memory_id 术语统一 ([1bd2110](https://github.com/freeanima-org/freeanima/commit/1bd211066af9a53f5c3f026e04cc304730393bd7))
* self_blocks + autobiographical_memory — 自我层独立建表 ([b199157](https://github.com/freeanima-org/freeanima/commit/b19915750dce25f14757fca27e891f5c09120406))
* ToolSet 注册机制（能力面罩基础设施） ([2b7d057](https://github.com/freeanima-org/freeanima/commit/2b7d05748e6fd8b3eda8e7986b989a0403090942))
* 能力面罩（Mask）系统 ([1d036d5](https://github.com/freeanima-org/freeanima/commit/1d036d57a3b3b66507c01676c4f1f117bc407b27))

## [0.1.5](https://github.com/freeanima-org/freeanima/compare/v0.1.4...v0.1.5) (2026-06-07)

### Features

* **acp:** 支持 acp_cursor 异步执行与进度推送 ([99d75c3](https://github.com/freeanima-org/freeanima/commit/99d75c370a023bb8454c355c7d5db5db02cb4539))
* **cron:** migrate storage from file JSON to PostgreSQL + Bun.cron scheduling ([17288e6](https://github.com/freeanima-org/freeanima/commit/17288e60dd945c106643f0fe3915e8479750dde4))
* **memory:** L3 语义记忆从文件系统迁移到 PG ([291a80b](https://github.com/freeanima-org/freeanima/commit/291a80b0e7bee91c452ba260ca0f9210f77448fb))
* **memory:** PG FTS 替代 L2 蒸馏 + L4 SQLite 索引 ([40f7908](https://github.com/freeanima-org/freeanima/commit/40f7908801fe2891e50af62874a476ddcdf1a69c))
* **service:** 启动时自动运行数据库迁移 ([c396491](https://github.com/freeanima-org/freeanima/commit/c3964914b8d9e7a4872b97b104f9e2625d377d40))
* 实现深睡机制 (deep sleep) ([0a82262](https://github.com/freeanima-org/freeanima/commit/0a8226266ed3a339b08ba8d0daebb41d69897642))
* 浅睡替代反思，作为语义记忆唯一增量提取通道 ([7cbd3de](https://github.com/freeanima-org/freeanima/commit/7cbd3ded361e57942511918d5139a84774a6a8b4))

### Bug Fixes

* **acp:** Cursor ACP 新建 session 默认使用 Auto 模型 ([1e4ec78](https://github.com/freeanima-org/freeanima/commit/1e4ec78074b1fb02713567689ab4e92f1f986bb4))
* **cron:** listJobs/getJob gracefully return empty when module not initialized ([e4a60e5](https://github.com/freeanima-org/freeanima/commit/e4a60e50346997cffe72bf1da0fd47795ef88703))
* **cron:** persistJob/runJobById/getJobSync handle uninit gracefully ([bf836ef](https://github.com/freeanima-org/freeanima/commit/bf836ef4d86d64ed2d4602e4afaf7231bc8ba397))
* **engine:** 修复空 assistant 消息导致 DeepSeek 400 错误 ([dace94d](https://github.com/freeanima-org/freeanima/commit/dace94d18f1d32e72f5c7d84f7d17568c8dd0f9d))
* **gateway:** Discord 单条消息超长时自动拆分 ([9a7317f](https://github.com/freeanima-org/freeanima/commit/9a7317fde5c447dce352b8fc7e2af92d610f12f2))
* **life-memory:** add missing engine-loop devDependency ([62e5080](https://github.com/freeanima-org/freeanima/commit/62e50804708f76624ff8d5ab24cca875398ced1c))
* **logging:** error.log 序列化时保留 err.cause 链 ([02a4ae4](https://github.com/freeanima-org/freeanima/commit/02a4ae4e5083a9781c29fadaae7c9ba6e706c189))

### Performance

* **conversation:** 已压缩会话 beginTurn 按 pos 窗口加载 ([b3e61cd](https://github.com/freeanima-org/freeanima/commit/b3e61cdd1f81489f74bd2e7b026f7e53a5d0c05d))
* **service:** 次级路径避免全量消息加载 ([c2049eb](https://github.com/freeanima-org/freeanima/commit/c2049eb94d078513a23f1bd9a68169c5cb642716))

## [0.1.4](https://github.com/freeanima-org/freeanima/compare/v0.1.3...v0.1.4) (2026-06-06)

### Features

* **acp:** 增强 ACP Cursor 长生命周期与多模式支持 ([b6000d5](https://github.com/freeanima-org/freeanima/commit/b6000d5f80ad0d046df00a6c8faef2119fad5575))

## [0.1.3](https://github.com/freeanima-org/freeanima/compare/v0.1.2...v0.1.3) (2026-06-06)

### Bug Fixes

* **ci:** 补全 workspace 直接依赖以修复 typecheck ([5a09702](https://github.com/freeanima-org/freeanima/commit/5a09702a4012ae6d77475e4af400e5b730dadb75))

## [0.1.2](https://github.com/freeanima-org/freeanima/compare/v0.1.1...v0.1.2) (2026-06-05)

### Features

* **discord:** 优化discord遇到网络抖动也会重试，直到最终编辑 ([5463a48](https://github.com/freeanima-org/freeanima/commit/5463a48989693b97aa92c72c21d9fe2cb8231351))
* **engine:** 拆分 engine-tool 与 Engine 聚合包（RFC Step 3） ([cc764f6](https://github.com/freeanima-org/freeanima/commit/cc764f6cb2241e5c1bd10b58d3bd6dd265a9ee92))
* **event-bus:** 新增 EventBus 框架与 Sqlite 适配器并接入 legacy 栈 ([f243347](https://github.com/freeanima-org/freeanima/commit/f24334725d44f4977f10e17198cdb41d60cf9adf))
* **kernel:** Kernel 与 HookRegistry 接入 Logger，统一服务端日志 ([8b737fd](https://github.com/freeanima-org/freeanima/commit/8b737fd9b67f9ed0a1a475ce0f2ce1e7bd7fbca6))
* **kernel:** 新增 hooks 包与 Kernel，legacy 栈迁移至 token Hook API ([17a5bac](https://github.com/freeanima-org/freeanima/commit/17a5bacd4d4dffb5c74c1b801bc10f7f4f264870))
* **life:** 新增 life-self 与 life-estate 空壳包 ([927fe59](https://github.com/freeanima-org/freeanima/commit/927fe59dd4c1fda4d451b451fe613d271496b0e2))
* **llm:** 切换到新的llm provider ([16fcd59](https://github.com/freeanima-org/freeanima/commit/16fcd598d7e1ec08da0c60e94d9a2658c74d23f0))
* **llm:** 增加llm接口层和openai的实现 ([205724c](https://github.com/freeanima-org/freeanima/commit/205724c1c03b60be2339b8d9f57b9692ef6c38f1))
* **logging:** 新增 @freeanima/logging 内核日志契约与内置 sink ([3e95c98](https://github.com/freeanima-org/freeanima/commit/3e95c98c7c8534f7bec437a7396d88b93327df5c))
* **logging:** 新增 file sink 并抽取共用格式化逻辑 ([106eaaa](https://github.com/freeanima-org/freeanima/commit/106eaaa53b53669f2ba4480403e2d996ceedb9b5))
* **service:** K1 新建 @freeanima/platform 注册 hub ([a35d965](https://github.com/freeanima-org/freeanima/commit/a35d96587b52831bad3f3cf22e50068dac80b094))
* **webui:** Bun fullstack + tRPC 全链路，移除 Vite/TanStack Start ([dda1b2e](https://github.com/freeanima-org/freeanima/commit/dda1b2e549d350f1681de04499cbc13cbf01a150))
* 阶梯重试与日志治理，合并 Agent 文档 ([6f4719d](https://github.com/freeanima-org/freeanima/commit/6f4719d2b4c571789aa754c51e6b3f72196d9241))

### Bug Fixes

* **ci:** 修复 release workflow 因缺少 config 导致测试超时 ([1dbd8e6](https://github.com/freeanima-org/freeanima/commit/1dbd8e64855f6edd2353c71005d3c3fc78b1f621)), closes [freeanima-org/freeanima#18](https://github.com/freeanima-org/freeanima/issues/18)
* **discord:** 修复消息卡在思考中与 👀 反应不更新 ([b2a7af7](https://github.com/freeanima-org/freeanima/commit/b2a7af7d32bf44e1c7678a6dd7012b93d3ea15ab)), closes [#7](https://github.com/freeanima-org/freeanima/issues/7)
* **gateway:** 修复 Discord 单回合内 tool 与答案消息顺序混乱 ([2af0861](https://github.com/freeanima-org/freeanima/commit/2af0861fb49d156ed69f6f3444e2f0efccbf72f0)), closes [#17](https://github.com/freeanima-org/freeanima/issues/17)
* **gateway:** 修复微信出站并重构工具消息分片展示 ([a4c9bf2](https://github.com/freeanima-org/freeanima/commit/a4c9bf2d9173ce38ab8159f1e946571d82ed5797))
* **test:** 修复 CI 无 config.yaml 时测试失败 ([10f9de2](https://github.com/freeanima-org/freeanima/commit/10f9de2e61182b1e69d029024cbde47d71d5f2bf))
* **test:** 隔离单测 error.log 并增强 Gateway 诊断 ([e292e36](https://github.com/freeanima-org/freeanima/commit/e292e366abaa319f3ea6d176fa053dc8511a0bd1))
* **webui:** systemd 启动时 chdir 到仓库根以加载 Tailwind 插件 ([81b736a](https://github.com/freeanima-org/freeanima/commit/81b736a0bd560d56fad73c312f6259dfe8ff13ed))

## [0.1.1](https://github.com/freeanima-org/freeanima/compare/v0.1.0...v0.1.1) (2026-06-01)

### Features

* 增加discord的自动重连机制 ([a5c5dd5](https://github.com/freeanima-org/freeanima/commit/a5c5dd59150c696d169d0e87fee47f9acb5a9895))

## 0.1.0 (2026-06-01)

### Features

* **Agent 运行时**：`anima service`（systemd）、Hono HTTP / SSE、WebUI（会客厅 / 卧室 / 创作室）
* **Gateway**：Discord、微信 iLink；按 platform / thread / peer 路由会话
* **记忆 L1–L4**：PostgreSQL Session、L2 蒸馏、L3 事实库（`recall` / `remember`）、L4 检索
* **工具**：本地 / MCP / ACP 注册；`execute_code`、浏览器、Cron、推送等
* **凭证**：pass GPG；CLI `credential list|get|add`（YAML 多字段）；LLM 仅见路径元数据
* **工程**：pnpm + turbo monorepo；Vitest；GitHub Actions + semantic-release 发版

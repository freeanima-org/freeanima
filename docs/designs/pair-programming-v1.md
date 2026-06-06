# 结对编程 v1 — 工作台设计

> **Phase 1 ✅ 已实现**（2026-05-29）：三列 UI、highlight.js 查看、studio tree/file/search、xterm 终端、`studio-pair-programming` platform。
> API 形态为 **tRPC**（`connectors/webui/src/trpc/routers/studio.ts`），非下文 REST 示例。

## 设计原则

- **快速实现，不求功能完整**：用最小的可行范围跑通"在 Studio 里和 Agent 一起看代码"的闭环
- **轻量化起步**：文件树 + 文件查看 + 全局搜索 + 对话 + 终端，暂不嵌入 Monaco Editor
- **代码高亮用 highlight.js**（而非 Monaco Editor），降低首次实现成本
- **只读起步**：v1 以读代码为主，Agent 分析、提建议，暂不提供直接编辑/保存
- **平台身份分离**：结对编程会话用独立 platform 标识，与会客厅的聊天会话隔离
- **本地直读**：文件由服务端直接读取（非 Probe），workspace 路径在卧室配置
- **终端放在 Phase 1**（从原 Phase 2 提到 Phase 1），因为它对调试和运维很重要

## 整体布局

```
┌──────────────────────────────────────────────────────────┐
│  创作室 Studio              [结对编程] [小说] [短视频]   │  ← StudioLayout 侧边栏
├──────────┬────────────────────────┬──────────────────────┤
│ 🔍 搜索  │                       │  💬 会话列表          │
│ 文件     │                       │  ┌──────────────────┐ │
│ ─────── │     代码查看器         │  │ session-001      │ │
│ src/     │    (highlight.js)      │  │ session-002      │ │
│   main.ts│                       │  │ session-003      │ │
│   utils/ │   显示当前选中文件     │  ├──────────────────┤ │
│   ...    │   语法高亮、行号       │  │                  │ │
│          │                       │  │  对话区           │ │
│ index.html│                      │  │  Agent：这段代码     │ │
│ package.json│                    │  │  有个潜在问题…   │ │
│          │                       │  │                  │ │
│          │                       │  │  ┌──输入框──┐   │ │
│          │                       │  │  │          │   │ │
└──────────┴────────────────────────┴──────────────────────┘
   左列             中列                   右列
  文件树        highlight.js 代码查看    会话列表 + 对话
```

### 三列宽度

| 列           | 默认  | 可调               |
| ------------ | ----- | ------------------ |
| 左（文件树） | 260px | 拖拽调整 180–400px |
| 中（编辑器） | 1fr   | —                  |
| 右（会话）   | 360px | 拖拽调整 280–500px |

## 一、Platform 感知的会话

### 改动：前端 API client

```ts
// api/client.ts
export function createSession(platform = "parlor") {
  return postJSON("/sessions", { platform });
}

export function listSessions(platform?: string) {
  const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return getJSON(`/sessions${q}`).then((d) => d.sessions || []);
}
```

### 改动：后端 HTTP 层

```ts
// http-app.ts

// 创建会话 — 从 body 读取 platform
api.post("/sessions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform ?? PARLOR_PLATFORM;
  return c.json(service.createSession(platform));
});

// 列出会话 — 可选 platform 过滤
api.get("/sessions", (c) => {
  const platform = c.req.query("platform") ?? undefined;
  return c.json(service.listSessions(platform));
});
```

> 注意：`conversation.ts` 中的 `newSession(platform)` 和 `listSessions(platform?)` 已支持 platform，只需 HTTP 层透传。

### 结对编程的 platform 取值

```
platform = "studio-pair-programming"
```

- 在 PairProgrammingView 中创建的会话自动带上此 platform
- 会话列表按此过滤，只显示结对编程相关的会话
- 与会客厅 (`parlor`) 和其他平台的会话互不干扰

## 二、代码查看器

v1 不嵌入 Monaco Editor，使用 **highlight.js** 提供语法高亮，降低首次实现成本。

### 依赖

```json
{
  "dependencies": {
    "highlight.js": "^11.9.0"
  }
}
```

### 组件结构

```
PairProgrammingView.vue
├── FileTreePanel.vue          ← 左列
├── CodeViewerPanel.vue       ← 中列 (highlight.js)
├── SessionPanel.vue           ← 右列
│   ├── SessionList.vue        ← 会话列表（按 platform 过滤）
│   └── ChatPanel.vue          ← 对话（与会客厅共用 SSE 通道）
```

### CodeViewerPanel 职责

- 接收 `{ filePath, content, language }` props
- 使用 highlight.js 渲染语法高亮
- 显示行号
- 支持基础代码折叠（可选，v1 可不做）
- 点击行号可选中/复制（后续可用于"Agent，看这行"）

### 未来升级路径

当需要编辑功能时，可升级为 Monaco Editor（只读→可编辑），highlight.js 替换为 Monaco 的 Editor，文件树和对话区不做改动。

## 三、文件树

### 数据来源

```
GET /api/studio/tree?path=<workspace>
```

返回结构：

```json
{
  "tree": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        { "name": "main.ts", "type": "file", "size": 1234 },
        { "name": "utils", "type": "directory", "children": [...] }
      ]
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 567
    }
  ]
}
```

### 文件树组件

- 递归渲染目录树，可展开/折叠
- 点击文件 → 加载内容到 Monaco
- 根目录由卧室配置中的 `workspace` 指定（v1 可先硬编码或从配置读取）

### 文件名搜索

```
搜索框（左列顶部）
├── 输入关键词 → 实时过滤文件树节点
├── 匹配的文件和目录高亮/保留
├── 支持模糊匹配（fuse.js 或简单 includes）
└── 选中搜索结果 → 自动滚动并展开路径
```

### 配置 workspace

在卧室新增配置项：

| key                | 类型    | 默认   | 说明                         |
| ------------------ | ------- | ------ | ---------------------------- |
| `studio.workspace` | string  | `""`   | 结对编程工作目录路径         |
| `studio.gitignore` | boolean | `true` | 是否按 .gitignore 过滤文件树 |

首次进入时若未配置 workspace，显示引导提示，跳转到卧室配置页。

## 四、全局搜索

### API

```
POST /api/studio/search
Body: { query: string, path: string }
Response: {
  results: [
    {
      file: "src/main.ts",
      line: 42,
      column: 8,
      content: "  const x = foo()",
      match: "foo"
    }
  ]
}
```

### 实现方式

- 后端递归扫描 workspace 目录
- 读取 `.gitignore` 文件，应用 gitignore 规则过滤
- 支持 `.gitignore` 嵌套（子目录中的 `.gitignore` 叠加生效）
- 使用 ripgrep（如果有）或 Node.js 原生逐行搜索
- 搜索范围：所有纯文本文件（可配置 include 扩展名）

### 前端交互

- 左列底部或中列顶部增加全局搜索入口
- 搜索结果展示：文件名 + 行号 + 匹配行片段
- 点击结果 → 跳转到 Monaco 的对应文件 + 行号

## 五、后端新增 API

| 方法   | 路径                 | 说明                             |
| ------ | -------------------- | -------------------------------- |
| `GET`  | `/api/studio/tree`   | 获取 workspace 文件树            |
| `GET`  | `/api/studio/file`   | 读取文件内容（query: `path`）    |
| `POST` | `/api/studio/search` | 全局文本搜索                     |
| `GET`  | `/api/studio/config` | 获取 studio 配置（含 workspace） |
| `PUT`  | `/api/studio/config` | 更新 studio 配置                 |

### 文件读取

```
GET /api/studio/file?path=src/main.ts
Response:
{
  "path": "src/main.ts",
  "content": "import { ... }",
  "language": "typescript",
  "size": 1234
}
```

安全限制：

- 路径必须位于 workspace 目录下
- 拒绝隐藏文件（以 `.` 开头）除非在 `showHidden` 配置中允许
- 文件大小上限：1MB（超过返回提示信息）

## 六、前端的 store 与状态管理

### 新增 store

```ts
// stores/studio/pair-programming.js
export const usePairProgrammingStore = defineStore('pair-programming', () => {
  const sessions = ref([])
  const currentSessionId = ref(null)
  const fileTree = ref([])
  const currentFile = ref(null)      // { path, content, language }
  const searchResults = ref([])
  const workspace = ref('')

  async function fetchSessions() { /* 按 platform 过滤 */ }
  async function createSession() { /* platform = studio-pair-programming */ }
  async function fetchTree() { /* GET /api/studio/tree */ }
  async function openFile(path) { /* GET /api/studio/file */ }
  async function globalSearch(query) { /* POST /api/studio/search */ }

  return { ... }
})
```

## 七、路由与导航

```
GET /studio/pair-programming → PairProgrammingView.vue
```

当前路由已就位：

```ts
{
  path: '/studio/pair-programming',
  name: 'studio-pair-programming',
  component: () => import('../views/studio/PairProgrammingView.vue'),
}
```

StudioLayout 侧边栏保持现有风格，结对编程作为第一个入口。

## 八、实施计划

### Phase 1

| 步骤 | 内容                                              | 预估 |
| ---- | ------------------------------------------------- | ---- |
| 1.1  | API: POST/GET sessions 支持 platform              | 2h   |
| 1.2  | API: studio/tree, studio/file, studio/search 端点 | 4h   |
| 1.3  | 前端: 三列布局框架 + FileTreePanel                | 3h   |
| 1.4  | 前端: CodeViewerPanel (highlight.js 代码查看)     | 1.5h |
| 1.5  | 前端: SessionPanel (会话列表 + 聊天)              | 3h   |
| 1.6  | 前端: 文件名搜索 + 跳转                           | 2h   |
| 1.7  | 前端: 全局搜索 UI + 结果跳转                      | 2h   |
| 1.8  | 终端面板 (xterm.js)                               | 2h   |

### Phase 2（后续版本）

- 从 highlight.js 升级为 Monaco Editor（可编辑）
- 文件编辑 + diff 预览 + 应用/拒绝
- Git 面板 (diff/stage/commit)
- 多 workspace 支持
- 更多协作功能

---

> 设计文档 · 2026-05-28  
> 状态：**Phase 1 ✅ 已实现**（2026-05-29）；**Phase 2 🚧 规划中**

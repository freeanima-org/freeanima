# execute_code 多运行时设计

> 一个工具、多种运行时；默认 Node.js，按需扩展 Python / Deno。

## 背景

`execute_code` 原先硬编码 Node.js，但 tool schema 对 LLM 只暴露 `"Run code"`，导致模型频繁写入 Python 而执行失败。

改造目标：

1. **语义清晰** — LLM 明确知道该写什么语言、该选哪个 runtime
2. **默认 Node.js** — 与逸灵风同栈，TS/JS 片段首选
3. **可扩展** — 预留 Python、Deno，按配置逐步启用
4. **与 terminal 分工** — 结构化子进程 vs shell

## 与 terminal 的分工

|          | `execute_code`             | `terminal`                    |
| -------- | -------------------------- | ----------------------------- |
| 执行方式 | 无 shell，固定运行时       | shell=true                    |
| 适合     | 短脚本、数据处理、逻辑验证 | 系统命令、管道、git、长期任务 |
| 输出     | 50KB 上限，超时可控        | 同样有限制但更自由            |
| 安全     | 攻击面小（无 shell 注入）  | 攻击面较大                    |

Python 批处理应走 `execute_code(runtime="python")`，而非 `python3 -c "..."` 塞进 terminal。

## API

```typescript
execute_code({
  code: string,           // 源码
  runtime?: "nodejs" | "python" | "deno",  // 默认 nodejs
  timeout?: number,       // 秒，默认 300，上限 600
})
```

### LLM 可见描述（原则）

- 顶层 `description` 即 LLM 唯一真相源（扁平 JSON Schema，无嵌套包装）
- 明确默认 runtime、各 runtime 语言、未启用时的替代方案

## 运行时注册表

```typescript
interface CodeRuntime {
  id: "nodejs" | "python" | "deno";
  enabled: boolean;
  extension: string; // .mts / .py / .ts
  preamble?: string; // 写入文件前的 bootstrap
  command: string[]; // spawn 命令与参数（末项为文件路径占位）
}
```

| runtime    | 命令                              | 文件   | preamble                | 状态      |
| ---------- | --------------------------------- | ------ | ----------------------- | --------- |
| **nodejs** | `node --experimental-strip-types` | `.mts` | `node:fs` 等常用 import | ✅ 已实现 |
| **python** | `python3`                         | `.py`  | 可选 `os`/`pathlib`     | 🔲 预留   |
| **deno**   | `deno run --allow-read=...`       | `.ts`  | Deno 标准库             | 🔲 预留   |

### 阶段计划

| 阶段           | 内容                                          |
| -------------- | --------------------------------------------- |
| **P0**（当前） | 扁平 schema + `runtime` 参数 + 仅 nodejs 启用 |
| **P1**         | 实现 python runtime                           |
| **P2**         | `config.yaml` 运行时开关                      |
| **P3**         | deno + 权限策略                               |
| **P4**         | 跨 runtime 的 `credential()` 注入             |

## 配置（P2 预留）

```yaml
execute_code:
  default_runtime: nodejs
  runtimes:
    nodejs:
      enabled: true
    python:
      enabled: true
      command: python3
    deno:
      enabled: false
      command: deno
```

未启用的 runtime 返回：

```json
{ "error": "runtime 'python' 尚未启用；当前可用: nodejs" }
```

## 执行流程

```
LLM 调用 execute_code(code, runtime?)
        │
        ▼
  解析 runtime（默认 nodejs）
        │
        ▼
  查注册表 → enabled?
        │ no ──→ {"error": "..."}
        ▼ yes
  mkdtemp → 写 preamble + code → spawn
        │
        ▼
  stdout/stderr 合并；非零 exit → JSON { output, exit_code }
        │
        ▼
  清理临时文件
```

## 安全

- 始终 `shell: false`（与 `docs/security.md` 一致）
- 超时与 `maxBuffer` 与现实现保持一致
- Deno 启用前必须定义 `--allow-*` 白名单策略
- **不**根据代码内容自动猜测 runtime（避免误判）

## credential 注入（P4）

ARCHITECTURE 约定 `credential(path)` 在 `execute_code` 执行环境中可用，当前未实现。

多 runtime 统一方案建议：

1. 父进程在 spawn 前解析代码中的 `credential("...")` 调用（或显式参数）
2. 通过环境变量注入：`ANIMA_CRED_<PATH>`（路径转义）
3. 各 runtime preamble 提供同名 helper 读 env

不在各 runtime 内直接调 pass CLI。

## Tool Schema 扁平化

逸灵风本地工具统一为 OpenAI 标准形态：

```typescript
registerTool({
  name: "execute_code",
  description: "……LLM 看到的完整说明……",
  parameters: {
    type: "object",
    properties: { … },
    required: […],
  },
  handler: …,
});
```

禁止 `{ name, description, parameters: { … } }` 嵌套包装；`openaiFunctionSchema` 直接映射顶层字段。

## 文件布局

```
packages/tools/src/
  execute-code.ts          # 工具注册 + 路由
  execute-code-runtimes.ts # 运行时注册表与 spawn 逻辑（P1 起扩展）
```

## 测试

- `runtime` 默认 nodejs 执行 TS/JS
- 未启用 runtime 返回 error JSON
- `openaiSchemas()` 中 `execute_code.description` 含 Node.js 说明
- 嵌套 parameters 格式回归：不应再出现

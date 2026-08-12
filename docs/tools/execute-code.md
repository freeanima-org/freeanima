---
title: "execute_code 运行时"
---

# execute_code 多运行时

> 一个工具、多种运行时；默认 Bun；按需扩展 Python / Deno。

## 背景

`execute_code` 在受控子进程中运行短脚本。LLM 必须知道写什么语言、选哪个运行时——否则把 Python 发给 Node 会失败。

## 与 terminal 的分工

|          | `execute_code`                  | `terminal`                                             |
| -------- | ------------------------------- | ------------------------------------------------------ |
| 执行方式 | 无 shell，固定运行时            | 默认 `shell=false`（argv）；管道/重定向用 `shell=true` |
| 最适合   | 短脚本、数据处理、逻辑检查      | 系统命令、git、长任务；管道需 `shell=true`             |
| 输出     | 50KB 上限，可配置超时           | 相同限制                                               |
| 安全     | 无 shell 注入；**不是** FS 沙箱 | 灾难性命令硬拒绝 + 工作目录路径策略；仍 ≠ OS 沙箱      |

Python 批处理请用 `execute_code(runtime="python")`，不要在 terminal 里 `python3 -c "..."`。

## API

```typescript
execute_code({
  code: string,
  runtime?: "bun" | "nodejs" | "python" | "deno",  // default bun
  timeout?: number,       // seconds, default 300, max 600
})
```

## 可用运行时

| runtime    | 语言                    | 状态                 |
| ---------- | ----------------------- | -------------------- |
| **bun**    | TypeScript / JavaScript | ✅ 默认              |
| **nodejs** | TypeScript / JavaScript | ✅ 已实现            |
| **python** | Python                  | 🔲 预留（Issue #40） |
| **deno**   | TypeScript              | 🔲 预留（Issue #40） |

## 配置（预留）

```yaml
execute_code:
  default_runtime: bun
  runtimes:
    nodejs:
      enabled: true
    python:
      enabled: true
      command: python3
    deno:
      enabled: false
```

禁用的运行时会返回明确错误，并列出可用运行时。

## 安全

- 始终 `shell: false`（见 [`security.md`](../ops/security.md)）
- 超时与输出大小限制：工具内容中预览约 50KB 上限；过大的 stdout/stderr 溢出到 `~/.anima/tool-artifacts/` 并带 `artifact_path` — 用 `file_read` 续读，**不要**为取更多输出而重跑片段
- **不要**根据代码内容自动猜测运行时
- JS 运行时仍可 `import node:fs`—terminal 命令硬拒绝**不**作用于 `code_execute` 内部

## 凭证注入

`code_execute`（与 `terminal_run`）接受可选 `secrets[]`：仅为**该子进程**解密的 Vault 条目引用，合并进子进程 `env`（不进栖息地 `process.env`）。值永不出现在 LLM 工具结果中。片段内优先用 argv / `process.env.NAME`；运行时内不要用 vault CLI。

类 Issue #40 的文件路径凭证挂载**未实现**；CLI/运行时需求请用 `secrets[]`。

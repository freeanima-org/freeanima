import type { RemoteToolDefInput } from "@freeanima/shared/rpc-contract/frames/tool.ts";

/** Coding Outpost 静态工具表（GUI 窗与 anima-probe 共用；不含动态 mcp_*） */
export const CODING_BASE_TOOLS: RemoteToolDefInput[] = [
  {
    local_name: "file_list",
    description: "列出工作区目录树（只读；相对 workspace_root）",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", default: ".", description: "相对 workspace_root 的目录" },
        max_depth: { type: "integer", default: 3 },
        limit: { type: "integer", default: 500 },
      },
    },
    return_kind: "json",
  },
  {
    local_name: "file_read",
    description: "读取工作区内文本文件（带行号）",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "integer", default: 1 },
        limit: { type: "integer", default: 500 },
      },
      required: ["path"],
    },
    return_kind: "text",
  },
  {
    local_name: "file_search",
    description: "在工作区内搜索文件内容（简单 includes；后续可换索引）",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", default: "." },
        limit: { type: "integer", default: 50 },
        output_mode: {
          type: "string",
          enum: ["content", "files_only", "count"],
          default: "content",
        },
      },
      required: ["pattern"],
    },
    return_kind: "text",
  },
  {
    local_name: "file_patch",
    description: "用 old_string/new_string 最小替换编辑工作区文件",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean", default: false },
      },
      required: ["path", "old_string", "new_string"],
    },
    return_kind: "json",
  },
  {
    local_name: "terminal_run",
    description:
      "在工作区内执行一次性命令。默认 shell=false（quote-aware argv）；管道/重定向等再 shell=true。",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeout: { type: "integer", default: 180 },
        workdir: { type: "string", default: "." },
        shell: { type: "boolean", default: false },
      },
      required: ["command"],
    },
    return_kind: "text",
  },
  {
    local_name: "project_context",
    description:
      "发现并返回工作区项目 Agent 上下文（.agents / AGENTS.md / CLAUDE.md / .cursor / .opencode 等；不含 .anima skills）",
    parameters: { type: "object", properties: {} },
    return_kind: "json",
  },
  {
    local_name: "agents_md_read",
    description: "读取工作区根 AGENTS.md（不存在则 missing=true）",
    parameters: { type: "object", properties: {} },
    return_kind: "json",
  },
  {
    local_name: "agents_md_write",
    description: "写入工作区根 AGENTS.md（社区通用项目叙事；可创建）",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "完整 Markdown 内容" },
      },
      required: ["content"],
    },
    return_kind: "json",
  },
  {
    local_name: "project_mcp_status",
    description: "列出 Outpost 管理的项目 MCP 连接状态（不经 Habitat 全局 mcp_servers）",
    parameters: { type: "object", properties: {} },
    return_kind: "json",
  },
];

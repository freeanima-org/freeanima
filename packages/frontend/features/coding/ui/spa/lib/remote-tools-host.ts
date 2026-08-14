/**
 * Coding WebView-host：createRemoteToolsHabitatAttach + attach。
 * 产品面（Chat 等）禁止 attach；Coding 前哨窗本身即 Outpost。
 */

import {
  createRemoteToolsHabitatAttach,
  type RemoteToolsAttachHandle,
} from "@freeanima/shared/rpc-contract/remote-tools-attach.ts";
import { browserRemoteInstanceStore } from "@freeanima/shared/rpc-contract/instance-store-browser.ts";
import type { RemoteInstanceStore } from "@freeanima/shared/rpc-contract/instance-store.ts";
import type { RemoteToolDefInput } from "@freeanima/shared/rpc-contract/frames/tool.ts";
import { CODING_APP_ID } from "@freeanima/features/coding/shared/constants.ts";
import type { ProjectMcpServer } from "@freeanima/shared/coding/project-agent-context";
import { executeCodingTool } from "./tools-executor.ts";
import { getProjectMcpManager } from "./project-mcp-manager.ts";

const APP_ID = CODING_APP_ID;

const BASE_TOOLS: RemoteToolDefInput[] = [
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
      '在工作区内执行一次性命令。默认 shell=false（quote-aware argv，带空格参数请用引号，如 git commit -m "中文 带空格"）；管道/重定向等再 shell=true。需 portalShell.runCommand（Rust IPC）。',
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

export type CodingRemoteToolsStatus = {
  instance_id: string;
  remote_tools_connected: boolean;
};

export type RemoteToolsHostHandle = {
  stop: () => void;
  getStatus: () => CodingRemoteToolsStatus;
  /** 按发现结果启停项目 MCP，并重新 tool.register（桥转发） */
  refreshProjectMcp: (servers: ProjectMcpServer[]) => Promise<void>;
};

let activeHandle: RemoteToolsHostHandle | null = null;

export function getCodingRemoteToolsHost(): RemoteToolsHostHandle | null {
  return activeHandle;
}

function resolveInstanceStore(habitatUrl: string): RemoteInstanceStore {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  if (shell?.createFileInstanceStore) {
    return shell.createFileInstanceStore(APP_ID);
  }
  return browserRemoteInstanceStore(habitatUrl.replace(/\/$/, ""), APP_ID);
}

function resolveAuthToken(): string | undefined {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  return shell?.remoteAuth?.token?.trim() || undefined;
}

function resolveHabitatUrl(fallback?: string): string {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  const fromShell = shell?.habitatUrl?.trim();
  if (fromShell) return fromShell.replace(/\/$/, "");
  return (fallback ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}

/**
 * 启动 Coding 窗内 remote tools attach。无 token 时返回 null（不抛错）。
 */
export function startCodingRemoteToolsHost(opts?: {
  habitatUrl?: string;
  httpUrl?: string;
  onStatus?: (status: CodingRemoteToolsStatus) => void;
}): RemoteToolsHostHandle | null {
  const remoteAuthToken = resolveAuthToken();
  if (!remoteAuthToken) {
    const empty = { instance_id: "", remote_tools_connected: false };
    opts?.onStatus?.(empty);
    return null;
  }

  const habitatUrl = resolveHabitatUrl(opts?.habitatUrl);
  const httpUrl = opts?.httpUrl ?? window.portalShell?.apiOrigin ?? undefined;
  let attach: RemoteToolsAttachHandle | null = null;
  const mcp = getProjectMcpManager();

  const publish = (): void => {
    const status: CodingRemoteToolsStatus = {
      instance_id: attach?.getInstanceId() ?? "",
      remote_tools_connected: attach?.isConnected() ?? false,
    };
    opts?.onStatus?.(status);
  };

  async function reregisterAllTools(): Promise<void> {
    if (!attach?.isConnected()) return;
    const client = await attach.getRpcStreamClient();
    const tools = [...BASE_TOOLS, ...mcp.toRemoteToolDefs()];
    await client.request("tool.register", {
      tools,
      visibility: "catalog",
    });
  }

  attach = createRemoteToolsHabitatAttach({
    appId: APP_ID,
    habitatUrl,
    ...(httpUrl ? { httpUrl } : {}),
    remoteAuthToken,
    instanceStore: resolveInstanceStore(habitatUrl),
    tools: BASE_TOOLS,
    toolsetVisibility: "catalog",
    onToolCall: async (localName, args) => {
      if (localName === "project_mcp_status") {
        return JSON.stringify({ ok: true, servers: mcp.listStatuses() });
      }
      if (localName.startsWith("mcp_")) {
        return mcp.callTool(localName, args);
      }
      return executeCodingTool(localName, args);
    },
    onConnected: async (_client, instanceId) => {
      console.log("coding remote tools connected", instanceId);
      try {
        await reregisterAllTools();
      } catch (e) {
        console.warn("coding tool re-register failed", e);
      }
      publish();
    },
  });

  publish();

  const handle: RemoteToolsHostHandle = {
    stop: () => {
      void mcp.stopAll();
      attach?.stop();
      attach = null;
      if (activeHandle === handle) activeHandle = null;
      const empty = { instance_id: "", remote_tools_connected: false };
      opts?.onStatus?.(empty);
    },
    getStatus: () => ({
      instance_id: attach?.getInstanceId() ?? "",
      remote_tools_connected: attach?.isConnected() ?? false,
    }),
    refreshProjectMcp: async (servers) => {
      await mcp.reconcile(servers);
      await reregisterAllTools();
    },
  };
  activeHandle = handle;
  return handle;
}

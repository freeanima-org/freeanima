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
import { CODING_APP_ID } from "@freeanima/features/coding/shared/constants.ts";
import { CODING_BASE_TOOLS } from "@freeanima/shared/coding/outpost";
import type { ProjectMcpServer } from "@freeanima/shared/coding/project-agent-context";
import { executeCodingTool } from "./tools-executor.ts";
import { getProjectMcpManager } from "./project-mcp-manager.ts";

const APP_ID = CODING_APP_ID;

const BASE_TOOLS = CODING_BASE_TOOLS;

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

/**
 * Companion WebView-host：在第一方 overlay 内 createRemoteToolsHabitatAttach + attach。
 * 产品面（Chat 等）禁止 attach。
 */

import {
  createRemoteToolsHabitatAttach,
  type RemoteToolsAttachHandle,
} from "@freeanima/shared/rpc-contract/remote-tools-attach.ts";
import {
  browserRemoteInstanceStore,
  type RemoteInstanceStore,
} from "@freeanima/shared/rpc-contract/instance-store.ts";
import { executeCompanionTool } from "./tools-executor.ts";

const APP_ID = "companion";

const REGISTERED_TOOLS = [
  {
    local_name: "bubble",
    description: "向桌面伴侣发送单向文字气泡（入队展示，非聊天窗口）",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "要展示的文字" } },
      required: ["text"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "play_slot",
    description: "播放指定动作槽位（Motion Slot）；可指定动作库 id，否则随机",
    parameters: {
      type: "object",
      properties: {
        slot: { type: "string", description: "动作槽位 id：idle、rest、walk、climb、in_place" },
        motion_id: { type: "string", description: "可选：动作库条目 id" },
      },
      required: ["slot"],
    },
    return_kind: "json" as const,
  },
];

export type CompanionRemoteToolsStatus = {
  instance_id: string;
  remote_tools_connected: boolean;
};

export type RemoteToolsHostHandle = {
  stop: () => void;
  getStatus: () => CompanionRemoteToolsStatus;
};

function resolveInstanceStore(habitatUrl: string): RemoteInstanceStore {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  if (shell?.createFileInstanceStore) {
    return shell.createFileInstanceStore(APP_ID);
  }
  return browserRemoteInstanceStore(habitatUrl.replace(/\/$/, ""), APP_ID);
}

function resolveAuthToken(): string | undefined {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  return shell?.remoteAuth?.token?.trim() || undefined;
}

function resolveHabitatUrl(fallback?: string): string {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  const fromShell = shell?.habitatUrl?.trim();
  if (fromShell) return fromShell.replace(/\/$/, "");
  return (fallback ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}

function reportStatus(status: CompanionRemoteToolsStatus): void {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  void shell?.reportCompanionRemoteToolsStatus?.(status);
}

/**
 * 启动 overlay 内 remote tools attach。无 token 时返回 null（不抛错）。
 */
export function startCompanionRemoteToolsHost(opts?: {
  habitatUrl?: string;
  httpUrl?: string;
  onStatus?: (status: CompanionRemoteToolsStatus) => void;
}): RemoteToolsHostHandle | null {
  const remoteAuthToken = resolveAuthToken();
  if (!remoteAuthToken) {
    const empty = { instance_id: "", remote_tools_connected: false };
    opts?.onStatus?.(empty);
    reportStatus(empty);
    return null;
  }

  const habitatUrl = resolveHabitatUrl(opts?.habitatUrl);
  const httpUrl = opts?.httpUrl ?? window.satelliteShell?.apiOrigin ?? undefined;
  let attach: RemoteToolsAttachHandle | null = null;

  const publish = (): void => {
    const status: CompanionRemoteToolsStatus = {
      instance_id: attach?.getInstanceId() ?? "",
      remote_tools_connected: attach?.isConnected() ?? false,
    };
    opts?.onStatus?.(status);
    reportStatus(status);
  };

  attach = createRemoteToolsHabitatAttach({
    appId: APP_ID,
    habitatUrl,
    ...(httpUrl ? { httpUrl } : {}),
    remoteAuthToken,
    instanceStore: resolveInstanceStore(habitatUrl),
    tools: REGISTERED_TOOLS,
    toolsetPrivate: false,
    onToolCall: async (localName, args) => executeCompanionTool(localName, args),
    onConnected: async (_client, instanceId) => {
      console.log("companion remote tools connected", instanceId);
      publish();
    },
  });

  publish();

  return {
    stop: () => {
      attach?.stop();
      attach = null;
      const empty = { instance_id: "", remote_tools_connected: false };
      opts?.onStatus?.(empty);
      reportStatus(empty);
    },
    getStatus: () => ({
      instance_id: attach?.getInstanceId() ?? "",
      remote_tools_connected: attach?.isConnected() ?? false,
    }),
  };
}

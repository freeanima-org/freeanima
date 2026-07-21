import { homedir } from "node:os";
import { join } from "node:path";

import {
  createRemoteToolsHub,
  type RemoteToolsHubHandle,
} from "@freeanima/shared/rpc-contract/remote-tools-hub.ts";
import { fileRemoteInstanceStore } from "@freeanima/shared/rpc-contract/file-instance-store.ts";
import { remoteAuthTokenFromShell } from "../config.ts";
import { executeCompanionTool } from "../tools/executor.ts";

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

function instanceStorePath(): string {
  const home = process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
  return join(home, "companion", "instance.json");
}

let hub: RemoteToolsHubHandle | null = null;

function authTokenReady(): boolean {
  return Boolean(remoteAuthTokenFromShell()?.trim());
}

function ensureHub(habitatUrl: string, httpUrl?: string): RemoteToolsHubHandle | null {
  if (!authTokenReady()) return null;
  if (!hub) {
    const remoteAuthToken = remoteAuthTokenFromShell();
    hub = createRemoteToolsHub({
      appId: APP_ID,
      habitatUrl,
      ...(httpUrl !== undefined ? { httpUrl } : {}),
      ...(remoteAuthToken !== undefined ? { remoteAuthToken } : {}),
      instanceStore: fileRemoteInstanceStore(instanceStorePath()),
      tools: REGISTERED_TOOLS,
      toolsetPrivate: false,
      onToolCall: async (localName, args) => executeCompanionTool(localName, args),
      onConnected: async () => {
        console.log("companion remote tools connected");
      },
    });
  }
  return hub;
}

export function getRemoteToolInstanceId(): string {
  const fromHub = hub?.getInstanceId();
  if (fromHub) return fromHub;
  const id = fileRemoteInstanceStore(instanceStorePath()).load();
  return id instanceof Promise ? "" : (id ?? "");
}

export function isRemoteToolsConnected(): boolean {
  return hub?.isConnected() ?? false;
}

/** @deprecated use isRemoteToolsConnected */
export const isSapConnected = isRemoteToolsConnected;

export function startRemoteToolsTransport(habitatUrl: string, httpUrl?: string): void {
  if (!authTokenReady()) {
    console.log("companion remote tools: waiting for Habitat API Token");
    return;
  }
  ensureHub(habitatUrl, httpUrl);
}

/** @deprecated use startRemoteToolsTransport */
export const startSapTransport = startRemoteToolsTransport;

export function reconnectRemoteTools(habitatUrl: string, httpUrl?: string): void {
  if (!authTokenReady()) {
    hub?.stop();
    hub = null;
    return;
  }
  // 设置变更后 token 可能更新；重建 hub 以读取 remoteAuthTokenFromShell()
  hub?.stop();
  hub = null;
  ensureHub(habitatUrl, httpUrl);
}

/** @deprecated use reconnectRemoteTools */
export const reconnectSap = reconnectRemoteTools;

export async function getRpcStreamClient(habitatUrl: string, httpUrl?: string) {
  const handle = ensureHub(habitatUrl, httpUrl);
  if (!handle) {
    throw new Error("remote tools hub requires remoteAuthToken");
  }
  return handle.getRpcStreamClient();
}

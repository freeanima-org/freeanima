import { homedir } from "node:os";
import { join } from "node:path";

import { createSatelliteHub, type SatelliteHubHandle } from "@freeanima/shared/sap-contract";
import { fileSapInstanceStore } from "@freeanima/shared/sap-contract/file-instance-store";
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

let hub: SatelliteHubHandle | null = null;

function sapAuthTokenReady(): boolean {
  return Boolean(remoteAuthTokenFromShell()?.trim());
}

function ensureHub(habitatUrl: string, httpUrl?: string): SatelliteHubHandle | null {
  if (!sapAuthTokenReady()) return null;
  if (!hub) {
    const remoteAuthToken = remoteAuthTokenFromShell();
    hub = createSatelliteHub({
      appId: APP_ID,
      habitatUrl,
      ...(httpUrl !== undefined ? { httpUrl } : {}),
      ...(remoteAuthToken !== undefined ? { remoteAuthToken } : {}),
      instanceStore: fileSapInstanceStore(instanceStorePath()),
      relay: false,
      tools: REGISTERED_TOOLS,
      toolsetPrivate: false,
      onToolCall: async (localName, args) => executeCompanionTool(localName, args),
      onConnected: async () => {
        console.log("companion SAP connected");
      },
    });
  }
  return hub;
}

export function getSapInstanceId(): string {
  const fromHub = hub?.getInstanceId();
  if (fromHub) return fromHub;
  const id = fileSapInstanceStore(instanceStorePath()).load();
  return id instanceof Promise ? "" : (id ?? "");
}

export function isSapConnected(): boolean {
  return hub?.isConnected() ?? false;
}

export function startSapTransport(habitatUrl: string, httpUrl?: string): void {
  if (!sapAuthTokenReady()) {
    console.log("companion SAP: waiting for Habitat API Token");
    return;
  }
  ensureHub(habitatUrl, httpUrl);
}

export function reconnectSap(habitatUrl: string, httpUrl?: string): void {
  if (!sapAuthTokenReady()) {
    hub?.stop();
    hub = null;
    return;
  }
  if (hub) {
    hub.reconnect(habitatUrl, httpUrl);
    return;
  }
  ensureHub(habitatUrl, httpUrl);
}

export async function getSapClient(habitatUrl: string, httpUrl?: string) {
  const handle = ensureHub(habitatUrl, httpUrl);
  if (!handle) {
    throw new Error("satellite hub requires remoteAuthToken");
  }
  return handle.getSapClient();
}

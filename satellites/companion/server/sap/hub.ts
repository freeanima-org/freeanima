import {
  runSapTransport,
  type SapClient,
  type SapTransportHandle,
  type ToolCallPayload,
} from "@freeanima/sap-contract";
import { executePetTool } from "../tools/executor.ts";
import { attachHubEventFanout } from "./relay.ts";

const APP_ID = "companion";

const instanceId = process.env.SATELLITE_INSTANCE_ID ?? crypto.randomUUID();
let transport: SapTransportHandle | null = null;

const REGISTERED_TOOLS = [
  {
    local_name: "pet_say",
    description: "让桌宠显示对话气泡",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "气泡文字" },
        duration_ms: { type: "number", description: "显示时长（毫秒）" },
      },
      required: ["text"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "pet_emote",
    description: "切换桌宠表情",
    parameters: {
      type: "object",
      properties: {
        emotion: {
          type: "string",
          enum: ["neutral", "joy", "angry", "sad", "surprised", "think", "talk"],
        },
        weight: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["emotion"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "pet_move",
    description: "将桌宠窗口移动到屏幕坐标",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "屏幕 X 坐标" },
        y: { type: "number", description: "屏幕 Y 坐标" },
      },
      required: ["x", "y"],
    },
    return_kind: "json" as const,
  },
];

export function getSapInstanceId(): string {
  return instanceId;
}

export function isSapConnected(): boolean {
  return transport?.getClient() !== null;
}

async function registerToolsAndHandlers(sap: SapClient): Promise<void> {
  sap.onEvent("tool.call", (payload) => {
    void handleToolCall(sap, payload as ToolCallPayload);
  });

  await sap.request("tool.register", { tools: REGISTERED_TOOLS });
  attachHubEventFanout(sap);
}

async function handleToolCall(sap: SapClient, payload: ToolCallPayload): Promise<void> {
  try {
    const content = await executePetTool(payload.local_name, payload.args);
    await sap.request("tool.result", { call_id: payload.call_id, content });
  } catch (e) {
    await sap.request("tool.error", {
      call_id: payload.call_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function startSapTransport(hubUrl: string, httpUrl?: string): SapTransportHandle {
  if (transport) return transport;

  const resolvedHttpUrl = httpUrl ?? `http://127.0.0.1:${process.env.SATELLITE_PORT ?? 4176}`;

  transport = runSapTransport({
    hubUrl,
    connect: {
      app_id: APP_ID,
      instance_id: instanceId,
      features_requested: ["server_info", "capability_mask"],
      http_url: resolvedHttpUrl,
    },
    onConnected: async (sap) => {
      console.log("companion SAP connected");
      await registerToolsAndHandlers(sap);
    },
  });

  return transport;
}

export async function getSapClient(hubUrl: string, httpUrl?: string): Promise<SapClient> {
  return startSapTransport(hubUrl, httpUrl).whenConnected();
}

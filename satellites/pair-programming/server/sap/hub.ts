import {
  createSapClient,
  serializeSapEnvelope,
  type SapClient,
  type ToolCallPayload,
} from "@freeanima/sap-contract";
import { executeLocalTool } from "../tools/executor.ts";
import { getStudioConfig } from "../studio.ts";

const APP_ID = "pair-programming";

let client: SapClient | null = null;
let instanceId = "";
let connectPromise: Promise<SapClient> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function getSapInstanceId(): string {
  return instanceId;
}

export function isSapConnected(): boolean {
  return client !== null;
}

export async function getSapClient(hubUrl: string): Promise<SapClient> {
  if (client) return client;
  if (connectPromise) return connectPromise;
  connectPromise = connectInternal(hubUrl).finally(() => {
    connectPromise = null;
  });
  return connectPromise;
}

async function connectInternal(hubUrl: string): Promise<SapClient> {
  instanceId = process.env.SATELLITE_INSTANCE_ID ?? crypto.randomUUID();
  const wsUrl = hubUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/sap/v1";
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error(`SAP connect failed: ${wsUrl}`)));
  });

  const sap = createSapClient({ ws });
  const connected = await sap.connect({
    app_id: APP_ID,
    instance_id: instanceId,
    features_requested: ["server_info"],
  });
  console.log("SAP connected", connected);

  sap.onEvent("tool.call", (payload) => {
    void handleToolCall(sap, payload as ToolCallPayload);
  });

  await sap.request("tool.register", {
    tools: [
      {
        local_name: "scan_code",
        description: "Scan workspace metadata",
        parameters: { type: "object", properties: {} },
        return_kind: "json",
      },
      {
        local_name: "file_read_file",
        description: "Read a file from workspace",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
        return_kind: "text",
      },
    ],
  });

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(
    () => {
      ws.send(
        serializeSapEnvelope({
          kind: "evt",
          method: "heartbeat",
          payload: { ts: Date.now() },
        }),
      );
    },
    (connected.heartbeat_interval_sec ?? 30) * 1000,
  );

  client = sap;
  return sap;
}

async function handleToolCall(sap: SapClient, payload: ToolCallPayload): Promise<void> {
  try {
    const content = await executeLocalTool(
      payload.local_name,
      payload.args,
      payload.workspace_root ?? getStudioConfig().workspace,
    );
    await sap.request("tool.result", { call_id: payload.call_id, content });
  } catch (e) {
    await sap.request("tool.error", {
      call_id: payload.call_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

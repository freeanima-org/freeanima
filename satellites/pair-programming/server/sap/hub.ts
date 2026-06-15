import {
  runSapTransport,
  type SapClient,
  type SapTransportHandle,
  type ToolCallPayload,
} from "@freeanima/sap-contract";
import { executeLocalTool } from "../tools/executor.ts";
import { getStudioConfig } from "../studio.ts";

const APP_ID = "pair-programming";

const instanceId = process.env.SATELLITE_INSTANCE_ID ?? crypto.randomUUID();
let transport: SapTransportHandle | null = null;

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

export function startSapTransport(hubUrl: string, httpUrl?: string): SapTransportHandle {
  if (transport) return transport;

  const resolvedHttpUrl = httpUrl ?? `http://127.0.0.1:${process.env.SATELLITE_PORT ?? 4173}`;

  transport = runSapTransport({
    hubUrl,
    connect: {
      app_id: APP_ID,
      instance_id: instanceId,
      features_requested: ["server_info"],
      http_url: resolvedHttpUrl,
    },
    onConnected: async (sap) => {
      console.log("SAP connected");
      await registerToolsAndHandlers(sap);
    },
  });

  return transport;
}

export async function getSapClient(hubUrl: string, httpUrl?: string): Promise<SapClient> {
  return startSapTransport(hubUrl, httpUrl).whenConnected();
}

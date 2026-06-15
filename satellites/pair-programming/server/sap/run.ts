import {
  createSapClient,
  serializeSapEnvelope,
  type ToolCallPayload,
} from "@freeanima/sap-contract";
import { executeLocalTool } from "../tools/executor.ts";
import { getStudioConfig } from "../studio.ts";

const APP_ID = "pair-programming";

export async function connectSap(hubUrl: string, instanceId = crypto.randomUUID()): Promise<void> {
  const wsUrl = hubUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/sap/v1";
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error(`SAP connect failed: ${wsUrl}`)));
  });

  const client = createSapClient({ ws });
  const connected = await client.connect({
    app_id: APP_ID,
    instance_id: instanceId,
    features_requested: ["server_info"],
  });
  console.log("SAP connected", connected);

  client.onEvent("tool.call", (payload) => {
    void handleToolCall(client, payload as ToolCallPayload);
  });

  const cfg = getStudioConfig();
  await client.request("tool.register", {
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

  if (cfg.workspace) {
    const session = await client.request("session.create", {
      platform: "studio-pair-programming",
      workspace_root: cfg.workspace,
      workspace_gitignore: cfg.gitignore,
      workspace_show_hidden: cfg.showHidden,
    });
    console.log("SAP session.create", session.session_id);
  }

  setInterval(
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
}

async function handleToolCall(
  client: ReturnType<typeof createSapClient>,
  payload: ToolCallPayload,
): Promise<void> {
  try {
    const content = await executeLocalTool(
      payload.local_name,
      payload.args,
      payload.workspace_root ?? getStudioConfig().workspace,
    );
    await client.request("tool.result", { call_id: payload.call_id, content });
  } catch (e) {
    await client.request("tool.error", {
      call_id: payload.call_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

if (import.meta.main) {
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  void connectSap(hub).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

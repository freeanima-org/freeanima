import { homedir } from "node:os";
import { join } from "node:path";

import {
  createSatelliteHub,
  fileSapInstanceStore,
  type SatelliteHubHandle,
} from "@freeanima/sap-contract";
import { executeLocalTool } from "../tools/executor.ts";
import { getStudioConfig } from "../studio.ts";

const APP_ID = "pair-programming";

const REGISTERED_TOOLS = [
  {
    local_name: "scan_code",
    description: "Scan workspace metadata",
    parameters: { type: "object", properties: {} },
    return_kind: "json" as const,
  },
  {
    local_name: "file_read",
    description: "Read a file from workspace",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    return_kind: "text" as const,
  },
  {
    local_name: "file_search",
    description: "Search files in workspace by text query",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        file_glob: { type: "string" },
      },
      required: ["query"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "file_write",
    description: "Write content to a workspace file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "file_patch",
    description: "Apply a patch to a workspace file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        patch: { type: "string" },
      },
      required: ["path", "patch"],
    },
    return_kind: "json" as const,
  },
  {
    local_name: "terminal_run",
    description: "Run a shell command in the workspace directory",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeout: { type: "number" },
      },
      required: ["command"],
    },
    return_kind: "text" as const,
  },
];

function instanceStorePath(): string {
  const home = process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
  return join(home, "satellites", APP_ID, "instance.json");
}

let hub: SatelliteHubHandle | null = null;

function ensureHub(hubUrl: string, httpUrl?: string): SatelliteHubHandle {
  if (!hub) {
    hub = createSatelliteHub({
      appId: APP_ID,
      hubUrl,
      httpUrl,
      instanceStore: fileSapInstanceStore(instanceStorePath()),
      relay: true,
      tools: REGISTERED_TOOLS,
      toolsetPrivate: true,
      onToolCall: async (localName, args, ctx) =>
        executeLocalTool(localName, args, ctx.workspace_root ?? getStudioConfig().workspace),
      onConnected: async () => {
        console.log("SAP connected");
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

export function startSapTransport(hubUrl: string, httpUrl?: string): SatelliteHubHandle {
  return ensureHub(hubUrl, httpUrl);
}

export async function getSapClient(hubUrl: string, httpUrl?: string) {
  return ensureHub(hubUrl, httpUrl).getSapClient();
}

export function getRelayState() {
  return hub?.relayState ?? null;
}

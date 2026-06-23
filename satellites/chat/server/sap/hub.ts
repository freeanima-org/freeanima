import { homedir } from "node:os";
import { join } from "node:path";

import {
  createSatelliteHub,
  fileSapInstanceStore,
  type SatelliteHubHandle,
} from "@freeanima/sap-contract";

const APP_ID = "chat";

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

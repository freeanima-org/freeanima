import { runSapTransport, type SapTransportHandle } from "@freeanima/sap-contract";

const APP_ID = "companion";

const instanceId = process.env.SATELLITE_INSTANCE_ID ?? crypto.randomUUID();
let transport: SapTransportHandle | null = null;

export function getSapInstanceId(): string {
  return instanceId;
}

export function isSapConnected(): boolean {
  return transport?.getClient() !== null;
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
    onConnected: async () => {
      console.log("companion SAP connected");
    },
  });

  return transport;
}

export async function getSapClient(hubUrl: string, httpUrl?: string) {
  return startSapTransport(hubUrl, httpUrl).whenConnected();
}

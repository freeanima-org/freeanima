import { createSapClient, serializeSapEnvelope } from "@freeanima/sap-contract";

const APP_ID = "parlor";

export async function connectParlorSap(hubUrl: string): Promise<void> {
  const wsUrl = hubUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/sap/v1";
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error(`SAP connect failed: ${wsUrl}`)));
  });

  const client = createSapClient({ ws });
  const connected = await client.connect({
    app_id: APP_ID,
    instance_id: crypto.randomUUID(),
    features_requested: ["server_info"],
  });
  console.log("parlor SAP stub connected", connected.server_info?.platform_for_app ?? connected);

  const session = await client.request("session.create", { platform: "parlor" });
  console.log("parlor SAP session", session.session_id);

  client.onEvent("session.updated", (payload) => {
    console.log("session.updated", payload);
  });
  await client.request("session.subscribe", { session_id: session.session_id });

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

if (import.meta.main) {
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  void connectParlorSap(hub).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

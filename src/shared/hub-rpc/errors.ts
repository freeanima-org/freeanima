export class HubRpcTimeoutError extends Error {
  readonly code = "hub_rpc_timeout" as const;

  constructor(message: string) {
    super(message);
    this.name = "HubRpcTimeoutError";
  }
}

export function isHubRpcTimeoutError(err: unknown): boolean {
  return (
    err instanceof HubRpcTimeoutError ||
    (err instanceof Error && err.message.includes("hub_rpc_timeout"))
  );
}

export function isHubRpcTransportError(err: unknown): boolean {
  if (isHubRpcTimeoutError(err)) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("websocket closed") ||
    msg.includes("websocket open failed") ||
    msg.includes("timed out")
  );
}

export class HabitatRpcTimeoutError extends Error {
  readonly code = "hub_rpc_timeout" as const;

  constructor(message: string) {
    super(message);
    this.name = "HabitatRpcTimeoutError";
  }
}

export function isHabitatRpcTimeoutError(err: unknown): boolean {
  return (
    err instanceof HabitatRpcTimeoutError ||
    (err instanceof Error && err.message.includes("hub_rpc_timeout"))
  );
}

export function isHabitatRpcTransportError(err: unknown): boolean {
  if (isHabitatRpcTimeoutError(err)) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("websocket closed") ||
    msg.includes("websocket open failed") ||
    msg.includes("timed out")
  );
}

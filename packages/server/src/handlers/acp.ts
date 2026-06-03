import { getServiceContext } from "../service-context";
import { ApiHandlerError } from "./errors";

export function getAcpStatus() {
  const { acp } = getServiceContext();
  return acp.getStatus();
}

export async function acpStartAll() {
  const { acp } = getServiceContext();
  const result = await acp.startAll();
  if (!result.ok) throw new ApiHandlerError(400, result.error ?? "start failed");
  return { ok: true as const, ...acp.getStatus() };
}

export async function acpStopAll() {
  const { acp } = getServiceContext();
  const result = await acp.stopAll();
  if (!result.ok) throw new ApiHandlerError(400, result.error ?? "stop failed");
  return { ok: true as const, ...acp.getStatus() };
}

export async function acpStartAgent(name: string) {
  const { acp } = getServiceContext();
  const result = await acp.startAgent(name);
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error ?? "start failed", { agent: name });
  }
  return { ok: true as const, ...acp.getStatus() };
}

export async function acpStopAgent(name: string) {
  const { acp } = getServiceContext();
  const result = await acp.stopAgent(name);
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error ?? "stop failed", { agent: name });
  }
  return { ok: true as const, ...acp.getStatus() };
}

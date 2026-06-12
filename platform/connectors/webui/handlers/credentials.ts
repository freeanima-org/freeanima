import { getCredentialDetail, listCredentials } from "@freeanima/platform/config";
import { ApiHandlerError } from "./errors.ts";

export function listCredentialMetas() {
  return { credentials: listCredentials() };
}

export function getCredentialDetailHandler(path: string) {
  try {
    return getCredentialDetail(path);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("Failed to read credential")) {
      throw new ApiHandlerError(404, message, { path });
    }
    throw new ApiHandlerError(500, message, { path });
  }
}

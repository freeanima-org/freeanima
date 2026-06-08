import { listCredentials } from "@freeanima/service-config";

export function listCredentialMetas() {
  return { credentials: listCredentials() };
}

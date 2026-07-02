export { getAgentMachineKey, randomSalt, resetAgentMachineKeyCacheForTest } from "./machine-key.ts";
export {
  ensureAgentVaultConfig,
  openAgentVaultSecrets,
  patchAgentVaultSecrets,
  resolveAgentVaultSecret,
  sealAgentVaultItem,
} from "./agent-secrets.ts";
export {
  bindVaultShellSendRequest,
  parseVaultResolveSecretUserResponse,
  resolveUserVaultSecret,
} from "./user-secrets.ts";
export {
  openVaultSecrets,
  sealVaultSecrets,
  resolveSecretField,
  extractCustomFieldNames,
  rewrapAllDekWrapped,
} from "@freeanima/vault-crypto";

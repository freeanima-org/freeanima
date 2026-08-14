export {
  AGENT_VAULT_LOCKED,
  AGENT_MACHINE_KEY_BYTES,
  getAgentMachineKey,
  generateAgentMachineKeyB64,
  generateAgentMachineKeyRaw,
  isAgentVaultUnlocked,
  lockAgentMachineKey,
  peekAgentMachineKeyB64,
  peekAgentMachineKeyRaw,
  provisionAgentMachineKey,
  provisionAgentMachineKeyB64,
  randomSalt,
  resetAgentMachineKeyCacheForTest,
} from "./machine-key.ts";
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
} from "@freeanima/shared/vault-crypto";

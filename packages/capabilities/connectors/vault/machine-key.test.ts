import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  AGENT_MACHINE_KEY_BYTES,
  AGENT_VAULT_LOCKED,
  generateAgentMachineKeyRaw,
  getAgentMachineKey,
  isAgentVaultUnlocked,
  lockAgentMachineKey,
  peekAgentMachineKeyB64,
  provisionAgentMachineKey,
  resetAgentMachineKeyCacheForTest,
} from "./machine-key.ts";

describe("agent machine key cache", () => {
  let home: string;
  const prevHome = process.env.FREEANIMA_HOME;

  function useTempHome(): void {
    home = mkdtempSync(join(tmpdir(), "anima-agent-key-"));
    process.env.FREEANIMA_HOME = home;
    resetAgentMachineKeyCacheForTest();
  }

  afterEach(() => {
    resetAgentMachineKeyCacheForTest();
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    if (home) rmSync(home, { recursive: true, force: true });
  });

  it("throws AGENT_VAULT_LOCKED when cache missing", async () => {
    useTempHome();
    expect(isAgentVaultUnlocked()).toBe(false);
    expect(peekAgentMachineKeyB64()).toBeNull();
    await expect(getAgentMachineKey()).rejects.toThrow(AGENT_VAULT_LOCKED);
  });

  it("provision then getAgentMachineKey / peek / lock", async () => {
    useTempHome();
    const raw = generateAgentMachineKeyRaw();
    expect(raw.length).toBe(AGENT_MACHINE_KEY_BYTES);
    await provisionAgentMachineKey(raw);
    expect(isAgentVaultUnlocked()).toBe(true);
    const key = await getAgentMachineKey();
    expect(key).toBeTruthy();
    const peeked = peekAgentMachineKeyB64();
    expect(peeked).toBeTruthy();
    const cachePath = join(home, "vault", "agent-machine.key");
    expect(existsSync(cachePath)).toBe(true);

    lockAgentMachineKey();
    expect(isAgentVaultUnlocked()).toBe(false);
    expect(existsSync(cachePath)).toBe(false);
    await expect(getAgentMachineKey()).rejects.toThrow(AGENT_VAULT_LOCKED);
  });

  it("loads from existing cache file without auto-generate", async () => {
    useTempHome();
    const vaultDir = join(home, "vault");
    mkdirSync(vaultDir, { recursive: true });
    const raw = generateAgentMachineKeyRaw();
    writeFileSync(join(vaultDir, "agent-machine.key"), Buffer.from(raw));
    resetAgentMachineKeyCacheForTest();
    expect(isAgentVaultUnlocked()).toBe(true);
    await getAgentMachineKey();
  });
});

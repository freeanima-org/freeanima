import { beforeEach, describe, expect, it, mock } from "bun:test";
import { spawnSync } from "node:child_process";

const resolveAgentVaultSecretMock = mock(async () => "secret-value-xyz");
const resolveUserVaultSecretMock = mock(async () => {
  throw new Error("user not used");
});
const resolveVaultToolWorldMock = mock(async () => 1);

mock.module("@freeanima/platform/connectors/vault", () => ({
  resolveAgentVaultSecret: resolveAgentVaultSecretMock,
  resolveUserVaultSecret: resolveUserVaultSecretMock,
}));

mock.module("@freeanima/features/vault/domain/tool-world-resolve", () => ({
  resolveVaultToolWorld: resolveVaultToolWorldMock,
  SUBJECT_KIND_TOOL_PROPERTY: {
    type: "string",
    enum: ["user", "agent"],
    description: "Vault library",
  },
  WORLD_ID_TOOL_PROPERTY: {
    type: "integer",
    description: "Optional world override",
  },
}));

mock.module("@freeanima/features/vault/domain/vault-world", () => ({
  defaultVaultSubjectForTools: () => "agent" as const,
}));

const { parseSecretsArg, resolveSubprocessSecrets } = await import("./subprocess-secrets.ts");
const { buildSubprocessEnv } = await import("./subprocess-env.ts");

describe("parseSecretsArg", () => {
  it("returns empty array for nullish", () => {
    expect(parseSecretsArg(undefined)).toEqual([]);
    expect(parseSecretsArg(null)).toEqual([]);
  });

  it("rejects non-array", () => {
    const out = parseSecretsArg({});
    expect(typeof out).toBe("string");
    expect(out).toContain("secrets must be an array");
  });

  it("parses refs with defaults", () => {
    const out = parseSecretsArg([{ id: 12, env_name: "GH_TOKEN" }]);
    expect(Array.isArray(out)).toBe(true);
    if (!Array.isArray(out)) return;
    expect(out).toEqual([
      {
        id: 12,
        env_name: "GH_TOKEN",
        subject_kind: "agent",
      },
    ]);
  });
});

describe("resolveSubprocessSecrets", () => {
  const KEY = "FA_VAULT_SECRETS_TEST";

  beforeEach(() => {
    resolveAgentVaultSecretMock.mockClear();
    resolveUserVaultSecretMock.mockClear();
    resolveVaultToolWorldMock.mockClear();
    resolveAgentVaultSecretMock.mockImplementation(async () => "secret-value-xyz");
    resolveVaultToolWorldMock.mockImplementation(async () => 1);
    delete process.env[KEY];
  });

  it("resolves agent secrets without writing Hub process.env", async () => {
    const resolved = await resolveSubprocessSecrets([
      { id: 99, env_name: KEY, subject_kind: "agent" },
    ]);
    expect(resolved).toEqual({ [KEY]: "secret-value-xyz" });
    expect(process.env[KEY]).toBeUndefined();
    expect(resolveAgentVaultSecretMock).toHaveBeenCalled();
  });

  it("child printenv sees secrets via buildSubprocessEnv; Hub env stays clean", async () => {
    const resolved = await resolveSubprocessSecrets([
      { id: 99, env_name: KEY, subject_kind: "agent" },
    ]);
    expect(typeof resolved).toBe("object");
    if (typeof resolved === "string") return;

    expect(process.env[KEY]).toBeUndefined();
    const child = spawnSync("printenv", [KEY], {
      encoding: "utf-8",
      env: buildSubprocessEnv(resolved),
    });
    expect(child.status).toBe(0);
    expect((child.stdout ?? "").trim()).toBe("secret-value-xyz");
    expect(process.env[KEY]).toBeUndefined();
  });
});

import { beforeEach, afterEach, describe, expect, it, mock } from "bun:test";
import { spawnSync } from "node:child_process";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/resolved-world-context.ts";

const resolveAgentVaultSecretMock = mock(async () => "secret-value-xyz");
const resolveUserVaultSecretMock = mock(async () => {
  throw new Error("user not used");
});
const resolveVaultToolWorldMock = mock(async () => 1);

mock.module("@freeanima/habitat/capabilities/connectors/vault", () => ({
  resolveAgentVaultSecret: resolveAgentVaultSecretMock,
  resolveUserVaultSecret: resolveUserVaultSecretMock,
}));

mock.module("@freeanima/features/vault/domain/tool-world-resolve", () => ({
  resolveVaultToolWorld: resolveVaultToolWorldMock,
  SUBJECT_ID_TOOL_PROPERTY: {
    type: "integer",
    description: "Owning subject entity id",
  },
  WORLD_ID_TOOL_PROPERTY: {
    type: "integer",
    description: "Optional world override",
  },
}));

const { parseSecretArg, parseSecretsArg, resolveSubprocessSecrets, resolveVaultSecretValue } =
  await import("./subprocess-secrets.ts");
const { buildSubprocessEnv } = await import("./subprocess-env.ts");

describe("parseSecretArg", () => {
  it("returns null for nullish", () => {
    expect(parseSecretArg(undefined)).toBeNull();
    expect(parseSecretArg(null)).toBeNull();
  });

  it("rejects non-object", () => {
    const out = parseSecretArg([]);
    expect(typeof out).toBe("string");
    expect(out).toContain("secret must be an object");
  });

  it("requires id and field", () => {
    expect(coerceString(parseSecretArg({ id: 12 }))).toContain("secret.field is required");
    expect(coerceString(parseSecretArg({ field: "password" }))).toContain("secret.id is required");
  });

  it("parses id and field", () => {
    expect(parseSecretArg({ id: 12, field: "password" })).toEqual({
      id: 12,
      field: "password",
    });
  });
});

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

  it("parses refs without inventing subject_kind", () => {
    const out = parseSecretsArg([{ id: 12, env_name: "GH_TOKEN" }]);
    expect(Array.isArray(out)).toBe(true);
    if (!Array.isArray(out)) return;
    expect(out).toEqual([
      {
        id: 12,
        env_name: "GH_TOKEN",
      },
    ]);
  });

  it("keeps explicit subject_kind", () => {
    const out = parseSecretsArg([{ id: 12, env_name: "GH_TOKEN", subject_id: 20 }]);
    expect(Array.isArray(out)).toBe(true);
    if (!Array.isArray(out)) return;
    expect(out).toEqual([
      {
        id: 12,
        env_name: "GH_TOKEN",
        subject_id: 20,
      },
    ]);
  });
});

describe("resolveVaultSecretValue", () => {
  beforeEach(() => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 20,
      user_world_id: 10,
      agent_world_id: 200,
      default_chat_agent_subject_id: 20,
      default_chat_agent_world_id: 200,
      commons_world_id: 30,
    });
    resolveAgentVaultSecretMock.mockClear();
    resolveUserVaultSecretMock.mockClear();
    resolveVaultToolWorldMock.mockClear();
    resolveAgentVaultSecretMock.mockImplementation(async () => "secret-value-xyz");
    resolveVaultToolWorldMock.mockImplementation(async () => 1);
  });

  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("resolves agent secret without writing Habitat process.env", async () => {
    const resolved = await resolveVaultSecretValue({
      id: 99,
      field: "password",
      subject_id: 20,
    });
    expect(resolved).toEqual({ value: "secret-value-xyz" });
    expect(resolveAgentVaultSecretMock).toHaveBeenCalled();
  });
});

describe("resolveSubprocessSecrets", () => {
  const KEY = "FA_VAULT_SECRETS_TEST";

  beforeEach(() => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 20,
      user_world_id: 10,
      agent_world_id: 200,
      default_chat_agent_subject_id: 20,
      default_chat_agent_world_id: 200,
      commons_world_id: 30,
    });
    resolveAgentVaultSecretMock.mockClear();
    resolveUserVaultSecretMock.mockClear();
    resolveVaultToolWorldMock.mockClear();
    resolveAgentVaultSecretMock.mockImplementation(async () => "secret-value-xyz");
    resolveVaultToolWorldMock.mockImplementation(async () => 1);
    delete process.env[KEY];
  });

  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("resolves agent secrets without writing Habitat process.env", async () => {
    const resolved = await resolveSubprocessSecrets([{ id: 99, env_name: KEY, subject_id: 20 }]);
    expect(resolved).toEqual({ [KEY]: "secret-value-xyz" });
    expect(process.env[KEY]).toBeUndefined();
    expect(resolveAgentVaultSecretMock).toHaveBeenCalled();
  });

  it("child printenv sees secrets via buildSubprocessEnv; Habitat env stays clean", async () => {
    const resolved = await resolveSubprocessSecrets([{ id: 99, env_name: KEY, subject_id: 20 }]);
    expect(typeof resolved).toBe("object");
    if (typeof resolved === "string") return;

    expect(process.env[KEY]).toBeUndefined();
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `const v=process.env[${JSON.stringify(KEY)}]; if(v==null) process.exit(1); process.stdout.write(v)`,
      ],
      {
        encoding: "utf-8",
        env: buildSubprocessEnv(resolved),
      },
    );
    expect(child.status).toBe(0);
    expect((child.stdout ?? "").trim()).toBe("secret-value-xyz");
    expect(process.env[KEY]).toBeUndefined();
  });
});

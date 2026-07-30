import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";

const ensureAgentVaultConfigMock = mock(async () => ({}));
const sealAgentVaultItemMock = mock(
  async (_secrets: {
    password?: string;
    notes?: string;
    totp?: string;
    custom_fields?: { name: string; value: string; type: string }[];
  }) => ({
    secrets_enc: "enc",
    dek_wrapped: "dek",
    custom_field_names: ["api"],
  }),
);
const openAgentVaultSecretsMock = mock(async () => ({ password: "old" }));

const createVaultItemMock = mock(async () => ({
  id: 101,
  title: "GitHub",
  content: "",
  item_type: "login" as const,
  url: "https://github.com",
  username: "bot",
  tag_ids: [1],
  secrets_enc: "enc",
  dek_wrapped: "dek",
  custom_field_names: ["api"],
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-19T00:00:00.000Z",
}));

const updateVaultItemMock = mock(async () => ({
  id: 101,
  title: "GitHub updated",
  content: "",
  item_type: "login" as const,
  tag_ids: [],
  secrets_enc: "enc2",
  dek_wrapped: "dek2",
  custom_field_names: [],
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-19T01:00:00.000Z",
}));

const deleteVaultItemMock = mock(async () => true);
const getVaultItemMock = mock(async () => ({
  id: 101,
  title: "GitHub",
  content: "",
  item_type: "login" as const,
  tag_ids: [],
  secrets_enc: "enc",
  dek_wrapped: "dek",
  custom_field_names: [],
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-19T00:00:00.000Z",
}));

const resolveVaultToolWorldMock = mock(async () => 7);

mock.module("@freeanima/host/capabilities/connectors/vault", () => ({
  ensureAgentVaultConfig: ensureAgentVaultConfigMock,
  sealAgentVaultItem: sealAgentVaultItemMock,
  openAgentVaultSecrets: openAgentVaultSecretsMock,
}));

mock.module("./item-store.ts", () => ({
  createVaultItem: createVaultItemMock,
  updateVaultItem: updateVaultItemMock,
  deleteVaultItem: deleteVaultItemMock,
  getVaultItem: getVaultItemMock,
  listVaultItems: mock(async () => []),
  searchVaultItems: mock(async () => []),
  toVaultItemMeta: (row: {
    id: number;
    title: string;
    content: string;
    item_type: string;
    url?: string;
    username?: string;
    tag_ids: number[];
    custom_field_names: string[];
    created_at: string;
    updated_at: string;
  }) => {
    const {
      secrets_enc: _s,
      dek_wrapped: _d,
      ...meta
    } = row as typeof row & {
      secrets_enc?: string;
      dek_wrapped?: string;
    };
    return meta;
  },
}));

mock.module("./tool-world-resolve.ts", () => ({
  resolveVaultToolWorld: resolveVaultToolWorldMock,
  metaPayload: (row: Record<string, unknown>) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    item_type: row.item_type,
    url: row.url,
    username: row.username,
    tag_ids: row.tag_ids,
    custom_field_names: row.custom_field_names,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }),
  SUBJECT_KIND_TOOL_PROPERTY: {
    type: "string",
    enum: ["user", "agent"],
    description: "Vault library",
  },
  WORLD_ID_TOOL_PROPERTY: { type: "integer", description: "world" },
}));

const { registerVaultTools } = await import("./tools.ts");

describe("vault CRUD tools", () => {
  const tools = new ToolSetRegistry();

  beforeEach(() => {
    ensureAgentVaultConfigMock.mockClear();
    sealAgentVaultItemMock.mockClear();
    openAgentVaultSecretsMock.mockClear();
    createVaultItemMock.mockClear();
    updateVaultItemMock.mockClear();
    deleteVaultItemMock.mockClear();
    getVaultItemMock.mockClear();
    resolveVaultToolWorldMock.mockClear();
    resolveVaultToolWorldMock.mockImplementation(async () => 7);
    sealAgentVaultItemMock.mockImplementation(async () => ({
      secrets_enc: "enc",
      dek_wrapped: "dek",
      custom_field_names: ["api"],
    }));
    createVaultItemMock.mockImplementation(async () => ({
      id: 101,
      title: "GitHub",
      content: "",
      item_type: "login" as const,
      url: "https://github.com",
      username: "bot",
      tag_ids: [1],
      secrets_enc: "enc",
      dek_wrapped: "dek",
      custom_field_names: ["api"],
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:00:00.000Z",
    }));
    updateVaultItemMock.mockImplementation(async () => ({
      id: 101,
      title: "GitHub updated",
      content: "",
      item_type: "login" as const,
      tag_ids: [],
      secrets_enc: "enc2",
      dek_wrapped: "dek2",
      custom_field_names: [],
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T01:00:00.000Z",
    }));
    deleteVaultItemMock.mockImplementation(async () => true);
    getVaultItemMock.mockImplementation(async () => ({
      id: 101,
      title: "GitHub",
      content: "",
      item_type: "login" as const,
      tag_ids: [],
      secrets_enc: "enc",
      dek_wrapped: "dek",
      custom_field_names: [],
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:00:00.000Z",
    }));
    openAgentVaultSecretsMock.mockImplementation(async () => ({ password: "old" }));

    // register once
    if (!tools.getTool("vault_create")) {
      registerVaultTools(tools);
    }
  });

  it("registers vault tools without exposeMcp", () => {
    if (!tools.getTool("vault_create")) registerVaultTools(tools);
    for (const name of [
      "vault_list",
      "vault_search",
      "vault_get_meta",
      "vault_create",
      "vault_update",
      "vault_delete",
    ] as const) {
      const t = tools.getTool(name);
      expect(t, name).toBeTruthy();
      expect(t!.exposeMcp === true, name).toBe(false);
    }
    const mcpNames = new Set(tools.listMcpExposedTools().map((t) => t.name));
    expect(mcpNames.has("vault_list")).toBe(false);
    expect(mcpNames.has("vault_create")).toBe(false);
  });

  it("vault_create seals and returns metadata only", async () => {
    if (!tools.getTool("vault_create")) registerVaultTools(tools);
    const out = await tools.getTool("vault_create")!.handler({
      title: "GitHub",
      url: "https://github.com",
      username: "bot",
      tag_ids: [1],
      secrets: { password: "tok", custom_fields: [{ name: "api", value: "x", type: "hidden" }] },
    });
    const data = JSON.parse(out) as {
      ok: boolean;
      action: string;
      item: Record<string, unknown>;
    };
    expect(data.ok).toBe(true);
    expect(data.action).toBe("create");
    expect(data.item.id).toBe(101);
    expect(data.item.title).toBe("GitHub");
    expect(data.item).not.toHaveProperty("secrets_enc");
    expect(data.item).not.toHaveProperty("password");
    expect(sealAgentVaultItemMock).toHaveBeenCalled();
    expect(createVaultItemMock).toHaveBeenCalled();
  });

  it("vault_create trims credential values before seal", async () => {
    if (!tools.getTool("vault_create")) registerVaultTools(tools);
    await tools.getTool("vault_create")!.handler({
      title: "Trim",
      secrets: {
        password: " tok\n",
        notes: "  keep  ",
        totp: " 123 ",
        custom_fields: [{ name: "api", value: " val\n", type: "hidden" }],
      },
    });
    expect(sealAgentVaultItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "tok",
        notes: "  keep  ",
        totp: "123",
        custom_fields: [expect.objectContaining({ name: "api", value: "val" })],
      }),
    );
  });

  it("vault_create rejects user library", async () => {
    if (!tools.getTool("vault_create")) registerVaultTools(tools);
    const out = await tools.getTool("vault_create")!.handler({
      subject_kind: "user",
      title: "x",
      secrets: { password: "p" },
    });
    expect(out).toContain("agent library");
    expect(createVaultItemMock).not.toHaveBeenCalled();
  });

  it("vault_update merges secrets", async () => {
    if (!tools.getTool("vault_update")) registerVaultTools(tools);
    const out = await tools.getTool("vault_update")!.handler({
      id: 101,
      title: "GitHub updated",
      secrets: { password: "new" },
    });
    const data = JSON.parse(out) as { ok: boolean; action: string; item: { title: string } };
    expect(data.ok).toBe(true);
    expect(data.action).toBe("update");
    expect(data.item.title).toBe("GitHub updated");
    expect(openAgentVaultSecretsMock).toHaveBeenCalled();
    expect(sealAgentVaultItemMock).toHaveBeenCalled();
    expect(updateVaultItemMock).toHaveBeenCalled();
  });

  it("vault_update rejects user library", async () => {
    if (!tools.getTool("vault_update")) registerVaultTools(tools);
    const out = await tools.getTool("vault_update")!.handler({
      subject_kind: "user",
      id: 1,
      title: "x",
    });
    expect(out).toContain("agent library");
    expect(updateVaultItemMock).not.toHaveBeenCalled();
  });

  it("vault_delete returns ok", async () => {
    if (!tools.getTool("vault_delete")) registerVaultTools(tools);
    const out = await tools.getTool("vault_delete")!.handler({ id: 101 });
    expect(JSON.parse(out)).toEqual({ ok: true, action: "delete", id: 101 });
    expect(deleteVaultItemMock).toHaveBeenCalledWith(7, 101);
  });
});

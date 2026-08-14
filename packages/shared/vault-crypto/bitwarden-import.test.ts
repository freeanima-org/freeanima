import { describe, expect, test } from "bun:test";

import {
  indexBitwardenImportRefs,
  parseBitwardenExport,
  planBitwardenImport,
} from "./bitwarden-import.ts";

const FIXTURE = {
  encrypted: false,
  folders: [{ id: "folder-work", name: "工作" }],
  items: [
    {
      id: "cipher-login-1",
      folderId: "folder-work",
      type: 1,
      name: "GitHub",
      notes: "dev",
      login: {
        uris: [
          { match: null, uri: "https://github.com" },
          { match: 1, uri: "https://gist.github.com" },
        ],
        username: "octocat",
        password: "s3cret",
        totp: "JBSWY3DPEHPK3PXP",
      },
      fields: [{ name: "pat", value: "ghp_x", type: 1 }],
    },
    {
      id: "cipher-note-1",
      type: 2,
      name: "Memo",
      notes: "hello",
      secureNote: { type: 0 },
    },
    {
      id: "cipher-card-1",
      type: 3,
      name: "Visa",
      card: {
        cardholderName: "Ada",
        brand: "Visa",
        number: "4111111111111111",
        expMonth: "12",
        expYear: "2030",
        code: "123",
      },
    },
  ],
};

describe("parseBitwardenExport", () => {
  test("拒绝加密导出", () => {
    const r = parseBitwardenExport({ encrypted: true, items: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("加密");
  });

  test("映射 login / note / card 与 folder→tag、uris", () => {
    const r = parseBitwardenExport(FIXTURE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.folder_count).toBe(1);
    expect(r.items).toHaveLength(3);
    const login = r.items[0];
    expect(login?.bitwarden_id).toBe("cipher-login-1");
    expect(login?.item_type).toBe("login");
    expect(login?.tags).toEqual(["工作"]);
    expect(login?.username).toBe("octocat");
    expect(login?.url).toBe("https://github.com");
    expect(login?.uris).toEqual([
      { uri: "https://github.com", match: "domain" },
      { uri: "https://gist.github.com", match: "host" },
    ]);
    expect(login?.secrets.password).toBe("s3cret");
    expect(login?.secrets.custom_fields?.[0]?.name).toBe("pat");
    expect(r.items[1]?.item_type).toBe("secure_note");
    expect(r.items[2]?.secrets.card?.number).toBe("4111111111111111");
  });
});

describe("planBitwardenImport", () => {
  test("二次导入按 UUID upsert；create_only 跳过", () => {
    const parsed = parseBitwardenExport(FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const index = indexBitwardenImportRefs([
      { id: 42, import_refs: { bitwarden: "cipher-login-1" } },
    ]);
    const upsert = planBitwardenImport(parsed.items, index, "upsert");
    expect(upsert.filter((e) => e.action === "update")).toHaveLength(1);
    expect(upsert.find((e) => e.mapped.bitwarden_id === "cipher-login-1")?.local_id).toBe(42);
    expect(upsert.filter((e) => e.action === "create")).toHaveLength(2);

    const createOnly = planBitwardenImport(parsed.items, index, "create_only");
    expect(createOnly.find((e) => e.mapped.bitwarden_id === "cipher-login-1")?.action).toBe("skip");
  });
});

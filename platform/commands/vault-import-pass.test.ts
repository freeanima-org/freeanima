import { describe, expect, test } from "bun:test";

import { mapPassToVault } from "./vault-import-pass.ts";

describe("mapPassToVault", () => {
  test("YAML pass 条目映射 password 与 custom_fields", () => {
    const mapped = mapPassToVault(
      {
        path: "services/demo/api",
        category: "services",
        name: "api",
        label: "demo api",
        yaml: true,
        fields: ["token", "account_id"],
        tags: ["demo"],
        desc: "demo token",
      },
      {
        yaml: true,
        fields: { token: "secret-token", account_id: "acc-1" },
      },
    );
    expect(mapped.secrets.password).toBe("secret-token");
    expect(mapped.primaryField).toBe("password");
    expect(mapped.tags).toContain("pass:services/demo/api");
    expect(mapped.content).toContain("pass-import:services/demo/api");
  });

  test("单行 pass 条目映射为 password", () => {
    const mapped = mapPassToVault(
      {
        path: "misc/plain",
        category: "misc",
        name: "plain",
        label: "plain",
        yaml: false,
        fields: [],
        tags: [],
        desc: "",
      },
      { yaml: false, value: "plain-secret" },
    );
    expect(mapped.secrets.password).toBe("plain-secret");
  });
});

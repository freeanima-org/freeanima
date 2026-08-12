import { describe, expect, it } from "bun:test";

import { buildDirImportModuleSource } from "./dir-import-plugin.ts";

describe("buildDirImportModuleSource", () => {
  it("emits sorted type:file imports and default map", () => {
    const src = buildDirImportModuleSource([
      { rel: "b/x.sql", abs: "/tmp/b/x.sql" },
      { rel: "a/migration.sql", abs: "/tmp/a/migration.sql" },
    ]);
    expect(src).toContain(
      `import f0 from ${JSON.stringify("/tmp/a/migration.sql")} with { type: "file" };`,
    );
    expect(src).toContain(
      `import f1 from ${JSON.stringify("/tmp/b/x.sql")} with { type: "file" };`,
    );
    expect(src).toContain(`"a/migration.sql": f0`);
    expect(src).toContain(`"b/x.sql": f1`);
    expect(src).toContain("export default {");
  });

  it("handles empty directory", () => {
    const src = buildDirImportModuleSource([]);
    expect(src).toBe(`
export default {

};
`);
  });
});

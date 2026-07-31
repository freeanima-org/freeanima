import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { formatBootstrapConfigError, formatMissingConfigYamlError } from "./bootstrap-error.ts";

describe("bootstrap-error", () => {
  it("formatMissingConfigYamlError 含路径与 database.url 示例", () => {
    const msg = formatMissingConfigYamlError("/tmp/x/config.yaml");
    expect(msg).toContain("/tmp/x/config.yaml");
    expect(msg).toContain("database.url");
    expect(msg).toContain("postgresql://");
  });

  it("formatBootstrapConfigError 对 database 缺失给出可读提示", () => {
    const parsed = z.object({ database: z.object({ url: z.string() }) }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const msg = formatBootstrapConfigError(parsed.error, "C:\\Users\\x\\.anima\\config.yaml");
    expect(msg).toContain("bootstrap 校验失败");
    expect(msg).toContain("database");
    expect(msg).toContain("不是「PostgreSQL 还没连上」");
    expect(msg).toContain("C:\\Users\\x\\.anima\\config.yaml");
    expect(msg).not.toContain("ZodError");
  });

  it("formatBootstrapConfigError 非 database 问题时不附加 PG 连通性说明", () => {
    const parsed = z
      .object({
        database: z.object({ url: z.string() }),
        http: z.object({ port: z.number() }),
      })
      .safeParse({ database: { url: "postgresql://x" }, http: { port: "x" } });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const msg = formatBootstrapConfigError(parsed.error, "/tmp/config.yaml");
    expect(msg).toContain("http.port");
    expect(msg).not.toContain("不是「PostgreSQL 还没连上」");
  });
});

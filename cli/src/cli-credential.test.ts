import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import type { CredentialMeta } from "@freeanima/service-config";
import {
  parseKeyValues,
  registerCredentialCommand,
  type CredentialCommandDeps,
} from "./commands/credential.ts";
import { renderTable } from "./output/table.ts";

const sampleMeta: CredentialMeta = {
  path: "services/discord",
  category: "services",
  name: "discord",
  label: "discord",
  yaml: true,
  fields: ["token", "desc"],
  tags: ["bot"],
  desc: "Discord bot",
};

function mockDeps(overrides: Partial<CredentialCommandDeps> = {}): CredentialCommandDeps {
  return {
    listCredentials: () => [],
    credential: () => "secret-value",
    insertCredential: () => "ok",
    updateCredential: () => "ok",
    ...overrides,
  };
}

async function runCredential(args: string[], deps: CredentialCommandDeps): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerCredentialCommand(program, deps);
  await program.parseAsync(["credential", ...args], { from: "user" });
}

describe("parseKeyValues", () => {
  it("解析 key=value 对", () => {
    expect(parseKeyValues(["token=abc", "desc=hello"])).toEqual({
      token: "abc",
      desc: "hello",
    });
  });

  it("无效格式抛错", () => {
    expect(() => parseKeyValues(["notvalid"])).toThrow(/key=value/);
    expect(() => parseKeyValues([])).toThrow(/至少需要一个/);
  });
});

describe("credential CLI", () => {
  const logs: string[] = [];
  let logSpy: ReturnType<typeof spyOn<typeof console, "log">>;

  beforeEach(() => {
    logs.length = 0;
    logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("list 无凭证时输出占位", async () => {
    await runCredential(["list"], mockDeps());
    expect(logs).toEqual(["(无凭证)"]);
  });

  it("list 有凭证时输出表格", async () => {
    await runCredential(["list"], mockDeps({ listCredentials: () => [sampleMeta] }));
    const out = logs.join("\n");
    expect(out).toContain("services/discord");
    expect(out).toContain("Path");
    expect(out).toContain("token");
  });

  it("get 输出字段值", async () => {
    await runCredential(
      ["get", "services/discord", "token"],
      mockDeps({
        credential: (path, field) => {
          expect(path).toBe("services/discord");
          expect(field).toBe("token");
          return "my-token";
        },
      }),
    );
    expect(logs).toEqual(["my-token"]);
  });

  it("get 失败时 exit 1", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as typeof process.exit);
    await expect(
      runCredential(
        ["get", "missing", "token"],
        mockDeps({
          credential: () => {
            throw new Error("not found");
          },
        }),
      ),
    ).rejects.toThrow("exit:1");
    exitSpy.mockRestore();
  });

  it("add 调用 insertCredential 并输出成功", async () => {
    const inserted: Array<{ path: string; data: Record<string, string> }> = [];
    await runCredential(
      ["add", "services/new", "token=xyz", "desc=test"],
      mockDeps({
        insertCredential: (path, data) => {
          inserted.push({ path, data });
          return "written";
        },
      }),
    );
    expect(inserted[0]).toEqual({
      path: "services/new",
      data: { token: "xyz", desc: "test" },
    });
    expect(logs.some((l) => l.includes("已写入 services/new"))).toBe(true);
  });
});

describe("renderTable", () => {
  it("truncates long cells", () => {
    const table = renderTable([["x".repeat(60)]], ["Path"]);
    expect(table).toContain("…");
  });
});

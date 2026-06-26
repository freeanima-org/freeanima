import { describe, expect, it } from "bun:test";

import { ToolSetRegistry } from "./toolset.ts";
import { expandToolNames } from "./expand.ts";

const sampleTool = {
  name: "read_file",
  description: "Read",
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
};

describe("expandToolNames", () => {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("local", "Local", [
    { ...sampleTool, name: "read_file" },
    { ...sampleTool, name: "write_file" },
  ]);

  it("expands @toolset refs to tool names", () => {
    expect(expandToolNames(registry, ["@local", "standalone"])).toEqual([
      "read_file",
      "write_file",
      "standalone",
    ]);
  });

  it("keeps unknown refs by default and invokes callback", () => {
    const unknown: string[] = [];
    const out = expandToolNames(registry, ["@missing"], {
      onUnknownToolSet: (name) => unknown.push(name),
    });
    expect(out).toEqual(["@missing"]);
    expect(unknown).toEqual(["missing"]);
  });

  it("drops unknown refs when keepUnknownRefs is false", () => {
    expect(expandToolNames(registry, ["@missing"], { keepUnknownRefs: false })).toEqual([]);
  });

  it("skips blank items", () => {
    expect(expandToolNames(registry, ["  ", "@local"])).toEqual(["read_file", "write_file"]);
  });
});

import { describe, expect, it } from "bun:test";
import { groupToolSetsByVisibility, sortToolSets, visibilityLabel } from "./tools.tsx";

describe("tools page visibility helpers", () => {
  it("sortToolSets keeps static order then name", () => {
    const sorted = sortToolSets([
      {
        name: "web",
        description: "",
        tools: [],
        visibility: "catalog",
        visibility_source: "registered",
      },
      {
        name: "toolset",
        description: "",
        tools: [],
        visibility: "catalog",
        visibility_source: "registered",
      },
      {
        name: "memory",
        description: "",
        tools: [],
        visibility: "catalog",
        visibility_source: "registered",
      },
    ]);
    expect(sorted.map((t) => t.name)).toEqual(["toolset", "memory", "web"]);
  });

  it("groupToolSetsByVisibility orders catalog → searchable → hidden", () => {
    const groups = groupToolSetsByVisibility([
      {
        name: "ops",
        description: "",
        tools: [],
        visibility: "searchable",
        visibility_source: "registered",
      },
      {
        name: "file",
        description: "",
        tools: [],
        visibility: "catalog",
        visibility_source: "registered",
      },
      {
        name: "secret",
        description: "",
        tools: [],
        visibility: "hidden",
        visibility_source: "override",
      },
    ]);
    expect(groups.map((g) => g.visibility)).toEqual(["catalog", "searchable", "hidden"]);
    expect(groups[0]?.toolsets.map((t) => t.name)).toEqual(["file"]);
    expect(visibilityLabel("catalog")).toBe("进目录");
  });
});

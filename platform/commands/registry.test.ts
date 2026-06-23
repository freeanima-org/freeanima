import { describe, expect, it } from "bun:test";
import {
  commandAvailableForPlatform,
  platformMatchesCommandPattern,
  type CommandDef,
} from "./registry.ts";

describe("platformMatchesCommandPattern", () => {
  it("matches exact platform strings", () => {
    expect(platformMatchesCommandPattern("discord", "discord")).toBe(true);
    expect(platformMatchesCommandPattern("discord", "weixin")).toBe(false);
  });

  it("matches sap:parlor:* against any parlor instance", () => {
    expect(platformMatchesCommandPattern("sap:parlor:web", "sap:parlor:*")).toBe(true);
    expect(platformMatchesCommandPattern("sap:parlor:k7m", "sap:parlor:*")).toBe(true);
    expect(platformMatchesCommandPattern("sap:companion:web", "sap:parlor:*")).toBe(false);
  });

  it("supports lone * as match-all", () => {
    expect(platformMatchesCommandPattern("anything", "*")).toBe(true);
  });
});

describe("commandAvailableForPlatform", () => {
  const cmd: CommandDef = {
    name: "mask",
    description: "mask",
    handler: () => "",
    platforms: ["sap:parlor:*"],
  };

  it("accepts parlor SAP instances via glob", () => {
    expect(commandAvailableForPlatform(cmd, "sap:parlor:web")).toBe(true);
    expect(commandAvailableForPlatform(cmd, "sap:parlor:custom")).toBe(true);
    expect(commandAvailableForPlatform(cmd, "discord")).toBe(false);
  });
});

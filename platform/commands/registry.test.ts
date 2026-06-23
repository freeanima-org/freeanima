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

  it("matches sap:chat:* against any chat instance", () => {
    expect(platformMatchesCommandPattern("sap:chat:web", "sap:chat:*")).toBe(true);
    expect(platformMatchesCommandPattern("sap:chat:k7m", "sap:chat:*")).toBe(true);
    expect(platformMatchesCommandPattern("sap:companion:web", "sap:chat:*")).toBe(false);
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
    platforms: ["sap:chat:*"],
  };

  it("accepts chat SAP instances via glob", () => {
    expect(commandAvailableForPlatform(cmd, "sap:chat:web")).toBe(true);
    expect(commandAvailableForPlatform(cmd, "sap:chat:custom")).toBe(true);
    expect(commandAvailableForPlatform(cmd, "discord")).toBe(false);
  });
});

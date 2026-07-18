import { describe, expect, it } from "bun:test";
import {
  commandAvailableForPlatform,
  commandNeedsMessageDelivery,
  commandNeedsPreAck,
  ensureCommandResultText,
  formatCommandPreAck,
  formatCommandStreamPreAck,
  getCommand,
  platformMatchesCommandPattern,
  registerCommand,
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

describe("command response ack helpers", () => {
  const retryCmd: CommandDef = {
    name: "retry",
    description: "retry",
    handler: () => "",
  };
  const helpCmd: CommandDef = {
    name: "help",
    description: "help",
    handler: () => "",
  };
  const compressCmd: CommandDef = {
    name: "compress",
    description: "compress",
    handler: () => "",
  };
  const maskCmd: CommandDef = {
    name: "mask",
    description: "mask",
    handler: () => "",
  };

  it("commandNeedsPreAck marks slow sync commands", () => {
    expect(commandNeedsPreAck(compressCmd, [])).toBe(true);
    expect(commandNeedsPreAck(maskCmd, ["set", "coding"])).toBe(true);
    expect(commandNeedsPreAck(helpCmd, [])).toBe(false);
  });

  it("formatCommandPreAck returns Chinese pending text", () => {
    expect(formatCommandPreAck(compressCmd, [], "/compress")).toContain("压缩");
  });

  it("formatCommandStreamPreAck covers retry", () => {
    expect(formatCommandStreamPreAck(retryCmd)).toContain("重新生成");
  });

  it("ensureCommandResultText fills empty output", () => {
    expect(ensureCommandResultText("", helpCmd)).toBe("✅ /help 已完成");
    expect(ensureCommandResultText("ok", helpCmd)).toBe("ok");
  });
});

describe("commandNeedsMessageDelivery", () => {
  const retryCmd: CommandDef = { name: "retry", description: "retry", handler: () => "" };
  const goalCmd: CommandDef = { name: "goal", description: "goal", handler: () => "" };
  const helpCmd: CommandDef = { name: "help", description: "help", handler: () => "" };

  it("routes retry and goal start to message delivery", () => {
    expect(commandNeedsMessageDelivery(retryCmd, [])).toBe(true);
    expect(commandNeedsMessageDelivery(goalCmd, ["ship", "it"])).toBe(true);
  });

  it("keeps goal status/pause and help on terminal rpc", () => {
    expect(commandNeedsMessageDelivery(goalCmd, ["status"])).toBe(false);
    expect(commandNeedsMessageDelivery(goalCmd, ["pause"])).toBe(false);
    expect(commandNeedsMessageDelivery(goalCmd, [])).toBe(false);
    expect(commandNeedsMessageDelivery(helpCmd, [])).toBe(false);
  });
});

describe("CommandDef.subcommands", () => {
  it("stores discrete subcommands on registerCommand", () => {
    registerCommand({
      name: "__test_with_subs",
      description: "test",
      handler: () => "",
      hidden: true,
      subcommands: [
        { name: "status", description: "View status" },
        { name: "clear", description: "Clear" },
      ],
    });
    expect(getCommand("__test_with_subs")?.subcommands?.map((s) => s.name)).toEqual([
      "status",
      "clear",
    ]);
  });
});

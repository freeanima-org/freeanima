import { describe, it, expect } from "bun:test";
import { buildDiscordSlashCommands, interactionToCommandText } from "@freeanima/connectors-gateway";

describe("discord slash commands", () => {
  it("buildDiscordSlashCommands includes cwd options", () => {
    const body = buildDiscordSlashCommands([
      { name: "help", description: "List all available commands" },
      { name: "cwd", description: "View or set current session working directory" },
    ]);
    const cwd = body.find((c) => c.name === "cwd");
    expect(cwd?.options?.some((o) => o.name === "path")).toBe(true);
  });

  it("interactionToCommandText maps options", () => {
    const interaction = {
      commandName: "cwd",
      options: {
        getString: (name: string) => (name === "path" ? "/tmp/work" : null),
        getBoolean: () => null,
      },
    } as unknown as Parameters<typeof interactionToCommandText>[0];

    expect(interactionToCommandText(interaction)).toBe("/cwd /tmp/work");
  });

  it("interactionToCommandText maps stats --all", () => {
    const interaction = {
      commandName: "stats",
      options: {
        getString: () => null,
        getBoolean: (name: string) => (name === "all" ? true : null),
      },
    } as unknown as Parameters<typeof interactionToCommandText>[0];

    expect(interactionToCommandText(interaction)).toBe("/stats --all");
  });
});

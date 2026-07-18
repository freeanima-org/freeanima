import { describe, expect, test } from "bun:test";
import { buildSlashMenuEntries, type SlashCommandItem } from "./slash-command-menu.ts";

const commands: SlashCommandItem[] = [
  { name: "help", description: "List commands" },
  {
    name: "goal",
    description: "Manage goal",
    subcommands: [
      { name: "status", description: "View status" },
      { name: "pause", description: "Pause" },
      { name: "resume", description: "Resume" },
      { name: "clear", description: "Clear" },
    ],
  },
  {
    name: "mask",
    description: "Capability mask",
    subcommands: [
      { name: "set", description: "Set preset" },
      { name: "clear", description: "Clear mask" },
      { name: "show", description: "Show mask" },
    ],
  },
];

describe("buildSlashMenuEntries", () => {
  test("filters top-level commands by prefix", () => {
    const rows = buildSlashMenuEntries("/go", commands);
    expect(rows.map((r) => r.label)).toEqual(["/goal"]);
    expect(rows[0]?.insertText).toBe("/goal ");
  });

  test("lists all subcommands after command + space", () => {
    const rows = buildSlashMenuEntries("/goal ", commands);
    expect(rows.map((r) => r.label)).toEqual([
      "/goal status",
      "/goal pause",
      "/goal resume",
      "/goal clear",
    ]);
    expect(rows[0]?.insertText).toBe("/goal status ");
  });

  test("filters subcommands by second-token prefix", () => {
    const rows = buildSlashMenuEntries("/mask se", commands);
    expect(rows.map((r) => r.label)).toEqual(["/mask set"]);
  });

  test("closes menu for commands without subcommands after space", () => {
    expect(buildSlashMenuEntries("/help ", commands)).toEqual([]);
  });

  test("closes menu once a third token is started", () => {
    expect(buildSlashMenuEntries("/goal status ", commands)).toEqual([]);
    expect(
      buildSlashMenuEntries("/subgoal remove 1", [
        {
          name: "subgoal",
          subcommands: [{ name: "remove", description: "Remove N" }],
        },
      ]),
    ).toEqual([]);
  });

  test("ignores non-slash input", () => {
    expect(buildSlashMenuEntries("hello", commands)).toEqual([]);
  });
});

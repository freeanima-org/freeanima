import { describe, it, expect, vi } from "bun:test";
import {
  buildDiscordSlashCommands,
  ensureSlashInteractionDeferred,
  interactionToCommandText,
  streamReplyToInteraction,
} from "@freeanima/platform/connectors/gateway";
import type { StreamEvent } from "@freeanima/runtime/loop";

describe("discord slash commands", () => {
  it("buildDiscordSlashCommands includes cwd options", () => {
    const body = buildDiscordSlashCommands([
      { name: "help", description: "List all available commands" },
      { name: "cwd", description: "View or set current conversation working directory" },
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

  it("ensureSlashInteractionDeferred skips duplicate ack", async () => {
    const deferReply = vi.fn(async () => {
      throw { code: 40060, message: "Interaction has already been acknowledged." };
    });
    const interaction = {
      deferred: false,
      replied: false,
      deferReply,
    } as unknown as Parameters<typeof ensureSlashInteractionDeferred>[0];

    await expect(ensureSlashInteractionDeferred(interaction)).resolves.toBe(false);
    expect(deferReply).toHaveBeenCalledTimes(1);
  });

  it("ensureSlashInteractionDeferred continues when local state shows deferred", async () => {
    const deferReply = vi.fn(async () => {
      throw { code: 40060, message: "Interaction has already been acknowledged." };
    });
    const interaction = {
      get deferred() {
        return true;
      },
      replied: false,
      deferReply,
    } as unknown as Parameters<typeof ensureSlashInteractionDeferred>[0];

    await expect(ensureSlashInteractionDeferred(interaction)).resolves.toBe(true);
    expect(deferReply).not.toHaveBeenCalled();
  });

  it("streamReplyToInteraction delivers empty stream as no output", async () => {
    const editReply = vi.fn(async () => undefined);
    const followUp = vi.fn(async () => undefined);
    const interaction = {
      deferred: true,
      replied: false,
      editReply,
      followUp,
    } as unknown as Parameters<typeof streamReplyToInteraction>[0];

    async function* events(): AsyncGenerator<StreamEvent> {
      yield { event: "done", data: {} };
    }

    await streamReplyToInteraction(interaction, events());
    expect(editReply).toHaveBeenCalled();
  });
});

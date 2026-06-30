import { describe, expect, it } from "bun:test";
import type { StoredMessage } from "@freeanima/core/db/domain";
import {
  FRIDGE_CONTEXT_ASSISTANT_NAME,
  FRIDGE_MAGNET_BOARD_FRAME,
  FRIDGE_MAGNET_BOARD_HEADING,
  formatFridgeMagnets,
  wrapFridgeMagnetBoard,
  formatFridgeMagnetManifestPreview,
  stripFridgeContextFromMessages,
  manifestFridgeMagnetBoard,
  isFridgeContextAssistant,
} from "./inject.ts";
import type { FridgeMagnet } from "./types.ts";

const sampleMagnets: FridgeMagnet[] = [
  { key: "user_mood", value: "Sunny" },
  { key: "task", value: "Write tests" },
];

describe("formatFridgeMagnets", () => {
  it("formats as fridge-magnet code block", () => {
    expect(formatFridgeMagnets(sampleMagnets)).toBe(
      "```fridge-magnet\nuser_mood: Sunny\ntask: Write tests\n```\n",
    );
  });

  it("empty list returns empty string", () => {
    expect(formatFridgeMagnets([])).toBe("");
  });

  it("filters magnets with empty values", () => {
    expect(formatFridgeMagnets([{ key: "a", value: "  " }])).toBe("");
  });
});

describe("wrapFridgeMagnetBoard", () => {
  it("includes frame, heading, and fence", () => {
    const wrapped = wrapFridgeMagnetBoard(sampleMagnets);
    expect(wrapped).toContain(FRIDGE_MAGNET_BOARD_FRAME);
    expect(wrapped).toContain(FRIDGE_MAGNET_BOARD_HEADING);
    expect(wrapped).toContain("```fridge-magnet");
    expect(wrapped).toContain("user_mood: Sunny");
  });

  it("returns empty when magnets are empty", () => {
    expect(wrapFridgeMagnetBoard([])).toBe("");
  });
});

describe("formatFridgeMagnetManifestPreview", () => {
  it("includes role, name, and board content", () => {
    const preview = formatFridgeMagnetManifestPreview(sampleMagnets);
    expect(preview).toContain("role: assistant");
    expect(preview).toContain(`name: ${FRIDGE_CONTEXT_ASSISTANT_NAME}`);
    expect(preview).toContain(FRIDGE_MAGNET_BOARD_FRAME);
  });

  it("returns empty when board is empty", () => {
    expect(formatFridgeMagnetManifestPreview([])).toBe("");
  });
});

describe("isFridgeContextAssistant", () => {
  it("matches assistant with fridge_context name", () => {
    expect(
      isFridgeContextAssistant({
        role: "assistant",
        name: FRIDGE_CONTEXT_ASSISTANT_NAME,
        content: "note",
      }),
    ).toBe(true);
  });

  it("rejects unnamed assistant", () => {
    expect(isFridgeContextAssistant({ role: "assistant", content: "note" })).toBe(false);
  });
});

describe("manifestFridgeMagnetBoard", () => {
  it("inserts fridge_context assistant before last user message", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Second message" },
    ];
    manifestFridgeMagnetBoard(messages, [{ key: "note", value: "Note" }]);
    expect(messages).toHaveLength(4);
    expect(messages[2]).toMatchObject({
      role: "assistant",
      name: FRIDGE_CONTEXT_ASSISTANT_NAME,
    });
    const board = messages[2];
    expect(board?.role === "assistant" && board.content).toContain("note: Note");
    expect(messages[3]).toMatchObject({ role: "user", content: "Second message" });
  });

  it("does not manifest when last message is not user", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Reply" },
    ];
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    expect(messages).toHaveLength(2);
  });

  it("does not manifest when magnets are empty", () => {
    const messages: StoredMessage[] = [{ role: "user", content: "Hello" }];
    manifestFridgeMagnetBoard(messages, []);
    expect(messages).toHaveLength(1);
  });
});

describe("stripFridgeContextFromMessages", () => {
  it("removes fridge_context assistant messages", () => {
    const messages: StoredMessage[] = [
      {
        role: "assistant",
        name: FRIDGE_CONTEXT_ASSISTANT_NAME,
        content: "board",
      },
      { role: "user", content: "Hello" },
    ];
    stripFridgeContextFromMessages(messages);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe("user");
  });

  it("preserves other assistant messages", () => {
    const messages: StoredMessage[] = [
      { role: "assistant", content: "Reply" },
      {
        role: "assistant",
        name: FRIDGE_CONTEXT_ASSISTANT_NAME,
        content: "board",
      },
      { role: "user", content: "Hello" },
    ];
    stripFridgeContextFromMessages(messages);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "assistant", content: "Reply" });
  });
});

describe("manifest idempotency via strip + remanifest", () => {
  it("leaves exactly one fridge_context assistant after two rounds", () => {
    const messages: StoredMessage[] = [{ role: "user", content: "Hello" }];
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    stripFridgeContextFromMessages(messages);
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    const manifests = messages.filter((m) => isFridgeContextAssistant(m));
    expect(manifests).toHaveLength(1);
  });
});

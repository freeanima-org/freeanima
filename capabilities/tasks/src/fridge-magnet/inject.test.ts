import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@freeanima/core/db/domain";
import {
  FRIDGE_CONTEXT_ASSISTANT_NAME,
  FRIDGE_MAGNET_BOARD_FRAME,
  FRIDGE_MAGNET_BOARD_HEADING,
  formatFridgeMagnets,
  wrapFridgeMagnetBoard,
  formatFridgeMagnetManifestPreview,
  stripFridgeMagnets,
  stripFridgeContextFromMessages,
  stripLegacyUserFridgeBlocks,
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

describe("stripFridgeMagnets", () => {
  it("strips leading fridge-magnet block", () => {
    const content = "```fridge-magnet\nuser_mood: Sunny\n```\nHello";
    expect(stripFridgeMagnets(content)).toBe("Hello");
  });

  it("strips legacy fridge block", () => {
    const content = "```fridge\nuser_mood: Sunny\n```\nHello";
    expect(stripFridgeMagnets(content)).toBe("Hello");
  });

  it("returns unchanged when no fridge magnet block", () => {
    expect(stripFridgeMagnets("Plain text")).toBe("Plain text");
  });

  it("idempotent: repeated strip yields same result", () => {
    const once = stripFridgeMagnets("```fridge-magnet\na: 1\n```\nContent");
    expect(stripFridgeMagnets(once)).toBe(once);
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
    const messages: SessionMessage[] = [
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
    expect(messages[2]!.role === "assistant" && messages[2].content).toContain("note: Note");
    expect(messages[3]).toMatchObject({ role: "user", content: "Second message" });
  });

  it("does not manifest when last message is not user", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Reply" },
    ];
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    expect(messages).toHaveLength(2);
  });

  it("does not manifest when magnets are empty", () => {
    const messages: SessionMessage[] = [{ role: "user", content: "Hello" }];
    manifestFridgeMagnetBoard(messages, []);
    expect(messages).toHaveLength(1);
  });
});

describe("stripFridgeContextFromMessages", () => {
  it("removes fridge_context assistant messages", () => {
    const messages: SessionMessage[] = [
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
    const messages: SessionMessage[] = [
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

describe("stripLegacyUserFridgeBlocks", () => {
  it("strips fridge magnet blocks from all user messages", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "```fridge-magnet\na: 1\n```\nFirst message" },
      { role: "assistant", content: "```fridge-magnet\nb: 2\n```\nReply" },
      { role: "user", content: "```fridge\nc: 3\n```\nSecond message" },
    ];
    stripLegacyUserFridgeBlocks(messages);
    expect(messages[0]!.content).toBe("First message");
    expect(messages[1]!.content).toBe("```fridge-magnet\nb: 2\n```\nReply");
    expect(messages[2]!.content).toBe("Second message");
  });
});

describe("manifest idempotency via strip + remanifest", () => {
  it("leaves exactly one fridge_context assistant after two rounds", () => {
    const messages: SessionMessage[] = [{ role: "user", content: "Hello" }];
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    stripFridgeContextFromMessages(messages);
    manifestFridgeMagnetBoard(messages, sampleMagnets);
    const manifests = messages.filter((m) => isFridgeContextAssistant(m));
    expect(manifests).toHaveLength(1);
  });
});

import { describe, expect, it } from "bun:test";
import {
  formatFridgeMagnets,
  injectFridgeMagnets,
  stripFridgeMagnets,
  injectIntoMessages,
  stripAllFromMessages,
} from "./inject.ts";
import type { FridgeMagnet } from "./types.ts";

const sampleMagnets: FridgeMagnet[] = [
  { key: "user_mood", value: "Sunny" },
  { key: "task", value: "Write tests" },
];

describe("formatFridgeMagnets", () => {
  it("formats as fridge code block", () => {
    expect(formatFridgeMagnets(sampleMagnets)).toBe(
      "```fridge\nuser_mood: Sunny\ntask: Write tests\n```\n",
    );
  });

  it("empty list produces empty code block", () => {
    expect(formatFridgeMagnets([])).toBe("```fridge\n\n```\n");
  });
});

describe("injectFridgeMagnets", () => {
  it("injects fridge magnet block before content", () => {
    const result = injectFridgeMagnets("Hello", sampleMagnets);
    expect(result).toBe("```fridge\nuser_mood: Sunny\ntask: Write tests\n```\nHello");
  });
});

describe("stripFridgeMagnets", () => {
  it("strips leading fridge magnet block", () => {
    const content = "```fridge\nuser_mood: Sunny\n```\nHello";
    expect(stripFridgeMagnets(content)).toBe("Hello");
  });

  it("returns unchanged when no fridge magnet block", () => {
    expect(stripFridgeMagnets("Plain text")).toBe("Plain text");
  });

  it("idempotent: repeated strip yields same result", () => {
    const once = stripFridgeMagnets("```fridge\na: 1\n```\nContent");
    expect(stripFridgeMagnets(once)).toBe(once);
  });
});

import type { SessionMessage } from "@freeanima/engine-db/domain";

describe("injectIntoMessages", () => {
  it("injects into last user message", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Second message" },
    ];
    injectIntoMessages(messages, [{ key: "note", value: "Note" }]);
    expect(messages[0]!.content).toBe("First message");
    expect(messages[2]!.content).toBe("```fridge\nnote: Note\n```\nSecond message");
  });

  it("does not modify when no user messages", () => {
    const messages: SessionMessage[] = [{ role: "assistant", content: "Assistant only" }];
    injectIntoMessages(messages, sampleMagnets);
    expect(messages[0]!.content).toBe("Assistant only");
  });
});

describe("stripAllFromMessages", () => {
  it("strips fridge magnet blocks from all user messages", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "```fridge\na: 1\n```\nFirst message" },
      { role: "assistant", content: "```fridge\nb: 2\n```\nReply" },
      { role: "user", content: "```fridge\nc: 3\n```\nSecond message" },
    ];
    stripAllFromMessages(messages);
    expect(messages[0]!.content).toBe("First message");
    expect(messages[1]!.content).toBe("```fridge\nb: 2\n```\nReply");
    expect(messages[2]!.content).toBe("Second message");
  });

  it("skips when content is null", () => {
    const messages: SessionMessage[] = [{ role: "user", content: "" }];
    stripAllFromMessages(messages);
    expect(messages[0]!.content).toBe("");
  });
});

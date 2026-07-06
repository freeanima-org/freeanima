import { describe, expect, it } from "bun:test";

import { randomUuid } from "./random-uuid.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("randomUuid", () => {
  it("returns RFC 4122 v4 shape", () => {
    expect(randomUuid()).toMatch(UUID_RE);
  });

  it("falls back when randomUUID is missing", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(bytes: Uint8Array): Uint8Array {
          for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 17 + 3) % 256;
          return bytes;
        },
      },
    });
    try {
      expect(randomUuid()).toMatch(UUID_RE);
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
    }
  });
});

import { describe, expect, it } from "bun:test";

import { pgUnavailable, pgUnavailableStore } from "./null-helpers.ts";

describe("null-helpers", () => {
  it("pgUnavailable throws default message", () => {
    expect(() => pgUnavailable()).toThrow("database.url not configured");
  });

  it("pgUnavailable accepts custom message", () => {
    expect(() => pgUnavailable("custom")).toThrow("custom");
  });

  it("pgUnavailableStore includes store name", () => {
    expect(() => pgUnavailableStore("conversation")).toThrow(
      "conversation not configured (PostgreSQL unavailable)",
    );
  });
});

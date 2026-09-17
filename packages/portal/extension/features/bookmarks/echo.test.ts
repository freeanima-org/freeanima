import { describe, expect, test } from "bun:test";

import { markBookmarkEcho, shouldSuppressBookmarkEcho } from "./echo.ts";

describe("bookmark echo suppress", () => {
  test("marks and suppresses recent browser_id", () => {
    markBookmarkEcho("42");
    expect(shouldSuppressBookmarkEcho("42")).toBe(true);
    expect(shouldSuppressBookmarkEcho("99")).toBe(false);
  });
});

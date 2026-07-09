import { describe, expect, test } from "bun:test";

import { readHubConfigRecord } from "./hub-config-field-helpers.tsx";

describe("readHubConfigRecord", () => {
  test("returns empty object for null or undefined", () => {
    expect(readHubConfigRecord(null)).toEqual({});
    expect(readHubConfigRecord(undefined)).toEqual({});
  });

  test("skips non-object entries", () => {
    expect(
      readHubConfigRecord({
        good: { a: 1 },
        bad: null,
        list: [1],
      }),
    ).toEqual({ good: { a: 1 } });
  });
});

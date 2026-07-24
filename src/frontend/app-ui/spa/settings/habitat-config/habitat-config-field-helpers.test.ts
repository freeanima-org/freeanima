import { describe, expect, test } from "bun:test";

import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";

describe("readHabitatConfigRecord", () => {
  test("returns empty object for null or undefined", () => {
    expect(readHabitatConfigRecord(null)).toEqual({});
    expect(readHabitatConfigRecord(undefined)).toEqual({});
  });

  test("skips non-object entries", () => {
    expect(
      readHabitatConfigRecord({
        good: { a: 1 },
        bad: null,
        list: [1],
      }),
    ).toEqual({ good: { a: 1 } });
  });
});

import { describe, it, expect } from "bun:test";
import { keyValueTextToRecord, recordToKeyValueText } from "./mcp-key-value.ts";

describe("mcp-key-value", () => {
  it("round-trips KEY=VALUE lines", () => {
    const text = "Authorization=Bearer tok\nX-Foo=bar";
    expect(keyValueTextToRecord(text)).toEqual({
      Authorization: "Bearer tok",
      "X-Foo": "bar",
    });
    expect(recordToKeyValueText(keyValueTextToRecord(text))).toBe(text);
  });

  it("returns undefined for incomplete lines without equals", () => {
    expect(keyValueTextToRecord("Authorization")).toBeUndefined();
    expect(keyValueTextToRecord("Auth\n")).toBeUndefined();
  });

  it("keeps completed lines while ignoring incomplete ones", () => {
    expect(keyValueTextToRecord("Authorization=Bearer x\nIncomplete")).toEqual({
      Authorization: "Bearer x",
    });
  });
});

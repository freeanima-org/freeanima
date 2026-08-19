import { describe, expect, it } from "bun:test";

import { randomPublicId } from "./random-public-id.ts";

const ALNUM = /^[0-9A-Za-z]+$/;

describe("randomPublicId", () => {
  it("returns alphanumeric id of default length", () => {
    const id = randomPublicId();
    expect(id).toMatch(ALNUM);
    expect(id.includes("-")).toBe(false);
    expect(id.includes("_")).toBe(false);
    expect(id.length).toBe(21);
  });

  it("respects custom size", () => {
    const id = randomPublicId(8);
    expect(id.length).toBe(8);
    expect(id).toMatch(ALNUM);
  });

  it("produces distinct values", () => {
    const a = randomPublicId();
    const b = randomPublicId();
    expect(a).not.toBe(b);
  });
});

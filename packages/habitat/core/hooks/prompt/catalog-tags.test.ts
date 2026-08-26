import { describe, expect, it } from "bun:test";

import { entityMatchesScenarioCatalog } from "./catalog-tags.ts";

describe("entityMatchesScenarioCatalog", () => {
  const codingId = 42;

  it("coding_agent requires coding tag", () => {
    expect(entityMatchesScenarioCatalog([], codingId, "coding_agent")).toBe(false);
    expect(entityMatchesScenarioCatalog([99], codingId, "coding_agent")).toBe(false);
    expect(entityMatchesScenarioCatalog([codingId], codingId, "coding_agent")).toBe(true);
    expect(entityMatchesScenarioCatalog([codingId, 99], codingId, "coding_agent")).toBe(true);
  });

  it("digital_human hides coding-only entries", () => {
    expect(entityMatchesScenarioCatalog([], codingId, "digital_human")).toBe(true);
    expect(entityMatchesScenarioCatalog([codingId], codingId, "digital_human")).toBe(false);
    expect(entityMatchesScenarioCatalog([codingId, 99], codingId, "digital_human")).toBe(true);
  });

  it("null coding tag id: chat shows all; coding shows none", () => {
    expect(entityMatchesScenarioCatalog([99], null, "digital_human")).toBe(true);
    expect(entityMatchesScenarioCatalog([], null, "coding_agent")).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  dreamGetInputSchema,
  dreamListInputSchema,
} from "@freeanima/shared/sap-contract";

describe("dream Hub RPC procedures", () => {
  it("registers dream.* methods", () => {
    expect(SAP_METHODS).toContain("dream.list");
    expect(SAP_METHODS).toContain("dream.get");
  });

  it("validates dream procedure inputs", () => {
    dreamListInputSchema.parse({ offset: 0, limit: 20 });
    dreamGetInputSchema.parse({ day: "2026-06-14" });
  });
});

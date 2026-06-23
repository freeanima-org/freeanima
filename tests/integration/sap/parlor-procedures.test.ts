import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  fridgeListInputSchema,
  sessionAcpDockInputSchema,
  sessionCommandsInputSchema,
} from "@freeanima/sap-contract";
import { TEST_SAP_PARLOR_PLATFORM } from "../../helpers/sap-parlor-test-platform.ts";

describe("parlor SAP procedures", () => {
  it("registers session.acpDock, session.commands, fridge.list", () => {
    expect(SAP_METHODS).toContain("session.acpDock");
    expect(SAP_METHODS).toContain("session.commands");
    expect(SAP_METHODS).toContain("fridge.list");
  });

  it("validates parlor procedure inputs", () => {
    sessionAcpDockInputSchema.parse({ session_id: "20260101_120000_abc" });
    sessionCommandsInputSchema.parse({ platform: TEST_SAP_PARLOR_PLATFORM, all: false });
    fridgeListInputSchema.parse({});
  });
});

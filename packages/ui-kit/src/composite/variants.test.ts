import { describe, expect, it } from "bun:test";

import { confirmButtonVariant, statusAlertVariant } from "./variants.ts";

describe("composite variants", () => {
  it("confirmButtonVariant maps variant to shadcn button variants", () => {
    expect(confirmButtonVariant("primary")).toBe("default");
    expect(confirmButtonVariant("error")).toBe("destructive");
  });

  it("statusAlertVariant maps variant to shadcn alert variants", () => {
    expect(statusAlertVariant("info")).toBe("info");
    expect(statusAlertVariant("error")).toBe("error");
  });
});

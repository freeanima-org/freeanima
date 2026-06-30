import { describe, expect, it } from "bun:test";

import { confirmButtonClass, statusAlertClass } from "./variants.ts";

describe("composite variants", () => {
  it("confirmButtonClass maps variant to daisyUI btn classes", () => {
    expect(confirmButtonClass("primary")).toBe("btn btn-primary btn-sm");
    expect(confirmButtonClass("error")).toBe("btn btn-error btn-sm");
  });

  it("statusAlertClass maps variant to daisyUI alert classes", () => {
    expect(statusAlertClass("info")).toBe("alert alert-info text-sm");
    expect(statusAlertClass("error")).toBe("alert alert-error text-sm");
  });
});

import { describe, expect, it } from "bun:test";

import { resolveAdminSubpath } from "./admin-subpath.ts";

describe("resolveAdminSubpath", () => {
  it("maps dashboard shell path", () => {
    expect(resolveAdminSubpath("/admin/dashboard")).toBe("/dashboard");
  });

  it("maps nested admin routes", () => {
    expect(resolveAdminSubpath("/admin/credentials")).toBe("/credentials");
  });

  it("defaults bare /admin to dashboard", () => {
    expect(resolveAdminSubpath("/admin")).toBe("/dashboard");
    expect(resolveAdminSubpath("/admin/")).toBe("/dashboard");
  });

  it("defaults non-admin paths to dashboard", () => {
    expect(resolveAdminSubpath("/tasks")).toBe("/dashboard");
    expect(resolveAdminSubpath("/chat")).toBe("/dashboard");
  });
});

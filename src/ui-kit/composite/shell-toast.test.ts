import { describe, expect, it } from "bun:test";

import { buildShellToastSonnerOptions } from "./shell-toast.ts";

describe("buildShellToastSonnerOptions", () => {
  it("always includes action/cancel keys so Sonner clears prior buttons", () => {
    const opts = buildShellToastSonnerOptions({
      duration: Number.POSITIVE_INFINITY,
      dismissible: false,
    });
    expect(Object.hasOwn(opts, "action")).toBe(true);
    expect(opts.action).toBeUndefined();
    expect(Object.hasOwn(opts, "cancel")).toBe(true);
    expect(opts.cancel).toBeUndefined();
    expect(opts.dismissible).toBe(false);
    expect(opts.duration).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps action when provided", () => {
    const onClick = () => {};
    const opts = buildShellToastSonnerOptions({
      action: { label: "立即更新", onClick },
    });
    expect(opts.action?.label).toBe("立即更新");
  });
});

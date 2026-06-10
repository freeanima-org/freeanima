import { describe, expect, it } from "bun:test";
import { createServiceKernel } from "./kernel.ts";

describe("service-bootstrap kernel", () => {
  it("createServiceKernel returns HookRegistry and EventBus", () => {
    const kernel = createServiceKernel();
    expect(kernel.hookRegistry).toBeDefined();
    expect(kernel.eventBus).toBeDefined();
    expect(kernel.logger.info).toBeFunction();
  });
});

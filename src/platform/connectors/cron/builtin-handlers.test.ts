import { afterEach, describe, expect, it } from "bun:test";
import {
  registerCronBuiltinHandler,
  resetCronBuiltinHandlersForTests,
  runCronBuiltinHandler,
  unregisterCronBuiltinHandler,
} from "./builtin-handlers.ts";

describe("cron builtin handlers", () => {
  afterEach(() => {
    resetCronBuiltinHandlersForTests();
  });

  it("runs registered handler by job id", async () => {
    registerCronBuiltinHandler("builtin-env-health", async () =>
      JSON.stringify({ ok: true, action: "quiet" }),
    );
    expect(await runCronBuiltinHandler("builtin-env-health")).toBe(
      JSON.stringify({ ok: true, action: "quiet" }),
    );
  });

  it("returns null when handler missing", async () => {
    expect(await runCronBuiltinHandler("builtin-env-health")).toBeNull();
  });

  it("unregister removes handler", async () => {
    registerCronBuiltinHandler("builtin-env-health", async () => "x");
    unregisterCronBuiltinHandler("builtin-env-health");
    expect(await runCronBuiltinHandler("builtin-env-health")).toBeNull();
  });
});

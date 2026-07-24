import { describe, expect, expectTypeOf, it } from "bun:test";
import {
  blockedMessageFromChain,
  createHook,
  headOkStepData,
  Hook,
  type HookHandler,
  type HookStepLink,
  type PayloadOf,
  walkHookChain,
  walkHookChainOldestFirst,
} from "./hook.ts";

function link(step: Omit<HookStepLink, "prev">, prev?: HookStepLink): HookStepLink {
  return prev ? { ...step, prev } : { ...step };
}

describe("createHook", () => {
  it("sets qualifiedId and description", () => {
    const hook = createHook("@freeanima/kernel-hooks/test/id", "Display label");
    expect(hook.qualifiedId).toBe("@freeanima/kernel-hooks/test/id");
    expect(hook.description).toBe("Display label");
    expect(hook.id.description).toBe("@freeanima/kernel-hooks/test/id");
  });

  it("description undefined when omitted", () => {
    const hook = createHook("@freeanima/kernel-hooks/test/no-desc");
    expect(hook.description).toBeUndefined();
  });

  it("each create produces independent Symbol id", () => {
    const a = createHook("@freeanima/kernel-hooks/test/same-id");
    const b = createHook("@freeanima/kernel-hooks/test/same-id");
    expect(a.id).not.toBe(b.id);
    expect(a.id.description).toBe(b.id.description);
  });

  it("different qualifiedId produces different Symbol", () => {
    const a = createHook("@freeanima/kernel-hooks/test/a");
    const b = createHook("@freeanima/kernel-hooks/test/b");
    expect(a.id).not.toBe(b.id);
  });

  it("returns Hook instance", () => {
    const hook = createHook<{ n: number }>("@freeanima/kernel-hooks/test/instance");
    expect(hook).toBeInstanceOf(Hook);
  });
});

describe("Handler types", () => {
  it("PayloadOf infers payload type from Hook instance", () => {
    const hook = createHook<{ value: number }>("@freeanima/kernel-hooks/test/payload-of");
    type Payload = PayloadOf<typeof hook>;
    expectTypeOf<Payload>().toEqualTypeOf<{ value: number }>();
  });

  it("HookHandler receives inferred payload", () => {
    const hook = createHook<{ ok: boolean }>("@freeanima/kernel-hooks/test/handler");
    const handler: HookHandler<typeof hook> = (payload) => {
      void payload.ok;
    };
    void handler;
  });
});

describe("walkHookChain", () => {
  it("null returns empty array", () => {
    expect(walkHookChain(null)).toEqual([]);
  });

  it("single-step chain", () => {
    const head = link({ status: "ok", data: { n: 1 } });
    expect(walkHookChain(head)).toEqual([head]);
  });

  it("multi-step head-to-tail order", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "ok", data: { n: 2 } }, first);
    expect(walkHookChain(head).map((s) => s.data?.n)).toEqual([2, 1]);
  });
});

describe("walkHookChainOldestFirst", () => {
  it("null returns empty array", () => {
    expect(walkHookChainOldestFirst(null)).toEqual([]);
  });

  it("opposite order from walkHookChain", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "failed", message: "x" }, first);
    expect(walkHookChainOldestFirst(head).map((s) => s.status)).toEqual(["ok", "failed"]);
  });
});

describe("blockedMessageFromChain", () => {
  it("null returns undefined", () => {
    expect(blockedMessageFromChain(null)).toBeUndefined();
  });

  it("no blocked step returns undefined", () => {
    const head = link({ status: "ok", data: { x: 1 } });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("ok+blocked step returns its message", () => {
    const head = link({
      status: "ok",
      blocked: true,
      message: "awaiting clarify",
    });
    expect(blockedMessageFromChain(head)).toBe("awaiting clarify");
  });

  it("blocked without message returns undefined", () => {
    const head = link({ status: "ok", blocked: true });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("blocked on failed step not counted", () => {
    const head = link({ status: "failed", blocked: true, message: "ignored" });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("walks prev to find earlier ok+blocked", () => {
    const first = link({
      status: "ok",
      blocked: true,
      message: "first",
    });
    const head = link({ status: "ok", data: {} }, first);
    expect(blockedMessageFromChain(head)).toBe("first");
  });
});

describe("headOkStepData", () => {
  const testHook = createHook<{ value: number }, { label?: string; n?: number }>(
    "@freeanima/kernel-hooks/test/head-ok",
  );

  it("null returns undefined", () => {
    expect(headOkStepData(testHook, null)).toBeUndefined();
  });

  it("no ok step with data returns undefined", () => {
    const head = link({ status: "failed", message: "err" });
    expect(headOkStepData(testHook, head)).toBeUndefined();
  });

  it("returns chain-head ok step data when present", () => {
    const head = link({ status: "ok", data: { label: "x" } });
    expect(headOkStepData(testHook, head)).toEqual({ label: "x" });
  });

  it("walks prev for first ok data when chain head has none", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "ok", blocked: true, message: "stop" }, first);
    expect(headOkStepData(testHook, head)).toEqual({ n: 1 });
  });
});

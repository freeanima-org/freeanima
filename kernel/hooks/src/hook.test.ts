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
} from "./hook.js";

function link(
  step: Omit<HookStepLink, "prev">,
  prev?: HookStepLink,
): HookStepLink {
  return prev ? { ...step, prev } : { ...step };
}

describe("createHook", () => {
  it("设置 qualifiedId 与 description", () => {
    const hook = createHook("@freeanima/hooks/test/id", "展示文案");
    expect(hook.qualifiedId).toBe("@freeanima/hooks/test/id");
    expect(hook.description).toBe("展示文案");
    expect(hook.id.description).toBe("@freeanima/hooks/test/id");
  });

  it("未传 description 时为 undefined", () => {
    const hook = createHook("@freeanima/hooks/test/no-desc");
    expect(hook.description).toBeUndefined();
  });

  it("每次创建产生独立的 Symbol id", () => {
    const a = createHook("@freeanima/hooks/test/same-id");
    const b = createHook("@freeanima/hooks/test/same-id");
    expect(a.id).not.toBe(b.id);
    expect(a.id.description).toBe(b.id.description);
  });

  it("不同 qualifiedId 产生不同 Symbol", () => {
    const a = createHook("@freeanima/hooks/test/a");
    const b = createHook("@freeanima/hooks/test/b");
    expect(a.id).not.toBe(b.id);
  });

  it("返回 Hook 实例", () => {
    const hook = createHook<{ n: number }>("@freeanima/hooks/test/instance");
    expect(hook).toBeInstanceOf(Hook);
  });
});

describe("Handler 类型", () => {
  it("PayloadOf 从 Hook 实例推断负载类型", () => {
    const hook = createHook<{ value: number }>("@freeanima/hooks/test/payload-of");
    type Payload = PayloadOf<typeof hook>;
    expectTypeOf<Payload>().toEqualTypeOf<{ value: number }>();
  });

  it("HookHandler 接收推断后的 payload", () => {
    const hook = createHook<{ ok: boolean }>("@freeanima/hooks/test/handler");
    const handler: HookHandler<typeof hook> = (payload) => {
      void payload.ok;
    };
    void handler;
  });
});

describe("walkHookChain", () => {
  it("null 返回空数组", () => {
    expect(walkHookChain(null)).toEqual([]);
  });

  it("单步链", () => {
    const head = link({ status: "ok", data: { n: 1 } });
    expect(walkHookChain(head)).toEqual([head]);
  });

  it("多步按链头到链尾顺序", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "ok", data: { n: 2 } }, first);
    expect(walkHookChain(head).map((s) => s.data?.n)).toEqual([2, 1]);
  });
});

describe("walkHookChainOldestFirst", () => {
  it("null 返回空数组", () => {
    expect(walkHookChainOldestFirst(null)).toEqual([]);
  });

  it("与 walkHookChain 顺序相反", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "failed", message: "x" }, first);
    expect(walkHookChainOldestFirst(head).map((s) => s.status)).toEqual([
      "ok",
      "failed",
    ]);
  });
});

describe("blockedMessageFromChain", () => {
  it("null 返回 undefined", () => {
    expect(blockedMessageFromChain(null)).toBeUndefined();
  });

  it("无 blocked 步返回 undefined", () => {
    const head = link({ status: "ok", data: { x: 1 } });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("ok+blocked 步返回其 message", () => {
    const head = link({
      status: "ok",
      blocked: true,
      message: "awaiting clarify",
    });
    expect(blockedMessageFromChain(head)).toBe("awaiting clarify");
  });

  it("blocked 无 message 时返回 undefined", () => {
    const head = link({ status: "ok", blocked: true });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("failed 步上的 blocked 不计入", () => {
    const head = link({ status: "failed", blocked: true, message: "ignored" });
    expect(blockedMessageFromChain(head)).toBeUndefined();
  });

  it("沿 prev 找到较早的 ok+blocked", () => {
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
  it("null 返回 undefined", () => {
    expect(headOkStepData(null)).toBeUndefined();
  });

  it("无 ok 步带 data 返回 undefined", () => {
    const head = link({ status: "failed", message: "err" });
    expect(headOkStepData(head)).toBeUndefined();
  });

  it("链头 ok 步带 data 时返回该 data", () => {
    const head = link({ status: "ok", data: { label: "x" } });
    expect(headOkStepData(head)).toEqual({ label: "x" });
  });

  it("链头无 data 时沿 prev 找第一个 ok data", () => {
    const first = link({ status: "ok", data: { n: 1 } });
    const head = link({ status: "ok", blocked: true, message: "stop" }, first);
    expect(headOkStepData(head)).toEqual({ n: 1 });
  });
});

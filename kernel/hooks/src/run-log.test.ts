import { describe, expect, it } from "bun:test";
import { createHook } from "./hook.js";
import { logHookRunOutcome } from "./run-log.js";
import { createMemoryLogger } from "./test-logger.js";

const messageIncoming = createHook<{
  sessionId: string;
  message: string;
  platform: string;
  blocked?: { reason: string };
  transformedMessage?: string;
  expiredHint?: string;
}>("@freeanima/legacy-kernel/hooks/message-incoming");

const toolAfterCall = createHook<{
  sessionId: string;
  toolName: string;
  turnControl?: { pause?: boolean };
}>("@freeanima/legacy-kernel/hooks/tool-after-call");

const turnAfterComplete = createHook<{
  sessionId: string;
  displayContent?: string;
}>("@freeanima/legacy-kernel/hooks/turn-after-complete");

const meta = { duration_ms: 1.2, handlers: 1 };

describe("logHookRunOutcome", () => {
  it("message-incoming 拦截为 warn", () => {
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "discord",
      blocked: { reason: "awaiting clarify" },
    }, meta);
    expect(memory.records.at(-1)?.level).toBe("warn");
    expect(memory.records.at(-1)?.message).toBe("入站消息被 hook 拦截");
    expect(memory.records.at(-1)?.attributes.reason).toBe("awaiting clarify");
  });

  it("message-incoming 过期 hint 为 info", () => {
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
      expiredHint: "已过期",
    }, meta);
    expect(memory.records.at(-1)?.level).toBe("info");
    expect(memory.records.at(-1)?.message).toBe("clarify 等待已过期");
  });

  it("message-incoming 转换消息为 debug", () => {
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
      transformedMessage: "[hi]",
    }, meta);
    expect(memory.records.at(-1)?.level).toBe("debug");
    expect(memory.records.at(-1)?.message).toBe("入站消息已转换");
  });

  it("tool-after-call 暂停回合为 info", () => {
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, toolAfterCall, {
      sessionId: "s1",
      toolName: "clarify",
      turnControl: { pause: true },
    }, meta);
    expect(memory.records.at(-1)?.level).toBe("info");
    expect(memory.records.at(-1)?.message).toBe("工具调用后暂停回合");
  });

  it("turn-after-complete 为 debug", () => {
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, turnAfterComplete, {
      sessionId: "s1",
      displayContent: "请选择",
    }, meta);
    expect(memory.records.at(-1)?.level).toBe("debug");
    expect(memory.records.at(-1)?.attributes.display_overridden).toBe(true);
  });

  it("未知 hook 为 debug 通用完成", () => {
    const other = createHook<{ value: number }>("@freeanima/hooks/test/other");
    const { logger, memory } = createMemoryLogger();
    const log = logger.with({ component: "hooks" });
    logHookRunOutcome(log, other, { value: 1 }, meta);
    expect(memory.records.at(-1)?.level).toBe("debug");
    expect(memory.records.at(-1)?.message).toBe("hook 执行完成");
  });
});

import { describe, expect, it } from "bun:test";
import { createLogger } from "./create-logger";
import { createMemorySink } from "./sinks/memory";
import { createNullSink } from "./sinks/null";

describe("createLogger", () => {
  it("无 sink 时 throw", () => {
    expect(() => createLogger({ sinks: [] })).toThrow("至少需要提供一个 sink");
  });

  it("默认 level 为 info", () => {
    const sink = createMemorySink();
    const logger = createLogger({ sinks: [sink] });
    logger.debug("d");
    logger.info("i");
    expect(sink.records.map((r) => r.level)).toEqual(["info"]);
  });

  it("debug 级别四级均可写入", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "debug", sinks: [sink] });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(sink.records.map((r) => r.level)).toEqual(["debug", "info", "warn", "error"]);
  });

  it("error 级别仅 error 可写入", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "error", sinks: [sink] });
    logger.debug("d");
    logger.warn("w");
    logger.error("e");
    expect(sink.records.map((r) => r.level)).toEqual(["error"]);
  });

  it("根 logger 无 component 也可直接打日志", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    root.info("bootstrap");
    expect(sink.records[0]?.attributes).toEqual({});
    expect(sink.records[0]?.message).toBe("bootstrap");
  });

  it("无单次 attributes 时仅 base + scope", () => {
    const sink = createMemorySink();
    const root = createLogger({
      base: { service: "anima" },
      sinks: [sink],
    });
    root.with({ component: "kernel" }).warn("check");
    expect(sink.records[0]?.attributes).toEqual({
      service: "anima",
      component: "kernel",
    });
  });

  it("base + scope + 单次 attributes 浅合并", () => {
    const sink = createMemorySink();
    const root = createLogger({
      base: { service: "anima" },
      sinks: [sink],
    });
    const discord = root.with({ component: "gateway.discord" });
    const session = discord.with({ sessionId: "abc" });
    session.info("received", { requestId: "r1" });

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]?.attributes).toEqual({
      service: "anima",
      component: "gateway.discord",
      sessionId: "abc",
      requestId: "r1",
    });
    expect(sink.records[0]?.message).toBe("received");
    expect(typeof sink.records[0]?.timestamp).toBe("number");
  });

  it("with 无 component 且 scope 为空时 throw", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    expect(() => root.with({ sessionId: "x" })).toThrow("component");
  });

  it("with 将 component 置空时 throw", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    expect(() => discord.with({ component: "" })).toThrow("component");
  });

  it("with 可显式覆盖 component", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    root.with({ component: "gateway" }).with({ component: "gateway.discord" }).info("ok");
    expect(sink.records[0]?.attributes.component).toBe("gateway.discord");
  });

  it("with 继承已有 component", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    const session = discord.with({ sessionId: "abc" });
    session.info("ok");
    expect(sink.records[0]?.attributes.component).toBe("gateway.discord");
    expect(sink.records[0]?.attributes.sessionId).toBe("abc");
  });

  it("with 返回新 logger，父级 scope 不变", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    discord.with({ sessionId: "abc" });
    root.with({ component: "bootstrap" }).info("boot");
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]?.attributes).toEqual({ component: "bootstrap" });
  });

  it("多 sink fan-out", () => {
    const a = createMemorySink();
    const b = createMemorySink();
    const logger = createLogger({ sinks: [a, b] });
    logger.with({ component: "test" }).error("fail", { err: new Error("x") });
    expect(a.records).toHaveLength(1);
    expect(b.records).toHaveLength(1);
    expect(a.records[0]).toEqual(b.records[0]);
  });

  it("sink throw 不冒泡，后续 sink 仍执行", () => {
    const sink = createMemorySink();
    const bad: typeof sink = {
      records: sink.records,
      emit() {
        throw new Error("sink failed");
      },
    };
    const logger = createLogger({ sinks: [bad, sink] });
    const scoped = logger.with({ component: "test" });
    expect(() => scoped.info("ok")).not.toThrow();
    expect(sink.records).toHaveLength(1);
  });

  it("可与 createNullSink 组合", () => {
    const memory = createMemorySink();
    const logger = createLogger({ sinks: [createNullSink(), memory] });
    logger.with({ component: "x" }).info("i");
    expect(memory.records).toHaveLength(1);
  });
});

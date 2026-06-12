import { describe, expect, it } from "bun:test";
import { createLogger } from "./create-logger.ts";
import { createMemorySink } from "./sinks/memory.ts";
import { createNullSink } from "./sinks/null.ts";

describe("createLogger", () => {
  it("throws when no sink", () => {
    expect(() => createLogger({ sinks: [] })).toThrow("requires at least one sink");
  });

  it("default level is info", () => {
    const sink = createMemorySink();
    const logger = createLogger({ sinks: [sink] });
    logger.debug("d");
    logger.info("i");
    expect(sink.records.map((r) => r.level)).toEqual(["info"]);
  });

  it("debug level allows all four levels", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "debug", sinks: [sink] });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(sink.records.map((r) => r.level)).toEqual(["debug", "info", "warn", "error"]);
  });

  it("error level allows only error", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "error", sinks: [sink] });
    logger.debug("d");
    logger.warn("w");
    logger.error("e");
    expect(sink.records.map((r) => r.level)).toEqual(["error"]);
  });

  it("root logger logs without component", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    root.info("bootstrap");
    expect(sink.records[0]?.attributes).toEqual({});
    expect(sink.records[0]?.message).toBe("bootstrap");
  });

  it("base + scope only without per-call attributes", () => {
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

  it("shallow merge base + scope + per-call attributes", () => {
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

  it("with throws without component and empty scope", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    expect(() => root.with({ sessionId: "x" })).toThrow("component");
  });

  it("with throws when component cleared", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    expect(() => discord.with({ component: "" })).toThrow("component");
  });

  it("with can override component explicitly", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    root.with({ component: "gateway" }).with({ component: "gateway.discord" }).info("ok");
    expect(sink.records[0]?.attributes.component).toBe("gateway.discord");
  });

  it("with inherits existing component", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    const session = discord.with({ sessionId: "abc" });
    session.info("ok");
    expect(sink.records[0]?.attributes.component).toBe("gateway.discord");
    expect(sink.records[0]?.attributes.sessionId).toBe("abc");
  });

  it("with returns new logger; parent scope unchanged", () => {
    const sink = createMemorySink();
    const root = createLogger({ sinks: [sink] });
    const discord = root.with({ component: "gateway.discord" });
    discord.with({ sessionId: "abc" });
    root.with({ component: "bootstrap" }).info("boot");
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]?.attributes).toEqual({ component: "bootstrap" });
  });

  it("multi-sink fan-out", () => {
    const a = createMemorySink();
    const b = createMemorySink();
    const logger = createLogger({ sinks: [a, b] });
    logger.with({ component: "test" }).error("fail", { err: new Error("x") });
    expect(a.records).toHaveLength(1);
    expect(b.records).toHaveLength(1);
    expect(a.records[0]).toEqual(b.records[0]);
  });

  it("sink throw does not bubble; later sinks still run", () => {
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

  it("composes with createNullSink", () => {
    const memory = createMemorySink();
    const logger = createLogger({ sinks: [createNullSink(), memory] });
    logger.with({ component: "x" }).info("i");
    expect(memory.records).toHaveLength(1);
  });
});

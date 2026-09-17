import { describe, expect, test } from "bun:test";

import { HabitatSessionRegistry } from "./habitat-session-registry.ts";

describe("HabitatSessionRegistry", () => {
  test("broadcastToSubject 只发给匹配 subject_type 的会话", () => {
    const registry = new HabitatSessionRegistry();
    const userEvents: Array<{ method: string; payload: unknown }> = [];
    const agentEvents: Array<{ method: string; payload: unknown }> = [];

    registry.register("u1", {
      auth: { subject_id: 1, subject_type: "user", token_id: 1, authorization: { full: true } },
      sendEvent: (method, payload) => {
        userEvents.push({ method, payload });
      },
    });
    registry.register("a1", {
      auth: { subject_id: 2, subject_type: "agent", token_id: 2, authorization: { full: true } },
      sendEvent: (method, payload) => {
        agentEvents.push({ method, payload });
      },
    });

    const payload = { subject_id: "user", active: null };
    const sent = registry.broadcastToSubject("user", "pomodoro.active.changed", payload);

    expect(sent).toBe(1);
    expect(userEvents).toEqual([{ method: "pomodoro.active.changed", payload }]);
    expect(agentEvents).toEqual([]);
  });

  test("excludeId 跳过写方连接", () => {
    const registry = new HabitatSessionRegistry();
    const received: string[] = [];
    registry.register("writer", {
      auth: { subject_id: 1, subject_type: "user", token_id: 1, authorization: { full: true } },
      sendEvent: () => {
        received.push("writer");
      },
    });
    registry.register("peer", {
      auth: { subject_id: 1, subject_type: "user", token_id: 3, authorization: { full: true } },
      sendEvent: () => {
        received.push("peer");
      },
    });

    registry.broadcastToSubject("user", "pomodoro.active.changed", {}, { excludeId: "writer" });
    expect(received).toEqual(["peer"]);
  });

  test("unregister 后不再收到广播", () => {
    const registry = new HabitatSessionRegistry();
    let count = 0;
    registry.register("s1", {
      auth: { subject_id: 1, subject_type: "user", token_id: 1, authorization: { full: true } },
      sendEvent: () => {
        count += 1;
      },
    });
    registry.unregister("s1");
    const sent = registry.broadcastToSubject("user", "pomodoro.active.changed", {});
    expect(sent).toBe(0);
    expect(count).toBe(0);
    expect(registry.size()).toBe(0);
  });
});

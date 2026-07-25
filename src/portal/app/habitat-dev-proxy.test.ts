import { describe, expect, it } from "bun:test";

import {
  isBenignWsProxyDisconnect,
  isBenignWsProxyLogMessage,
  resolveProxyHabitatUrl,
} from "./habitat-dev-proxy.ts";

describe("habitat-dev-proxy", () => {
  it("isBenignWsProxyDisconnect recognizes EPIPE / writeAfterFIN", () => {
    expect(
      isBenignWsProxyDisconnect(
        Object.assign(new Error("This socket has been ended by the other party"), {
          code: "EPIPE",
        }),
      ),
    ).toBe(true);
    expect(
      isBenignWsProxyDisconnect(Object.assign(new Error("boom"), { code: "ECONNRESET" })),
    ).toBe(true);
    expect(isBenignWsProxyDisconnect(new Error("ENOTFOUND habitat"))).toBe(false);
  });

  it("isBenignWsProxyLogMessage matches Vite ws proxy stacks", () => {
    const msg =
      "ws proxy error:\nError: This socket has been ended by the other party\n    at TLSSocket.writeAfterFIN";
    expect(isBenignWsProxyLogMessage(msg)).toBe(true);
    expect(isBenignWsProxyLogMessage("ws proxy socket error:\nError: read ECONNRESET")).toBe(true);
    expect(isBenignWsProxyLogMessage("http proxy error: /rpc\nError: timeout")).toBe(false);
  });

  it("resolveProxyHabitatUrl prefers FREEANIMA_URL", () => {
    const resolved = resolveProxyHabitatUrl({
      FREEANIMA_URL: "http://127.0.0.1:14445/",
    } as NodeJS.ProcessEnv);
    expect(resolved).toEqual({ url: "http://127.0.0.1:14445", source: "env" });
  });
});

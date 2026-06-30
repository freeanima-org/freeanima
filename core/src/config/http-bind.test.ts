import { describe, expect, test } from "bun:test";

import {
  collectHttpBindHosts,
  formatHttpBindHosts,
  parseHttpBindHostInput,
  resolveHttpBindHost,
} from "./http-bind.ts";

describe("parseHttpBindHostInput", () => {
  test("splits comma-separated hosts", () => {
    expect(parseHttpBindHostInput("127.0.0.1, 0.0.0.0")).toEqual(["127.0.0.1", "0.0.0.0"]);
  });
});

describe("collectHttpBindHosts", () => {
  test("reads string host", () => {
    expect(collectHttpBindHosts({ host: "0.0.0.0" })).toEqual(["0.0.0.0"]);
  });

  test("reads host array", () => {
    expect(collectHttpBindHosts({ host: ["127.0.0.1", "10.244.0.2"] })).toEqual([
      "127.0.0.1",
      "10.244.0.2",
    ]);
  });

  test("accepts hostname entries", () => {
    expect(collectHttpBindHosts({ host: ["galaxy", "10.244.0.2"] })).toEqual([
      "galaxy",
      "10.244.0.2",
    ]);
  });
});

describe("resolveHttpBindHost", () => {
  test("CLI overrides config", () => {
    expect(resolveHttpBindHost("127.0.0.1", { host: "0.0.0.0" })).toBe("127.0.0.1");
  });

  test("falls back to config then default", () => {
    expect(resolveHttpBindHost(undefined, { host: "0.0.0.0" })).toBe("0.0.0.0");
    expect(resolveHttpBindHost(undefined, undefined)).toBe("127.0.0.1");
  });

  test("formats array config", () => {
    expect(resolveHttpBindHost(undefined, { host: ["127.0.0.1", "10.244.0.2"] })).toBe(
      formatHttpBindHosts(["127.0.0.1", "10.244.0.2"]),
    );
  });
});

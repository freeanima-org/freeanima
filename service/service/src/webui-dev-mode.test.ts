import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { resolveWebuiDevMode } from "./webui-dev-mode.ts";

describe("resolveWebuiDevMode", () => {
  const prev = process.env.ANIMA_WEBUI_DEV;

  beforeEach(() => {
    delete process.env.ANIMA_WEBUI_DEV;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ANIMA_WEBUI_DEV;
    else process.env.ANIMA_WEBUI_DEV = prev;
  });

  it("dev off by default", () => {
    expect(resolveWebuiDevMode()).toBe(false);
    expect(resolveWebuiDevMode(false)).toBe(false);
  });

  it("CLI --dev enables", () => {
    expect(resolveWebuiDevMode(true)).toBe(true);
  });

  it("ANIMA_WEBUI_DEV=1 forces on", () => {
    process.env.ANIMA_WEBUI_DEV = "1";
    expect(resolveWebuiDevMode(false)).toBe(true);
  });

  it("ANIMA_WEBUI_DEV=0 forces off", () => {
    process.env.ANIMA_WEBUI_DEV = "0";
    expect(resolveWebuiDevMode(true)).toBe(false);
  });
});

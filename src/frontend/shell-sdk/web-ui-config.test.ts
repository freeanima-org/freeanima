import { describe, expect, test } from "bun:test";

import { parseWebUiConfigJson } from "./web-ui-config.ts";

describe("parseWebUiConfigJson", () => {
  test("解析 Hub config.json 字段", () => {
    const cfg = parseWebUiConfigJson({
      app_id: "chat",
      hub_url: "http://127.0.0.1:2658",
      hub_ws_url: "ws://127.0.0.1:2658/hub/rpc/v1",
      ui_version: "0.8.1",
      min_shell_version: "0.8.0",
      layout_mode: "compact",
      auth_token: "anima_test_token_123456",
    });
    expect(cfg?.ui_version).toBe("0.8.1");
    expect(cfg?.min_shell_version).toBe("0.8.0");
    expect(cfg?.layout_mode).toBe("compact");
    expect(cfg?.auth_token).toBe("anima_test_token_123456");
  });
});

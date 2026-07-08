import { describe, expect, test } from "bun:test";

import { getTlsCaInfo } from "./tls-ca.ts";

describe("getTlsCaInfo", () => {
  test("returns http download url when request is https", async () => {
    const info = await getTlsCaInfo(new Request("https://feng-vm.lan:2659/api/tls/ca/info"));
    expect(info.download_url).toBe("http://feng-vm.lan:2658/api/tls/ca");
    expect(info.qr_url).toBe("http://feng-vm.lan:2658/api/tls/ca/qr?size=256");
  });
});

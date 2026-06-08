import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describeE2e } from "../../helpers/webview-gate.ts";
import { startE2eWebuiServer, type E2eWebuiServer } from "../../helpers/e2e-webui-server.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";

async function waitForTestId(
  view: InstanceType<typeof Bun.WebView>,
  testId: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await view.evaluate(`!!document.querySelector('[data-testid="${testId}"]')`);
    if (found) return true;
    await Bun.sleep(200);
  }
  return false;
}

describeE2e("webui e2e", () => {
  let server: E2eWebuiServer | undefined;

  beforeEach(async () => {
    server = await startE2eWebuiServer();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("能打开卧室 dashboard", async () => {
    if (!server) throw new Error("E2E server not started");
    await using view = new Bun.WebView({ width: 1280, height: 720 });
    await view.navigate(`http://127.0.0.1:${server.port}/webui/chamber/dashboard`);
    const found = await waitForTestId(view, "chamber-layout", 60_000);
    expect(found).toBe(true);
  });
});

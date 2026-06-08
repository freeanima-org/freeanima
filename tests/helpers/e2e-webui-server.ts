import { getServiceContext } from "@freeanima/service";
import {
  startWebuiHttpServer,
  type WebuiServerHandle,
} from "@freeanima/connectors-webui/webui-server";
import { beginIntegrationCase, restoreIntegrationHome } from "./integration-case.ts";

export type E2eWebuiServer = {
  port: number;
  close: () => Promise<void>;
};

export async function startE2eWebuiServer(): Promise<E2eWebuiServer> {
  const prevHome = process.env.FREEANIMA_HOME;
  await beginIntegrationCase("e2e-webui-");
  getServiceContext().service.markStarted();
  const handle: WebuiServerHandle = await startWebuiHttpServer("127.0.0.1", 0, {
    development: true,
  });
  return {
    port: handle.port,
    close: async () => {
      await handle.close();
      await restoreIntegrationHome(prevHome);
    },
  };
}

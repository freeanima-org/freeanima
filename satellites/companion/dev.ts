import { buildCompanionApp } from "./build.ts";
import { startCompanionServer } from "./server/index.ts";

await buildCompanionApp({ watch: true });
await startCompanionServer();

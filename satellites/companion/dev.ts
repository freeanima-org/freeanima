import { buildCompanionApp } from "./build.ts";

await buildCompanionApp({ watch: true });
await import("./server/index.ts");

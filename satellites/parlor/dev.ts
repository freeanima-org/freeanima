import { buildParlorApp } from "./build.ts";

await buildParlorApp({ watch: true });
await import("./server/index.ts");

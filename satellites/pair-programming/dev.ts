import { buildPairProgrammingApp } from "./build.ts";

await buildPairProgrammingApp({ watch: true });
await import("./server/index.ts");

import { buildChatApp } from "./build.ts";

await buildChatApp({ watch: true });
await import("./server/index.ts");

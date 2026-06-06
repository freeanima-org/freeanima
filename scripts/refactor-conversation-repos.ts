#!/usr/bin/env bun
/** 一次性脚本：为 conversation.ts 注入 repos 参数并生成 ConversationService */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const path = join(ROOT, "engine/conversation/src/conversation.ts");
let src = readFileSync(path, "utf8");

if (!src.includes("@freeanima/engine-repos")) {
  src = src.replace(
    '} from "./session-store-pg-bridge.ts";',
    '} from "./session-store-pg-bridge.ts";\nimport type { PgRepositories } from "@freeanima/engine-repos";',
  );
}

const bridgeCalls: Array<[RegExp, string]> = [
  [/postgresAvailable\(\)/g, "postgresAvailable(repos)"],
  [/loadSessionToolsWithRouting\(([^,)]+)\)/g, "loadSessionToolsWithRouting(repos, $1)"],
  [/loadMetaWithRouting\(([^,)]+)\)/g, "loadMetaWithRouting(repos, $1)"],
  [/pgCountSessionsByPlatform\(\)/g, "pgCountSessionsByPlatform(repos)"],
  [/pgListSessionSummaries\(([^)]*)\)/g, "pgListSessionSummaries(repos, $1)"],
  [/listSessionsWithRouting\(([^)]*)\)/g, "listSessionsWithRouting(repos, $1)"],
  [/sessionExistsWithRouting\(([^,)]+)\)/g, "sessionExistsWithRouting(repos, $1)"],
  [/loadMessagesWithRouting\(([^,)]+)\)/g, "loadMessagesWithRouting(repos, $1)"],
  [
    /loadMessagesPageWithRouting\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
    "loadMessagesPageWithRouting(repos, $1, $2, $3)",
  ],
  [/countMessagesWithRouting\(([^,)]+)\)/g, "countMessagesWithRouting(repos, $1)"],
  [
    /loadMessagesForRuntimeWithRouting\(([^,]+),\s*([^)]+)\)/g,
    "loadMessagesForRuntimeWithRouting(repos, $1, $2)",
  ],
  [/nextMessagePosWithRouting\(([^,)]+)\)/g, "nextMessagePosWithRouting(repos, $1)"],
  [/pgWriteMessage\(([^,]+),\s*([^)]+)\)/g, "pgWriteMessage(repos, $1, $2)"],
  [/pgWriteMeta\(([^,]+),\s*([^)]+)\)/g, "pgWriteMeta(repos, $1, $2)"],
  [
    /pgFindSessionIdByPlatformInfo\(([^,]+),\s*([^)]+)\)/g,
    "pgFindSessionIdByPlatformInfo(repos, $1, $2)",
  ],
  [/pgWritePatchMeta\(([^,]+),\s*([^)]+)\)/g, "pgWritePatchMeta(repos, $1, $2)"],
  [/pgLastMessageTimestamp\(([^,)]+)\)/g, "pgLastMessageTimestamp(repos, $1)"],
  [
    /pgShiftMessagePositions\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
    "pgShiftMessagePositions(repos, $1, $2, $3)",
  ],
  [/pgWriteTruncate\(([^,]+),\s*([^)]+)\)/g, "pgWriteTruncate(repos, $1, $2)"],
  [/pgDeleteDebugSessions\(\)/g, "pgDeleteDebugSessions(repos)"],
  [/pgListDebugSessionIds\(\)/g, "pgListDebugSessionIds(repos)"],
  [/pgWriteDeleteSession\(([^,)]+)\)/g, "pgWriteDeleteSession(repos, $1)"],
];

for (const [re, rep] of bridgeCalls) {
  src = src.replace(re, rep);
}

const fnNames = [
  "loadSessionTools",
  "loadSessionMeta",
  "countSessionsByPlatform",
  "listSessionSummaries",
  "listSessions",
  "sessionExists",
  "load",
  "loadMessagePage",
  "countMessages",
  "loadForRuntime",
  "appendMessage",
  "appendSessionMeta",
  "initSession",
  "newSession",
  "findSessionByOrigin",
  "updateSessionMetaField",
  "patchSessionOrigin",
  "rebuildSessionSystemPrompt",
  "reloadSessionTools",
  "refreshSystemPromptOnResume",
  "assertSessionPlatform",
  "appendUserTurn",
  "flushCompressionSummaries",
  "advanceCompressionMeta",
  "recompressSession",
  "repairAndPersistToolLoop",
  "maybeApplyEmergencyCompression",
  "buildRuntimeMessages",
  "beginTurn",
  "finishTurn",
  "updateSessionMeta",
  "setSessionTitle",
  "getSessionTitle",
  "getSessionCwd",
  "setSessionCwd",
  "rollbackToLastUser",
  "retryTurn",
  "cleanupDebugSessions",
  "sessionLastActivityMs",
  "finalizeCompressionSummary",
  "ensureSessionToolIntegrity",
];

for (const name of fnNames) {
  src = src.replace(
    new RegExp(`(export )?async function ${name}\\(`, "g"),
    (_m, exp) => `${exp ?? ""}async function ${name}(repos: PgRepositories, `,
  );
  // internal calls: await name( -> await name(repos,
  src = src.replace(new RegExp(`await ${name}\\(`, "g"), `await ${name}(repos, `);
  src = src.replace(new RegExp(`return ${name}\\(`, "g"), `return ${name}(repos, `);
  // fix double repos
  src = src.replace(/\(repos: PgRepositories, repos: PgRepositories,/g, "(repos: PgRepositories,");
  src = src.replace(/await (\w+)\(repos, repos,/g, "await $1(repos,");
}

writeFileSync(path, src);
console.log("conversation.ts updated");

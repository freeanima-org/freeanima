/**
 * Repair overly-broad Session→Conversation replacements.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".tsout", "dist", ".git", "www", ".generated"]);

const REPLACEMENTS: Array<[string, string]> = [
  ["SessionConversationPort", "ConversationPort"],
  ["sessionStore", "conversationStore"],
  [
    "conversation: ConversationPort, conversation: string",
    "conversation: ConversationPort, conversationId: string",
  ],
  ["conversation: string): Promise", "conversationId: string): Promise"],
  ["conversation: string,", "conversationId: string,"],
  ["(conversation: string)", "(conversationId: string)"],
  ["(conversation)", "(conversationId)"],
  ["loadConversationMeta(session)", "loadConversationMeta(conversationId)"],
  ["loadConversationMeta(conversation)", "loadConversationMeta(conversationId)"],
  ["updateConversationMetaField(conversation,", "updateConversationMetaField(conversationId,"],
  [
    "appendMessage?(msg: StoredMessage, conversation:",
    "appendMessage?(msg: StoredMessage, conversationId:",
  ],
  ["private conversation: ConversationPort", "private conversationPort: ConversationPort"],
  [
    "wireConversation(conversation: ConversationPort)",
    "wireConversation(conversationPort: ConversationPort)",
  ],
  ["this.conversation =", "this.conversationPort ="],
  ["this.conversation?", "this.conversationPort?"],
  ["createConversation(platform", "createConversation(platform"],
  ["findOrCreateConversation(", "findOrCreateConversation("],
  ["applyCommandConversationEffects", "applyCommandConversationEffects"],
  ["export class SessionManager", "export class ConversationManager"],
  ["SessionManager", "ConversationManager"],
  ["tool-session-port", "tool-conversation-port"],
  ["memory SessionStore", "memory ConversationStore"],
  ["truncatedSessions", "truncatedConversations"],
  ["LightSleepSessionBlock", "LightSleepConversationBlock"],
  ["## Session ", "## Conversation "],
  ["createSessionBodySchema", "createConversationBodySchema"],
  ["CreateSessionBody", "CreateConversationBody"],
  ["export async function createSession(", "export async function createConversation("],
  ["api.sessions.", "api.conversations."],
  ["apiClient.api.sessions", "apiClient.api.conversations"],
  ["findOrCreateSession(", "findOrCreateConversation("],
  ["createSession(platform", "createConversation(platform"],
  ["listSessions(", "listConversations("],
  ["getSessionMessages(", "getConversationMessages("],
  ["getSessionInfo(", "getConversationInfo("],
  ["sessions.listConversations", "conversations.listConversations"],
  ["sessions.createConversation", "conversations.createConversation"],
  ["sessions.findOrCreateConversation", "conversations.findOrCreateConversation"],
  ["sessions.patchConversationOrigin", "conversations.patchConversationOrigin"],
  ["sessions.getConversationInfo", "conversations.getConversationInfo"],
  ["sessions.getMessages", "conversations.getMessages"],
  ["sessions.setConversationTitle", "conversations.setConversationTitle"],
  ["sessions.appendConversationMetaForEngine", "conversations.appendConversationMetaForEngine"],
  ["import * as sessions from", "import * as conversations from"],
  ["result.sessions.map", "result.conversations.map"],
  ["sessions: result.conversations", "conversations: result.conversations"],
  ["{ sessions:", "{ conversations:"],
  ["state.sessions", "state.conversations"],
  ["get().sessions", "get().conversations"],
  ["conversationStore:", "conversationStore:"],
  ["GatherDreamInputOpts", "GatherDreamInputOpts"],
];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      out.push(...(await walk(p)));
    } else out.push(p);
  }
  return out;
}

async function main(): Promise<void> {
  const files = await walk(ROOT);
  let n = 0;
  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const rel = relative(ROOT, file);
    if (rel.startsWith("scripts/fix-")) continue;
    let c = await readFile(file, "utf8");
    let next = c;
    for (const [a, b] of REPLACEMENTS) next = next.split(a).join(b);
    if (next !== c) {
      await writeFile(file, next);
      n++;
    }
  }
  console.log(`Fixed ${n} files`);
}

main();

import type { PgRepositories } from "../ports/index.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";
import { nullSessionStore } from "./null-session.ts";

export const nullPgRepositories: PgRepositories = {
  pgAvailable: false,
  session: nullSessionStore,
  semanticMemory: nullSemanticMemoryStore,
};

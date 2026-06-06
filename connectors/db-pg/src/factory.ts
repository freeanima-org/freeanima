import type { PgRepositories } from "@freeanima/kernel";
import type { Db } from "./client.ts";
import { PgSessionStore } from "./session/pg-session-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    session: new PgSessionStore(),
  };
}

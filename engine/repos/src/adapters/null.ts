import type { PgRepositories } from "../ports/index.ts";
import { nullSessionStore } from "./null-session.ts";

export const nullPgRepositories: PgRepositories = {
  pgAvailable: false,
  session: nullSessionStore,
};

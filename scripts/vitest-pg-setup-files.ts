import { existsSync, readFileSync } from "node:fs";

import { PG_TEST_URL_FILE } from "./vitest-pg-constants.js";

if (existsSync(PG_TEST_URL_FILE)) {
  process.env.ANIMA_TEST_PG_URL = readFileSync(PG_TEST_URL_FILE, "utf-8").trim();
}

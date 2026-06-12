import "@freeanima/platform/runtime/system-prompt-wire";
import { describe } from "bun:test";

/**
 * PG integration test gate.
 *
 * `bun test` injects `ANIMA_TEST_PG_URL` (Docker CLI starts a temp PG).
 * Skips when URL is unset (e.g. unit-test-only `bun test` path).
 */
export const pgTestUrl = process.env.ANIMA_TEST_PG_URL;
export const describePg = pgTestUrl ? describe : describe.skip;

import { join } from "node:path";
import { tmpdir } from "node:os";

/** globalSetup 写入、setupFiles 读取；供 vitest worker 共享 PG URL */
export const PG_TEST_URL_FILE = join(tmpdir(), "anima-test-pg.url");

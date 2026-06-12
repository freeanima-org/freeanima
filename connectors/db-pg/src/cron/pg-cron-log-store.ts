import type { CronLogStorePort } from "@freeanima/storage-repos";

import * as repo from "./repos/cron-log-repo.ts";

export class PgCronLogStore implements CronLogStorePort {
  async append(row: Parameters<CronLogStorePort["append"]>[0]) {
    return repo.appendCronLog(row);
  }

  async list(opts?: Parameters<CronLogStorePort["list"]>[0]) {
    return repo.listCronLogs(opts);
  }
}

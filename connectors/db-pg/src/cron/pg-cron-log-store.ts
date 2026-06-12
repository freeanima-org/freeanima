import type { CronLogStorePort } from "@freeanima/core/repos";

import * as repo from "./repos/cron-log-repo.ts";

/** PostgreSQL CronLogStorePort implementation */
export const pgCronLogStore: CronLogStorePort = {
  append: repo.appendCronLog,
  list: repo.listCronLogs,
};

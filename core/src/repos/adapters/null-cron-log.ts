import type { CronLogStorePort } from "../ports/cron-log.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

export const nullCronLogStore: CronLogStorePort = {
  async append() {
    return unavailable();
  },
  async list() {
    return [];
  },
};

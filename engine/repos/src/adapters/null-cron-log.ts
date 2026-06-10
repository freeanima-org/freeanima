import type { CronLogStorePort } from "../ports/cron-log.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

export const nullCronLogStore: CronLogStorePort = {
  async append() {
    return unavailable();
  },
  async list() {
    return [];
  },
};

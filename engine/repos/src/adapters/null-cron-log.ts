import type { CronLogStorePort } from "../ports/cron-log.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

export const nullCronLogStore: CronLogStorePort = {
  async append() {
    return unavailable();
  },
  async list() {
    return [];
  },
};

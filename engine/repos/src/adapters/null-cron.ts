import type { CronJobStorePort } from "../ports/cron.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

/** PG 不可用时的 Cron 端口空实现 */
export const nullCronJobStore: CronJobStorePort = {
  async create() {
    return unavailable();
  },
  async upsertBuiltin() {
    return unavailable();
  },
  async get() {
    return null;
  },
  async update() {
    return unavailable();
  },
  async delete() {
    return false;
  },
  async listAll() {
    return [];
  },
};

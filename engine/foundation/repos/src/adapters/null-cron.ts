import type { CronJobStorePort } from "../ports/cron.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

/** Null Cron port when PG unavailable */
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

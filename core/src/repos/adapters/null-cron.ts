import type { CronJobStorePort } from "../ports/cron.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

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

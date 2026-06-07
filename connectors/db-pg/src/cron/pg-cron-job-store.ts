import type { CronJobStorePort } from "@freeanima/engine-repos";

import { pgProfileWrap } from "../pg-profile.ts";
import * as crudRepo from "./repos/cron-crud-repo.ts";

/** PostgreSQL CronJobStorePort 实现 */
export class PgCronJobStore implements CronJobStorePort {
  async create(row: Parameters<CronJobStorePort["create"]>[0]) {
    return pgProfileWrap("cron.create", () => crudRepo.createCronJob(row));
  }

  async upsertBuiltin(row: Parameters<CronJobStorePort["upsertBuiltin"]>[0]) {
    return pgProfileWrap("cron.upsertBuiltin", () => crudRepo.upsertBuiltinCronJob(row));
  }

  async get(id: string) {
    return pgProfileWrap("cron.get", () => crudRepo.getCronJob(id));
  }

  async update(row: Parameters<CronJobStorePort["update"]>[0]) {
    return pgProfileWrap("cron.update", () => crudRepo.updateCronJob(row));
  }

  async delete(id: string) {
    return pgProfileWrap("cron.delete", () => crudRepo.deleteCronJob(id));
  }

  async listAll() {
    return pgProfileWrap("cron.listAll", () => crudRepo.listAllCronJobs(), {
      resultBytes: (rows) => JSON.stringify(rows).length,
    });
  }
}

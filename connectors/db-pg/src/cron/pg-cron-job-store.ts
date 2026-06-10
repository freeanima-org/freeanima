import type { CronJobStorePort } from "@freeanima/engine-repos";

import * as crudRepo from "./repos/cron-crud-repo.ts";

/** PostgreSQL CronJobStorePort implementation */
export class PgCronJobStore implements CronJobStorePort {
  async create(row: Parameters<CronJobStorePort["create"]>[0]) {
    return crudRepo.createCronJob(row);
  }

  async upsertBuiltin(row: Parameters<CronJobStorePort["upsertBuiltin"]>[0]) {
    return crudRepo.upsertBuiltinCronJob(row);
  }

  async get(id: string) {
    return crudRepo.getCronJob(id);
  }

  async update(row: Parameters<CronJobStorePort["update"]>[0]) {
    return crudRepo.updateCronJob(row);
  }

  async delete(id: string) {
    return crudRepo.deleteCronJob(id);
  }

  async listAll() {
    return crudRepo.listAllCronJobs();
  }
}

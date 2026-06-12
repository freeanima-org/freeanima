import type { CronJobStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/cron-crud-repo.ts";

/** PostgreSQL CronJobStorePort implementation */
export const pgCronJobStore: CronJobStorePort = {
  create: crudRepo.createCronJob,
  upsertBuiltin: crudRepo.upsertBuiltinCronJob,
  get: crudRepo.getCronJob,
  update: crudRepo.updateCronJob,
  delete: crudRepo.deleteCronJob,
  listAll: crudRepo.listAllCronJobs,
};

import { cronJobs } from "../cron-jobs.ts";

export type CronJobRow = typeof cronJobs.$inferSelect;

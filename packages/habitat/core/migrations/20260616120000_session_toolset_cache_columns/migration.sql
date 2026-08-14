ALTER TABLE "sessions" RENAME COLUMN "tools" TO "cached_toolsets";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "loaded_tools" TO "staged_toolsets";

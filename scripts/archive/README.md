# Archived one-off migration scripts

These scripts were used during entity-model migration. Run only when upgrading legacy deployments.

- `migrate-tasks-to-entities.ts` — old `tasks` table → entity `task_item`
- `migrate-email-to-entities.ts` — config.yaml `email.accounts[]` → entity `email_account`
- `recover-tasks-from-message-history.ts` — 一次性从消息历史恢复任务（legacy 部署专用）

Invoke from repo root:

```bash
DATABASE_URL=postgres://… bun scripts/archive/migrate-tasks-to-entities.ts
DATABASE_URL=postgres://… bun scripts/archive/migrate-email-to-entities.ts --dry-run
```

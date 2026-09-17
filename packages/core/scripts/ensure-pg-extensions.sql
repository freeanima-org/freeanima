-- 须以 postgres 超级用户执行一次（应用 migrate 用户无 CREATE EXTENSION 权限）
-- 例: sudo -u postgres psql -d anima -f engine/db/scripts/ensure-pg-extensions.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

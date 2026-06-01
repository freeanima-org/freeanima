-- Session 体量诊断（迁移 PG 后定位慢 session）
-- 用法: psql "$DATABASE_URL" -f packages/db/scripts/session-size.sql

SELECT session_id,
       count(*) AS message_count,
       pg_size_pretty(
         sum(pg_column_size(role_payload) + coalesce(length(content), 0))::bigint
       ) AS approx_payload
FROM messages
GROUP BY session_id
ORDER BY count(*) DESC
LIMIT 10;

SELECT id,
       pg_column_size(tools) AS tools_bytes,
       pg_column_size(functions) AS functions_bytes,
       pg_column_size(compression) AS compression_bytes
FROM sessions
ORDER BY pg_column_size(tools) DESC
LIMIT 10;

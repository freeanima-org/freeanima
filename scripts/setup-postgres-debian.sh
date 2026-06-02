#!/usr/bin/env bash
# 本机 Debian PostgreSQL 17 生产向安装（逸灵风 Slice A）
# 用法: sudo ./scripts/setup-postgres-debian.sh
# 可选: ANIMa_PG_PASSWORD=xxx sudo ./scripts/setup-postgres-debian.sh
set -euo pipefail

DB_NAME="${ANIMA_PG_DATABASE:-anima}"
DB_USER="${ANIMA_PG_USER:-anima}"
DB_PORT="${ANIMA_PG_PORT:-5432}"
PASS_PATH="${ANIMA_PG_PASS_PATH:-services/postgres/anima}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "请使用 root 运行: sudo $0" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
fi

PG_VERSION="$(psql --version | awk '{print $3}' | cut -d. -f1)"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
PG_SNIPPET="/etc/postgresql/${PG_VERSION}/main/conf.d/99-anima-production.conf"

systemctl enable --now "postgresql@${PG_VERSION}-main.service" 2>/dev/null || systemctl enable --now postgresql

if [[ -z "${ANIMA_PG_PASSWORD:-}" ]]; then
  ANIMA_PG_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
fi

# 角色 / 库（幂等）
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${ANIMA_PG_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${ANIMA_PG_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" -E UTF8 -T template0 "${DB_NAME}"
fi

sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c \
  "GRANT ALL ON SCHEMA public TO ${DB_USER}; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};"

# 生产向参数（4C / 8G 本机参考值；可按机器调整）
mkdir -p "$(dirname "${PG_SNIPPET}")"
cat >"${PG_SNIPPET}" <<'CONF'
# anima local production-ish (managed by scripts/setup-postgres-debian.sh)
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 256MB
work_mem = 16MB
wal_level = replica
max_wal_size = 2GB
min_wal_size = 512MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100
log_line_prefix = '%t [%p] %u@%d '
log_checkpoints = on
log_lock_waits = on
track_io_timing = on
CONF

# 仅 anima 用户本地 TCP 密码认证
if ! grep -q "# anima local access" "${PG_HBA}"; then
  cat >>"${PG_HBA}" <<HBA

# anima local access
host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256
host    ${DB_NAME}    ${DB_USER}    ::1/128         scram-sha-256
HBA
fi

systemctl restart "postgresql@${PG_VERSION}-main.service" 2>/dev/null || systemctl restart postgresql

CONN_URL="postgresql://${DB_USER}:${ANIMA_PG_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}"
TARGET_USER="${SUDO_USER:-${USER:-root}}"
CRED_FILE="$(mktemp /tmp/anima-pg-creds.XXXXXX)"
chmod 600 "${CRED_FILE}"
chown "${TARGET_USER}:${TARGET_USER}" "${CRED_FILE}" 2>/dev/null || true

cat >"${CRED_FILE}" <<EOF
# 一次性凭证文件 — 导入 pass 后请删除
url=${CONN_URL}
host=127.0.0.1
port=${DB_PORT}
user=${DB_USER}
password=${ANIMA_PG_PASSWORD}
database=${DB_NAME}
desc=逸灵风 L1 PostgreSQL 本机
EOF

echo ""
echo "=== PostgreSQL 就绪 ==="
echo "  版本: $(psql --version)"
echo "  库:   ${DB_NAME}"
echo "  用户: ${DB_USER}"
echo ""
echo "凭证已写入 ${CRED_FILE}（权限 600，一次性）"
echo "以 ${TARGET_USER} 用户导入 pass 后删除该文件："
echo "  anima credential add ${PASS_PATH} url=\$(grep '^url=' ${CRED_FILE} | cut -d= -f2-) \\"
echo "    host=127.0.0.1 port=${DB_PORT} user=${DB_USER} \\"
echo "    password=\$(grep '^password=' ${CRED_FILE} | cut -d= -f2-) database=${DB_NAME} \\"
echo "    desc='逸灵风 L1 PostgreSQL 本机'"
echo "  rm -f ${CRED_FILE}"
echo ""
echo "Drizzle migrate（需先从 pass 读取 URL）："
echo "  DATABASE_URL=\"\$(anima credential get ${PASS_PATH} url)\" pnpm --filter @freeanima/legacy-db db:migrate"
echo ""

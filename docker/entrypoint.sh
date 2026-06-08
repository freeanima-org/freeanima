#!/usr/bin/env bash
set -euo pipefail

CONFIG="${FREEANIMA_HOME}/config.yaml"
TEMPLATE="/docker/config.docker.yaml"

mkdir -p "${FREEANIMA_HOME}"

if [[ ! -f "${CONFIG}" ]]; then
  echo "[entrypoint] 初始化 ${CONFIG} …"
  cp "${TEMPLATE}" "${CONFIG}"
fi

exec anima "$@"

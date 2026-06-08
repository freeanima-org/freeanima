# syntax=docker/dockerfile:1

# 阶段 1：从源码构建 @freeanima/cli 发布目录（与 npm 包同构）
FROM oven/bun:1.3.14 AS builder
WORKDIR /src

COPY package.json bun.lock bunfig.toml ./
COPY kernel kernel
COPY engine engine
COPY life life
COPY service service
COPY capabilities capabilities
COPY connectors connectors
COPY cli cli
COPY scripts scripts
COPY tests/package.json tests/

RUN bun install --frozen-lockfile
RUN bun run build:cli

# 阶段 2：仅 Bun + 发布包（无 monorepo 源码）
FROM oven/bun:1.3.14 AS runtime

ENV NODE_ENV=production
ENV ANIMA_WEBUI_DEV=0
ENV FREEANIMA_HOME=/home/bun/.anima
ENV PATH="/opt/anima/dist:${PATH}"

COPY --from=builder /src/cli/publish /opt/anima
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/config.docker.yaml /docker/config.docker.yaml

RUN chmod +x /entrypoint.sh \
  && mkdir -p /home/bun/.anima \
  && chown -R bun:bun /home/bun/.anima /opt/anima

USER bun
EXPOSE 2658
ENTRYPOINT ["/entrypoint.sh"]
CMD ["service", "start", "--foreground", "--host", "0.0.0.0", "--port", "2658"]

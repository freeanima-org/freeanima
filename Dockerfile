# syntax=docker/dockerfile:1

# 单阶段 — 直接从 npm 安装 @freeanima/cli
FROM oven/bun:1.3.14

ENV NODE_ENV=production
ENV FREEANIMA_HOME=/home/bun/.anima

RUN bun install -g @freeanima/cli

COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/config.docker.yaml /docker/config.docker.yaml

RUN chmod +x /entrypoint.sh \
  && mkdir -p /home/bun/.anima \
  && chown -R bun:bun /home/bun/.anima

USER bun
EXPOSE 2658
ENTRYPOINT ["/entrypoint.sh"]
CMD ["service", "start", "--foreground", "--host", "0.0.0.0", "--port", "2658"]

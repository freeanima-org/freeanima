# DB 集成测试

由根目录 `pnpm test:integration` 统一执行（Testcontainers 自动起 PG + migrate）。

```bash
# 需 Docker 运行中
pnpm test:integration
```

勿使用生产 `DATABASE_URL`。

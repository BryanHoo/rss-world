# Self-hosted Next.js Deployment

## 1. Local production start

```bash
pnpm install
pnpm run build
pnpm run start
```

默认监听端口为 `3000`。

## 2. Docker deployment

```bash
docker build -t rss-world:next16 .
docker run --rm -p 3000:3000 rss-world:next16
```

## 3. Reverse proxy

将流量反向代理到 `http://127.0.0.1:3000`。

建议项：

- 开启 `gzip` 或 `brotli`
- 为静态资源配置合理缓存策略
- 使用 `X-Forwarded-*` 头以保留真实客户端信息

## 4. Structural verification

部署前执行：

```bash
node scripts/verify-next-migration.mjs
pnpm run lint
pnpm run test:unit
pnpm run build
```

# pg-boss 使用优化实施总结

**Date:** 2026-03-04  
**Status:** resolved  
**Area:** queue contracts / enqueue semantics / worker bootstrap & registry / observability  
**Related:** `docs/plans/2026-03-04-pg-boss-usage-optimization-design.md`

## 1. 变更范围

本次落地范围覆盖以下五个核心面：

- contracts
  - 新增 `src/server/queue/contracts.ts` 与测试。
  - 将 `createQueue/send/work` 的关键参数统一到单一配置源。
- enqueue
  - `src/server/queue/queue.ts` 增加 `enqueueWithResult()`，统一返回：
    - `{ status: 'enqueued', jobId }`
    - `{ status: 'throttled_or_duplicate' }`
  - 保留 legacy `enqueue()` 兼容入口，内部走结构化结果包装。
- bootstrap
  - 新增 `src/server/queue/bootstrap.ts`，worker 启动按 contract 统一 `createQueue`。
  - 自动创建 `deadLetter` 队列（如 `dlq.feed.fetch`、`dlq.article.fulltext`）。
- worker registry
  - 新增 `src/worker/workerRegistry.ts`，统一通过 contract 注入 `localConcurrency/batchSize`。
  - `src/worker/index.ts` 从多处 `boss.work(...)` 迁移为 `registerWorkers(...)`。
- observability
  - 新增 `src/server/queue/observability.ts`，集中挂接 `error/warning/wip/stopped` 事件。
  - `src/worker/index.ts` 增加 60 秒 `getQueueStats` 采样日志。

## 2. 行为兼容结论

- 路由层继续返回兼容结构：
  - `enqueued: true/false`
  - 既有 `reason`（如 `already_enqueued`）保持不变。
- `ai*` 任务继续手动重试策略（`retryLimit: 0`）。
- `feed/fulltext` 任务按 contract 启用自动重试 + backoff + DLQ。

## 3. 指标前后对比口径（观测定义）

本次先完成“口径统一 + 可采样”，指标对比按以下定义执行：

- `queue lag`
  - 口径：`created + retry`（来自 `getQueueStats(name)`）。
  - 目标：识别积压趋势和重试堆积趋势。
- `enqueue -> active`
  - 口径：从 route 成功入队时间戳到 worker 首次处理该 job 的时间差（P50/P95）。
  - 目标：评估吞吐配置（`localConcurrency/batchSize`）调优收益。
- `失败率`
  - 口径：在固定时间窗内 `failed / (completed + failed)`，按队列分维度统计。
  - 目标：验证 `feed/fulltext` 自动重试 + DLQ 后的最终失败收敛效果。

## 4. 回滚开关与参数

可按风险从轻到重回滚：

- 并发/批量回滚
  - 下调 `contracts.ts` 的 `worker.localConcurrency` 与 `worker.batchSize`。
- 重试策略回滚
  - 下调或清空 `feed/fulltext` 的 `retryLimit/retryDelay/retryBackoff/retryDelayMax`。
- DLQ 回滚
  - 临时移除对应 queue contract 的 `deadLetter` 字段（保留已有 DLQ 数据不删）。
- 语义回滚
  - 如需紧急回退，可让 route 层临时回落到 legacy `enqueue()` 分支。

## 5. 验证证据（命令输出摘要）

- 全量单测：
  - 命令：`pnpm run test:unit`
  - 结果：`Test Files 85 passed | 1 skipped`，`Tests 285 passed | 4 skipped`。
- 关键新增测试：
  - `src/server/queue/contracts.test.ts`
  - `src/server/queue/queue.test.ts`
  - `src/server/queue/bootstrap.test.ts`
  - `src/worker/workerRegistry.test.ts`
  - `src/server/queue/observability.test.ts`

## 6. 后续建议

- 在线上环境补齐 `queue lag / enqueue->active / failed ratio` 的固定看板与告警阈值。
- 按业务峰值逐步调参 `localConcurrency/batchSize`，每次只变更单一队列。
- 对 DLQ 建立 replay/runbook，形成标准恢复路径。

# RSS World Next.js 16 迁移设计（保留现有 UI）

日期：2026-02-22  
状态：已评审通过（方案 A）  
作者：Codex（与用户共创）

## 1. 背景与目标

当前项目基于 `Vite + React + TypeScript + TailwindCSS + Zustand`，希望升级到更适合未来迭代的框架形态，并为后续后端化做准备。

本次确定路线：
- 一次性迁移到 `Next.js 16 App Router`
- 优先面向自托管（`next build` + `next start` + Docker）
- 后端能力暂不实现，仅预留数据层扩展边界
- **硬约束：保留现有 UI 设计（视觉风格、布局结构、交互习惯）**

## 2. 约束与原则

### 2.1 硬约束

- 不改变当前三栏布局与主要交互路径
- 不做视觉重设计，不引入新的 UI 风格体系
- 键盘快捷键与阅读交互行为保持一致（`j/k/s/m/v`）

### 2.2 架构原则

- UI 层与数据来源解耦：通过 `ReaderDataProvider` 抽象数据访问
- 迁移后短期继续 client-first 交互，避免因过早 SSR/RSC 化引入不必要复杂度
- 为未来接入后端预留稳定接口，不要求本次实现后端

## 3. 范围定义

### 3.1 In Scope

- 框架从 Vite 迁移到 Next.js App Router
- 目录重构为 `src/app` + `features` + `data/provider`
- 保留并迁移现有状态管理（`Zustand`）
- 升级并兼容 `TailwindCSS v4`
- 环境变量与构建脚本迁移（`VITE_*` -> `NEXT_PUBLIC_*`）
- 自托管部署路径可用（Node.js / Docker）

### 3.2 Out of Scope

- 实现真实后端 API、鉴权、抓取与同步
- 大规模 UI 改版或交互重设计
- 新增复杂业务模块（如多租户、团队协作）

## 4. 目标技术基线（以 2026-02-22 为准）

- `next`: `16.1.6`
- `react`: `19.2.x`
- `react-dom`: `19.2.x`
- `tailwindcss`: `4.2.0`
- `typescript`: `5.9.x`
- Node.js：`>= 20.9`（当前本地 `v24.13.0` 满足）

## 5. 目标架构

### 5.1 目录结构（建议）

```txt
src/
  app/
    (reader)/
      layout.tsx
      page.tsx
      error.tsx
      loading.tsx
  features/
    feeds/
    articles/
    settings/
  components/
  store/
    appStore.ts
    settingsStore.ts
  data/
    provider/
      readerDataProvider.ts
    mock/
      mockProvider.ts
  lib/
    storage/
    date/
  types/
```

### 5.2 关键分层职责

- `app/*`：路由与页面壳层，仅做编排和全局边界
- `features/*`：业务模块（feeds/articles/settings）
- `components/*`：可复用展示组件
- `store/*`：前端 UI/交互状态
- `data/provider/*`：数据访问抽象层（当前 mock，未来 API）

### 5.3 数据流

1. 页面启动后加载 `ReaderDataProvider`
2. provider 返回 feeds/articles 给 feature 层
3. feature 层驱动 `Zustand` 状态与渲染
4. 用户操作先更新 store，再经 provider 落盘（当前 localStorage）
5. 后续切换 API provider 时，UI 调用保持不变

## 6. UI 保留策略（本设计核心）

- 迁移阶段以“像素级近似 + 交互等价”为验收标准
- 不调整信息架构：侧栏、文章列表、阅读面板顺序与语义不变
- 主题、字体、字号、行高设置项保留原行为
- 快捷键映射保持不变
- 仅允许为框架兼容做不可见层改动（入口文件、路由壳、配置）

## 7. 兼容性与风险

### 7.1 主要风险

- `Tailwind v4` utility 与默认行为变化导致样式细微偏差
- 主题与用户偏好在 hydration 时出现闪烁或 mismatch
- 入口迁移后遗留 Vite 文件造成双入口混乱

### 7.2 缓解措施

- 样式升级采用“先机械迁移，再页面对照验收”
- 偏好设置在客户端初始化完成后应用
- 清理 `main.tsx/index.html/vite.config.ts/tsconfig.node.json` 等 Vite 资产

## 8. 验证与验收标准

### 8.1 必过检查

- `pnpm run lint`
- `pnpm run build`
- 关键交互回归：
  - 三栏布局与响应式行为正常
  - feed 切换、文章选中、星标/已读可用
  - `j/k/s/m/v` 快捷键可用
  - 主题/阅读设置刷新后可恢复

### 8.2 UI 保留验收

- 与迁移前对照检查：布局、层级、间距、颜色语义、主要交互路径一致
- 不接受“迁移顺便改 UI”

## 9. 部署与回滚

### 9.1 部署目标

- 自托管 Node.js 或 Docker
- 生产建议通过反向代理（如 nginx）前置

### 9.2 回滚策略

- 保留迁移前稳定 tag/镜像
- 出现不可接受回归时按版本回滚，不在线上临时热修复架构问题

## 10. 后续衔接

本设计通过后，下一步可进入实现计划（`workflow-writing-plans`）：
- 拆分迁移批次
- 明确每批次可验证产出
- 将 UI 对照验收嵌入每批次完成标准

## 11. 参考来源

- https://nextjs.org/docs/app/guides/migrating/from-vite
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/app/guides/self-hosting
- https://nextjs.org/docs/app/building-your-application/deploying#docker-image
- https://tailwindcss.com/docs/upgrade-guide
- https://react.dev/blog/2025/10/01/react-19-2
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- https://nodejs.org/en/about/previous-releases
- https://github.com/RSSNext/Folo
- https://github.com/electh/ReactFlux
- https://github.com/electh/nextflux

# Repository Guidelines

## Project Structure & Module Organization

FeedFuse 是一个基于 Next.js 16、React 19、TypeScript 的单仓库应用。主要代码位于 `src/`：`src/app` 放 App Router 页面与全局样式，`src/components` 放通用 UI，`src/features` 放业务功能，`src/server` 放服务端逻辑、队列与数据库访问，`src/worker` 放异步任务入口与处理器。测试通常与实现文件同目录放置，命名为 `*.test.ts` 或 `*.test.tsx`。静态资源在 `public/`，开发与部署文档在 `docs/`，脚本在 `scripts/`。

## Build, Test, and Development Commands

优先使用 `pnpm`。

- `pnpm install`：安装依赖，要求 `Node >=20.19.0`、`pnpm@10`
- `pnpm dev`：启动 Web 开发服务，默认端口 `9559`
- `pnpm worker:dev`：启动后台 worker，用于抓取、摘要、翻译等任务
- `pnpm build`：构建生产版本
- `pnpm start`：启动生产构建
- `pnpm lint`：运行 ESLint
- `pnpm test:unit`：运行 Vitest 单测
- `node scripts/db/migrate.mjs`：执行 PostgreSQL 迁移
- `docker compose up -d db`：拉起本地 PostgreSQL 16

## Coding Style & Naming Conventions

项目使用 TypeScript + ESM，默认 2 空格缩进、保留分号、优先单引号。组件文件使用 `PascalCase` 导出，hooks 使用 `useXxx`，工具函数使用 `camelCase`，测试文件与源文件同名追加 `.test.ts(x)`。数据库迁移位于 `src/server/db/migrations/`，遵循 `00xx_description.sql` 命名。提交前至少运行 `pnpm lint`；ESLint 配置在 `eslint.config.js`。

## Testing Guidelines

测试框架为 Vitest。Node 环境测试覆盖 `src/server`、`src/worker`、`src/lib`、`src/data` 等模块，DOM 相关测试使用 `jsdom`。新增功能应补充同目录单测；涉及迁移时，补充对应 migration test；涉及 UI 交互时，优先补 `*.test.tsx`。开发时可用 `pnpm test:unit:watch` 持续运行测试。

## Commit & Pull Request Guidelines

Git 历史采用 Conventional Commits，例如 `fix(reader): 修复中栏选中文章保留后的列表错序`、`feat(feeds): 添加分类自动创建提示`。请保持 `<type>(<scope>): <subject>` 结构，`scope` 不省略，主题使用简体中文并直接描述核心改动。PR 应说明用户可见变化、数据库或环境变量影响；UI 变更附截图，异步任务或数据结构变更附验证步骤。

## Security & Configuration Tips

从 `.env.example` 复制生成 `.env`，至少配置 `DATABASE_URL` 与 `IMAGE_PROXY_SECRET`。不要提交真实密钥。任何涉及外部抓取、代理或 OpenAI 配置的改动，都应同时更新相关文档与安全校验逻辑。

## Other Rules

不自动做浏览器测试，如果要做必须先询问
任何代码类（仅修改文档除外）更改后验证必须调用 pnpm build 进行构建验证

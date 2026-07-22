---
alwaysApply: false
description: 编辑 apps/web/ 下的 Next.js / React / Ant Design 前端代码时使用该规则
globs: apps/web/**, packages/shared/**
---

# 前端开发规则（Next.js 15 + React 19 + Ant Design 5）

## 框架约束

- Next.js 15 App Router（`app/` 目录），不使用 Pages Router。
- React 19，优先使用 Server Components，交互逻辑用 `"use client"` 标注。
- 状态管理使用 TanStack Query（服务端状态）+ React useState/useReducer（本地状态）。
- UI 组件库使用 Ant Design 5，不自造同类型组件。

## 目录结构

```
apps/web/src/
├── app/           # Next.js App Router 页面
│   ├── layout.tsx # 根布局
│   ├── page.tsx   # 首页
│   └── providers.tsx # Provider 包裹
├── components/     # 通用组件
├── features/      # 功能模块（按领域分）
└── lib/           # 工具函数、API 客户端
```

## TypeScript 规范

- 严格模式（`strict: true`），不允许 `any`，必要时使用 `unknown` + 类型守卫。
- 共享类型放 `packages/shared/src/`，通过 `@design-platform/shared` 引用。
- API 请求/响应类型与 BFF 契约一致，参考 `design/r2-contract-catalog/`。

## 样式规范

- 优先使用 Ant Design 的 Token 系统和 `theme` 配置。
- 自定义样式使用 CSS Modules（`*.module.css`），不使用内联样式。
- 响应式布局使用 Ant Design 的 `Grid` 系统（`Row`/`Col`）。

## 数据获取

- 服务端数据获取使用 Next.js `fetch` + 缓存策略。
- 客户端数据获取使用 TanStack Query 的 `useQuery` / `useMutation`。
- BFF API 基础 URL 通过环境变量 `BFF_URL` 配置。

## 测试

- 单元测试使用 Vitest（或 Jest）。
- 组件测试使用 React Testing Library。
- E2E 测试预留 Playwright 接入点（V1 不强制）。

## 前端约定补充（TanStack Query + Zod + A11y + i18n + 性能）

### 状态管理

- Zustand（全局客户端状态）+ useState/useReducer（局部）+ URL searchParams（分页/筛选）
- 异步数据用 TanStack Query，不放全局 store
- 禁止全局单例变量、props 超过 3 层传递

### 数据获取（TanStack Query）

- 声明式：用 useQuery/useMutation 封装，禁止 useEffect + 裸 fetch
- queryKey 必须包含所有依赖参数
- mutation 成功后 invalidate 关联 queries
- 三态处理：loading（Skeleton）/ error（role="alert"）/ empty（引导文案）
- 乐观更新：先更新 UI 再等服务端确认，失败回滚
- 分页/筛选状态放 URL searchParams

### 表单处理

- Zod 做 SSOT Schema（packages/shared 共享类型 + 校验）
- React Hook Form + Zod（zodResolver）
- 提交中禁用按钮（isSubmitting）
- 前后端共享 schema：TS monorepo 通过 packages/shared 共享 Zod schema

### 可访问性 WCAG 2.2 AA 合规（境外市场法规要求）

#### 必做 Checklist（每个 PR 必过）
- 语义化 HTML（<button> 而非 <div onClick>，<h1>-<h6> 而非 <div> 当标题）
- ARIA 属性完整（aria-label / aria-expanded / aria-describedby）
- 颜色对比度：普通文本 ≥ 4.5:1，大文本/UI ≥ 3:1
- 键盘导航：Tab 可达 + focus-visible ring + 跳过链接
- 表单：label htmlFor + autoComplete + aria-required + role="alert" 错误
- 图片有 alt（信息性描述，装饰性 alt=""）
- 焦点管理：模态 focus trap + 关闭回到触发元素
- 焦点不被粘性 header 遮挡（scroll-mt-16）
- Touch target ≥ 24×24 CSS px（WCAG 2.2 - 2.5.8）
- 拖拽有非拖拽替代（WCAG 2.2 - 2.5.7）

#### 工具链
- eslint-plugin-jsx-a11y（Lint 必装）
- @axe-core/react（开发期警告）
- Lighthouse CI accessibility ≥ 0.95（CI 门禁）

#### Ant Design 5 适配
- Ant Design 组件默认遵守 WAI-ARIA，不要覆盖其 ARIA 属性或 tabIndex
- 自定义组件需补 aria-label / aria-expanded / aria-describedby
- 加载状态用 `<div role="status" aria-live="polite"><Spinner /></div>`
- 错误提示用 `<div role="alert">`
- 动画尊重 `prefers-reduced-motion`

### 国际化与本地化（OD-01 适配）

- 项目默认语言：英文（en-US），公制 SI 单位，ISO/EN 规范优先
- 时间统一存 UTC ISO 8601（TIMESTAMPTZ），前端用 date-fns-tz 按用户时区显示
- 金额/尺寸用定点数：DB 用 NUMERIC(20,4)，禁止 FLOAT/DOUBLE
- 单位格式化用 Intl.NumberFormat（metric style: 'unit'）
- 英文文案外提到 messages/en-US.json，命名 module.field
- 推荐技术栈：Next.js 15 App Router 用 next-intl
- 禁止硬编码用户可见文案（用 eslint-plugin-i18next 检测）
- 禁止存本地时间字符串（无时区）
- 禁止金额/坐标用 FLOAT/DOUBLE

### 性能 SLO

- Web Vitals：LCP < 2.5s / INP < 200ms / CLS < 0.1
- 首屏 JS（gzip）≤ 150KB，单 chunk ≤ 50KB
- Ant Design 组件按需导入，禁止全量
- 大列表（构件清单 > 100 项）用虚拟化（@tanstack/react-virtual）
- 图片用 next/image + AVIF/WebP
- 禁止 lodash 全量导入（用 lodash-es 按需）
- 禁止 moment.js（用 date-fns 或 dayjs）
- 禁止 OFFSET 大分页（> 10000 慢）→ 用游标
- 禁止在 JSX 中定义对象/数组/函数（每次新引用）

# Premium Mode Settings Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Premium 模式默认关闭，只能由当前浏览器的普通设置页开关开启；开启后首页显示入口并可进入 `/premium`，关闭后 `/premium/*` 统一拦截，同时保留 `PREMIUM_PASSWORD` 校验。

**Architecture:** 继续复用 `settingsStore` 作为本地总闸门数据源，在普通设置页写入 `premiumModeEnabled`。新增一个共享的 `/premium` 路由 gate 统一拦截所有 Premium 子路由，并用一个小型订阅 hook 把首页入口和 Gate 都绑定到同一个本地状态。首页入口不新增导航位，而是在现有标签入口区插入一个稳定可控的“高级”标签。

**Tech Stack:** Next.js App Router, React 19, TypeScript, localStorage-backed settings store, ESLint, Next build

---

## Implementation Notes

- 当前仓库 `package.json` 没有配置单元测试 runner；本计划不引入新的测试栈，避免把一个小切片做成大手术。
- 本切片的验证基线使用：
  - 聚焦文件的 `npm run lint -- <paths...>`
  - 全量 `npm run lint`
  - 全量 `npm run build`
  - 浏览器手动回归
- 保持 tight scope：不改 `PREMIUM_PASSWORD` 服务端语义，不碰 Premium 内部数据结构，不新加全站配置。

## File Map

### Create

- `lib/hooks/usePremiumModeEnabled.ts`
  - 订阅 `settingsStore`，向客户端组件暴露 `premiumModeEnabled`
- `components/PremiumModeGate.tsx`
  - 关闭时阻断 `/premium/*`，提供返回首页 / 前往设置按钮
- `app/premium/layout.tsx`
  - 给整个 Premium 路由族挂统一 gate

### Modify

- `lib/store/settings-store.ts`
  - 新增 `premiumModeEnabled` 字段、默认值、旧数据回退解析
- `app/settings/hooks/useSettingsPage.ts`
  - 透出 `premiumModeEnabled` 与保存 handler
- `components/settings/DisplaySettings.tsx`
  - 增加“开启高级模式”开关 UI
- `app/settings/page.tsx`
  - 透传开关值与 handler
- `components/home/hooks/useTagManager.ts`
  - 支持按状态注入/移除稳定的“高级”标签
- `components/home/PopularFeatures.tsx`
  - 读取 `premiumModeEnabled`，仅在开启时展示 Premium 入口并维持点击跳转
- `README.md`
  - 更新 Premium 模式入口说明和 `PREMIUM_PASSWORD` 行为描述

## Manual Verification Checklist

- 默认状态：首页无“高级”入口，访问 `/premium`、`/premium/settings`、`/premium/favorites` 被阻断
- 设置页开启后：首页出现“高级”入口，点击后进入 `/premium`
- 若设置了 `PREMIUM_PASSWORD`：进入 `/premium` 后仍显示密码输入页
- 关闭开关后：首页入口消失，再次访问 `/premium/*` 统一被阻断
- 旧的 `kvideo-settings` 缺少 `premiumModeEnabled` 字段时不报错，按 `false` 处理

### Task 1: Extend settings model and expose a reusable premium-mode hook

**Files:**
- Modify: `lib/store/settings-store.ts`
- Create: `lib/hooks/usePremiumModeEnabled.ts`

- [ ] **Step 1: Add the new persisted flag to `AppSettings`**

在 `lib/store/settings-store.ts` 中加入：

```ts
premiumModeEnabled: boolean;
```

并把默认值写进 `getDefaultAppSettings()`：

```ts
premiumModeEnabled: false,
```

- [ ] **Step 2: Add backward-compatible parsing for old localStorage payloads**

在 `settingsStore.getSettings()` 返回对象里补解析：

```ts
premiumModeEnabled:
  parsed.premiumModeEnabled !== undefined ? parsed.premiumModeEnabled : false,
```

要求：
- 缺字段时回退 `false`
- 不影响其它字段解析

- [ ] **Step 3: Create a tiny subscription hook for client components**

在 `lib/hooks/usePremiumModeEnabled.ts` 新建 hook：

```ts
import { useEffect, useState } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

export function usePremiumModeEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(settingsStore.getSettings().premiumModeEnabled);
    sync();
    return settingsStore.subscribe(sync);
  }, []);

  return enabled;
}
```

- [ ] **Step 4: Verify the compatibility baseline manually**

手动在浏览器里把 `localStorage['kvideo-settings']` 改成不含 `premiumModeEnabled` 的旧对象，然后刷新页面。

Expected:
- 页面正常加载
- `settingsStore.getSettings().premiumModeEnabled === false`

- [ ] **Step 5: Run focused lint**

Run:

```bash
npm run lint -- 'lib/store/settings-store.ts' 'lib/hooks/usePremiumModeEnabled.ts'
```

Expected:
- exit code `0`

- [ ] **Step 6: Commit**

```bash
git add 'lib/store/settings-store.ts' 'lib/hooks/usePremiumModeEnabled.ts'
git commit -m 'feat: add premium mode settings flag'
```

### Task 2: Wire the premium-mode toggle into the normal settings page

**Files:**
- Modify: `app/settings/hooks/useSettingsPage.ts`
- Modify: `components/settings/DisplaySettings.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add state + save handler in `useSettingsPage`**

在 `app/settings/hooks/useSettingsPage.ts`：

- 增加本地 state：

```ts
const [premiumModeEnabled, setPremiumModeEnabled] = useState(false);
```

- 在 `syncFromStore()` 中同步：

```ts
setPremiumModeEnabled(settings.premiumModeEnabled);
```

- 增加 handler：

```ts
const handlePremiumModeEnabledChange = (enabled: boolean) => {
  setPremiumModeEnabled(enabled);
  const currentSettings = settingsStore.getSettings();
  settingsStore.saveSettings({
    ...currentSettings,
    premiumModeEnabled: enabled,
  });
};
```

- [ ] **Step 2: Extend `DisplaySettingsProps`**

在 `components/settings/DisplaySettings.tsx` 增加 props：

```ts
premiumModeEnabled: boolean;
onPremiumModeEnabledChange: (enabled: boolean) => void;
```

- [ ] **Step 3: Render the new toggle row**

在“显示设置”顶部或“记住滚动位置”附近插入新开关：

```tsx
<Switch
  checked={premiumModeEnabled}
  onChange={onPremiumModeEnabledChange}
  ariaLabel='开启高级模式开关'
/>
```

文案固定为：
- 标题：`开启高级模式`
- 描述：`开启后首页显示高级入口，并允许访问 /premium；关闭后隐藏入口并阻止访问高级页面`

- [ ] **Step 4: Pass the new prop chain from `app/settings/page.tsx`**

把 `premiumModeEnabled` 和 `handlePremiumModeEnabledChange` 从 `useSettingsPage()` 解构出来，并传给 `DisplaySettings`。

- [ ] **Step 5: Verify localStorage write-through**

在浏览器中打开设置页，切换开关两次，检查：

```js
JSON.parse(localStorage.getItem('kvideo-settings')).premiumModeEnabled
```

Expected:
- 跟 UI 状态一致

- [ ] **Step 6: Run focused lint**

Run:

```bash
npm run lint -- 'app/settings/hooks/useSettingsPage.ts' 'components/settings/DisplaySettings.tsx' 'app/settings/page.tsx'
```

Expected:
- exit code `0`

- [ ] **Step 7: Commit**

```bash
git add 'app/settings/hooks/useSettingsPage.ts' 'components/settings/DisplaySettings.tsx' 'app/settings/page.tsx'
git commit -m 'feat: add premium mode toggle to settings'
```

### Task 3: Protect all `/premium/*` routes with a shared gate

**Files:**
- Create: `components/PremiumModeGate.tsx`
- Create: `app/premium/layout.tsx`

- [ ] **Step 1: Create `PremiumModeGate`**

新组件职责：

- 读 `usePremiumModeEnabled()`
- `true` 时返回 `children`
- `false` 时渲染阻断页

阻断页至少包含：

```tsx
<Link href='/settings'>前往设置</Link>
<Link href='/'>返回首页</Link>
```

不要在这里处理 `PREMIUM_PASSWORD`，只负责本地总闸门。

- [ ] **Step 2: Add `app/premium/layout.tsx`**

用 layout 统一包裹：

```tsx
import { PremiumModeGate } from '@/components/PremiumModeGate';

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return <PremiumModeGate>{children}</PremiumModeGate>;
}
```

- [ ] **Step 3: Verify the blocked state manually**

在 `premiumModeEnabled = false` 时分别访问：

- `/premium`
- `/premium/settings`
- `/premium/favorites`

Expected:
- 都显示同一类阻断 UI
- 不进入 Premium 页面主体

- [ ] **Step 4: Verify the allowed state manually**

在 `premiumModeEnabled = true` 时再访问以上页面。

Expected:
- 路由正常进入
- `/premium` 继续交由 `PremiumPasswordGate` 决定是否弹密码页

- [ ] **Step 5: Run focused lint**

Run:

```bash
npm run lint -- 'components/PremiumModeGate.tsx' 'app/premium/layout.tsx'
```

Expected:
- exit code `0`

- [ ] **Step 6: Commit**

```bash
git add 'components/PremiumModeGate.tsx' 'app/premium/layout.tsx'
git commit -m 'feat: gate premium routes behind settings'
```

### Task 4: Show a stable homepage premium entry only when enabled

**Files:**
- Modify: `components/home/hooks/useTagManager.ts`
- Modify: `components/home/PopularFeatures.tsx`

- [ ] **Step 1: Define a stable synthetic premium tag**

在 `components/home/hooks/useTagManager.ts` 顶部增加常量：

```ts
const PREMIUM_TAG = { id: 'premium-entry', label: '高级', value: '高级' };
```

目标：
- 不依赖用户自己手动添加 `高级` 标签
- 首页入口由代码显式控制，不靠碰运气

- [ ] **Step 2: Inject or remove the premium tag based on the local flag**

在 `useTagManager()` 中读取 `premiumModeEnabled`（可直接读 store，或复用新的小 hook/辅助函数），确保：

- 开启时：`tags` 列表包含 `PREMIUM_TAG`
- 关闭时：过滤掉任何 `label === '高级'` 或 `id === 'premium-entry'` 的入口

要求：
- 不污染用户其它自定义标签
- `handleRestoreDefaults()` 后也要保持同样规则

- [ ] **Step 3: Update the homepage click branch to use the stable id**

在 `components/home/PopularFeatures.tsx` 中把判断收敛成：

```ts
if (tagId === 'premium-entry' || tags.find(t => t.id === tagId)?.label === '高级') {
  window.location.href = '/premium';
  return;
}
```

如果 `useTagManager()` 已保证只有开启时才会出现该标签，则这里不需要再二次拦截。

- [ ] **Step 4: Verify homepage visibility manually**

Expected:
- 开关关闭：首页标签区没有“高级”
- 开关开启：首页标签区出现“高级”
- 点击“高级”后跳转 `/premium`

- [ ] **Step 5: Run focused lint**

Run:

```bash
npm run lint -- 'components/home/hooks/useTagManager.ts' 'components/home/PopularFeatures.tsx'
```

Expected:
- exit code `0`

- [ ] **Step 6: Commit**

```bash
git add 'components/home/hooks/useTagManager.ts' 'components/home/PopularFeatures.tsx'
git commit -m 'feat: show premium homepage entry only when enabled'
```

### Task 5: Update documentation and run final regression verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Premium mode entry description**

把 README 中“直接输入 `/premium` 即可进入”的表述改成：

- 需要先在普通设置页开启高级模式
- 开启后首页会显示入口
- 仍可直接访问 `/premium`，但前提是本地总闸门已开启

- [ ] **Step 2: Update the `PREMIUM_PASSWORD` section**

补充说明：

- `PREMIUM_PASSWORD` 只负责 Premium 模式的密码校验
- 是否允许当前浏览器访问 `/premium` 由普通设置页中的本地开关决定

- [ ] **Step 3: Run full lint**

Run:

```bash
npm run lint
```

Expected:
- exit code `0`

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected:
- build 成功
- 无新的 TypeScript / Next build 错误

- [ ] **Step 5: Execute the full manual regression checklist**

按本文顶部 `Manual Verification Checklist` 全量走一遍，并记录实际结果。

- [ ] **Step 6: Commit**

```bash
git add 'README.md'
git commit -m 'docs: describe premium mode settings gate'
```

- [ ] **Step 7: Prepare final delivery notes**

最终汇报必须包含：
- 改动文件列表
- `npm run lint` 结果
- `npm run build` 结果
- 手动验证结果
- 是否保留 `PREMIUM_PASSWORD`

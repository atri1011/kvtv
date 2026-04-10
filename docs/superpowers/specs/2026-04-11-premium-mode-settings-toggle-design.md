# Premium 模式改为在设置中开启 - 设计说明

## 目标

把当前独立可访问的 `/premium` 模式收口为“当前用户在本地设置中显式开启后才可见、才可访问”的行为，同时保留现有 `PREMIUM_PASSWORD` 密码校验。

本次设计要满足：

- 默认关闭 Premium 模式
- 在普通设置页中提供开关
- 开启后，首页出现现有 Premium 入口，用户点击即可进入 `/premium`
- 关闭后，首页不显示入口，直接访问 `/premium` 及其子路由也会被拦截
- 开启后仍保留现有 `PREMIUM_PASSWORD` 校验链路
- 作用域仅限当前浏览器 / 当前本地用户，不做全站共享

## 当前现状

### 已有能力

- `app/premium/page.tsx`
  - Premium 首页路由
  - 当前仅由 `components/PremiumPasswordGate.tsx` 控制是否需要输入 `PREMIUM_PASSWORD`
- `app/api/auth/route.ts`
  - `GET` 返回 `hasPremiumAuth`
  - `POST` 在 `type === 'premium'` 时校验 `PREMIUM_PASSWORD`
- `lib/store/settings-store.ts`
  - 普通模式设置统一存放在 `kvideo-settings`
  - 已承载多个本地布尔开关，适合作为新的本地总闸门载体
- `app/settings/page.tsx` + `app/settings/hooks/useSettingsPage.ts`
  - 普通设置页及其状态同步入口
- `components/settings/DisplaySettings.tsx`
  - 当前“显示设置”区块已经承载多个纯本地 UI 行为开关
- `components/home/PopularFeatures.tsx`
  - 首页现有“高级”入口实际是标签点击跳转
  - 当前命中 “高级” 标签时直接 `window.location.href = '/premium'`

### 当前问题

- `/premium` 当前不是“在设置中开启”的模式，而是“知道地址就能访问，再由密码二次校验”
- 首页 Premium 入口没有和本地设置开关联动
- `/premium/settings`、`/premium/favorites` 等子路由没有统一总闸门

## 不做的事

- 不把该开关升级为服务端 / 全站级配置
- 不改变 `PREMIUM_PASSWORD` 的语义
- 不修改 Premium 模式内部的数据结构（如 `premiumSources`、`kvideo-premium-mode-settings`）
- 不新增顶栏入口；首页继续复用现有入口形态

## 核心决策

### 1. 新增本地总闸门

在 `lib/store/settings-store.ts` 的 `AppSettings` 中新增：

```ts
premiumModeEnabled: boolean
```

约束：

- 默认值为 `false`
- 从旧版 `localStorage` 读取时，缺失字段按 `false` 处理
- 继续使用现有 `settingsStore.saveSettings()` 持久化到 `kvideo-settings`

### 2. 开关放在普通设置页，而不是 Premium 设置页

在普通设置页的 `DisplaySettings` 中增加开关项：

- 标题：`开启高级模式`
- 说明：`开启后首页显示高级入口，并允许访问 /premium；关闭后隐藏入口并阻止访问高级页面`

原因：

- 这是 Premium 路由族的“前置总闸门”
- 用户必须先在普通设置中开启，才有资格进入 Premium 相关页面

### 3. 首页继续复用现有入口

不增加新的导航按钮，继续复用首页当前“高级”入口形态。

实现目标：

- `premiumModeEnabled = false`
  - 首页不展示“高级”入口
- `premiumModeEnabled = true`
  - 首页展示现有“高级”入口
  - 点击后直接进入 `/premium`

根据当前实现，首页入口来自 `components/home/PopularFeatures.tsx` 对标签 `高级` 的处理，因此实现时需要保证：

- 当开关关闭时，该标签不应出现在首页可见标签列表中
- 当开关开启时，该标签恢复可见并保持当前跳转行为

### 4. 用共享 Gate 兜住整个 `/premium/*`

新增一个共享路由闸门，建议落在：

- `app/premium/layout.tsx`
- 配套客户端 Gate 组件，例如 `components/PremiumModeGate.tsx`

职责：

- 读取 `settingsStore.getSettings().premiumModeEnabled`
- 开启时放行 `children`
- 关闭时阻断整个 `/premium` 路由族，包括：
  - `/premium`
  - `/premium/settings`
  - `/premium/favorites`

关闭时展示阻断 UI，而不是空白页。阻断 UI 至少提供：

- `前往设置`
- `返回首页`

这样可以避免把“是否允许访问 Premium”散落在多个页面里分别判断。

### 5. 现有密码校验保留，顺序后置

访问链路变为：

1. 先过本地总闸门 `premiumModeEnabled`
2. 再过现有 `PremiumPasswordGate`

结果：

- 未开启设置开关：不进入 Premium 页面，不触发密码输入页
- 已开启设置开关：继续按 `PREMIUM_PASSWORD` 现有逻辑校验

## 用户行为定义

### 默认状态

- 新用户 / 本地未存储该字段时，`premiumModeEnabled = false`
- 首页无 Premium 入口
- 手动访问 `/premium`、`/premium/settings`、`/premium/favorites` 时显示阻断页

### 开启后

- 普通设置页保存 `premiumModeEnabled = true`
- 首页出现现有 Premium 入口
- 点击入口进入 `/premium`
- 如果服务端配置了 `PREMIUM_PASSWORD`，仍需输入密码

### 关闭后

- 首页立即隐藏 Premium 入口
- 再次访问 `/premium` 路由族时统一被 Gate 阻断
- 不清理已有 `premiumSources` 或 `kvideo-premium-mode-settings`，仅禁止入口和访问

## 影响范围

### 必改文件

- `lib/store/settings-store.ts`
  - 新增字段、默认值、旧数据兼容解析
- `app/settings/hooks/useSettingsPage.ts`
  - 同步开关状态并提供保存 handler
- `components/settings/DisplaySettings.tsx`
  - 增加开关 UI
- `app/settings/page.tsx`
  - 透传新字段和 handler
- `components/home/PopularFeatures.tsx`
  - 根据开关决定是否展示 / 响应“高级”入口
- `app/premium/layout.tsx`
  - 新增共享路由 gate
- `components/PremiumModeGate.tsx` 或同类新组件
  - 实现阻断 UI 与放行逻辑

### 受影响但逻辑不改的文件

- `components/PremiumPasswordGate.tsx`
  - 保留原有密码校验逻辑
- `app/premium/page.tsx`
  - 仍使用 `PremiumPasswordGate`
- `app/premium/settings/page.tsx`
  - 由新的共享 route gate 在更外层统一保护

## 边界与兼容性

### 本地兼容

- 旧版 `kvideo-settings` 无 `premiumModeEnabled` 字段时不能报错
- 导入旧设置备份时，该字段缺失应回退到 `false`

### 权限边界

- 该开关仅控制“当前浏览器能否看到入口和访问 Premium 路由”
- 不替代 `PREMIUM_PASSWORD`
- 不替代 `AdminGate`

### UI 边界

- 不新增顶栏入口
- 不在 Premium 模式内部增加“关闭高级模式”快捷入口
- 普通设置页是唯一主入口

## 风险与注意点

### 1. 不能只藏首页按钮

如果只隐藏首页入口而不拦 `/premium/*`，用户仍能手输地址进入，和目标不符。

### 2. 首页入口当前是标签，不是独立按钮

实现时要特别注意 `PopularFeatures` 里的“高级”入口来自标签数据和点击分支，不能只改点击逻辑，还要处理可见性。

### 3. 需要统一保护 Premium 子路由

如果只改 `app/premium/page.tsx`，那 `/premium/settings` 和 `/premium/favorites` 仍可能漏掉，因此应优先采用 `app/premium/layout.tsx` 做统一路由保护。

## 验证方案

由于仓库当前未见现成自动化测试框架接线，本次以构建与手动功能验证为主。

### 静态验证

- `npm run lint`
- `npm run build`

### 手动验证

1. 默认状态
   - 打开首页，不显示 Premium 入口
   - 访问 `/premium`，看到阻断页
   - 访问 `/premium/settings`，看到阻断页

2. 开启后
   - 在普通设置页打开“开启高级模式”
   - 回到首页，出现 Premium 入口
   - 点击入口进入 `/premium`

3. 密码链路
   - 若配置了 `PREMIUM_PASSWORD`，进入 `/premium` 后仍显示密码验证
   - 输入正确密码后正常进入 Premium 首页

4. 关闭后回归
   - 关闭“开启高级模式”
   - 首页入口消失
   - 再次访问 `/premium/*` 被统一阻断

## 后续实现建议

实现阶段建议保持一个紧凑切片完成：

1. 先补 store 字段与设置页开关
2. 再加 `/premium` 共享 gate
3. 最后收首页入口可见性
4. 跑 `lint + build`，再做手动验证闭环

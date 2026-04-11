# Mobile Player Primary Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让手机竖屏播放页只展示极简主控条，把次级功能从底栏挪出，保留现有更多菜单作为扩展入口。

**Architecture:** 继续复用 `DesktopVideoPlayer` 作为统一播放器容器，只在控件层增加“手机竖屏主控条”分支，避免重建整套移动播放器。桌面与横屏沿用现有 `DesktopControls` 结构，手机竖屏则渲染一个新的极简组件，并通过少量 CSS 扩展放大触控命中区和进度条视觉厚度。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, existing player hooks, ESLint, Next build

---

## Implementation Notes

- 当前仓库没有现成的单元测试 runner，本切片不引入新测试栈，验证以聚焦 lint + 全量 build + 手动回归为主。
- 这次只处理手机竖屏底栏密度，不重做横屏/全屏，不调整手势逻辑。
- 新增文件必须保持小而清晰，别把一个手机适配切片写成巨石。

## File Map

### Create

- `components/player/mobile/MobilePrimaryControls.tsx`
  - 手机竖屏极简主控条

### Modify

- `components/player/DesktopVideoPlayer.tsx`
  - 把手机竖屏判定透传给控件层
- `components/player/desktop/DesktopControlsWrapper.tsx`
  - 透传 `isMobilePrimaryLayout`
- `components/player/desktop/DesktopControls.tsx`
  - 在桌面控件栏与手机竖屏主控条之间切换
- `components/player/desktop/DesktopProgressBar.tsx`
  - 支持手机主控条样式
- `app/styles/video-player.css`
  - 增加手机主控条按钮 / 进度条样式

## Manual Verification Checklist

- 手机竖屏：底栏只剩播放、时间、进度、全屏
- 手机竖屏：左上角更多菜单仍可访问次级能力
- 桌面：原有底栏按钮不缺失
- 手机横屏/旋转态：不误切成竖屏极简布局

### Task 1: Add a dedicated mobile primary controls component

**Files:**
- Create: `components/player/mobile/MobilePrimaryControls.tsx`

- [ ] **Step 1: Create the mobile primary controls component**

组件只接收极简主控所需参数：

- `isPlaying`
- `currentTime`
- `duration`
- `formatTime`
- `onTogglePlay`
- `onToggleFullscreen`
- `children` 或进度条节点

- [ ] **Step 2: Render a two-row mobile layout**

结构固定为：

- 第一行：时间文案
- 第二行：播放按钮 + 中间进度条 + 全屏按钮

要求：

- 保持组件职责单一
- 不在这里处理音量、PiP、AirPlay、Cast

- [ ] **Step 3: Run focused lint**

Run:

```bash
npm run lint -- 'components/player/mobile/MobilePrimaryControls.tsx'
```

Expected:
- exit code `0`

### Task 2: Switch the controls bar by viewport context

**Files:**
- Modify: `components/player/DesktopVideoPlayer.tsx`
- Modify: `components/player/desktop/DesktopControlsWrapper.tsx`
- Modify: `components/player/desktop/DesktopControls.tsx`

- [ ] **Step 1: Compute a mobile-primary-layout flag**

在 `DesktopVideoPlayer.tsx` 中基于：

- `isMobile`
- `shouldForceLandscape`
- `data.fullscreenMode`

生成仅用于手机竖屏的布局 flag。

- [ ] **Step 2: Pass the flag through the wrapper**

在 `DesktopControlsWrapper.tsx` 增加新 prop，并继续复用原有逻辑与 refs。

- [ ] **Step 3: Render `MobilePrimaryControls` when the flag is true**

在 `DesktopControls.tsx`：

- 手机竖屏渲染 `MobilePrimaryControls`
- 其他场景继续渲染原有 `DesktopLeftControls + DesktopRightControls`

- [ ] **Step 4: Keep fullscreen behavior aligned**

手机主控条上的全屏按钮继续调用现有 `onToggleNativeFullscreen`，不新造全屏逻辑。

- [ ] **Step 5: Run focused lint**

Run:

```bash
npm run lint -- 'components/player/DesktopVideoPlayer.tsx' 'components/player/desktop/DesktopControlsWrapper.tsx' 'components/player/desktop/DesktopControls.tsx'
```

Expected:
- exit code `0`

### Task 3: Make progress and touch targets feel mobile-native

**Files:**
- Modify: `components/player/desktop/DesktopProgressBar.tsx`
- Modify: `app/styles/video-player.css`

- [ ] **Step 1: Add a mobile variant to the progress bar**

让 `DesktopProgressBar` 支持一个轻量样式标记，例如：

```ts
variant?: 'default' | 'mobile-primary'
```

- [ ] **Step 2: Add mobile-specific classes**

在 `video-player.css` 中为手机主控条补：

- 更大的主按钮尺寸
- 更紧凑但更易点的时间文字样式
- 更粗的进度条和更明显的 thumb

- [ ] **Step 3: Ensure drag hit area remains generous**

不要缩小 `slider-track::before` 热区，必要时只调整视觉高度，不改拖动可达性。

- [ ] **Step 4: Run focused lint**

Run:

```bash
npm run lint -- 'components/player/desktop/DesktopProgressBar.tsx' 'app/styles/video-player.css'
```

Expected:
- exit code `0`

### Task 4: Run verification and smoke-test the behavior

**Files:**
- Modify: none

- [ ] **Step 1: Run full lint**

Run:

```bash
npm run lint
```

Expected:
- exit code `0`

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected:
- exit code `0`

- [ ] **Step 3: Manual smoke test**

检查：

- 手机竖屏显示极简主控条
- 更多菜单仍可用
- 桌面控件未回退
- 进度拖动手感正常

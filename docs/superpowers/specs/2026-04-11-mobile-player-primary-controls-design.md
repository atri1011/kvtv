# 手机竖屏播放器主控条瘦身 - 设计说明

## 目标

把当前手机竖屏播放页里“桌面播放器控件直接下放”的展示，收敛成更适合触控的极简主控条。

本次设计要满足：

- 手机竖屏第一层只保留高频播放操作
- 播放器底栏在小屏下不再挤满次级按钮
- 进度条、播放按钮、时间信息在手机上更容易点、更容易扫读
- 次级能力仍可访问，但不占据底栏主视区
- 桌面与横屏/全屏交互不在这次切片里重做

## 当前现状

### 已有实现

- `components/player/CustomVideoPlayer.tsx`
  - 当前无真实移动端分支，直接返回 `DesktopVideoPlayer`
- `components/player/DesktopVideoPlayer.tsx`
  - 统一承载手机和桌面播放器主体
  - 手机已接入单击显隐控件、双击左右快进/快退
- `components/player/desktop/DesktopControls.tsx`
  - 底栏固定渲染桌面进度条 + 左右双栏控件
- `components/player/desktop/DesktopLeftControls.tsx`
  - 播放/暂停、音量、时间信息
- `components/player/desktop/DesktopRightControls.tsx`
  - PiP、AirPlay、Cast、网页全屏、系统全屏
- `components/player/desktop/DesktopMoreMenu.tsx`
  - 已有独立“更多”入口，可承接次级功能

### 当前问题

- 手机竖屏底栏同时展示播放、音量、时间、PiP、AirPlay、Cast、双全屏入口，密度过高
- 底部主控条视觉重心过重，压缩视频本体的沉浸感
- 进度条和按钮虽然可用，但没有针对手机竖屏做信息减负

## 不做的事

- 不重做整套移动端播放器容器
- 不改双击快进/快退逻辑
- 不改横屏/全屏控件布局
- 不删除 PiP、AirPlay、Cast 等能力，只调整其暴露层级

## 核心决策

### 1. 手机竖屏底栏改为极简主控条

手机竖屏第一层仅保留：

- 播放 / 暂停
- 当前时间 / 总时长
- 加粗后的进度条
- 全屏

原因：

- 这四项覆盖竖屏观看中的绝大多数高频动作
- 保留完整可用性，同时把底栏从“工具堆”降成“主控条”

### 2. 次级功能不再占据手机底栏

以下功能从手机竖屏底栏移除：

- 音量 / 静音
- PiP
- AirPlay
- Cast
- 网页全屏单独入口

这些功能继续通过现有 `DesktopMoreMenu` 暴露，不额外新建第二套菜单体系。

原因：

- 仓库里已经有独立的 `More Menu` 承接扩展动作
- 复用现有入口，能把这次改动收敛在“显示适配”，不扩散行为逻辑

### 3. 手机竖屏使用单行主操作 + 独立进度条

手机竖屏底栏布局改成两段：

1. 上层：时间信息
2. 下层：`播放 / 暂停` + `加粗进度条` + `全屏`

布局要求：

- 时间信息独占一行，使用更紧凑字号
- 播放键与全屏键固定在两端
- 进度条占据中间主宽度
- 主控区域整体高度和间距按触控优先调大

### 4. 保留现有 overlay 作为扩展操作入口

手机竖屏下继续显示左上角 `More Menu` 按钮，不把“更多”塞回底栏。

结果：

- 第一层底栏继续保持轻量
- 扩展能力仍能从 overlay 进入
- 不需要发明新的移动端抽屉或底部弹层

### 5. 适配只在手机竖屏触发

本次适配判定条件：

- `useIsMobile()` 为 `true`
- 当前不处于强制横屏展示态

桌面与横屏模式继续走现有桌面控件结构。

## 用户行为定义

### 手机竖屏

- 点按视频显示控件
- 底部看到极简主控条
- 可直接完成播放、拖动进度、看时间、进入全屏
- 需要 PiP / 投屏 / 复制链接 / 播放策略等次级能力时，走左上角更多菜单

### 桌面 / 横屏

- 继续使用现有桌面控件栏
- 不受这次切片影响

## 影响范围

### 必改文件

- `components/player/desktop/DesktopControls.tsx`
  - 按场景切换桌面控件栏 / 手机竖屏主控条
- `components/player/desktop/DesktopControlsWrapper.tsx`
  - 透传移动端与横屏判定
- `components/player/DesktopVideoPlayer.tsx`
  - 把手机竖屏判定传到控件层
- `components/player/desktop/DesktopProgressBar.tsx`
  - 支持手机竖屏样式参数
- `app/styles/video-player.css`
  - 补手机主控条按钮和进度条尺寸样式

### 建议新增文件

- `components/player/mobile/MobilePrimaryControls.tsx`
  - 手机竖屏极简主控条主体

## 风险与注意点

### 1. 不能误伤横屏体验

如果只按 `useIsMobile()` 切换控件，会把横屏全屏态也压成极简版，体验会倒退。需要额外排除横屏/旋转场景。

### 2. 不能把次级能力做丢

PiP、AirPlay、Cast 等能力只是从底栏移走，不是删除。手机端仍要能从 `More Menu` 找到。

### 3. 不能让进度条拖动变差

瘦身控件不等于缩小交互命中区。手机版进度条的视觉厚度和可拖动热区都应该不低于现状。

## 验证方案

### 静态验证

- `npm run lint -- 'components/player/DesktopVideoPlayer.tsx' 'components/player/desktop/DesktopControlsWrapper.tsx' 'components/player/desktop/DesktopControls.tsx' 'components/player/desktop/DesktopProgressBar.tsx' 'components/player/mobile/MobilePrimaryControls.tsx'`
- `npm run build`

### 手动验证

- 手机竖屏下底栏只出现播放、时间、进度、全屏
- 左上角更多菜单仍可打开并访问次级能力
- 桌面下控件栏无回退
- 手机横屏 / 全屏进入后仍保持现有横向控制体验

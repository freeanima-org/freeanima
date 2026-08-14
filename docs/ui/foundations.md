---
title: 视觉基础
---

# 视觉基础

入口 UI 的视觉语言。Token **取值**仅定义在 [`packages/frontend/ui-kit/styles/globals.css`](../../packages/frontend/ui-kit/styles/globals.css)。本页定义**意图、用法与维度适配**。技术栈：Tailwind CSS v4 + shadcn/ui（`@freeanima/ui-kit`）。**不**使用 DaisyUI。

各节使用[维度适配模板](dimensions.md#dimension-adaptation-template)。

Agent 禁令（原始 CSS 变量、DaisyUI token）→ [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)。

## 颜色与主题

**意图：** 语义化表面与文字，而非临时 hex。暗色经根节点 `.dark`。暗色强调变体经 `data-color-theme`（默认 `neutral`，另有 `ocean` / `forest` / `sunset` / `violet`），来自本地偏好（`portal-sdk/color-theme`）。

**用法：** Tailwind 语义类（`bg-background`、`text-muted-foreground`、`bg-primary`、`border-border`、…）。在 `globals.css` 外优先用带这些工具类的 `@apply`，少用原始 `var(--background)`。

| 透镜   | 适配                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 不变量 | 语义 token 名；明/暗成对；破坏性操作用 destructive                                                                           |
| 布局   | N/A（同一调色板）；chrome 可用 `sidebar-*` token                                                                             |
| 交互   | Hover/active 色调（`hover:bg-muted`、选中 `bg-primary/20`）仅在 pointer 可 hover 时；touch 不得依赖仅 hover 才出现的颜色线索 |
| 壳     | 强调主题是**本机客户端偏好**，非壳类型；勿按壳发另一套调色板                                                                 |
| 禁止   | DaisyUI `data-theme` / `--color-base-*`；用 `getShellKind()` 选色                                                            |

**待对齐：** 绕过语义 token 的功能局部一次性颜色（审计：SPA 功能大体用语义 Tailwind；继续关注栖息地管理台 / 扩展表面）。

## 字体排印

**意图：** 清晰层级——页/面板标题、正文、次要、元信息/标签。

**用法（当前实践）：** 面板标题常用 `text-lg font-semibold` 或 `text-sm font-semibold`；正文 `text-sm`；次要/元信息 `text-xs text-muted-foreground`；长标题用 `truncate`。

| 透镜   | 适配                                                 |
| ------ | ---------------------------------------------------- |
| 不变量 | 层级角色（标题 / 正文 / 次要 / 元信息）              |
| 布局   | compact 可隐藏或缩短次要行；勿按断点另造一套字号阶梯 |
| 交互   | 用间距/最小高度放大**点击目标**，不要靠破坏字号阶梯  |
| 壳     | N/A                                                  |
| 禁止   | 按壳换字体栈                                         |

## 间距与密度

**意图：** 一致的内边距与控件高度；touch 友好目标，同时避免 pointer UI 过于稀疏。

**用法：** 控件高度 `h-8` / `h-9` / `h-10`；列表行常 `min-h-11` + `px-1 py-1`；面板头 `p-3`。

| 透镜   | 适配                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| 不变量 | 间距阶梯走 Tailwind；尽量共用行/控件高度                                                            |
| 布局   | compact chrome 须避开底栏（`--app-bottom-nav-h`）；更密 chrome，而非更密到不安全的点击区            |
| 交互   | **touch：** 最小约 44px 点击目标（`min-h-11`）；**pointer：** 若 hover/菜单仍可达，可用更密图标按钮 |
| 壳     | 安全区 inset 经壳/宿主（`shared-safe-area.css`）；不是第二套密度体系                                |
| 禁止   | 用 `getShellKind()` 选 padding                                                                      |

## 圆角

**意图：** 柔和且一致的圆角，来自 `--radius`（及 `@theme` 中 sm/md/lg/xl 派生）。

**用法：** 控件/菜单常 `rounded-md` / `rounded-sm`；行/Dialog `rounded-lg`；pill/开关 `rounded-full`；compact sheet 可用更大上圆角（`rounded-t-2xl`）。

| 透镜   | 适配                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 不变量 | 圆角 token；映射控件 vs 表面角色                                                                                  |
| 布局   | Sheet/drawer 呈现可用更大上圆角；Dialog 保持 `rounded-lg`                                                         |
| 交互   | N/A                                                                                                               |
| 壳     | N/A                                                                                                               |
| 禁止   | 一次性 `rounded-[13px]` 蔓延（SPA 功能已洁净；shadcn 基元可用 `rounded-[min(var(--radius-*),…)]` token 运算——OK） |

## 边框与分割线

**意图：** 用 `border-border` 分隔区域；优先列表分隔线或 muted 背景，少用卡片套卡片。

| 透镜   | 适配                                                      |
| ------ | --------------------------------------------------------- |
| 不变量 | 控件用 `border-border` / `border-input`                   |
| 布局   | expanded 多栏用栏间边框；compact drawer 用边缘边框 + 阴影 |
| 交互   | N/A                                                       |
| 壳     | N/A                                                       |
| 禁止   | 无信息结构的装饰性多层边框 chrome                         |

## 阴影与层级

**意图：** 高度表达叠层/浮层，而非装饰。

**用法：** 控件 `shadow-xs`；浮层/drawer 慎用 `shadow-lg`。

| 透镜   | 适配                                       |
| ------ | ------------------------------------------ |
| 不变量 | 优先语义高度阶梯；避免叠光晕               |
| 布局   | Drawer/Sheet/Dialog 用高度；列表行通常扁平 |
| 交互   | N/A                                        |
| 壳     | N/A                                        |
| 禁止   | 把光晕当品牌；空闲 chrome 多层阴影         |

## 图标

**意图：** Lucide 图标；默认尺寸对齐控件（常见 `size-4`）。

| 透镜   | 适配                                       |
| ------ | ------------------------------------------ |
| 不变量 | 图标集与默认尺寸                           |
| 布局   | N/A                                        |
| 交互   | touch 放大**按钮点击框**，而非全局图标尺寸 |
| 壳     | N/A                                        |

## 动效

**意图：** 开合与状态变化的过渡（React Aria / shadcn animate）。动效澄清层级；不是装饰。

| 透镜   | 适配                                  |
| ------ | ------------------------------------- |
| 不变量 | 优先既有 animate 工具类               |
| 布局   | Sheet 滑入 vs Dialog 缩放跟随呈现方式 |
| 交互   | touch 上必要反馈不得依赖 hover 过渡   |
| 壳     | N/A                                   |
| 禁止   | 无意义的光晕脉冲                      |

## 焦点与键盘

**意图：** 可见 `focus-visible` 环（`ring` / `ring-ring`）。Dialog/Sheet 默认在打开时**阻断**自动聚焦；确认操作不得获得默认焦点。

| 透镜   | 适配                                               |
| ------ | -------------------------------------------------- |
| 不变量 | 焦点环；破坏性确认上无隐秘焦点陷阱                 |
| 布局   | N/A                                                |
| 交互   | 键盘用户需要可见焦点；Enter 发送是交互能力，非布局 |
| 壳     | 外接键盘不把 touch→pointer 策略翻掉                |
| 禁止   | 破坏性确认按钮上 `autoFocus`                       |

## 禁用与透明度

**意图：** 控件用 `disabled:opacity-50` + `pointer-events-none`；已完成/弱化内容可用 `opacity-60`。

| 透镜             | 适配           |
| ---------------- | -------------- |
| 不变量           | 禁用可及性模式 |
| 布局 / 交互 / 壳 | N/A            |

## 滚动条与安全区

**意图：** 全局细滚动条样式（`ui-kit` scrollbar CSS）。刘海设备安全区 CSS 变量；布局 chrome 避开底栏高度。

| 透镜   | 适配                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 不变量 | 共享滚动条外观                                                                                                    |
| 布局   | compact 固定层尊重 `--app-bottom-nav-h`                                                                           |
| 交互   | 下拉刷新忽略靠近左缘的起点（与 drawer 冲突）——见 [交互模式](patterns.md) / [页面刷新](../aspects/page-refresh.md) |
| 壳     | 安全区与键盘 inset 的宿主差异                                                                                     |
| 禁止   | 仅安全区 CSS 文件内塞主题色                                                                                       |

## z-index（叠层）

**意图：** 菜单、sheet、toast 的稳定叠层。优先共享约定，少用魔法数字。

| 层           | 约定                              |
| ------------ | --------------------------------- |
| app 底栏     | `z-[60]`（`AppFrame`）            |
| Dialog/Sheet | `z-[70]`（须盖住 compact 底栏）   |
| 沉浸全页编辑 | `z-[70]`（`DetailEditPageShell`） |

| 透镜   | 适配                                                                      |
| ------ | ------------------------------------------------------------------------- |
| 不变量 | 模态浮层在 chrome（含底栏）之上；勿让底栏 `z` 压过 Dialog/Sheet           |
| 布局   | Sheet/Dialog/Drawer 叠层                                                  |
| 交互   | 右键菜单 / ActionSheet 在内容之上                                         |
| 壳     | N/A                                                                       |
| 禁止   | 临时 `z-[9999]` / 手写模态浮层（用 Dialog / Sheet / `ModalSheetPresent`） |

## 相关文档

- 三维度 → [dimensions.md](dimensions.md)
- 组件 → [components.md](components.md)
- 交互模式 → [patterns.md](patterns.md)

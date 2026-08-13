---
title: 交互模式
---

# 交互模式

可复用的交互契约，使模块（任务、聊天室、邮件、…）共享同一 UX 语言。优先使用既有 `@freeanima/ui-kit/composite` 实现，避免并行菜单、行或确认框。

三维度 → [dimensions.md](dimensions.md)。组件 → [components.md](components.md)。视觉 → [foundations.md](foundations.md)。

## 模式卡片模板

每个模式记录：

1. **意图** — 何时使用
2. **插槽** — 必需/可选 UI 部件
3. **状态** — default、hover、selected、active、dragging、selectionMode、disabled、…
4. **维度适配** — 不变量 / 布局 / 交互 / 壳（无则 N/A）
5. **实现** — 代码入口（或「待抽取」）
6. **禁止** — 反模式
7. **合规** — 参考 / 待抽取 / 待对齐

---

## DataListRow（数据列表行）

**意图：** 数据列表主行（任务、邮件线程、…）：标题、操作、选择、可选拖拽、溢出菜单。

**插槽：**

| 插槽                 | 角色                                                    |
| -------------------- | ------------------------------------------------------- |
| 前导控件             | 完成勾选，或 `selectionMode` 下的选择字形               |
| 标题                 | 主截断文本                                              |
| 次行 / 标签 / 元信息 | 可选 muted 行、标签、截止日期、实体 id                  |
| 常驻操作             | 无需 hover 即可见的控件（如 touch ⋯）                   |
| Hover 操作           | 仅 pointer 揭示的控件（`group-hover`）                  |
| 溢出菜单来源         | 共享 `ActionSheetItem[]`，供 ContextMenu 与 ActionSheet |
| 拖拽手柄             | 优先**整行**拖拽监听；除非必要勿单独手柄                |

**状态：**

| 状态          | 视觉 / 行为                                                     |
| ------------- | --------------------------------------------------------------- |
| default       | 行 chrome；`min-h-11`                                           |
| hover         | `hover:bg-muted`（pointer）；touch 上不得成为发现操作的唯一途径 |
| active        | 当前详情目标（未选中时的轻环/底）                               |
| selected      | 更强主色 tint + 环；用于多选                                    |
| selectionMode | 勾选 → 选择字形；点击切换；禁用拖拽/菜单                        |
| dragging      | 降低透明度；可拖时 grab 光标                                    |
| disabled      | 控件禁用；不可拖                                                |

**维度适配：**

| 透镜   | 适配                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 不变量 | 跨模块同一插槽契约；勿按断点再发第二套行组件                                                                                                             |
| 布局   | 外层 List-Detail / 栏变化；**行插槽在 compact 与 expanded 保持相同**                                                                                     |
| 交互   | **pointer：** hover 底；启用时右键 `ContextMenu`；可选 hover 揭示操作。**touch：** 无仅 hover 操作；常驻 ⋯（或等价）；长按 → ActionSheet；点击目标 ≥44px |
| 壳     | N/A                                                                                                                                                      |
| 禁止   | 用 `getShellKind()` 选菜单类型；用视口宽度选 ContextMenu vs ActionSheet；自定义 `fixed` 坐标菜单                                                         |

**实现：** 底盘 — [`ListRow.tsx`](../../src/ui-kit/composite/ListRow.tsx)。任务领域 — [`TaskItemRowView.tsx`](../../src/ui-kit/composite/TaskItemRowView.tsx)（+ 列表包装 `TaskItemListView`）。消费者：项目侧栏、任务列表侧栏、智能清单侧栏、邮件消息/账户行、聊天室对话列表。能力开关：`useActionSheet`、`contextMenuEnabled`、来自父级的拖拽 attrs/listeners。

**合规：** 参考（底盘已抽取）。**待对齐（P2/P3）：** MoveTo*Picker 树行；Vault/日记/番茄选择器；栖息地管理台；扩展弹窗。

---

## OverflowMenu（溢出菜单）

**意图：** 对象上的次要操作，不挤占行。

**插槽：** 条目列表（`ActionSheetItem[]`：label、action、destructive 标志、…）；可选触发器（⋯）。

**状态：** 关 / 开；破坏性条目样式区分；`selectionMode` 或行禁用时禁用。

**维度适配：**

| 透镜   | 适配                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| 不变量 | 一套条目构建器；两套表面消费同一数组                                                                          |
| 布局   | ActionSheet 可呈底栏 sheet；ContextMenu 锚定——呈现细节跟基元                                                  |
| 交互   | **pointer：** `ContextMenu`。**touch：** `ActionSheet` + 长按和/或 ⋯。状态机分开；会话数据共享（目标 + 条目） |
| 壳     | N/A                                                                                                           |
| 禁止   | 并行手写菜单；菜单动作内用 `window.confirm` 做不可逆删除（用 ConfirmDestructive）                             |

**实现：** `@freeanima/ui-kit/composite` — `ContextMenu`、`ActionSheet`、`useLongPress`。

**合规：** 参考。

---

## ConfirmDestructive（破坏性确认）

**意图：** 确认不可逆或高风险操作（删除、purge）。

**插槽：** 标题、描述、取消、确认（destructive/error 变体）。

**状态：** 开/关；确认按钮**不得**默认聚焦或成为「轻易 Enter」默认项。

**维度适配：**

| 透镜   | 适配                                                |
| ------ | --------------------------------------------------- |
| 不变量 | 不可逆删除二次确认；`showConfirm` / `ConfirmDialog` |
| 布局   | Dialog vs Sheet 呈现可跟 ModalSheetPresent          |
| 交互   | pointer 与 touch 确认语义相同                       |
| 壳     | N/A                                                 |
| 禁止   | `window.confirm`；确认上 `autoFocus`                |

**实现：** `@freeanima/ui-kit/composite` 的 `ConfirmDialog`、`showConfirm`。

**合规：** 参考。

---

## ModalSheetPresent（模态 / Sheet 呈现）

**意图：** 跟**布局**而非壳的模态内容呈现。

**插槽：** 标题、正文、页脚操作；可选关闭。

**维度适配：**

| 透镜   | 适配                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 不变量 | 同一内容模型                                                             |
| 布局   | **expanded：** 居中 `Dialog`。**compact：** 底部 `Sheet` / 类 sheet 表面 |
| 交互   | 打开手势分开（按钮 vs 长按）；勿与呈现方式混为一谈                       |
| 壳     | N/A                                                                      |
| 禁止   | `getShellKind() === "tauri"` ⇒ Sheet                                     |

**实现：** 经复合 `ModalSheetPresent` 使用 shadcn `Dialog` / `Sheet`；选择器（`MoveToListPicker`、`MoveToProjectPicker`）与实体 overlay（Anima URI / `EntityOverlayHost`）用该壳。**禁止**手写 `createPortal` + fixed 浮层。

**任务详情（compact）：** 浏览/展示用 peek `Sheet`；激活标题或备注（focus 前 pointer down，再在沉浸树内 focus 一次）进入**沉浸全页编辑**（`DetailEditPageShell` + `setCompactImmersive`），带返回控件且**无底栏**——避免 peek→沉浸重挂载导致双软键盘。返回 / 系统返回关闭详情并回到**列表**（不恢复 peek）。由布局驱动——非壳类型。

**合规：** 参考。

---

## QuickAddBar（快速添加栏）

**意图：** 列表边缘的单行快速创建（任务、项目任务）。

**插槽：** 文本输入；提交按钮（始终可见）。

**状态：** 空 / 已填；写被阻时禁用。

**维度适配：**

| 透镜   | 适配                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| 不变量 | 同一插槽；提交按钮始终存在                                                      |
| 布局   | 经 `className` 置顶或底 chrome（边框方向）；不切换 List-Detail                  |
| 交互   | `enterToSubmit`（单行默认 true）。多行作曲器改注入 `useEnterToSendCapability()` |
| 壳     | N/A                                                                             |
| 禁止   | touch 上仅靠 Enter；对 touch 主交互隐藏提交控件                                 |

**实现：** [`QuickAddBar.tsx`](../../src/ui-kit/composite/QuickAddBar.tsx)。

**合规：** 参考。

---

## PullToRefresh（下拉刷新）

**意图：** 经 touch 下拉刷新主列表内容；pointer 用单独顶栏刷新控件。

**插槽：** 可滚动内容；下拉指示 / spinner。

**维度适配：**

| 透镜   | 适配                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| 不变量 | 同一 `onRefresh` 回调                                                        |
| 布局   | N/A（包裹列表滚动器）                                                        |
| 交互   | **touch：** 下拉手势（默认自动检测）。**pointer：** 禁用下拉；用顶栏刷新按钮 |
| 壳     | N/A                                                                          |
| 禁止   | 用 `getShellKind()` 启用下拉                                                 |

**实现：** [`PullToRefresh.tsx`](../../src/ui-kit/composite/PullToRefresh.tsx)。产品说明 → [page-refresh.md](../aspects/page-refresh.md)。

**合规：** 参考。

---

## ListDetail / ThreeColumn（列表详情 / 三栏）

**意图：** 列表 + 详情（+ 可选第三栏）的页面底盘。

**插槽：** 侧栏 / 中栏 / 详情；drawer vs 分栏。

**维度适配：**

| 透镜   | 适配                                                                      |
| ------ | ------------------------------------------------------------------------- |
| 不变量 | 同一内容插槽                                                              |
| 布局   | `useDrawerNav` / `useThreeColumnLayoutMode` / `useCompactLayout` 切换呈现 |
| 交互   | 底盘 N/A；菜单留在行上                                                    |
| 壳     | N/A                                                                       |
| 禁止   | `getShellKind()` ⇒ drawer 或 tabs                                         |

**实现：** [`ListDetailLayout.tsx`](../../src/ui-kit/layout/ListDetailLayout.tsx)、ThreeColumnLayout；chrome 助手 [`DetailPanelShell.tsx`](../../src/ui-kit/composite/DetailPanelShell.tsx)、[`ModuleScopeBar.tsx`](../../src/ui-kit/composite/ModuleScopeBar.tsx)。

**合规：** 参考。

---

## EmptyState / StatusAlert（空状态 / 状态提示）

**意图：** 空列表引导；行内错误/状态提示。

**插槽：** 文案（EmptyState 可选操作）；StatusAlert 的 variant。

**维度适配：** 文案与位置为不变量；布局可改 padding；交互/壳 N/A。

**实现：** [`EmptyState.tsx`](../../src/ui-kit/composite/EmptyState.tsx)、[`StatusAlert.tsx`](../../src/ui-kit/composite/StatusAlert.tsx)。

**合规：** 参考。

---

## AutoPersist（自动持久化：debounce + maxWait）

**意图：** 自动保存用户编辑而不淹没栖息地 RPC / localStorage：**debounce** 在输入空闲后触发；**maxWait**（节流窗）在持续输入时强制保存。

**插槽：** 调度 API — `schedule` / `cancel` / `flush`；长文 vs 短文时间预设。

**状态：** Idle（无待办）/ pending（定时器或窗口开）/ flushing（导航离开、卸载、关面板）。

**维度适配：** 跨布局/壳的时间语义为不变量；交互 N/A（非手势模式）。

**时间预设：**

| 预设 | 用途                                        | debounce | maxWait |
| ---- | ------------------------------------------- | -------- | ------- |
| 长文 | 日记块、任务/项目 `content`、聊天室输入草稿 | 1000ms   | 5000ms  |
| 短文 | 数字/配置字段（伴侣行为、番茄分钟）         | 400ms    | 2000ms  |

**实现：** [`auto-persist-schedule.ts`](../../src/ui-kit/lib/auto-persist-schedule.ts)；详情面板经 [`useDetailPanelState.ts`](../../src/ui-kit/composite/useDetailPanelState.ts)（默认长文预设）。Toggle/Switch 与栖息地显式保存按钮保持立即——非 AutoPersist。

**禁止：** 文本/数字字段按键写入栖息地；为 UI 自动保存在本模块旁再发明第二套 debounce 助手。

**合规：** 参考。

---

## 候选（稍后）

在出现第二消费者或进一步抽取时再文档化：

- （当前无——QuickAddBar / PullToRefresh / ListDetail / EmptyState / ModuleScopeBar 已提升至上文）

## 新 UI 清单

- [ ] 选用模式（或扩展目录），而非发明并行手势
- [ ] 已文档化维度适配（至少布局 + 交互）
- [ ] 菜单共享一套条目列表；无 fixed 定位 DIY 菜单
- [ ] 不可逆操作使用 ConfirmDestructive
- [ ] Touch 路径不依赖仅 hover 可及性
- [ ] 壳类型不锁定布局或菜单类型

## 相关文档

- 页面刷新动词 → [aspects/page-refresh.md](../aspects/page-refresh.md)
- Agent UI 规则 → [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)

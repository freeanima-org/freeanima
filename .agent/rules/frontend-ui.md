# 前端 UI 规范（DaisyUI）

> 与 [`frontend-features.md`](frontend-features.md) 包边界规则配合。样式栈：**Tailwind CSS v4 + DaisyUI 5**。

## 分层

| 层级     | 做法                                          | 位置                               |
| -------- | --------------------------------------------- | ---------------------------------- |
| **基元** | 直接使用 daisyUI class，**不封装** React 组件 | 各 satellite / admin / shell-ui    |
| **结构** | 表单/布局封装                                 | `@freeanima/ui-kit/form`、`layout` |
| **复合** | 跨域重复交互模式                              | `@freeanima/ui-kit/composite`      |
| **领域** | 产品专属 UI                                   | 各业务包本地                       |

## DaisyUI 配置

- 共享插件配置：[`packages/ui-kit/src/daisyui.css`](../packages/ui-kit/src/daisyui.css)（`themes: dark --default, light`）
- 各 SPA `styles.css`：`@import "tailwindcss"` + `@import "@freeanima/ui-kit/daisyui.css"` + `@source`
- **主题**：壳层/admin/chat 默认 `data-theme="dark"`；companion 为 `data-theme="light"`（产品意图，不强行统一）

## 基元约定

| 场景                | 推荐 class                                                                   |
| ------------------- | ---------------------------------------------------------------------------- |
| 工具栏按钮          | `btn btn-sm` + `btn-primary` / `btn-ghost`                                   |
| 表格内按钮          | `btn btn-xs btn-ghost`                                                       |
| 表单输入            | `input input-bordered input-sm`（或 `textarea-bordered`、`select-bordered`） |
| 加载                | `loading loading-spinner loading-sm`                                         |
| 空态（手写时）      | `text-sm text-base-content/60 py-4`；优先用 `EmptyState`                     |
| 错误/提示（手写时） | `alert alert-error text-sm`；优先用 `StatusAlert`                            |

## Modal

统一使用 daisyUI `<dialog>` 模式（参考 admin `cron-run-log-modal.tsx`）：

```tsx
<dialog className="modal modal-open safe-area-pt safe-area-pb" open>
  <div className="modal-box">…</div>
  <div className="modal-action">…</div>
  <form method="dialog" className="modal-backdrop">
    <button type="button" onClick={onClose}>
      close
    </button>
  </form>
</dialog>
```

- **禁止**自定义 `bg-black/40` overlay 弹窗；确认类交互用 `ConfirmDialog`
- 移动端底部 sheet：参考 `ActionSheet`（`modal-bottom sm:modal-middle`）

## 复合组件

从 `@freeanima/ui-kit/composite` 导入：

| 组件            | 用途                                                |
| --------------- | --------------------------------------------------- |
| `ConfirmDialog` | 确认/删除（替代 `window.confirm` 与自定义 overlay） |
| `ActionSheet`   | 移动端底部操作菜单                                  |
| `EmptyState`    | 列表/面板空态                                       |
| `StatusAlert`   | 内联 info/success/warning/error                     |

**i18n**：Cancel/Confirm/Close 等通用按钮文案由组件内置 Paraglide（`ui_common_*`）；`title`、`description`、`items[].label` 等领域文案由调用方传入。详见 [`i18n.md`](i18n.md)。

## 平台布局

- 导航与主布局 IA：**必须** `detectPlatform()` / `useDrawerNav()` 分支，不靠纯 viewport 响应式替代移动端布局
- 响应式 CSS 仅作桌面窗口缩放辅助

## 禁止

- 为 `btn` / `input` / `modal` 再包一层无行为基元组件
- 在 `ui-kit` 内 import `sap-contract`、Hub API
- 在 `shell-ui` 内深路径 import satellite 源码（走 package export）

# SweetNotification

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/notification/src/notification.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `customClass` | string |  |
| `dangerouslyUseHTMLString` | boolean | False |
| `duration` | number | 4500 |
| `icon` | string / Component |  |
| `id` | string |  |
| `message` | string / VNode |  |
| `offset` | number | 0 |
| `onClick` | Function |  |
| `onClose` | Function |  |
| `position` | string | ['top-right', 'top-left', 'bottom-right', 'bottom-left'] |
| `showClose` | boolean | True |
| `title` | string |  |
| `type` | string | ['success', 'info', 'warning', 'error', ''] |
| `zIndex` | number |  |
| `namespace` | string |  |

## events

- destroy

## api_methods

closeAll / success / warning / info / error

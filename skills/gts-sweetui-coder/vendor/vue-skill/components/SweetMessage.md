# SweetMessage

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/message/src/message.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `customClass` | string |  |
| `center` | boolean | False |
| `dangerouslyUseHTMLString` | boolean | False |
| `duration` | number | 3000 |
| `icon` | string / Component |  |
| `id` | string |  |
| `message` | string / VNode / Function |  |
| `onClose` | Function |  |
| `showClose` | boolean | False |
| `type` | string | ['success', 'info', 'warning', 'error'] |
| `plain` | boolean | False |
| `offset` | number | 16 |
| `zIndex` | number | 0 |
| `grouping` | boolean | False |
| `repeatNum` | number | 1 |
| `namespace` | string |  |

## events

- destroy

## api_methods

closeAll / success / warning / info / error

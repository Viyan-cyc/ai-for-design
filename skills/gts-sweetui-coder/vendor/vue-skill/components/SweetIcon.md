# SweetIcon

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/icon/icon.vue`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

图标只从 `scripts/verify/whitelists/sweetui-icons.json` 选完整类名，不猜 `-l/-f` 变体。`iconClass` 是完整CSS类名，纯图标按钮需有可访问名称。线性/面性着色以真实CSS为准，不假设均支持currentColor。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `size` | number / string |  |
| `color` | string |  |
| `iconClass` | string |  |

## events

未列出；不代表不存在。

## slots

- default

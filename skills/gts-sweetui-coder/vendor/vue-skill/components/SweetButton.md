# SweetButton

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/button/src/button.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `size` | string | ['large', 'default', 'small'] |
| `disabled` | boolean | False |
| `type` | string | ['default', 'primary', 'success', 'warning', 'info', 'danger', 'gray', 'brand', 'ghost', 'urgent', 'text', ''] |
| `icon` | string / Component |  |
| `nativeType` | string | ['button', 'submit', 'reset'] |
| `loading` | boolean | False |
| `loadingIcon` | string / Component | sweetui-icon-loading |
| `plain` | boolean |  |
| `text` | boolean | False |
| `link` | boolean | False |
| `bg` | boolean | False |
| `autofocus` | boolean | False |
| `round` | boolean |  |
| `circle` | boolean | False |
| `color` | string |  |
| `dark` | boolean | False |
| `autoInsertSpace` | boolean |  |
| `tag` | string / Component | button |
| `label` | string |  |
| `gray` | boolean | False |
| `selected` | boolean | False |

## events

- click

## slots

- default

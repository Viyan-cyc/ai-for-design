# SweetForm

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/form/form.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `size` | string | ['large', 'default', 'small'] |
| `disabled` | boolean | False |
| `model` | object |  |
| `rules` | object |  |
| `labelPosition` | string | ['left', 'right', 'top'] |
| `requireAsteriskPosition` | string | ['left', 'right'] |
| `labelWidth` | string / number |  |
| `labelSuffix` | string |  |
| `inline` | boolean | False |
| `inlineMessage` | boolean | False |
| `statusIcon` | boolean | False |
| `showMessage` | boolean | True |
| `validateOnRuleChange` | boolean | True |
| `hideRequiredAsterisk` | boolean | False |
| `scrollToError` | boolean | False |
| `scrollIntoViewOptions` | object / boolean | True |

## events

- validate

## slots

- default

## exposed_methods

- validate
- validateField
- resetFields
- clearValidate
- scrollToField

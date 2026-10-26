# SweetInput

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/input/src/input.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `id` | string |  |
| `size` | string | ['large', 'default', 'small'] |
| `disabled` | boolean | False |
| `modelValue` | string / number / null |  |
| `maxlength` | string / number |  |
| `minlength` | string / number |  |
| `type` | string | text |
| `resize` | string | ['none', 'both', 'horizontal', 'vertical'] |
| `autosize` | boolean / {minRows?:number,maxRows?:number} | False |
| `autocomplete` | string | off |
| `formatter` | Function |  |
| `parser` | Function |  |
| `placeholder` | string |  |
| `form` | string |  |
| `readonly` | boolean | False |
| `clearable` | boolean | False |
| `showPassword` | boolean | False |
| `showWordLimit` | boolean | False |
| `suffixIcon` | string / Component |  |
| `prefixIcon` | string / Component |  |
| `containerRole` | string |  |
| `tabindex` | string / number | 0 |
| `validateEvent` | boolean | True |
| `inputStyle` | object / array / string | {} |
| `autofocus` | boolean | False |
| `rows` | number | 2 |
| `ariaLabel` | string |  |

## events

- blur
- compositionstart
- compositionupdate
- compositionend
- change
- clear
- focus
- input
- keydown
- mouseleave
- mouseenter
- update:modelValue

## slots

- prefix
- suffix
- prepend
- append

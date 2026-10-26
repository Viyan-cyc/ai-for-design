# SweetDialog

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/dialog/src/dialog.ts + dialog-content.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `appendToBody` | boolean | False |
| `appendTo` | string | body |
| `beforeClose` | Function |  |
| `destroyOnClose` | boolean | False |
| `closeOnClickModal` | boolean | True |
| `closeOnPressEscape` | boolean | True |
| `lockScroll` | boolean | True |
| `modal` | boolean | True |
| `modalPenetrable` | boolean | False |
| `openDelay` | number | 0 |
| `closeDelay` | number | 0 |
| `top` | string |  |
| `modelValue` | boolean |  |
| `modalClass` | string |  |
| `headerClass` | string |  |
| `bodyClass` | string |  |
| `footerClass` | string |  |
| `width` | string / number |  |
| `zIndex` | number |  |
| `trapFocus` | boolean | False |
| `headerAriaLevel` | string | 2 |
| `transition` | string / object |  |
| `center` | boolean | False |
| `alignCenter` | boolean |  |
| `closeIcon` | string / Component |  |
| `draggable` | boolean |  |
| `overflow` | boolean |  |
| `fullscreen` | boolean | False |
| `showClose` | boolean | True |
| `title` | string |  |
| `ariaLevel` | string | 2 |

## events

- open
- opened
- close
- closed
- update:modelValue
- openAutoFocus
- closeAutoFocus

## slots

- default
- header
- title
- footer

## exposed_methods

- resetPosition
- updatePosition
- handleClose

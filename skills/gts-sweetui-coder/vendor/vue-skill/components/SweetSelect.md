# SweetSelect

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/select/src/select.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `name` | string |  |
| `id` | string |  |
| `modelValue` | Array / String / Number / Boolean / Object | undefined |
| `autocomplete` | string | off |
| `automaticDropdown` | boolean | False |
| `size` | string | ['large', 'default', 'small'] |
| `effect` | string | light |
| `disabled` | boolean | False |
| `clearable` | boolean | False |
| `filterable` | boolean | False |
| `allowCreate` | boolean | False |
| `loading` | boolean | False |
| `popperClass` | string |  |
| `popperOptions` | Partial<Options> | {} |
| `remote` | boolean | False |
| `loadingText` | string |  |
| `noMatchText` | string |  |
| `noDataText` | string |  |
| `remoteMethod` | Function |  |
| `filterMethod` | Function |  |
| `multiple` | boolean | False |
| `multipleLimit` | number | 0 |
| `placeholder` | string |  |
| `defaultFirstOption` | boolean | False |
| `reserveKeyword` | boolean | True |
| `valueKey` | string | value |
| `collapseTags` | boolean | False |
| `collapseTagsTooltip` | boolean | False |
| `maxCollapseTags` | number | 1 |
| `teleported` | boolean | True |
| `persistent` | boolean | True |
| `clearIcon` | string / Component | sweetui-icon-circle-close-l |
| `fitInputWidth` | boolean | False |
| `suffixIcon` | string / Component | sweetui-icon-down |
| `tagType` | string | info |
| `tagEffect` | string | light |
| `validateEvent` | boolean | True |
| `remoteShowSuffix` | boolean | False |
| `placement` | string | bottom-start |
| `fallbackPlacements` | array | ['bottom-start', 'top-start', 'right', 'left'] |
| `displayOrder` | boolean | True |
| `showResize` | boolean | True |
| `maxHeight` | number | 400 |
| `minHeight` | number | 46 |
| `maxWidth` | number | 400 |
| `valueShowTooltips` | boolean | False |
| `tooltipsPlacement` | string | top |
| `scrollContainer` | HTMLElement / string |  |
| `menuFilterable` | boolean | False |

## events

- update:modelValue
- change
- remove-tag
- clear
- search
- visible-change
- focus
- blur
- scroll-top
- scroll-bottom

## slots

- default
- prefix
- tag
- label
- header
- loading
- empty
- footer

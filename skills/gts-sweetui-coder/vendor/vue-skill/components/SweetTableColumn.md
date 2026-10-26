# SweetTableColumn

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/virtual-table/src/table-column/defaults.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `type` | string | ['default', 'selection', 'index', 'expand'] |
| `prop` | string |  |
| `label` | string |  |
| `className` | string |  |
| `labelClassName` | string |  |
| `property` | string |  |
| `width` | string / number |  |
| `minWidth` | string / number |  |
| `renderHeader` | Function |  |
| `sortable` | boolean / string | [True, False, 'custom'] |
| `sortMethod` | Function |  |
| `sortBy` | string / array / Function |  |
| `resizable` | boolean | True |
| `columnKey` | string |  |
| `align` | string | ['left', 'center', 'right'] |
| `headerAlign` | string | ['left', 'center', 'right'] |
| `showOverflowTooltip` | boolean / object |  |
| `fixed` | boolean / string | [True, False, 'left', 'right'] |
| `formatter` | Function |  |
| `selectable` | Function |  |
| `reserveSelection` | boolean | False |
| `filterMethod` | Function |  |
| `filteredValue` | array |  |
| `filters` | array |  |
| `filterPlacement` | string |  |
| `filterMultiple` | boolean | True |
| `filterClassName` | string |  |
| `headWordWrap` | boolean | False |
| `headWordLineNum` | number | 1 |
| `isDisabled` | boolean | False |
| `isHidden` | boolean | False |
| `index` | number / Function |  |
| `sortOrders` | array | ['ascending', 'descending', None] |

## slots

- default
- header

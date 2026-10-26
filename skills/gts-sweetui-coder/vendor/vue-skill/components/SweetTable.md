# SweetTable

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/virtual-table/src/table/defaults.ts + virtual-table.vue`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `data` | array | [] |
| `size` | string |  |
| `width` | string / number |  |
| `height` | string / number |  |
| `maxHeight` | string / number |  |
| `fit` | boolean | True |
| `stripe` | boolean | False |
| `border` | boolean | False |
| `rowKey` | string / Function |  |
| `showHeader` | boolean | True |
| `showSummary` | boolean | False |
| `sumText` | string |  |
| `summaryMethod` | Function |  |
| `rowClassName` | string / Function |  |
| `rowStyle` | object / Function |  |
| `cellClassName` | string / Function |  |
| `cellStyle` | object / Function |  |
| `headerRowClassName` | string / Function |  |
| `headerRowStyle` | object / Function |  |
| `headerCellClassName` | string / Function |  |
| `headerCellStyle` | object / Function |  |
| `highlightCurrentRow` | boolean | False |
| `alternateHighlight` | boolean | True |
| `currentRowKey` | string / number |  |
| `emptyText` | string |  |
| `expandRowKeys` | array |  |
| `defaultExpandAll` | boolean | False |
| `defaultSort` | object |  |
| `tooltipEffect` | string |  |
| `tooltipOptions` | object |  |
| `spanMethod` | Function |  |
| `selectOnIndeterminate` | boolean | True |
| `indent` | number | 16 |
| `treeProps` | object | {hasChildren:'hasChildren',children:'children'} |
| `parseTreeData` | boolean | False |
| `lazy` | boolean | False |
| `load` | Function |  |
| `style` | object | {} |
| `className` | string |  |
| `tableLayout` | string | ['fixed', 'auto'] |
| `scrollbarAlwaysOn` | boolean | False |
| `flexible` | boolean | False |
| `showOverflowTooltip` | boolean / object |  |
| `virtualScroll` | boolean | False |
| `selectedRowKeys` | array |  |

## events

- select
- scroll
- selection-change
- select-all
- cell-mouse-leave
- cell-mouse-enter
- cell-click
- cell-contextmenu
- cell-dblclick
- row-click
- row-dblclick
- row-contextmenu
- header-contextmenu
- header-click
- header-dragend
- filter-change
- sort-change
- expand-change
- current-change

## slots

- default
- empty
- append

## exposed_methods

- setCurrentRow
- getSelectionRows
- toggleRowSelection
- clearSelection
- clearFilter
- toggleAllSelection
- toggleRowExpansion
- clearSort
- sort
- doLayout
- scrollTo
- setScrollTop
- setScrollLeft

## note

SweetTable is thin wrapper over SweetVirtualTable via v-bind="$attrs". Real props defined in virtual-table/defaults.ts. Only 2 own props: tableId, columnsWidthCache.

# SweetPagination

状态：来自带回源码契约，尚未完成私有 UMD 运行验证。

定位：`packages/components/pagination/src/pagination.ts`。

具体使用示例优先看同名 `.vue` 文件；本页只在 API 不确定时读取。

## Props

| 名称 | 类型 | 默认/允许值 |
|---|---|---|
| `pageSize` | number |  |
| `defaultPageSize` | number |  |
| `total` | number |  |
| `pageCount` | number |  |
| `pagerCount` | number | 7 |
| `currentPage` | number |  |
| `defaultCurrentPage` | number |  |
| `layout` | string | prev, pager, next, jumper, ->, total |
| `pageSizes` | array | [10, 20, 30, 40, 50, 100] |
| `popperClass` | string |  |
| `prevText` | string |  |
| `prevIcon` | string / Component | sweetui-icon-left |
| `nextText` | string |  |
| `nextIcon` | string / Component | sweetui-icon-right |
| `small` | boolean | False |
| `background` | boolean | False |
| `disabled` | boolean | False |
| `hideOnSinglePage` | boolean | False |
| `maxPage` | number |  |

## events

- update:current-page
- update:page-size
- size-change
- current-change
- prev-click
- next-click

## slots

- default

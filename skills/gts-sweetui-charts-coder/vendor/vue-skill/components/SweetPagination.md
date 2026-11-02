# 分页 SweetPagination

```vue
<SweetPagination
  v-model:current-page="currentPage"
  :page-size="pageSize"
  :total="total"
  layout="total, sizes, prev, pager, next, jumper"
  :page-sizes="[10, 20, 50, 100]"
  @size-change="handleSizeChange"
  @current-change="handlePageChange"
/>
```

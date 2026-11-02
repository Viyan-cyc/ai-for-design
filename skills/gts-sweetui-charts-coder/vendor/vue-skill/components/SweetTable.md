# 表格 SweetTable / SweetTableColumn

```vue
<SweetTable :data="tableData" stripe highlight-current-row>
  <SweetTableColumn prop="id" label="ID" width="80" />
  <SweetTableColumn prop="name" label="名称" min-width="160" show-overflow-tooltip />
  <SweetTableColumn prop="status" label="状态" width="100">
    <template #default="{ row }">
      <SweetTag :type="statusMap[row.status]?.type || 'info'" size="small">
        {{ statusMap[row.status]?.label || row.status }}
      </SweetTag>
    </template>
  </SweetTableColumn>
  <template #empty>
    <SweetEmpty description="暂无数据" />
  </template>
</SweetTable>
```

关键 props（Table）：`:data`、`stripe`、`highlight-current-row`、`border`、`height`、`max-height`。
关键 props（Column）：`prop`、`label`、`width`、`min-width`、`fixed`、`align`、`show-overflow-tooltip`。
关键 slot（Column）：`#default="{ row, column, $index }"`。

# 选择 SweetSelect / SweetOption

```vue
<SweetSelect v-model="value" placeholder="请选择" clearable>
  <SweetOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
</SweetSelect>
<SweetSelect v-model="multi" multiple placeholder="多选">
  <SweetOption v-for="item in opts" :key="item.value" :label="item.label" :value="item.value" />
</SweetSelect>
```

关键 props（Select）：`v-model`、`placeholder`、`clearable`、`multiple`、`disabled`、`filterable`。

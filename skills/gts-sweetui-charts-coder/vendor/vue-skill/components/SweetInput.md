# 输入 SweetInput

```vue
<SweetInput v-model="keyword" placeholder="请输入" clearable />
<SweetInput v-model="remark" type="textarea" :rows="2" maxlength="100" show-word-limit />
<SweetInput v-model="val" disabled placeholder="禁用" />
```

关键 props：`v-model`、`type`（text/textarea）、`placeholder`、`clearable`、`disabled`、`maxlength`、`show-word-limit`、`rows`（textarea）。

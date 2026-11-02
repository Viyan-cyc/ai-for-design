# 抽屉 SweetDrawer

```vue
<SweetDrawer v-model="visible" title="详情" size="480px">
  <SweetDescriptions :column="1" border>
    <SweetDescriptionsItem label="名称">设备 A</SweetDescriptionsItem>
    <SweetDescriptionsItem label="状态">运行中</SweetDescriptionsItem>
  </SweetDescriptions>
</SweetDrawer>
```

关键 props：`v-model`、`title`、`size`、`direction`（rtl/ltr/ttb/btt）、`before-close`、`destroy-on-close`。

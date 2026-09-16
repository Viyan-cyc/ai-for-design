# el-tag 标签（docs/el-tag）

> GTS: 标签（组件规范/展示类/标签.md） | EP 2.13.5 | 白名单: ✅

写状态列、列表项标记、筛选回显标签前读本篇。标签只做**状态展示**，不是操作入口（操作用 `el-button link`）。只覆盖方言约束，全部属性以 Element Plus 2.13.5 官方文档为准。

## 标准形（表格状态列）

```html
<el-table-column prop="status" label="状态" min-width="100">
  <template #default="{ row }">
    <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
  </template>
</el-table-column>
```

```js
// 业务状态 → 文案/颜色 映射表，放 js/constants.js；未知状态兜底 info
const STATUS_MAP = {
  running: { label: '运行中', type: 'success' },
  stopped: { label: '已停止', type: 'info' },
  error:   { label: '异常',   type: 'danger' },
}
const statusLabel = (s) => STATUS_MAP[s]?.label ?? s
const statusType = (s) => STATUS_MAP[s]?.type ?? 'info'
```

## 约束（方言坑 + G 增量）

- `type` 只接受 `success / info / warning / danger / primary`，不写自定义色值；颜色语义：正常/成功=success，异常/失败=danger，中间态=warning，中性/停用=info。
- 业务状态一律走 STATUS_MAP 常量映射（文案+type 同源），**未知状态兜底 `info`**，不裸写三元串。
- 可删除标签才加 `closable` + `@close`；默认不带关闭按钮。
- 场景对照：状态列/详情字段用默认尺寸；筛选条件回显用 `closable`（点掉即清除该条件并刷新列表）。

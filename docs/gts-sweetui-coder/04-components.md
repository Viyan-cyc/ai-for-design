# 04-components.md — SweetUI 公共组件及关键 API

> 静态核实 @hw-seq/sweet-ui-base 5.7.0 | 2026-10-27

---

## 1. 组件导出名完整列表（137 个 PascalCase）

| # | 导出名 | kebab 注册名 |
|---|---|---|
| 1 | SweetAffix | sweet-affix |
| 2 | SweetAlert | sweet-alert |
| 3 | SweetAnchor | sweet-anchor |
| 4 | SweetAnchorLink | sweet-anchor-link |
| 5 | SweetAreaChart | sweet-area-chart |
| 6 | SweetAside | sweet-aside |
| 7 | SweetAutocomplete | sweet-autocomplete |
| 8 | SweetAutoResizer | sweet-auto-resizer |
| 9 | SweetAvatar | sweet-avatar |
| 10 | SweetBacktop | sweet-backtop |
| 11 | SweetBadge | sweet-badge |
| 12 | SweetBarChart | sweet-bar-chart |
| 13 | SweetBarlineChart | sweet-barline-chart |
| 14 | SweetBigTable | sweet-big-table |
| 15 | SweetBigTableColumn | sweet-big-table-column |
| 16 | SweetBottomPanel | sweet-bottom-panel |
| 17 | SweetBoxplotChart | sweet-boxplot-chart |
| 18 | SweetBreadcrumb | sweet-breadcrumb |
| 19 | SweetBreadcrumbItem | sweet-breadcrumb-item |
| 20 | SweetBubbleChart | sweet-bubble-chart |
| 21 | SweetButton | sweet-button |
| 22 | SweetButtonGroup | sweet-button-group |
| 23 | SweetCalendar | sweet-calendar |
| 24 | SweetCard | sweet-card |
| 25 | SweetCardPagination | sweet-card-pagination |
| 26 | SweetCarousel | sweet-carousel |
| 27 | SweetCarouselItem | sweet-carousel-item |
| 28 | SweetCascader | sweet-cascader |
| 29 | SweetCascaderPanel | sweet-cascader-panel |
| 30 | SweetCheckbox | sweet-checkbox |
| 31 | SweetCheckboxButton | sweet-checkbox-button |
| 32 | SweetCheckboxGroup | sweet-checkbox-group |
| 33 | SweetClamp | sweet-clamp |
| 34 | SweetCmpTable | sweet-cmp-table |
| 35 | SweetCol | sweet-col |
| 36 | SweetCollapse | sweet-collapse |
| 37 | SweetCollapseItem | sweet-collapse-item |
| 38 | SweetColorPicker | sweet-color-picker |
| 39 | SweetColorPickerCustom | sweet-color-picker-custom |
| 40 | SweetConfigProvider | sweet-config-provider |
| 41 | SweetContainer | sweet-container |
| 42 | SweetCustomLoading | sweet-custom-loading |
| 43 | SweetCustomSelect | sweet-custom-select |
| 44 | SweetDatePicker | sweet-date-picker |
| 45 | SweetDescriptions | sweet-descriptions |
| 46 | SweetDescriptionsItem | sweet-descriptions-item |
| 47 | SweetDialog | sweet-dialog |
| 48 | SweetDivider | sweet-divider |
| 49 | SweetDrawer | sweet-drawer |
| 50 | SweetDropdown | sweet-dropdown |
| 51 | SweetDropdownItem | sweet-dropdown-item |
| 52 | SweetDropdownMenu | sweet-dropdown-menu |
| 53 | SweetEcharts | sweet-echarts |
| 54 | SweetEmpty | sweet-empty |
| 55 | SweetFooter | sweet-footer |
| 56 | SweetForm | sweet-form |
| 57 | SweetFormItem | sweet-form-item |
| 58 | SweetGaugeChart | sweet-gauge-chart |
| 59 | SweetGenexTable | sweet-genex-table |
| 60 | SweetGridItem | sweet-grid-item |
| 61 | SweetGridLayout | sweet-grid-layout |
| 62 | SweetHeader | sweet-header |
| 63 | SweetHorBarChart | sweet-hor-bar-chart |
| 64 | SweetIcon | sweet-icon |
| 65 | SweetImage | sweet-image |
| 66 | SweetInput | sweet-input |
| 67 | SweetInputNumber | sweet-input-number |
| 68 | SweetLineChart | sweet-line-chart |
| 69 | SweetLink | sweet-link |
| 70 | SweetLiquidfillChart | sweet-liquidfill-chart |
| 71 | SweetListTransfer | sweet-list-transfer |
| 72 | SweetLoading | sweet-loading |
| 73 | SweetMain | sweet-main |
| 74 | SweetMapChart | sweet-map-chart |
| 75 | SweetMenu | sweet-menu |
| 76 | SweetMenuItem | sweet-menu-item |
| 77 | SweetMenuItemGroup | sweet-menu-item-group |
| 78 | SweetMessage | sweet-message |
| 79 | SweetMessageBox | sweet-message-box |
| 80 | SweetMinPagination | sweet-min-pagination |
| 81 | SweetMultiSelect | sweet-multi-select |
| 82 | SweetNotification | sweet-notification |
| 83 | SweetOption | sweet-option |
| 84 | SweetOptionGroup | sweet-option-group |
| 85 | SweetPageHeader | sweet-page-header |
| 86 | SweetPagination | sweet-pagination |
| 87 | SweetPanel | sweet-panel |
| 88 | SweetPieChart | sweet-pie-chart |
| 89 | SweetPopconfirm | sweet-popconfirm |
| 90 | SweetPopover | sweet-popover |
| 91 | SweetPopupMenu | sweet-popup-menu |
| 92 | SweetProgress | sweet-progress |
| 93 | SweetRadarChart | sweet-radar-chart |
| 94 | SweetRadialBarChart | sweet-radial-bar-chart |
| 95 | SweetRadio | sweet-radio |
| 96 | SweetRadioButton | sweet-radio-button |
| 97 | SweetRadioGroup | sweet-radio-group |
| 98 | SweetRate | sweet-rate |
| 99 | SweetResult | sweet-result |
| 100 | SweetRow | sweet-row |
| 101 | SweetScoreCard | sweet-score-card |
| 102 | SweetScoreCardGroup | sweet-score-card-group |
| 103 | SweetScrollbar | sweet-scrollbar |
| 104 | SweetSelect | sweet-select |
| 105 | SweetSelectTree | sweet-select-tree |
| 106 | SweetSelectV2 | sweet-select-v2 |
| 107 | SweetSidePanel | sweet-side-panel |
| 108 | SweetSkeleton | sweet-skeleton |
| 109 | SweetSkeletonItem | sweet-skeleton-item |
| 110 | SweetSlider | sweet-slider |
| 111 | SweetSpace | sweet-space |
| 112 | SweetStep | sweet-step |
| 113 | SweetSteps | sweet-steps |
| 114 | SweetSubmenu | sweet-submenu |
| 115 | SweetSwitch | sweet-switch |
| 116 | SweetTable | sweet-table |
| 117 | SweetTableColumn | sweet-table-column |
| 118 | SweetTabPane | sweet-tab-pane |
| 119 | SweetTabs | sweet-tabs |
| 120 | SweetTag | sweet-tag |
| 121 | SweetText | sweet-text |
| 122 | SweetTimeline | sweet-timeline |
| 123 | SweetTimelineItem | sweet-timeline-item |
| 124 | SweetTimePicker | sweet-time-picker |
| 125 | SweetTimeRange | sweet-time-range |
| 126 | SweetTimeSelect | sweet-time-select |
| 127 | SweetTooltip | sweet-tooltip |
| 128 | SweetTransfer | sweet-transfer |
| 129 | SweetTree | sweet-tree |
| 130 | SweetTreeTable | sweet-tree-table |
| 131 | SweetTreeTransfer | sweet-tree-transfer |
| 132 | SweetTreeV2 | sweet-tree-v2 |
| 133 | SweetUpload | sweet-upload |
| 134 | SweetValidate | sweet-validate |
| 135 | SweetVirtualTable | sweet-virtual-table |
| 136 | SweetVirtualTableColumn | sweet-virtual-table-column |
| 137 | SweetVirtualTree | sweet-virtual-tree |

**白名单来源**：`skills/gts-sweetui-coder/scripts/verify/whitelists/sweet-ui-components.json`（kebab）+ `sweet-ui-exports.json`（PascalCase），与 `es/component.mjs` 实际导出一致。

---

## 2. 关键组件 API 速查

### 2.1 按钮 SweetButton

```vue
<SweetButton type="primary">主要按钮</SweetButton>
<SweetButton>次要按钮</SweetButton>
<SweetButton text>文本按钮</SweetButton>
<SweetButton type="danger">告警按钮</SweetButton>
<SweetButton type="primary" loading>加载中</SweetButton>
<SweetButton disabled>禁用</SweetButton>
<SweetButton type="primary" circle aria-label="搜索">
  <SweetIcon icon-class="sweetui-icon-search-l" />
</SweetButton>
```

关键 props：`type`（primary/default/danger/warning/success）、`size`（large/default/small）、`loading`、`disabled`、`text`、`circle`、`icon`。

### 2.2 输入 SweetInput

```vue
<SweetInput v-model="keyword" placeholder="请输入" clearable />
<SweetInput v-model="remark" type="textarea" :rows="2" maxlength="100" show-word-limit />
<SweetInput v-model="val" disabled placeholder="禁用" />
```

关键 props：`v-model`、`type`（text/textarea）、`placeholder`、`clearable`、`disabled`、`maxlength`、`show-word-limit`、`rows`（textarea）。

### 2.3 选择 SweetSelect / SweetOption

```vue
<SweetSelect v-model="value" placeholder="请选择" clearable>
  <SweetOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
</SweetSelect>
<SweetSelect v-model="multi" multiple placeholder="多选">
  <SweetOption v-for="item in opts" :key="item.value" :label="item.label" :value="item.value" />
</SweetSelect>
```

关键 props（Select）：`v-model`、`placeholder`、`clearable`、`multiple`、`disabled`、`filterable`。

### 2.4 表单 SweetForm / SweetFormItem

```vue
<SweetForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
  <SweetFormItem label="名称" prop="name">
    <SweetInput v-model="formData.name" placeholder="请输入名称" />
  </SweetFormItem>
  <SweetFormItem label="区域" prop="region">
    <SweetSelect v-model="formData.region" placeholder="请选择">
      <SweetOption v-for="item in regionOpts" :key="item.value" :label="item.label" :value="item.value" />
    </SweetSelect>
  </SweetFormItem>
  <SweetFormItem>
    <SweetButton type="primary" @click="handleSubmit">提交</SweetButton>
  </SweetFormItem>
</SweetForm>
```

SweetForm defineExpose 方法（`es/components/form/form.vue2.mjs`）：
- `validate()` — 校验全部字段，返回 Promise<boolean>
- `validateField(props?, callback?)` — 校验指定字段
- `resetFields(props?)` — 重置字段值和校验状态
- `clearValidate(props?)` — 清除校验状态
- `scrollToField(prop)` — 滚动到指定字段
- `getField(prop)` — 获取字段实例
- `fields` — 字段实例数组

### 2.5 表格 SweetTable / SweetTableColumn

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

### 2.6 分页 SweetPagination

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

**注意**：UMD 预览下 `:current-page` 静态值可能不渲染，必须用 `v-model:current-page` 绑定 ref。

### 2.7 弹窗 SweetDialog

```vue
<SweetDialog v-model="visible" title="编辑" draggable :close-on-click-modal="false">
  <!-- 内容 -->
  <template #footer>
    <SweetButton @click="visible = false">取消</SweetButton>
    <SweetButton type="primary" @click="handleConfirm">确认</SweetButton>
  </template>
</SweetDialog>
```

关键 props：`v-model`、`title`、`draggable`、`close-on-click-modal`、`width`、`before-close`、`destroy-on-close`。

### 2.8 抽屉 SweetDrawer

```vue
<SweetDrawer v-model="visible" title="详情" size="480px">
  <SweetDescriptions :column="1" border>
    <SweetDescriptionsItem label="名称">设备 A</SweetDescriptionsItem>
    <SweetDescriptionsItem label="状态">运行中</SweetDescriptionsItem>
  </SweetDescriptions>
</SweetDrawer>
```

关键 props：`v-model`、`title`、`size`、`direction`（rtl/ltr/ttb/btt）、`before-close`、`destroy-on-close`。

### 2.9 消息 / 通知

```js
import { SweetMessage, SweetMessageBox, SweetNotification } from '@hw-seq/sweet-ui-base'

SweetMessage.success('操作成功')
SweetMessage.error('操作失败')
SweetMessageBox.confirm('确定删除？', '提示', { type: 'warning' }).then(() => { /* 确认 */ })
SweetNotification({ title: '通知', message: '您有新消息', type: 'info' })
```

---

## 3. 复合示例：查询表单 + 表格 + 分页 + 编辑弹窗

```vue
<script setup>
import { ref, reactive } from 'vue'
import {
  SweetForm, SweetFormItem, SweetInput, SweetSelect, SweetOption,
  SweetButton, SweetIcon, SweetTable, SweetTableColumn, SweetTag,
  SweetPagination, SweetDialog, SweetEmpty, SweetMessage
} from '@hw-seq/sweet-ui-base'

const queryForm = reactive({ keyword: '', status: '' })
const statusOptions = [
  { value: '', label: '全部' },
  { value: 'running', label: '运行中' },
  { value: 'warning', label: '告警' },
  { value: 'error', label: '错误' }
]

const tableData = ref([
  { id: 1, name: '设备 A', status: 'running', ip: '10.0.0.1' },
  { id: 2, name: '设备 B', status: 'warning', ip: '10.0.0.2' },
  { id: 3, name: '设备 C', status: 'error', ip: '10.0.0.3' }
])

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(100)

const statusMap = {
  running: { type: 'success', label: '运行中' },
  warning: { type: 'warning', label: '告警' },
  error: { type: 'danger', label: '错误' }
}

const dialogVisible = ref(false)
const editForm = reactive({ name: '', status: '', ip: '' })

const handleQuery = () => { currentPage.value = 1 }
const handleReset = () => { queryForm.keyword = ''; queryForm.status = '' }
const handlePageChange = (page) => { currentPage.value = page }
const handleSizeChange = (size) => { pageSize.value = size; currentPage.value = 1 }
const handleEdit = (row) => {
  Object.assign(editForm, { name: row.name, status: row.status, ip: row.ip })
  dialogVisible.value = true
}
const handleSave = () => {
  SweetMessage.success('保存成功')
  dialogVisible.value = false
}
</script>

<template>
  <div class="page-root">
    <SweetForm :model="queryForm" inline class="query-form">
      <SweetFormItem label="关键词">
        <SweetInput v-model="queryForm.keyword" placeholder="请输入" clearable />
      </SweetFormItem>
      <SweetFormItem label="状态">
        <SweetSelect v-model="queryForm.status" placeholder="全部" clearable>
          <SweetOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </SweetSelect>
      </SweetFormItem>
      <SweetFormItem>
        <SweetButton type="primary" @click="handleQuery">查询</SweetButton>
        <SweetButton @click="handleReset">重置</SweetButton>
      </SweetFormItem>
    </SweetForm>

    <SweetTable :data="tableData" stripe highlight-current-row class="data-table">
      <SweetTableColumn prop="id" label="ID" width="80" />
      <SweetTableColumn prop="name" label="名称" min-width="160" show-overflow-tooltip />
      <SweetTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <SweetTag :type="statusMap[row.status]?.type || 'info'" size="small">
            {{ statusMap[row.status]?.label || row.status }}
          </SweetTag>
        </template>
      </SweetTableColumn>
      <SweetTableColumn prop="ip" label="IP" width="140" />
      <SweetTableColumn label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <SweetButton text type="primary" @click="handleEdit(row)">编辑</SweetButton>
        </template>
      </SweetTableColumn>
      <template #empty>
        <SweetEmpty description="暂无数据" />
      </template>
    </SweetTable>

    <div class="table-pagination">
      <SweetPagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <SweetDialog v-model="dialogVisible" title="编辑" draggable :close-on-click-modal="false" width="480px">
      <SweetForm :model="editForm" label-width="80px">
        <SweetFormItem label="名称">
          <SweetInput v-model="editForm.name" />
        </SweetFormItem>
        <SweetFormItem label="状态">
          <SweetSelect v-model="editForm.status" placeholder="请选择">
            <SweetOption v-for="item in statusOptions.filter(o => o.value)" :key="item.value" :label="item.label" :value="item.value" />
          </SweetSelect>
        </SweetFormItem>
        <SweetFormItem label="IP">
          <SweetInput v-model="editForm.ip" />
        </SweetFormItem>
      </SweetForm>
      <template #footer>
        <SweetButton @click="dialogVisible = false">取消</SweetButton>
        <SweetButton type="primary" @click="handleSave">确认</SweetButton>
      </template>
    </SweetDialog>
  </div>
</template>

<style scoped lang="css">
.page-root {
  padding: var(--swt-space-size-24);
}
.query-form {
  margin-bottom: var(--swt-space-size-16);
}
.data-table {
  width: 100%;
}
.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--swt-space-size-16);
}
</style>
```

---

## 4. formRef.validate 与 defineExpose 限制核实

### 4.1 SweetForm 真实 API

`es/components/form/form.vue2.mjs` 中，SweetForm **确实通过 `defineExpose` 暴露了 `validate` 方法**：

```js
// 编译后源码
setup(__props, { expose: __expose, emit: __emit }) {
  // ...
  __expose({
    validate,        // async (callback?) => boolean
    validateField,   // async (props?, callback?)
    resetFields,     // (props?) => void
    clearValidate,   // (props?) => void
    scrollToField,   // (prop) => void
    getField,        // (prop) => FieldContext
    fields,          // FieldContext[]
  });
}
```

这是 **真实存在的 API**，在 Vue 真实工程（Vite/webpack 构建）中可靠工作。

### 4.2 UMD 预览下的限制

**来源**：`error-checklist.md` 坑 1（第 40-53 行）

> 预览 UMD 下模板 ref + defineExpose 暴露的方法调用报 "is not a function"。

**限制性质**：这是 **vue3-sfc-loader（浏览器内 SFC 编译器）的运行时限制**，不是 SweetUI 组件本身的缺陷。

**证据链**：
- SweetForm 的 `defineExpose` 定义在编译后源码中，API 真实存在
- `error-checklist.md` 仅将此归咎于"预览 UMD"
- `SweetForm.vue` 示例使用 `formRef.value?.validate()` — 这是**正确的真实工程写法**
- `SweetDialog.vue` 示例**不使用 validate**，但不代表组件不支持

**现有 skill 的 workaround**：
```js
// ❌ UMD 预览下失效
const valid = await formRef.value?.validate()

// ✅ UMD 预览 workaround：prop 信号 + 子组件 watch
// 父组件: <ChildForm :submit-signal="submitCount" />
// 子组件: watch(() => props.submitSignal, () => { /* 执行校验和提交 */ })
```

### 4.3 核实结论

| 问题 | 结论 |
|---|---|
| `formRef.validate()` 是 SweetUI 真实 API？ | **是**，源码确认 |
| `defineExpose` 在真实工程中可用？ | **是**，Vite/webpack 构建无此问题 |
| `defineExpose` 在 UMD 预览中失效？ | **是**，vue3-sfc-loader 运行时限制 |
| 限制是 SweetUI 组件 bug？ | **否**，是预览运行时限制 |
| 需要升级为通用禁令？ | **否**，仅影响 UMD 预览；真实工程用原始写法 |

**建议外网实施者**：保留 UMD 预览下的 workaround 描述，明确标注为"vue3-sfc-loader 限制"而非组件缺陷；真实工程代码不受此限制。

---

## 5. 尺寸、密度、字号、间距规则

### 5.1 CSS 变量定义的尺寸体系

从实际 CSS 变量提取（`var-ui-uDesign2.2-light.css` 和 `.2-dark.css`）：

**组件尺寸**：
- `--swt-component-size` = 32px（默认）
- `--swt-component-size-small` = 24px
- `--swt-component-size-large` = 40px

**字号**（uDesign2.2-light 值，dark 相同）：

| token | light 值 |
|---|---|
| `--swt-font-size-small` | 12px |
| `--swt-font-size-small1` | 12px |
| `--swt-font-size-normal` | 14px |
| `--swt-font-size-normal1` | 14px |
| `--swt-font-size-normal2` | 14px |
| `--swt-font-size-medium` | 16px |
| `--swt-font-size-big` | 16px |
| `--swt-font-size-big1` | 18px |
| `--swt-font-size-big2` | 20px |
| `--swt-font-size-big3` | 24px |
| `--swt-font-size-big4` | 28px |
| `--swt-font-size-big5` | 32px |
| `--swt-font-size-big6` | 36px |
| `--swt-font-size-title1` | 24px |
| `--swt-font-size-title2` | 20px |
| `--swt-font-size-title3` | 16px |
| `--swt-font-size-subtitle1` | 14px |

**字重**：

| token | 值 |
|---|---|
| `--swt-font-weight-thin` | 100 |
| `--swt-font-weight-light` | 300 |
| `--swt-font-weight-normal` | 400 |
| `--swt-font-weight-medium` | 500 |
| `--swt-font-weight-bold` | 600 |
| `--swt-font-weight-black` | 900 |

**间距**：

| token | 值 |
|---|---|
| `--swt-space-size-2` | 2px |
| `--swt-space-size-4` | 4px |
| `--swt-space-size-8` | 8px |
| `--swt-space-size-12` | 12px |
| `--swt-space-size-16` | 16px |
| `--swt-space-size-20` | 20px |
| `--swt-space-size-24` | 24px |
| `--swt-space-size-32` | 32px |
| `--swt-space-size-40` | 40px |
| `--swt-space-size-48` | 48px |
| `--swt-space-size-56` | 56px |
| `--swt-space-size-64` | 64px |
| `--swt-space-size-72` | 72px |
| `--swt-space-size-80` | 80px |

**圆角**：

| token | 值 |
|---|---|
| `--swt-radius-size-small` | 2px |
| `--swt-radius-size-normal` | 4px |
| `--swt-radius-size-medium` | 8px |
| `--swt-radius-size-big` | 12px |
| `--swt-radius-size-big1` | 16px |
| `--swt-radius-size-big2` | 20px |
| `--swt-radius-size-infinity` | 999px（胶囊形） |

### 5.2 官方推荐用途（来自 design-language.md 速查 + code-rules.md）

| 用途 | token |
|---|---|
| 页面内边距 | `--swt-space-size-24` |
| 表单字段垂直间距 | `--swt-space-size-20`（SweetUI CSS 内置） |
| 操作区/表格/分页间距 | `--swt-space-size-16` |
| 按钮组间距 | `--swt-space-size-16` |
| Dialog 底部按钮间距 | `--swt-space-size-8` |
| Tags 间距 | `--swt-space-size-8` |
| 表格单元格水平内边距 | `--swt-space-size-12` |
| 正文文本 | `--swt-font-size-normal` (14px) |
| 小标题 | `--swt-font-size-normal1` (14px) / `--swt-font-size-medium` (16px) |
| 常规圆角 | `--swt-radius-size-normal` (4px) |

**无独立密度/紧凑模式 API**：SweetUI 通过 `size` prop（`large`/`default`/`small`）控制组件密度，对应 CSS 变量 `--swt-component-size-{large/default/small}`。无全局密度切换开关。

---

## 6. 白名单文件位置

| 文件 | 内容 |
|---|---|
| `scripts/verify/whitelists/sweet-ui-components.json` | 137 个 kebab-case 注册名 |
| `scripts/verify/whitelists/sweet-ui-exports.json` | 137 个 PascalCase 导出名 |
| `scripts/verify/whitelists/sweet-ui-icons.json` | 图标 stem 名 |
| `scripts/verify/whitelists/sweet-ui-icon-css-classes.json` | 图标完整 CSS class 名 |

白名单由 `scripts/gen-whitelists.mjs` 从 npm 包的 `es/component.mjs` + `theme-chalk/fonts/sweet.css` 自动生成。

# 错误检测清单

> 代码自检时逐项检查，确保没有以下错误。

## 一、组件导入错误

### 错误 1：未导入组件直接使用

```vue
<!-- ❌ 错误：未导入组件直接使用导致页面白屏 -->
<el-button type="primary">提交</el-button>

<!-- ✅ 正确 -->
<script setup>
import { ElButton } from 'element-plus'
</script>
<ElButton type="primary">提交</ElButton>
```

### 错误 2：使用 EP 默认色而非 GTS Token

```less
/* ❌ 错误：使用 Element Plus 默认蓝色 */
background: #409eff;
color: #67c23a;

/* ✅ 正确：使用 GTS Token */
background: var(--color-brand);
color: var(--color-success);
```

### 错误 3：间距/圆角使用非 Token 值

```less
/* ❌ 错误：使用任意数值 */
margin: 15px;
border-radius: 6px;
padding: 10px 20px;

/* ✅ 正确：使用 GTS Token */
margin: var(--space-size-16);
border-radius: var(--radius-size-normal);   /* 4px */
padding: var(--space-size-8) var(--space-size-20);
```

### 错误 3.1：静态内联 style

```vue
<!-- ❌ 错误：字面量样式写进模板 -->
<ElInput style="width: 200px" />

<!-- ✅ 正确：进 less 类 -->
<ElInput class="search-input" />
```

```less
.search-input { width: 200px; }
```

### 错误 3.2：把 ElLoading 服务当指令注册

`v-loading` 指令的实体是 `ElLoadingDirective`；`ElLoading` 是命令式服务（`ElLoading.service()`），
没有指令钩子，注册上去遮罩不会出现（编译能过、无报错，运行时静默失效）。

```vue
<!-- ❌ 错误：服务当指令，遮罩不出现 -->
<script setup>
import { ElLoading } from 'element-plus'
defineOptions({ directives: { loading: ElLoading } })
</script>

<!-- ✅ 正确 -->
<script setup>
import { ElLoadingDirective } from 'element-plus'
defineOptions({ directives: { loading: ElLoadingDirective } })
</script>
```

## 二、GTS 规范违规

### 错误 4：同一按钮组放置多个主要按钮

```vue
<!-- ❌ 错误 -->
<ElButton type="primary">新增</ElButton>
<ElButton type="primary">导出</ElButton>

<!-- ✅ 正确：每按钮组最多一个主要按钮 -->
<ElButton type="primary">新增</ElButton>
<ElButton>导出</ElButton>
```

### 错误 5：图标按钮缺少文字说明

```vue
<!-- ❌ 错误：图标按钮无说明 -->
<ElButton :icon="Search" circle />

<!-- ✅ 正确：添加 aria-label 或 ElTooltip -->
<ElButton :icon="Search" circle aria-label="搜索" />
<!-- 或 -->
<ElTooltip content="搜索">
  <ElButton :icon="Search" circle />
</ElTooltip>
```

### 错误 6：ElDialog 缺少 draggable 或 close-on-click-modal 默认

```vue
<!-- ❌ 错误 -->
<ElDialog v-model="visible" title="编辑">

<!-- ✅ 正确 -->
<ElDialog v-model="visible" title="编辑" draggable :close-on-click-modal="false">
```

### 错误 7：表格无数据时整体空白

```vue
<!-- ❌ 错误：无空态处理 -->
<ElTable :data="tableData">
  <ElTableColumn prop="name" label="名称" />
</ElTable>

<!-- ✅ 正确：保留表头 + 空态（样式进 less 类） -->
<ElTable :data="tableData">
  <ElTableColumn prop="name" label="名称" />
  <template #empty>
    <div class="table-empty">
      <ElEmpty description="暂无数据" />
    </div>
  </template>
</ElTable>
```

```less
.table-empty { padding: var(--space-size-32) 0; }
```

### 错误 8：使用 moment.js 而非 dayjs

```js
// ❌ 错误
import moment from 'moment'

// ✅ 正确
import dayjs from 'dayjs'
```

### 错误 9：直接在代码中写死中英文字符串做语言显示

> 预览原型阶段直接写中文文案可接受；真实工程接入后必须走 vue-i18n（见 code-rules 规则十）。

```js
// ❌ 错误（真实工程）
ElMessage.success('保存成功')

// ✅ 正确（真实工程）
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
ElMessage.success(t('msg.module.success.saveOk'))
```

### 错误 10：大对象定义

对象属性之和超过 10000 以上会严重影响性能。

## 三、文件组织错误

### 错误 11：单文件超过 500 行未拆分

### 错误 12：文件命名使用大写驼峰而非小写中划线

```
// ❌ 错误
SearchForm.vue
DataGrid.ts

// ✅ 正确
search-form.vue
data-grid.js
```

### 错误 13：跨层级通信方式选择错误

- 层级差 = 1 却用了 provide/inject（应使用 props/emit）
- 使用了反向 provide/inject（子 provide → 父 inject）

## 四、Vue3 编码错误

### 错误 14：使用 reactive 包装数组

```js
// ❌ 错误
const list = reactive([])

// ✅ 正确
const list = ref([])
```

### 错误 15：use 函数返回单例状态

```js
// ❌ 错误：多实例共享状态
const items = ref([])
const useList = () => ({ items })

// ✅ 正确：每次调用创建独立实例
const useList = () => {
  const items = ref([])
  return { items }
}
```

### 错误 16：异步回调中创建 watch 未手动停止

```js
// ❌ 错误：不会随组件卸载自动停止
promise.then(() => {
  watch(source, callback)
})

// ✅ 正确
let unwatch = null
promise.then(() => {
  unwatch = watch(source, callback)
})
onUnmounted(() => { unwatch?.() })
```

### 错误 17：串行发出无依赖的网络请求

```js
// ❌ 错误
await getTableData()
await getInfoData()

// ✅ 正确
await Promise.all([getTableData(), getInfoData()])
```

## 五、样式 Token 错误

### 错误 18：使用硬编码字号

```less
/* ❌ 错误 */
font-size: 13px;
font-size: 15px;
font-weight: 500;
line-height: 24px;

/* ✅ 正确 */
font-size: var(--font-size-normal);           /* 14px */
font-weight: var(--font-weight-bold);         /* 600 */
line-height: var(--font-line-height-normal1); /* 24px */
```

### 错误 19：使用硬编码阴影

```less
/* ❌ 错误 */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

/* ✅ 正确 */
box-shadow: var(--shadow-1);
```

### 错误 20：业务页面深度覆盖 EP 组件样式

```less
/* ❌ 错误：主题层（bridge.css）已完成全部映射，页面再做覆盖即双重维护 */
:deep(.el-table .el-table__header) {
  background: #f5f5f5 !important;
}

/* ✅ 正确：页面不写任何 --el-* 覆盖 */
```

## 六、图表错误

### 错误 21：图表配色写死 hex

```js
// ❌ 错误：不跟随换肤，build 也无法审计
option.color = ['#2070F3', '#62B42E', '#715AFB']

// ✅ 正确：运行时读 Token
const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
option.color = ['--color-chart-1', '--color-chart-2', '--color-chart-3']
  .map(readToken).filter(Boolean)
```

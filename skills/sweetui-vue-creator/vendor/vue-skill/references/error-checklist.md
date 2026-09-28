# 错误检测清单

> 代码自检时逐项检查，确保没有以下错误。一→六为通用错误，七为 SweetUI / 预览 UMD 特有坑。

## 一、组件导入错误

### 错误 1：未导入组件直接使用

```vue
<!-- ❌ 错误：未导入直接使用（预览 UMD 全量注册会掩盖问题，真实工程白屏） -->
<sweet-button type="primary">提交</sweet-button>

<!-- ✅ 正确：每个文件显式 import（code-rules 规则 2.1） -->
<script setup>
import { SweetButton } from '@hw-seq/sweet-ui-base'
</script>
<template>
  <sweet-button type="primary">提交</sweet-button>
</template>
```

### 错误 2：使用组件库默认色而非 GTS Token

```less
/* ❌ 错误：使用组件库默认主色 / 写死色值 */
background: #2070f3;
color: #ffffff;

/* ✅ 正确：使用 GTS Token */
background: var(--color-brand);
color: var(--color-text-inverse);
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
<sweet-input style="width: 200px" />

<!-- ✅ 正确：进 less 类 -->
<sweet-input class="search-input" />
```

```less
.search-input { width: 200px; }
```

### 错误 3.2：显式 import v-loading 的指令实体

`v-loading` 指令在 `app.use(SweetUIBase)` 全量安装时已自动注册，模板直接用即可；
但白名单没有 `SweetLoadingDirective` 这类导出——**显式 import 指令实体会失败或拿到
undefined**（编译能过、运行时静默失效）。局部注册无意义，全量安装下也不需要。

```vue
<!-- ❌ 错误：import 不存在的指令实体 -->
<script setup>
import { SweetLoadingDirective } from '@hw-seq/sweet-ui-base'
defineOptions({ directives: { loading: SweetLoadingDirective } })
</script>

<!-- ✅ 正确：app.use(SweetUIBase) 已注册，模板直接用 -->
<div v-loading="loading">…</div>
<!-- 命令式场景用 $loading 服务（经 getCurrentInstance().proxy 取用） -->
```

## 二、GTS 规范违规

### 错误 4：同一按钮组放置多个主要按钮

```vue
<!-- ❌ 错误 -->
<sweet-button type="primary">新增</sweet-button>
<sweet-button type="primary">导出</sweet-button>

<!-- ✅ 正确：每按钮组最多一个主要按钮 -->
<sweet-button type="primary">新增</sweet-button>
<sweet-button>导出</sweet-button>
```

### 错误 5：图标按钮缺少文字说明

```vue
<!-- ❌ 错误：图标按钮无说明 -->
<sweet-button><icon-plus name="search" /></sweet-button>

<!-- ✅ 正确：添加 aria-label 或 sweet-tooltip -->
<sweet-button aria-label="搜索"><icon-plus name="search" /></sweet-button>
<!-- 或 -->
<sweet-tooltip content="搜索">
  <sweet-button><icon-plus name="search" /></sweet-button>
</sweet-tooltip>
```

### 错误 6：SweetDialog 缺少 draggable 或 close-on-click-modal 默认

```vue
<!-- ❌ 错误 -->
<sweet-dialog v-model="visible" title="编辑">

<!-- ✅ 正确 -->
<sweet-dialog v-model="visible" title="编辑" draggable :close-on-click-modal="false">
```

### 错误 7：表格无数据时整体空白

```vue
<!-- ❌ 错误：无空态处理 -->
<sweet-table :data="tableData">
  <sweet-table-column prop="name" label="名称" />
</sweet-table>

<!-- ✅ 正确：保留表头 + 空态（样式进 less 类） -->
<sweet-table :data="tableData">
  <sweet-table-column prop="name" label="名称" />
  <template #empty>
    <div class="table-empty">
      <sweet-empty description="暂无数据" />
    </div>
  </template>
</sweet-table>
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

> 原型阶段直接写中文文案可接受；用户要求国际化时走词典 + `t()` 查表
> （机制见 `../../references/on-demand-toggle.md`，规则见 code-rules 规则十）。

```js
// ❌ 错误
$msgbox.alert('查询成功')

// ✅ 正确（启用 i18n 的工程）
$msgbox.alert(t('msg.module.success.queryOk'))
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

### 错误 20：业务页面深度覆盖 SweetUI 组件样式

组件 DOM 类名前缀跟随 namespace（默认 "el"，即 `.el-table`）。

```less
/* ❌ 错误：主题层（bridge.less）已完成全部映射，页面再做覆盖即双重维护 */
:deep(.el-table .el-table__header) {
  background: #f5f5f5 !important;
}

/* ✅ 正确：页面不写任何 --el-* / --swt-* 覆盖 */
```

## 六、图表错误

### 错误 21：图表配色写死 hex

```js
// ❌ 错误：chartTheme 是 JS 静态对象，写死 hex 不跟随换肤，build 也无法审计
option.color = ['#2070F3', '#62B42E', '#715AFB']

// ✅ 正确：运行时读 Token（变量挂在 body[theme] 上，从 body 读）
const readToken = (name) =>
  getComputedStyle(document.body).getPropertyValue(name).trim()
option.color = ['--color-chart-1', '--color-chart-2', '--color-chart-3']
  .map(readToken).filter(Boolean)
```

## 七、SweetUI 运行时坑（预览 UMD）

> 预览跑 UMD 运行时，与真实工程构建产物行为有差异；以下坑按两边都稳的写法规避。

### 坑 1：跨组件命令式调用用 defineExpose 方法

预览 UMD 运行时下，模板 ref + `defineExpose` 暴露的方法调用会报 "is not a function"
（`formRef.validate()`、`childRef.open()` 等都在内）。

```js
// ❌ 错误：预览运行时下失效
const valid = await formRef.value?.validate()
childRef.value.open()

// ✅ 正确：prop 信号 + 子组件 watch（父递增计数 prop，子 watch 它执行动作）
// <child-form :submit-signal="n" />
// 子组件：watch(() => props.submitSignal, () => { /* 执行动作 */ })
```

表单校验在预览里交 sweet-form 的 rules 即时校验承担；真实工程按 code-rules 规则 2.5
原生写法（ref validate 可靠）。

### 坑 2：SweetPagination 静态 current-page

```vue
<!-- ❌ 错误：静态字面量，预览运行时下组件可能静默不渲染 -->
<sweet-pagination :current-page="1" :page-size="20" :total="100" />

<!-- ✅ 正确：v-model 绑 ref -->
<sweet-pagination v-model:current-page="page" :page-size="20" :total="100"
  @current-change="loadData" />
```

### 坑 3：页面引用 --el-* / --swt-* 变量

`--el-*` 是 bridge 的映射输出；`--swt-*` 是 SweetUI 自有体系（纯 CSS、不受 namespace
影响）。两者都不进页面代码。

```less
/* ❌ 错误 */
color: var(--swt-color-primary);
background: var(--el-color-primary);

/* ✅ 正确：只写 design-language 名 */
color: var(--color-brand);
```

### 坑 4：图表期待配色自动跟随换肤

SweetUI 图表的 chartTheme 是 JS 静态对象，不读 CSS 变量——换肤后图表配色不变。
按 code-rules 规则 11.2：`getComputedStyle(document.body)` 读 `--color-chart-*`
注入 option，`MutationObserver` 监听 `body[theme]` 属性变化后重绘。

### 坑 5：使用白名单外的组件（build 直接拒绝）

SweetUI 5.6.5 共 137 个组件（白名单 `scripts/verify/whitelists/sweetui-components.json`）。
EP 有而 SweetUI 没有的常见组件，按回退写法：

| EP 有、SweetUI 没有 | 回退写法 |
| --- | --- |
| sweet-textarea | `<sweet-input type="textarea" />` |
| sweet-check-tag | `<sweet-tag>` + 点击切换选中态 |
| sweet-avatar-group | 页面自封装（头像叠放 + 计数徽标） |
| sweet-image-viewer | `<sweet-image>`（自带预览能力） |

完整缺失回退清单见 components_index.md。

### 坑 6：`<sweet-icon name="X">` 渲染不出图标

sweet-icon 没有 name prop（只有 iconClass/size/color），name 写上去不生效。
图标一律用包装组件（code-rules 规则 2.5.1）。

```vue
<!-- ❌ 错误：name prop 不存在 -->
<sweet-icon name="search" />

<!-- ✅ 正确 -->
<icon-plus name="search" />
```

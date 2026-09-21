# Vue3 代码规则

> 使用 Element Plus + GTS 设计规范开发时的强制性规则。文档优先级：
> GTS 组件规范 > components_index.md > code-rules.md > error-checklist.md > 代码示例。

## 一、最高优先级原则

**使用限制**：

- 仅允许使用 `components_index.md` 中映射的 Element Plus 组件（白名单校验见
  `scripts/verify/whitelists/`）。
- 单个文件不超过 500 行；页面功能复杂时按功能区域拆分子组件，最后组装。
- 页面文件放 `src/pages/{Page}/`（一页一目录，子组件/样式放同目录）。

**禁止事项**：

- 不要用其他项目的旧写法覆盖本规范。
- 不要从示例推断组件文档未列出的属性、事件、插槽或方法。
- 不要使用 Element Plus 默认主题色替代 GTS Token。
- 不要在页面代码里写文档指引注释（规范引用、出处编号等）——出处只在本目录文档里。

---

## 二、Element Plus 使用规范

### 规则 2.1：所有 EP 组件必须显式导入后使用

```js
// ✅ 正确：每个文件各自导入用到的组件
import { ElButton, ElTable, ElForm, ElFormItem } from 'element-plus'
```

```vue
<!-- ❌ 错误：未导入直接使用，编译能过但运行时白屏 -->
<el-button>提交</el-button>
```

- 模板标签用 PascalCase（`<ElButton>`）；命令式 API（`ElMessage`/`ElNotification`/`ElLoading`）
  同样需要 import；vue 的 API（`ref`/`reactive`/…）每个文件各自 import。编译宏
  （`defineProps` 等）不用 import。

### 规则 2.2：不在业务页面覆盖 EP 组件样式

组件主题已由项目主题层（`src/assets/themes/bridge.css`）集中映射到 GTS Token——
`--el-color-primary ← --color-brand` 等全部对位已完成。**页面禁止再做任何 `--el-*`
覆盖或 `:deep` 主题改写**；组件状态（悬停/按下/禁用/加载）由桥接层自动获得，页面不重绘状态色。

```less
// ❌ 错误：业务页面深度覆盖
:deep(.el-button) { background: red !important; }

// ✅ 正确：什么都不写，样式自动跟随主题
```

### 规则 2.3：ElDialog 默认传递 draggable、:close-on-click-modal="false"

```vue
<ElDialog draggable :close-on-click-modal="false">
```

### 规则 2.4：ElTable 大数据量使用分页或虚拟滚动

### 规则 2.5：ElForm 表单校验用 EP 原生 rules + ref validate

```js
import { reactive, ref } from 'vue'

const formRef = ref()
const rules = reactive({
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
})

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid) { /* 提交逻辑 */ }
}
```

### 规则 2.6：动态显示控制优先使用 v-if，而不是 v-show

v-if 保证页面展示资源少，减少内存占用。

### 规则 2.7：表单项联动场景优先用 change 事件处理联动

watch 的性能比 change 事件的性能低，且容易引起内存泄漏。

---

## 三、样式规范（less + Token）

### 规则 3.1：样式块统一 `<style scoped lang="less">`

- **禁止静态内联 style**：`style="width: 200px"` 这类字面量一律改写为 less 类。
- 仅动态绑定 `:style` 允许（值由 JS 计算的场景，如进度宽度）。
- 禁止 `:root` / `html` / `body` / `[data-theme]` 选择器（build 拒绝）。
- 页面局部自定义属性必须 `--page-*` 前缀。

```vue
<style scoped lang="less">
.search-input {
  width: 200px;
}
</style>

<template>
  <!-- ❌ 禁止 -->
  <ElInput style="width: 200px" />
  <!-- ✅ 正确 -->
  <ElInput class="search-input" />
</template>
```

### 规则 3.2：颜色必须使用 GTS Token，不使用 EP 默认色或 hex

```less
// ✅ 正确
.card {
  background: var(--color-brand);
  color: var(--color-text-inverse);
}

// ❌ 错误：使用 EP 默认蓝色 / 写死色值
.card {
  background: #409eff;
  color: #fff;
}
```

- 页面里正常应完全无 hex；页面局部派生色值定义在 `--page-*` 变量中。

### 规则 3.3：间距使用 space-size-* Token

```less
// ✅ 正确
margin: var(--space-size-16);
padding: var(--space-size-20);

// ❌ 错误：使用任意值
margin: 15px;
padding: 18px;
```

### 规则 3.4：圆角使用 radius-size-* Token

```less
// ✅ 正确
border-radius: var(--radius-size-normal);   /* 4px */
border-radius: var(--radius-size-medium);   /* 8px */

// ❌ 错误
border-radius: 6px;
border-radius: 10px;
```

### 规则 3.5：阴影使用 shadow-* Token

```less
// ✅ 正确
box-shadow: var(--shadow-1);

// ❌ 错误
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
```

### 规则 3.6：字号/行高/字重使用 font-size-* / font-line-height-* / font-weight-* Token

```less
// ✅ 正确
text {
  font-size: var(--font-size-normal);           /* 14px */
  line-height: var(--font-line-height-normal);  /* 22px */
  font-weight: var(--font-weight-bold);         /* 600 */
}

// ❌ 错误
text {
  font-size: 13px;
  font-weight: 500;
}
```

---

## 四、文件组织规范

### 规则 4.1：页面一页一目录

```
src/
└── pages/
    └── device-list/                 # 小写中划线
        ├── index.vue                # 页面入口
        └── components/
            ├── search-form.vue      # 子组件，小写中划线命名
            └── data-table.vue
```

### 规则 4.2：组件替换时必须重新检查拆分要求

当因编译错误或其他原因更换组件时，必须重新检查新组件是否需要拆分文件。

### 规则 4.3：跨文件通信机制

**场景 1：父子组件通信（相邻层级）**

- 父传子：子组件使用 `defineProps` 定义 props。
- 子通知父：使用 `emit` 触发。

**场景 2：跨多层组件通信（两层及以上），且是 page 开发，使用 pinia store**

- store 使用禁止直接修改变量，必须调用对应的 update 方法。
- 注：预览运行时不含 pinia；原型页面避免此形态，真实工程接入后可用。

**场景 3：跨多层组件通信（两层及以上），是业务/公共组件开发，或层级大于 3 层且子组件仅使用**

- 使用 `provide/inject` 机制。
- provide/inject 方向必须向下：只能在祖先组件 provide，子孙组件 inject。
- inject 获取数据建议在 page 或组件根目录封装组合式函数 `hooks/use-inject.js`。

**判断标准**：

- 组件层级差 = 1 → 使用 props/events
- 组件层级差 ≥ 2 且是 page 开发 → 优先使用 pinia store（预览原型内避免此形态）
- 组件层级差 ≥ 2 且是业务/公共组件开发 → 使用 provide/inject
- 组件层级差 ≥ 3 或子组件仅使用不存在修改场景 → 使用 provide/inject

---

## 五、核心编码规范

### 规则 5.1：禁止实体层 use 函数返回单例状态

```js
// ❌ 错误：单例，多实例会共享
let formItems = [{ key: 'nameItem' }]
const usePo = () => ({ formItems })

// ✅ 正确：每次调用创建独立实例
const usePo = () => {
  const formItems = [{ key: 'nameItem' }]
  return { formItems }
}
```

### 规则 5.2：禁止使用组件文档说明之外的属性和方法

仅使用组件文档 Exposes 暴露的属性和方法。

### 规则 5.3：禁止直接修改 DOM 树

### 规则 5.4：禁止非开发模式下使用 console API

### 规则 5.5：禁止用 reactive 包装数组响应式

```js
// ❌ 错误
const list = reactive([])

// ✅ 正确
const list = ref([])
```

### 规则 5.6：单个文件代码不要超过 500 行

按页面模块拆分组件，按功能抽取 JS 代码到 `hooks/{模块名}/use-{功能名称}.js` 的组合式函数中。

### 规则 5.7：所有的目录、文件命名皆为小写字母与中划线拼接

如 `search-form.vue`、`use-list.js`、`index.vue`，目录如 `search-form`。
（模板标签/组件名仍用 PascalCase，两者不冲突。）

---

## 六、异步数据加载规范

### 规则 6.1：网络请求尽可能并行

```js
// ❌ 错误：串行发出
await getTableData()
await getInfoData()

// ✅ 正确：并行发出
await Promise.all([getTableData(), getInfoData()])
```

---

## 七、性能优化规范

### 规则 7.1：禁止定义大对象

对象属性之和超过 10000 以上，会严重影响性能。

### 规则 7.2：禁止在组件属性 props 中使用非驼峰命名

会导致响应式丢失等问题。

---

## 八、内存管理规范

### 规则 8.1：局部注册的事件总线使用完后必须将其反注册

```js
import { onMounted, onUnmounted } from 'vue'

const customEvent1 = () => {}

onMounted(() => {
  eventBus.on('customEvent1', customEvent1)
})

onUnmounted(() => {
  eventBus.off('customEvent1', customEvent1)
})
```

### 规则 8.2：尽可能在同步创建侦听器

若在异步回调函数中创建侦听器（包括 watch、watchEffect）必须在组件卸载时手动停止。

```js
import { watch, onUnmounted } from 'vue'

let unwatch = null

promise.then(() => {
  unwatch = watch(() => {}, () => {})
})

onUnmounted(() => {
  unwatch?.()
})
```

---

## 九、日期处理规范

### 规则 9.1：日期处理统一用 dayjs

```js
// ✅ 正确
import dayjs from 'dayjs'
const now = dayjs()

// ❌ 错误
import moment from 'moment'
const now = moment()
```

---

## 十、国际化规范

> 注：预览运行时不含 vue-i18n；以下规则在真实工程接入后适用。原型阶段直接写中文文案
> 是可接受的临时形态，但不要用代码注释做双语说明。

### 规则 10.1：禁止在代码中直接写死中英文字符串做语言显示

```js
// ✅ 正确：使用国际化 Key
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
ElMessage.success(t('msg.yieldAnalysis.success.queryOk'))

// ❌ 错误：直接写死中文
ElMessage.success('查询成功')
```

### 规则 10.2：国际化 key 命名中的 '.' 字符必须大于 3 个或以上

按 `{msg.模块名称.分类.语义名称}` 的方式命名，至少包含 3 个 `.`

---

## 十一、其他规范

### 规则 11.1：按钮点击事件的消息提示应简洁明了

如"保存成功"、"提交成功"、"查询失败"等。

### 规则 11.2：图表组件使用 ECharts + GTS 图表配色

Element Plus 没有内置图表组件。使用 `vue-echarts` 组件 + 运行时读取 GTS 图表 Token
（不写 hex，换肤自动跟随）：

```js
import VChart from 'vue-echarts'

const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const chartColors = ['--color-chart-1', '--color-chart-2', '--color-chart-3',
  '--color-chart-4', '--color-chart-5', '--color-chart-6'].map(readToken).filter(Boolean)
// option.color = chartColors
```

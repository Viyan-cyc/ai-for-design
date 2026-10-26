# Vue3 代码规则

规则版本：0.2.3

> 使用 Element Plus + GTS 设计规范开发时的强制性规则。文档优先级：
> 视觉与设计值以GTS规范及其生成的消费视图为准；API以实际版本的Vue/EP为准。本文为项目编码规则统一来源，错误清单与示例用于解释，不得覆盖规则。编码前必读；当前上下文已完整读取同版本可复用。

## 一、最高优先级原则

**使用限制**：

- 只使用随包实际支持的Vue/Element Plus API，索引用于选型；未知API核对实际版本资料，不从其他组件猜测。
- 多功能页面按职责拆分，入口负责装配和协调；800行是必须审视并优先拆分的界线，不是凑满后才拆的指标，详见规则5.6。
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

组件主题已由项目主题层（`src/assets/themes/bridge.less`）集中映射到 GTS Token——
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

### 规则 2.6：按切换成本选择 v-if / v-show

低频或按需创建的区域用v-if；频繁切换且需要保留实例时可用v-show，不声称v-if始终更快。

### 规则 2.7：按语义选择事件、computed与watch

用户操作触发的联动用change等事件；派生值优先computed；需要响应数据变化的副作用可用watch。同步setup创建的watch通常随卸载停止，异步创建的watch需自行停止，不能以不存在的性能定律禁用watch。

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

- 页面里不写hex；局部派生色可在 `--page-*` 中用已有设计token组合，定义作用域须覆盖使用位置。

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
    └── DeviceList/                  # init返回的PAGE，沿用脚手架约定
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

**场景 2：局部跨层上下文**

共享范围局限于同一组件树时，可使用provide/inject避免逐层透传；提供者管理修改入口。不要仅凭超过两层引入全局store。

**场景 3：跨页面或全局共享状态**

真实工程按既有状态管理方案处理；当前离线运行没有Pinia，不自行引入未映射依赖。局部状态留在拥有它的组件，子组件不直接修改父props或注入的只读状态。

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

### 规则 5.3：业务状态由Vue驱动DOM

不手工增删Vue管理的节点。图表初始化、测量、滚动与焦点等必要操作通过模板ref和生命周期执行，并清理外部资源。

### 规则 5.4：交付不保留调试输出

删除临时console和调试UI；错误按工程日志/反馈约定处理，不吞错，也不将全部错误变成成功提示。

### 规则 5.5：本项目列表统一使用ref([])

```js
// 本项目不采用；reactive数组本身是合法Vue用法
const list = reactive([])

// ✅ 正确
const list = ref([])
```

### 规则 5.6：按职责拆分，800行必须审视

开始写模板前，先根据需求确定以下归属，并直接按归属编写，不先把整页写进index.vue再拆：

1. **区域与文件**：识别导航、筛选、列表、详情、页脚等本页实际区域；相对独立的展示/交互区域放 `src/pages/{Page}/components/{name}.vue`。入口负责装配和跨区域协调，不要求有独立状态或跨页复用才拆；简单页面仍可单文件。
2. **数据与状态**：业务记录经 `src/api/{模块}.js` 获取，mock在 `src/api/mock/`；跨区域共享状态由页面持有，区域自身状态留在子组件。菜单、联系方式显示配置、页脚分组等UI配置留在所属组件；重复项先组织数组，再按规则5.8循环。
3. **装配与复用**：先明确服务函数及组件props/emits，再实现各区域并由入口组装。仅实际跨页面复用时放入项目公共组件目录；复杂可复用逻辑才提取组合式函数。不要为凑层数创建空文件、全局store或多余接口。

例如查询列表页可拆筛选区、结果表格和详情抽屉；Portal可拆导航、内容区和页脚。按本页职责选择，不把示例清单作为固定文件数量。此步骤不要求输出规划报告、目录清单或等待确认。

单文件原则上不超过800行。超过时必须重新审视并优先拆分；职责单一、继续拆分反而增加理解成本时才保留。不得压缩换行、删除必要格式或机械搬运来规避。简单页面可单文件，不把每个div或静态卡片单独封装。

### 规则 5.7：业务文件用小写中划线，脚手架入口沿用约定

如 `search-form.vue`、`use-list.js`、`index.vue`，目录如 `search-form`。
（模板标签/组件名用PascalCase。页面目录使用init返回的PAGE，如DeviceList；App.vue/main.js等入口沿用约定。自建子组件/业务辅助文件用小写中划线。已有工程不批量改名。）

### 规则 5.8：同构结构必须数据驱动

仅内容不同的卡片、栏目、链接、菜单和列表，先定义配置数组，再写一份v-for模板；不先复制多段模板再等待自查重构。嵌套结构外层和内层分别循环，使用稳定的业务id/key，动态列表不用数组下标。联系方式的图标不同可用 `<component :is="item.icon" />`，显示业务值或 `t(item.labelKey)`；页脚用分组和链接两层配置。静态UI配置留在所属组件或辅助模块，不因此创建API。不同职责、插槽或结构不为循环强行合并。

```vue
<ElCol v-for="group in footerGroups" :key="group.id" :xs="24" :sm="12" :md="6">
  <h4>{{ group.title }}</h4>
  <ElLink v-for="link in group.links" :key="link.id" :href="link.href" :underline="false">
    {{ link.label }}
  </ElLink>
</ElCol>
```

启用多语言时数组保存titleKey/labelKey，在模板中t(key)，或由computed生成配置；不得初始化时翻译一次后固定字符串。


---

## 六、异步数据加载规范

### 规则 6.1：无依赖请求并行，依赖请求按顺序

```js
// 无数据依赖时，避免不必要的串行等待
await getTableData()
await getInfoData()

// ✅ 正确：并行发出
await Promise.all([getTableData(), getInfoData()])

// 有依赖时按顺序，不为并行破坏参数与时序
const info = await getInfoData()
await getTableData({ ownerId: info.id })
```

---

## 七、性能优化规范

### 规则 7.1：控制大数据的响应式与渲染成本

大列表用分页/虚拟滚动，外部引擎对象按需要避免深度响应式；依据实际数据规模和行为判断，不使用无依据的属性数量阈值。

### 规则 7.2：prop声明与模板命名区分

JS中的prop声明用camelCase；模板传参可用kebab-case，保持团队约定一致。不能声称模板kebab-case导致响应式丢失。

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

let disposed = false
let unwatch

promise.then(() => {
  if (disposed) return
  unwatch = watch(source, handleChange)
})

onUnmounted(() => {
  disposed = true
  unwatch?.()
})
```

---

定时器、事件监听、ResizeObserver及手动创建的图表实例同样在卸载时取消/释放；未使用的资源不额外造清理代码。

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

> 国际化按用户需求启用；未要求多语言时直接写中文。预览已有可选 vue-i18n 接线，
> 以下 key/词典规则仅适用于已启用国际化的工程，不额外要求中文页面改造词典。

### 规则 10.1：禁止在代码中直接写死中英文字符串做语言显示

```js
// ✅ 正确：使用国际化 Key
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
ElMessage.success(t('msg.yieldAnalysis.success.queryOk'))

// ❌ 错误：直接写死中文
ElMessage.success('查询成功')
```

> 边界：`t()` 只包「前端决定的文案」（界面文案 + 枚举显示名），不包「后端给的数据值」。
> 对数据值 `t()` 的真实系统会把接口返回的标题/描述渲染成 key 路径——违反「对接后端页面零改动」。

### 规则 10.2：中英文文件独立且key成对一致

词典分别放src/i18n/locales/zh-cn.js与en.js，同一key表示同一语义且两边都提供翻译；按msg.模块.分类.语义命名，至少3个点。词典过大时才按模块拆分，由语言入口聚合，遵循800行审视约定。不生成两套Vue页面，不在组件里写locale条件大对象。

公共安装接线复用i18n-scaffold；demo词典应按业务更新。安装必须先于useI18n与mount，语言状态只使用i18n的响应式locale；不复制一份locale状态。导航、校验、提示、空态、aria-label及图表界面文案都按适用场景覆盖。Element Plus内置文案通过ElConfigProvider跟随locale。中文回落不能当作英文已完成。

在模板t(key)或computed中计算翻译；避免const label=t(key)或初始化配置数组固化旧语言。切换可用性由源码自查并如实标明运行状态，不新增词典门禁。

### 规则 10.3：词典只收界面文案与枚举显示名，记录内容不进词典

判定法：对接真实后端后，这个词典条目还用得上吗？用得上才收。

```js
// ✅ 正确：枚举显示名——封闭集合 code→label，词典对接后保留（仅对齐后端 code 表）
t(`msg.event5.level.${event.level}`)      // level: 'critical' → '严重'
t(`msg.event5.status.${event.status}`)    // status: 'pending' → '待处理'

// ❌ 错误：记录内容——开放文本，存于 mock、对接后被真实数据取代
t(`msg.event5.mock.title.${event.title}`) // 真实后端标题进来 → 显示整条 key 路径
```

- 界面文案（标签/按钮/提示/空态）与枚举显示名（level/status/业务域等封闭集合）进词典；
- 记录内容（标题/描述/资源名称/人名/时长等）原样渲染，不进词典、不 `t()` 包装；
- 拿不准取值是否封闭集合时，按记录内容处理（保守口径）。

---

## 十一、其他规范

### 规则 11.1：按钮点击事件的消息提示应简洁明了

如"保存成功"、"提交成功"、"查询失败"等。

### 规则 11.2：图表组件使用 ECharts + GTS 图表配色

Element Plus 没有内置图表组件。使用 `vue-echarts` 组件 + 运行时读取 GTS 图表 Token
（不写hex；主题变化后重新读取并更新option，不能只在setup读一次）：

```js
import VChart from 'vue-echarts'

const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const readChartColors = () => ['--color-chart-1', '--color-chart-2', '--color-chart-3',
  '--color-chart-4', '--color-chart-5', '--color-chart-6'].map(readToken).filter(Boolean)
// 首次挂载且主题生效后option.color = readChartColors()；主题变化后重新读取
```

---

## 十二、响应式布局规范

> 页面按桌面区间弹性交付（约 1024–1920+），策略是布局折叠（内容重排），不是等比缩放。
> 断点两套数值的分工：EP 组件断点（xs<768 / sm≥768 / md≥992 / lg≥1200 / xl≥1920）
> 用于 `ElRow`/`ElCol` 响应式 props 与 `@media` 折叠；1024/1280/1680/1920 是设计验收的
> 人工检查值，页面代码只用 EP 断点。密度不随视口切换；禁止用视口单位缩放字体。

### 规则 12.1：页面容器流式，不写死总宽

`.page-root` 与布局容器宽度跟随可用空间；Portal 类内容用 `max-width` 上限 + 居中，
不得给整页或布局容器设固定宽度。

```less
// ✅ 正确：容器流式
.page-root {
  width: 100%;
  padding: var(--space-size-24);
}

// Portal 类：上限 + 居中
.portal-content {
  max-width: 1280px;
  margin: 0 auto;
}

// ❌ 错误：布局容器写死总宽
.page-root {
  width: 1440px;
}
```

### 规则 12.2：多卡片区域用响应式栅格，不用固定宽度行

卡片/统计块优先 `ElRow` + `ElCol` 响应式 props 折叠列数；等宽卡片流可用 CSS grid
`auto-fit` 流式排布。栅格间距用 `space-size-16`。

```vue
<!-- ✅ 正确：ElCol 响应式 props（宽屏 6 列，窄屏自动减列） -->
<ElRow :gutter="16">
  <ElCol :xs="24" :sm="12" :md="8" :lg="6" v-for="item in stats" :key="item.id">
    <StatCard :data="item" />
  </ElCol>
</ElRow>
```

```less
// ✅ 正确：等宽卡片流 auto-fit（每卡最小可读宽 320px，放不下自动换行）
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-size-16);
}

// ❌ 错误：固定列数，窄屏溢出
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
```

### 规则 12.3：内容宽度流式；写死 px 仅限控件固有尺寸并配兜底

内容区域用 `width: 100%` / `flex: 1` + `min-width: 0`；固定 px 只允许给控件固有尺寸
（输入框、下拉、日期选择器等），且必须配 `max-width: 100%` 防窄屏溢出。

```less
// ✅ 正确：控件定宽 + 兜底
.search-input {
  width: 240px;
  max-width: 100%;
}

// ✅ 正确：主内容流式并允许收缩
.page-main {
  flex: 1;
  min-width: 0;
}

// ❌ 错误：内容区写死宽且无兜底
.chart-panel {
  width: 960px;
}
```

### 规则 12.4：@media 只做页面局部折叠

`<style scoped>` 内使用；断点用 EP 口径（768/992/1200/1920）；只切换显示与布局，
不改字号、不改密度。

```less
// ✅ 正确：窄屏收起次要面板
.filter-panel {
  display: block;
}

@media (max-width: 1200px) {
  .filter-panel {
    display: none;
  }
}

// ❌ 错误：media 里缩字号（等于视口缩放字体）
@media (max-width: 1200px) {
  .page-title {
    font-size: 12px;
  }
}
```

### 规则 12.5：表格保关键列，横向滚动只用表格自带能力

关键列给 `min-width` 保证可读；次要列在窄屏可隐藏或收进详情。表格横向滚动由
ElTable 自身处理（内容超宽时表体出横向滚动条），页面外层不得再包横向滚动容器，
禁止整页横向滚动。

```vue
<!-- ✅ 正确：关键列 min-width，次要列收窄 -->
<ElTable :data="list">
  <ElTableColumn prop="name" label="名称" min-width="180" />
  <ElTableColumn prop="status" label="状态" width="120" />
  <ElTableColumn prop="updatedAt" label="更新时间" min-width="160" />
</ElTable>
```

### 规则 12.6：不用 JS 分支重建布局

响应式优先 CSS（栅格 / media）。确需 JS 的场景（如图表随容器 resize 重绘）用组件
自身能力或 `ResizeObserver`，不用 `window.innerWidth` 判断后重建布局。

```js
// ✅ 正确：图表跟随容器尺寸（原生 ResizeObserver）
const ro = new ResizeObserver(() => chart.resize())
ro.observe(chartEl)

// ❌ 错误：按视口宽度重建布局
if (window.innerWidth < 1200) {
  renderMobileLayout()
}
```


## 十三、服务、mock与交互

- 业务记录、统计值和图表数据只经src/api/{模块}.js的Promise接口获取，mock放src/api/mock/，由服务层消费；页面/子组件不直接import mock，也不内嵌整批模拟记录。替换真实后端时保持服务接口与返回结构。
- 菜单/栏目结构、按钮定义、枚举映射等静态UI配置可放组件或业务辅助模块，不为每个数组创建假接口。业务数据与配置混合时分离业务部分。
- 多语言仅翻译界面文案和封闭枚举，开放业务内容原样显示。若明确要求双语业务记录，由服务按locale返回或在服务层选择独立语言mock，不在页面写双语记录分支。
- 缺少真实数据时标明演示，不编造企业资历与业绩。按钮必须有实际动作/服务或明确说明未接入，不用成功toast冒充提交完成。
- 表单按rules校验，提交有pending防重复及失败反馈；请求按实际场景提供加载、空、错误和重试，不给简单页强加所有状态UI。
- 查询/重置必须同步UI与服务参数，重置/切页大小时回第一页；分页、筛选、详情使用真实关联数据。独立请求可并行，依赖请求按顺序；搜索竞态用请求序号/取消等避免旧结果覆盖。
- 模拟接口遵循同样分页/筛选/错误返回语义。界面状态在组件，后端可替换数据在服务/mock。

## 十四、交付前必须做一次代码自查

完成源码后、最终build前，按以下适用项检查并直接修正；build通过不替代本项。不增加命令、门禁、审批、自查报告或每页浏览器操作。

1. 职责是否合理拆分，800行以上是否已审视；文件/目录命名一致，无压缩行数规避。
2. 检查实际模板中连续的同类兄弟节点：只有文字、图标、链接或字段值不同时，合并为配置与循环；分组的内外层都检查，key稳定。不同职责或结构保留独立实现。
3. 业务数据是否经api/mock，组件是否只含必要UI配置；演示数据未冒充真实。
4. 交互、表单、筛选重置、分页与对应加载/空/错误/提交状态是否完整；无仅toast的假动作。
5. import/API是否真实，通信和实例状态边界正确；事件、定时器和外部资源是否清理。
6. scoped Less、token、响应式、滚动与图标尺寸是否遵循规则；图标按钮有可访问名称，Tooltip不能替代它。
7. 启用多语言时词典是否分离且键/语义对应，翻译是否响应locale变化，EP内置文案是否接线；单语言不造词典。
8. 交付源码无未替换的示例业务、调试输出、过程态注释和不必要文件；未运行不宣称交互/视觉验收通过。

需要错误对照时查error-checklist对应项。适用规则必须遵守；无对应场景不人为造功能，只有明确例外才保留偏离。

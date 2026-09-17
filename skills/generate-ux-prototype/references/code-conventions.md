# 页面代码规范（src/ 内交付件）

> SKILL.md 只保留硬规则索引；本文是细则唯一来源。所有约定服务于一个目标：交付与普通工程师手写无异的 Vue 3 + Element Plus 工程，二次开发者可直接接手。

## 1. 页面布局选型

- B 端控制台：`el-container`（aside 侧导航 + header 顶栏 + main 内容区）
- 列表页：标题行 → 筛选行 → `el-table` → `el-pagination`
- 看板页：顶部 KPI 卡片行 → 下方图表/数据区
- 内容页：单栏，根容器（如 `.page-root`）padding 24px
- 间距：4 的倍数 px；区块间 16-24px，组件内 8-12px
- NEVER sparse：用尽全部数据、mock 真实文本、CTA、搜索/筛选/分页、状态标签/进度等视觉语义；主列表 ≥ 10 条状态多样。

## 2. 组件写法与拆分

1. `<script setup>` Composition API；`defineProps` / `defineEmits` 声明组件契约；纯 JS 无 TS 标注。
2. **拆分触发式**：子组件仅在 **>150 行 / 被复用 / 独立状态复杂** 时拆出独立文件，常规页面约 4-8 个文件。页面私有放 `views/{slug}/components/`，跨页复用放 `src/components/`。
3. `index.vue` 做组合层：布局编排 + 子组件引用 + 事件协调；`<script setup>` 控制在 ~80 行内，业务逻辑、数据请求、复杂计算拆到子组件或 `views/{slug}/js/use-*.js`（composable）。
4. **imports 顺序**: vue → vue-router → element-plus → dayjs → 相对子组件/素材/api/constants（含 .svg 图标导入）。
5. 常量放 `views/{slug}/js/constants.js`，全大写+下划线命名（`ALARM_LEVEL`、`STATUS_MAP`）。
6. 图标一律 IconPlus/Lucide（生成时 `fetch_icons.mjs` 获取，存 `src/assets/icons/*.svg` 并自动生成 barrel `index.js`；内网走 IconPlus、外网自动降级 Lucide），**禁止 `@element-plus/icons-vue`**。**消费只走 barrel**：`import { ICONS } from '../../assets/icons/index.js'`，用法 `<img :src="ICONS.download" :width="20" :height="20" />`；不要在组件里手写逐个 .svg import。键名规则：kebab-case 文件名 → camelCase（`public-download.svg` → `ICONS.publicDownload`）；build 校验 `ICONS.key` 存在性，拼错直接 FAIL。
7. 反馈：轻提示 `ElMessage`；危险操作 `ElMessageBox.confirm(..., { type: 'warning' })`；表格 `v-loading`；空态 `el-empty`。
8. 表格：`el-table` + `el-table-column`；自定义列 `<template #default="{ row }">`；操作列 `fixed="right"` ≤3 个按钮（多了收进 `el-dropdown`）；≥8 条数据配 `el-pagination`。
9. 图片素材：`import logo from '../../assets/uploads/logo.png'` 或 `import icon from '../../assets/images/ran.svg'`（禁止裸路径 `src="/assets/..."`）。

## 3. 样式规范

- `<style lang="less" scoped>`；类名按组件功能命名（简短，如 `.header`、`.kpi-card`、`.filter-bar`），嵌套在根类下；嵌套 ≤ 3 层。
- 颜色一律资产 token 变量：`var(--color-*)`，尺寸/字体/投影 `var(--space-size-*)` / `var(--radius-size-*)` / `var(--font-size-*)` / `var(--shadow-*)`（全集见工作区 `src/assets/tokens/*.css`，build 实时校验兜底）；**禁 hex 硬编码**（build WARN）、禁内联 `style="..."`（`:style` 动态绑定仅限需变量计算的场景）。
- 单位一律 **px**（与资产 token 一致）。无 rem 换算。
- Less 变量/混入可用（`assets/style/base.less` 内置常用混入）；SFC 内不 `@import` 外部 .less（预览兼容性）。
- SFC 样式内禁止定义 `:root`、`[data-theme]`、资产 token（`--color-*`/`--space-size-*` 等）；页面局部自定义属性用 `--page-*` 前缀。
- 换肤协议为资产库的 `data-theme="light|dark"`（详见 SKILL.md「换肤系统」）；自定义皮肤只属于 `src/assets/themes/theme-{name}.css`，不写进 SFC。

## 4. 自适应规范（实现纪律，默认必做）

> 设计真值（画布、栅格、断点、密度）在 `assets/design-language/设计规范/响应式与无障碍.md` 与 `页面布局.md`（设计师维护）；本节只是该真值在 EP 工作区的实现纪律。冲突时以设计真值为准。

页面流式自适应：宽度 1280-1920 均正常呈现，窗口拖窄时成排卡片自动降列换行；移动端 H5 布局明确不承诺。**px 单位不变**，自适应靠容器纪律 + 栅格断点 + `min()` 表达式，禁止 rem/viewport 换算、禁止整页 zoom/scale、禁止页面级 `min-width`+横滚兜底。

1. **容器**：`.page-root` 只用 padding，不设 width/min-width；B 端壳 `el-aside` 固定 208-220px（可折叠），`el-main` 流式。`el-container` 一律显式 `direction="vertical"`（探测机制对自定义组件包裹的 `el-header` 失效，见 §9.5）。
2. **成排卡片**（KPI 行、统计卡）：`el-row :gutter="16"` + `el-col` 断点降列——

   ```html
   <el-row :gutter="16">
     <el-col v-for="kpi in kpis" :key="kpi.label" :xs="24" :sm="12" :md="8" :lg="6">
       <div class="kpi-card">…</div>
     </el-col>
   </el-row>
   ```
3. **表格**：`el-table` 默认流式，禁止给表格或列写死 width；列用 `min-width`，空间不足时表格**内部**出滚动条（EP 内建，零成本）。
4. **grid/flex 包宽内容**：grid/flex 容器包表格等宽内容时，子项默认 `min-width: auto` 会被内容的 min-content 宽度撑破容器（el-table 内建滚动随之失效）。grid 轨道一律写 `minmax(0, 1fr)` 禁止裸 `auto` 轨道；flex 子项加 `min-width: 0`。
5. **筛选行**：inline form + `flex-wrap: wrap`，控件定宽不写死（如 `width: 200px` 可以，`width: 100%` 撑爆一行不行）。
6. **对话框**：`width="min(720px, 92%)"` 模式，按内容选 480/720/960 基准，禁止超过视口的固定宽度。
7. **媒体查询**仅窄屏布局（用户明确要求时）使用；断点对齐 EP 五档 `<768 / ≥768 / ≥992 / ≥1200 / ≥1920`，禁止自造断点数值。
8. **截图转码例外**：布局按截图保真还原，但仍按本节纪律做流式，不照抄截图里的固定像素宽度。

## 5. API 适配层约定（页面取数唯一通道）

`init.mjs` 已生成 `src/api/{slug}.js`。**页面与组件只准从这个适配层取数，禁止直接 import `mock/modules`**（build 强制 FAIL）。二次开发时只改 api 文件内容，页面零改动。

```js
// ✅ 正确 — 页面从适配层取数
import { fetchList, createRecord } from '../../api/{slug}.js'

// ❌ 违规 — 页面直连 mock（build 拦截）
import { fetchList } from '../../../mock/modules/{slug}.js'
```

**Mock 函数按 REST 语义设计签名**（如 `fetchList({ keyword, page, pageSize })` 返回 `{ list, total, page, pageSize }`，`delay` 模拟网络；参数与返回都是页面消费的形状）——init 生成的 mock 文件头部注释自带完整示例。

**二开写法**（替换 api 文件原型态的 re-export；用 `import ... from` + `export { }` 两段式，勿用 `export {...} from` re-export 简写——sfc-loader 0.9.5 对 re-export 编译产物有缺陷，两段式在「真实工程外直接开 HTML」的场景也安全）：

```js
// src/api/{slug}.js 二开态示例（request 为自建 axios 实例）
import request from './request'

async function fetchList(params) { return request.get('/api/{slug}', { params }) }
async function fetchDetail(id) { return request.get(`/api/${slug}/${id}`) }

export { fetchList, fetchDetail }
```

导出名、参数、返回形状保持与 mock 一致。

## 6. Mock 数据模式

- 位置 `mock/modules/{slug}.js`（与 src 同级，init 已建）。函数签名按 REST 语义（见上节）；`Promise + setTimeout` 模拟异步。
- 数据 key 语义化（`deviceName` 禁止 `val1`）；主列表 ≥ 10 条状态多样。
- **混合策略**：手写前 8-10 条保状态多样性，其余用 spread / 生成器扩展数量：
  ```js
  const more = Array.from({ length: 40 }, (_, i) => ({
    id: String(i + 11), name: `设备-${String(i + 11).padStart(3, '0')}`,
    status: statuses[i % statuses.length],
  }))
  export const mockData = [...handwritten, ...more]
  ```
- **截图输入例外**：数据保真转录，行数列数与图完全一致，逐格独立读取，严禁行间复制——不用生成器扩展。

## 7. i18n 模式（单文件双语言）

- **页面级**：每页一个 `src/locales/pages/{slug}.js`（init 已建骨架，与全局词条同在 `src/locales/` 下）。zh + en 一次写完（en 机械翻译顺带产出）。**`messages` 存双语言源，`t` 是按 LANG 展平的字符串**——模板直接 `{{ t.title }}`，**禁止手动 `.zh`**（漏写展平会在界面渲染成 JSON 串）：
  ```js
  export const messages = {
    title: { zh: '设备管理', en: 'Device Management' },
  }
  const LANG = 'zh' // 'zh' | 'en'，页面显示语言（原型期常量；运行时切换随 vue-i18n 引入）
  export const t = Object.fromEntries(
    Object.entries(messages).map(([key, val]) => [key, typeof val === 'string' ? val : val[LANG] || val.zh]),
  )
  ```
  ```html
  <span class="title">{{ t.title }}</span>
  ```
  > 单语言页面可直接在 messages 里存字符串 `title: '设备管理'`，展平逻辑已兼容（typeof val === 'string' 直通）。
- 将来接 vue-i18n：把 messages 的 zh/en 拆进 JSON，页面模板零改动。

## 8. 相对路径计算（最易错项）

按 init 后实际目录结构计算（完整树见 SKILL.md「Output Contract」；与本节相关：`src/api/{slug}.js`、`src/locales/pages/{slug}.js`、`src/assets/{uploads,images,icons}/`、`src/components/`、`src/views/{slug}/{components/,js/}`）：

```
从 views/{slug}/index.vue 引用:
  页面子组件:   import StatusTag from './components/StatusTag.vue'
  常量:        import { STATUS_MAP } from './js/constants.js'
  页面词条:    import { t } from '../../locales/pages/{slug}.js'
  API 适配层:  import { fetchList } from '../../api/{slug}.js'
  图标 barrel: import { ICONS } from '../../assets/icons/index.js'
  素材:        import logo from '../../assets/uploads/logo.png'
  手写跨页组件: import SharedCard from '../../components/SharedCard.vue'

从 views/{slug}/components/StatusTag.vue 引用:
  API 适配层:  import { fetchList } from '../../../api/{slug}.js'
  图标 barrel: import { ICONS } from '../../../assets/icons/index.js'
  素材:        import logo from '../../../assets/uploads/logo.png'

从 src/components/SharedCard.vue 引用:
  API 适配层:  import { fetchList } from '../api/{slug}.js'
  图标 barrel: import { ICONS } from '../assets/icons/index.js'
  素材:        import logo from '../assets/uploads/logo.png'
```

（starter `index.vue` 引用 api 层是 `../../api/{slug}.js`——从 `views/{slug}/` 出发上两级到 `src/`，再进 `api/`。init.mjs 成功输出的 `PATH_PREFIX` 块即本表按实际 slug 实例化后的可照抄版本，规划清单直接复制，不再自行推算。）

## 9. 运行时错误预防（build 不覆盖）

1. `el-select` v-model 值必须在 options 中：初始值必须是某个 `el-option` 的 `value`，否则显示裸值。建议初始值 `''`（配合 `clearable`）。
2. `el-table` column `prop` 与 data key 匹配：`prop="xxx"` 必须对应数据对象的实际 key，否则列空白。
3. template 不引用未声明的变量：`<script setup>` 中未定义的变量在模板中不渲染但不报错。
4. token 使用前提交 preflight.mjs 校验（与 build 同源，禁止 grep tokens 目录现场查）。
5. `el-container` 显式 `direction="vertical"`：EP 靠**直接子节点**出现 `el-header`/`el-footer` 探测纵向布局，`el-header` 被包进自定义组件（如 `<TopNav>`）后探测失效，容器退化为横向 flex，顶栏被挤成一列。B 端壳（顶栏 + 侧栏）一律显式写 `direction="vertical"`，不依赖探测。

## 10. 高频错误预防（build 拦截项）

拼写类（图标/组件/导出名错、标签未 import）不用背表——preflight 会给相近项提示，按提示修正重跑即可。下表只列 preflight 提示不覆盖、或极易犯的项：

| # | 错误写法 | 正确写法 | 原因 |
|---|---------|---------|------|
| 1 | `import logo from '../assets/uploads/logo.png'`（从 views/{slug}/ 出发） | `'../../assets/uploads/logo.png'` | 路径少一级 |
| 1b | ~~图标 import 路径少一级~~（barrel 用法下此错误类已消失——组件只 import `assets/icons/index.js` 一个固定路径） | `import { ICONS } from '../../assets/icons/index.js'`（从 `views/{slug}/` 出发上两级） | fetch_icons 自动生成 barrel；build 校验 ICONS.key 存在性 |
| 1c | `import { Search } from '@element-plus/icons-vue'` | `fetch_icons.mjs` 拉图标 + `import icon from '../../assets/icons/xxx.svg'` | 图标来源钉死 IconPlus/Lucide，icons-vue 不在白名单（build FAIL） |
| 2 | `import { fetchList } from '../../../mock/modules/{slug}.js'` | `from '../../api/{slug}.js'` | 页面禁 import mock（build FAIL） |
| 3 | `<style lang="scss">` 或新增 .scss 文件 | `<style lang="less" scoped>` | 样式语言全链路钉死 less |
| 4 | `<style>` 内 `:root { --color-x: … }` | 皮肤只放 `src/assets/themes/`；页面局部变量 `--page-*` | token 层与皮肤文件专属 |
| 5 | `slot-scope="scope"` | `<template #default="{ row }">` | 旧语法编译失败 |
| 6 | `v-if` 和 `v-for` 同标签 | 分开到不同标签 | 编译错误 |
| 7 | `src="/assets/uploads/x.png"` | `import img from '../../assets/uploads/x.png'` | 预览无法解析裸路径 |

## 11. 二开依赖差异

工作区是标准 Vue 工程，但预览运行时与真实 Vite 工程有三处已知差异，二次开发者需知：

1. **devDependency 固定 `npm i -D less`**：真实工程 Vite 零配置编译 Less（`main.js` 已 `import './assets/style/base.less'`）；无需 sass/其他预处理器。
2. **api 适配层两段式 + el-pagination 用 v-model**：二开 `src/api/{slug}.js` 用 §5 的两段式写法（sfc-loader 0.9.5 re-export 缺陷经验，真实 Vite 工程无此限制）；el-pagination 传单向 `:current-page`/`:page-size` prop 会静默不渲染，必须写 `v-model:current-page` / `v-model:page-size`（真实 Vite 工程无此限制）。

真实工程 npm 依赖（`preview/src/main.js` 头部已注释声明）：`vue@^3.4`、`vue-router@^4.4`、`element-plus@2.13.5`、`dayjs@^1.11`、`less@^4.2`（图标不装 npm 包——走 IconPlus/Lucide 的 .svg 文件）。

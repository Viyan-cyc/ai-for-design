# 代码规范 — generate-ux-prototype

> SKILL.md 的细则文档。页面 .vue / .js 代码必须遵守本规范；build.mjs 实时校验兜底。
> 决策依据：SKILL-REPLACE-PLAN.md §5（组件复用方案）、§9 D13/D14/D15/D16/D17/D20/D22。

## 1. 页面代码规范（src/ 内 .vue 文件）

### 1.0 页面布局选型
- B 端控制台：`el-container`（aside 侧导航 + header 顶栏 + main 内容区）
- 列表页：标题行 → 筛选行 → `el-table` → `el-pagination`
- 看板页：顶部 KPI 卡片行 → 下方图表/数据区
- 内容页：单栏，根容器（如 `.page-root`）padding 24px
- 间距：4 的倍数 px；区块间 16-24px，组件内 8-12px（**单位 px，D14，无 rem**）

### 1.1 组件写法
`<script setup>` 优先；`defineProps`/`defineEmits` 声明组件契约。**文件颗粒度触发式拆分**（D13①）：
- >150 行 / 被复用 / 独立状态复杂 → 必拆
- 否则可内联在 index.vue
- index.vue 只做组合层（布局编排 + 子组件引用 + 事件协调），`<script setup>` 控制在 ~80 行以内

### 1.2 imports 顺序
vue → vue-router → element-plus → @element-plus/icons-vue → dayjs → 相对子组件/素材/api/constants。
**裸 import 仅限白名单五项**（+ element-plus 子路径）。

### 1.3 常量
放 `views/{slug}/js/constants.js`，全大写+下划线命名（`ALARM_LEVEL`、`STATUS_MAP`）。`COMPONENT_MODE` / `UI_RUNTIME` 两个生成开关也在此文件。

### 1.4 图标
`import { Search, Plus } from '@element-plus/icons-vue'`；用法 `<el-icon :size="20"><Search /></el-icon>` 或 `:icon="Search"`。
图标名大小写敏感，build 校验 293 白名单。

### 1.5 反馈
- 轻提示 `ElMessage`
- 危险操作 `ElMessageBox.confirm(..., { type: 'warning' })`
- 表格 `v-loading`
- 空态 `el-empty`

### 1.6 样式
`<style lang="less" scoped>`（D22 钉死 less）：
- 类名按组件功能命名（简短，如 `.header`、`.kpi-card`、`.filter-bar`）
- 间距/圆角/颜色用 G Design token（`--g-*` / `--color-*` / `--space-*`）；**从 `src/assets/tokens/*.css` 现查**，不内嵌速查表
- **禁止内联 `style="..."`**；`:style` 动态绑定仅限需变量计算的场景
- Less 嵌套、变量、混入可用；SFC 内不 `@import` 外部 .less（预览兼容性）
- **CSS 单位用 px**（D14）；**禁止 `.scss` 文件与 `lang="scss"`**（D22）
- 禁止在 SFC 样式里定义 `:root` / `[data-theme]` / `--g-*:` / `--color-*:`（页面局部变量用 `--page-*` 前缀）

### 1.7 表格
`el-table` + `el-table-column`；自定义列 `<template #default="{ row }">`；操作列 `fixed="right"` ≤3 个按钮（多了收进 `el-dropdown`）；≥8 条数据配 `el-pagination`。

### 1.8 相对路径计算（最易错项）

```
{slug}/
├── mock/
│   └── modules/{slug}.js                  ← Mock 数据 + API 模拟
├── src/
│   ├── api/{slug}.js                      ← ★ 接口适配层（页面唯一 import 入口）
│   ├── components/
│   │   └── {basic|business|complex}/GButton/GButton.vue  ← 复用 G 组件（D17 落位）
│   ├── assets/uploads/logo.png            ← 素材
│   ├── assets/images/ran.svg              ← SVG 图标
│   ├── assets/tokens/*.css                ← G Design token（FIXED，勿手改）
│   └── views/{slug}/
│       ├── index.vue                      ← 页面主组件
│       ├── components/StatusTag.vue       ← 页面私有子组件（按需创建）
│       └── js/
│           ├── constants.js               ← 常量 + COMPONENT_MODE/UI_RUNTIME
│           └── locales.js                 ← 页面级 i18n（D15 单文件双语言）

从 index.vue 引用:
  子组件:    import StatusTag from './components/StatusTag.vue'
  常量:      import { STATUS_MAP, COMPONENT_MODE } from './js/constants.js'
  i18n:      import t from './js/locales.js'
  API 层:    import { fetchList } from '../../api/{slug}.js'
  素材:      import logo from '../../assets/uploads/logo.png'
  SVG 图标:  import ranIcon from '../../assets/images/ran.svg'
  跨页组件:  import SharedCard from '../../components/layout/SharedCard.vue'
  复用 G 组件: import GButton from '../../components/basic/GButton/GButton.vue'

从 components/StatusTag.vue 引用:
  素材:      import logo from '../../../assets/uploads/logo.png'
```

> **注意**：页面**不准**直接 import `mock/modules` —— 走 `src/api/{slug}.js` 适配层（见 §3）。

---

## 2. Mock API 模式

init.mjs 已生成 `mock/modules/{slug}.js`（与 src 同级，Promise + setTimeout 模拟网络延迟）。**页面不直接引用 mock**，经 `src/api/{slug}.js` 适配层消费（见 §3）。

mock 函数按 REST 语义设计签名（D16）：

```js
// mock/modules/{slug}.js
export function fetchList({ keyword, page, pageSize }) {
  return new Promise(resolve => {
    setTimeout(() => {
      const all = keyword ? DATA.filter(d => d.name.includes(keyword)) : DATA
      const start = (page - 1) * pageSize
      resolve({ list: all.slice(start, start + pageSize), total: all.length })
    }, 300)
  })
}

export function fetchDetail(id) {
  return new Promise(resolve => setTimeout(() => resolve(DATA.find(d => d.id === id)), 200))
}
```

**数据多样性策略**（D13④）：手写前 8-10 条保状态多样（正常/告警/严重/离线/空数据等），程序化扩展可补数量；截图输入保真转录规则不变。

语义化 key（`deviceName` 禁止 `val1`）；主列表 ≥ 10 条状态多样。

---

## 3. API 适配层（D16）

### 3.1 正确/错误 import 对照

```js
// ✅ 正确：页面经 api 层消费
import { fetchList, fetchDetail } from '../../api/device-management.js'

// ❌ 错误：页面直接 import mock（build 拦截：mock 隔离）
import { fetchList } from '../../../mock/modules/device-management.js'
```

### 3.2 api 文件两态

**原型态**（init 生成）——仅 re-export mock：
```js
// src/api/{slug}.js
export { fetchList, fetchDetail, createItem, updateItem, deleteItem } from '../../mock/modules/{slug}.js'
```

**二次开发态**——替换为真实请求，**导出名/参数/返回形状不变**，页面零改动：
```js
// src/api/{slug}.js（二开改写后）
import request from '@/utils/request'  // 真实工程的 axios 封装

export function fetchList({ keyword, page, pageSize }) {
  return request.get('/api/devices', { params: { keyword, page, pageSize } })
    .then(res => ({ list: res.data.list, total: res.data.total }))
}

export function fetchDetail(id) {
  return request.get(`/api/devices/${id}`).then(res => res.data)
}
```

> **sfc-loader 0.9.5 re-export 缺陷经验**（W1-T3 回写）：原型态 re-export 简写 `export { ... } from '...'` 在 vue3-sfc-loader 0.9.5 预览下可能不解析。若预览报错，改两段式：`import { fetchList } from '...'; export { fetchList }`。真实工程（Vite/vue-cli）不受此限。

---

## 4. i18n 模式（D15 单文件双语言）

init.mjs 生成全局 `src/locales/lang/{zh-CN,en-US}/common.json`（跨页共享词条，按需追加）。**页面级文案收敛为每页一个 `views/{slug}/js/locales.js` 单文件**，双语言对象一次写完：

```js
// views/{slug}/js/locales.js
export default {
  'zh-CN': { title: '设备管理', refresh: '刷新', search: '查询', reset: '重置' },
  'en-US': { title: 'Device Management', refresh: 'Refresh', search: 'Search', reset: 'Reset' }
}
```

```vue
<!-- views/{slug}/index.vue -->
<script setup>
import t from './js/locales.js'
const locale = 'zh-CN'  // 简单引用方式；将来接 vue-i18n 时把对象拆进 JSON 即可
</script>
<template>
  <h1>{{ t[locale].title }}</h1>
</template>
```

- en 由 AI 机械翻译顺带产出（不单独走工具）
- 将来需要 vue-i18n 时，把两个对象拆进 `src/locales/lang/*/pages/{slug}.json`，页面模板 `t.xxx` 引用方式不变

---

## 5. 复用 G 组件约定（D7/D12/D17/D20）

### 5.1 落位
复用的 G 组件落位 `src/components/{basic|business|complex}/G<Name>/G<Name>.vue`（与资产库分类名一致，D17），溯源与升级 diff 友好。

### 5.2 collect_component.mjs 用法
```
node scripts/collect_component.mjs <ASSETS_ROOT> <G组件ID> <工作区src目录> <目标子目录>
```
- 读 G 组件的相对 import → 递归闭包 → 按库内相对路径镜像复制到 AI 指定目标根
- 文件头自动加来源注释：`<!-- 源: g-design v1.5.0 g-button -->`
- **零改写**：拷入的 .vue 文件内容与库源逐字一致（库已改造为单文件自包含格式，见 references/component-format.md）
- 闭包含非 .vue 相对 import（如 GIcon 的 `../../../icons/icon-nodes.json` + `icon-aliases.json`，约 420KB，不内联）

### 5.3 硬规则
- **禁止改写拷入的 G 组件文件**（复用 = 纯拷贝 + 来源注释，D7）——要改写请手写新组件，不要伪装成复用
- `examples.vue` 与 `index.ts` 不随拷贝（只拷 `G<Name>.vue` + 闭包依赖）
- 复用组件与 AI 手写组件风格完全同构（纯 JS、内联 less scoped、相对路径 import）

### 5.4 组件库格式
资产库已由 W2 改造为单文件自包含格式（component-format.md v1）：每组件目录下仅 `G<Name>.vue`（必须）+ `index.ts`（库构建用，不随拷贝）+ 可选 `examples.vue`（AI 学习匹配用，不随拷贝）。AI 复用时无需关心库内部格式，collect_component.mjs 处理闭包。

---

## 6. 二开依赖差异（D22）

真实工程（脱离预览，用 Vite/vue-cli 构建）的 devDependency 与预览态不同：

| 依赖 | 预览态（index.html） | 真实工程（Vite） |
|---|---|---|
| `vue` / `element-plus` / `@element-plus/icons-vue` / `vue-router` / `dayjs` | UMD（`public/library/`） | npm 安装 |
| `less` | `public/library/element-plus/less.min.js` 浏览器编译 | `npm i -D less`（Vite 零配置，`main.js` import `base.less` 即可） |

**二开者接入步骤**：
1. `npm create vue@latest`（或现有工程）+ `npm i element-plus@2.13.5 @element-plus/icons-vue dayjs vue-router`
2. `npm i -D less`
3. 把 `{slug}/src/` 整个拷入工程（`index.html` / `public/library/` / `preview-data.js` 丢弃，那是预览专用）
4. `main.js` 的 `import './assets/style/base.less'` 保留（Vite 零配置编译 less）
5. 二开改 `src/api/{slug}.js` 为真实请求（§3.2），页面零改动

---

## 7. 运行时错误预防（build 不覆盖）

1. **el-select v-model 值必须在 options 中:** 初始值必须是某个 `el-option` 的 `value`，否则显示裸值。建议初始值 `''`（配合 `clearable`）。
2. **el-table column prop 与 data key 匹配:** `prop="xxx"` 必须对应数据对象的实际 key，否则列空白。
3. **template 不引用未声明的变量:** `<script setup>` 中未定义的变量在模板中不渲染但不报错。
4. **Less 嵌套不要过深:** ≤ 3 层嵌套，避免选择器特异性问题。

---

## 8. 高频错误预防表（build 拦截项）

| # | 错误写法 | 正确写法 | 原因 |
|---|---------|---------|------|
| 1 | `import { Searchh } from '@element-plus/icons-vue'` | `import { Search }` | 图标名不在白名单 |
| 2 | `<el-table-cloumn>` | `<el-table-column>` | 组件名不在白名单 |
| 3 | `<StatusTag />` 但没 import | `import StatusTag from './components/StatusTag.vue'` | 标签无对应 import |
| 4 | `import logo from '../assets/uploads/logo.png'` | `import logo from '../../assets/uploads/logo.png'` | 路径少一级 |
| 5 | `import { ElToast } from 'element-plus'` | `import { ElMessage } from 'element-plus'` | 导出名不在白名单 |
| 6 | `var(--g-color-blue)` | 从 `src/assets/tokens/*.css` 查实际 token 名 | token 未定义 |
| 7 | `<style>` 内 `:root { --g-x: #fff }` | token 在 `src/assets/tokens/` | style 禁止 :root |
| 8 | `style="color: red"` | class + `<style lang="less">` 定义 | 禁止内联样式 |
| 9 | `padding: 1.6rem` | `padding: 16px` | D14 单位 px，无 rem |
| 10 | `slot-scope="scope"` | `<template #default="{ row }">` | 旧语法编译失败 |
| 11 | `v-if` 和 `v-for` 同标签 | 分开到不同标签 | 编译错误 |
| 12 | `src="/assets/uploads/x.png"` | `import img from '../../assets/uploads/x.png'` | 预览无法解析裸路径 |
| 13 | `import { fetchList } from '../../../mock/modules/x.js'` | `import { fetchList } from '../../api/x.js'` | D16 mock 隔离 |
| 14 | 直接改拷入的 `src/components/basic/GButton/GButton.vue` | 手写新组件，不改复用件 | D7 复用零改写 |
| 15 | `<style lang="scss">` 或 src 内出现 `.scss` 文件 | `<style lang="less">` | D22 全 less |

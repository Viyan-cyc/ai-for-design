# 页面代码规范（src/ 内交付件）

> 细则唯一来源。所有约定服务于：交付与普通工程师手写无异的 Vue 3 + Element Plus 工程。

## 1. 页面布局

- B 端控制台:`el-container`(aside+header+main);列表页:标题→筛选→`el-table`→`el-pagination`;看板:KPI 卡片行→图表区;内容页:单栏根容器 padding 24px。
- 间距 4 倍数 px;区块间 16-24px,组件内 8-12px。
- NEVER sparse:用尽数据、mock 真实文本、CTA、搜索/筛选/分页、状态标签;主列表 ≥ 10 条状态多样。

## 2. 组件写法

1. `<script setup>` Composition API;`defineProps`/`defineEmits` 声明契约;纯 JS。
2. 子组件仅在 >150 行/被复用/状态复杂时拆出(常规 4-8 文件)。私有放 `views/{slug}/components/`,跨页复用放 `src/components/`。
3. `index.vue` 做组合层:布局编排+子组件引用+事件协调;`<script setup>` ≤ ~80 行,复杂逻辑拆到 `views/{slug}/js/use-*.js`。
4. imports 顺序:vue→vue-router→element-plus→@element-plus/icons-vue→dayjs→相对路径。
5. 常量放 `views/{slug}/js/constants.js`,全大写+下划线。
6. 图标:`import { Search } from '@element-plus/icons-vue'`;用法 `<el-icon :size="20"><Search /></el-icon>` 或 `:icon="Search"`。
7. 反馈:`ElMessage` 轻提示;`ElMessageBox.confirm(...,{type:'warning'})` 危险操作;`v-loading` 表格;`el-empty` 空态。
8. 表格:`el-table`+`el-table-column`;自定义列 `<template #default="{ row }">`;操作列 `fixed="right"` ≤3 按钮(多收 `el-dropdown`);≥8 条配 `el-pagination`(**预览用 `v-model:current-page`/`v-model:page-size`**,单向 prop 会静默不渲染)。
9. 图片:`import logo from '../../assets/uploads/logo.png'`(禁止裸路径 `src="/assets/..."`)。

## 3. 样式

- `<style lang="less" scoped>`;类名按功能命名,嵌套 ≤ 3 层。
- 颜色一律 token:`var(--g-*)`/`var(--color-*)`(全集见 `src/assets/tokens/*.css`);**禁 hex**(build WARN)、禁内联 `style="..."`(`:style` 仅限动态计算)。
- 单位 px,无 rem。SFC 内不 `@import` 外部 .less。SFC 内禁定义 `:root`/`[data-theme]`/资产 token;局部变量用 `--page-*` 前缀。
- 换肤:`data-theme="light|dark"` 协议;自定义皮肤只放 `src/assets/themes/theme-{name}.css`。

## 4. API 适配层

`init.mjs` 已生成 `src/api/{slug}.js`。页面**只准从此适配层取数**,禁止直接 import `mock/modules`(build FAIL)。

**正确:** `import { fetchList } from '../../api/{slug}.js'`
**违规:** `import { fetchList } from '../../../mock/modules/{slug}.js'`

Mock 函数按 REST 语义设计签名(参数+返回形状=页面消费形状,`Promise+setTimeout` 模拟异步)。二开时改 api 文件内容,页面零改动。二开 api 用 `import...from`+`export {}` 两段式(勿用 re-export 简写——sfc-loader 缺陷)。导出名/参数/返回形状与 mock 一致。

## 5. Mock 数据

位置 `mock/modules/{slug}.js`(与 src 同级)。签名按 REST 语义。数据 key 语义化(`deviceName` 禁止 `val1`);主列表 ≥ 10 条。混合策略:手写前 8-10 条保多样性,其余用 spread/生成器扩展。**截图输入例外**:数据保真转录,不用生成器。

## 6. i18n

每页一个 `src/locales/pages/{slug}.js`。`messages` 存双语言源 `{ zh, en }`,`t` 是按 LANG 展平的字符串——模板直接 `{{ t.title }}`,**禁止手动 `.zh`**。单语言页面 messages 里直接存字符串(展平逻辑兼容)。将来接 vue-i18n 时拆 JSON,模板零改动。

## 7. 复用 G 组件

资产库组件以**纯拷贝+来源注释**方式复用,零改写。匹配→`collect_component.mjs` 一次性拷贝依赖闭包→落位 `src/components/GName/GName.vue`(平铺)→页面 `import GName from '../../components/GName/GName.vue'`。拷入文件禁止改写(含来源注释);不合用走 wrapper 或资产库升级。依赖闭包不完整时 collect FAIL 列缺失清单,如实上报不手工修复。

## 8. 相对路径（最易错项）

| 起点 | 目标 | 路径 |
|---|---|---|
| `views/{slug}/index.vue` | 子组件 | `./components/X.vue` |
| `views/{slug}/index.vue` | 常量 | `./js/constants.js` |
| `views/{slug}/index.vue` | 词条 | `../../locales/pages/{slug}.js` |
| `views/{slug}/index.vue` | API | `../../api/{slug}.js` |
| `views/{slug}/index.vue` | 素材 | `../../assets/uploads/x.png` |
| `views/{slug}/index.vue` | G 组件 | `../../components/GName/GName.vue` |
| `views/{slug}/components/X.vue` | API | `../../../api/{slug}.js` |
| `src/components/X.vue` | API | `../api/{slug}.js` |

关键:**从 `views/{slug}/` 出发上两级 `../../`;从 `components/` 出发上三级 `../../../`**——少写一级是最高频 build FAIL。

## 9. 运行时错误预防（build 不覆盖）

| # | 错误 | 正确 | 原因 |
|---|---|---|---|
| 1 | 模板用组件但没 import | 补 `import X from './components/X.vue'` | 不报错但不渲染 |
| 2 | `style="color:red"` | class+`<style lang="less">` | 禁内联静态样式 |
| 3 | 编辑拷入的 G 组件 | 保持原样;走 wrapper 或资产库升级 | 禁止改写拷贝件 |
| 4 | `<style>` 内 `:root{--g-x:…}` | 皮肤放 themes/;局部用 `--page-*` | token 层专属 |
| 5 | `src="/assets/x.png"` | `import img from '../../assets/...'` | 预览无法解析裸路径 |
| 6 | `el-select` v-model 初始值不在 options | 初始值 `''`(配合 `clearable`) | 否则显示裸值 |
| 7 | `el-table` prop 与 data key 不匹配 | prop 对应实际 key | 否则列空白 |

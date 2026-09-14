# 设计师新组件指南

> **读者**：向 g-design 资产库提交新组件的设计师。
> **配套文档**：[component-format.md](component-format.md) 是格式契约（权威）；本文是操作向导——从零写一个能一次过检的组件，照做即可。
> **依据**：SKILL-REPLACE-PLAN.md §5.3、D22（样式钉死 less）、D23（scss 全仓库清零）；任务卡 tasks/W2-components.md M0/M3。
> **最后更新**：2026-09-12（61 组件迁移完成后）

## 0. 一分钟版本

一个合规组件 = **一个目录、三个文件**：

```
components/{basic|business|complex}/GYourName/
├── GYourName.vue    ← 全部内容内联在这一个文件里
├── index.ts         ← 固定三行，照抄改名字
└── examples.vue     ← （可选但推荐）1-2 个典型用法
```

写完跑两条命令：

```bash
node scripts/migrate_components.mjs --check components/<分类>/GYourName   # 零输出 = 合规
npm run build:library                                                      # 在 frontend/element-plus 下，通过即可
```

---

## 1. 目录与文件

| 规则 | 说明 |
|---|---|
| 目录名 | `G` 前缀 PascalCase，与主文件同名：`GYourName/GYourName.vue` |
| 分类落位 | 基础控件 → `basic/`；业务组合 → `business/`；重型的 → `complex/` |
| `index.ts` | 必须有，固定写法见下；供库构建与分类 barrel 使用 |
| 禁止新增文件 | `types.ts`、`style.scss`、`README.md`、数据文件等一律不要——**所有内容进 .vue 单文件** |

`index.ts` 固定写法（三行，只换名字）：

```ts
import GYourName from './GYourName.vue'
export { GYourName }
export default GYourName
```

---

## 2. GYourName.vue 三段式

```vue
<template>  …纯 HTML + EP 组件 + slot… </template>

<script setup>
// 纯 JavaScript —— 不写 lang="ts"，不写任何 TS 语法
</script>

<style lang="less" scoped>
// 只用 less；token 变量取色，禁 hex
</style>
```

### 2.1 script：纯 JS 的 props / emits 写法

组件对外的"类型说明"全部用 **JSDoc 注释**承载（工具与 AI 都读它）：

```vue
<script setup>
/**
 * 类型 可选值：'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
 */
defineProps({
  type:    { type: String, default: 'default' },
  title:   { type: String },                    // 无 default = 可选
  nodes:   { type: Array, required: true },     // 必填
  value:   { type: [String, Number] },          // 联合类型用数组
})

defineEmits(['search', 'reset'])                // 数组语法，只列事件名
</script>
```

类型映射速查：

| 你想表达 | 运行时写法 |
|---|---|
| `string` / `number` / `boolean` | `String` / `Number` / `Boolean` |
| 数组 / 对象 / 函数 | `Array` / `Object` / `Function` |
| `string \| number` | `[String, Number]` |
| `'a' \| 'b' \| 'c'` 字面量联合 | `String` + JSDoc 写明可选值 |
| 默认值 | `default:` 字段；必填用 `required: true` |

其他 script 约定：

- **不要** `import type`、`as` 断言、`interface`、泛型 `ref<T>()`（写 `ref()`）、`withDefaults`、`defineModel`。
- v-model 按传统模式：prop 名 `modelValue` + emit `'update:modelValue'`。
- **API 命名前先查同类组件**（如各 `*Pro` 组件、GFilterBar）——新组件尽量沿用既有命名习惯（`type`、`size`、`disabled`…），AI 匹配复用全靠 props 语义。

### 2.2 style：less + token

```vue
<style lang="less" scoped>
.card {
  padding: var(--space-4);
  border-radius: var(--g-control-radius);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);

  :deep(.el-tag) {          /* 穿透 EP 内部样式，scoped 下合法 */
    border-radius: var(--g-control-radius-sm);
  }
}
</style>
```

规则：

| 必须 | 禁止 |
|---|---|
| 颜色/间距/圆角/字号/阴影一律 token 变量（`--g-*`、`--color-*`、`--space-*`、`--font-size-*`，查 `tokens/*.css`） | hex 字面量（`#fff`、`#0067D1`） |
| px 单位 | rem / em |
| `:deep()` 穿透 EP 内部 | 外链样式（`src="./x.scss"`）、`@import` |
| less 嵌套语法可用 | 静态内联 `style="…"`（动态 `:style` 计算值允许，如栅格列宽） |
| | 在组件样式里定义 `:root` / `[data-theme]` / `--g-*` 等全局变量 |

token 现查入口：`frontend/element-plus/tokens/*.css`（按 primitive → semantic → component 分层），毛玻璃相关在 `frosted.css` / `frost-decoration.css`。

### 2.3 template 与文案

- 文案走 **props 默认值或 slot 兜底**（中文默认，页面可覆盖）；组件内部不做 i18n。
- 图标用 `@element-plus/icons-vue`（在依赖白名单内）。
- 复杂子结构拆 slot，不要写死。

### 2.4 import 白名单（仅此 6 类）

```js
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import GOther from '../GOther/GOther.vue'        // 其他 G 组件：直指 .vue 文件
import nodes from '../../../icons/icon-nodes.json' // 仅 GIcon：icons 数据 JSON
```

第 5 条是硬规则：**跨组件引用写完整路径 `../GOther/GOther.vue`，不写目录 `'../GOther'`**——复用拷贝按文件闭包搬运，目录式引用会断。

---

## 3. 提交前自检（10 条）

1. [ ] 目录内只有 `GName.vue` + `index.ts`（+ 可选 `examples.vue`）
2. [ ] .vue 无 `lang="ts"`、无 TS 语法残留（grep `: string`、`as `、`interface ` 应零命中）
3. [ ] style 块是 `<style lang="less" scoped>`
4. [ ] 样式零 hex、零 rem、零静态 `style="…"`
5. [ ] 颜色/间距全部 token 变量
6. [ ] import 不出 §2.4 白名单；G 组件引用直指 .vue
7. [ ] 文案走 props 默认值 / slot
8. [ ] props/emits 命名与同类存量组件风格一致
9. [ ] `node scripts/migrate_components.mjs --check <目录>` 零输出
10. [ ] `npm run build:library` 通过

---

## 4. examples.vue 写法（可选但推荐）

```vue
<template>
  <GYourName type="primary" :nodes="demoNodes" @search="onSearch" />
</template>

<script setup>
import GYourName from './GYourName.vue'   // 同样直指 .vue
const demoNodes = [/* 典型数据 1-2 组，覆盖主要状态 */]
const onSearch = (kw) => console.log(kw)
</script>
```

价值：examples 是 AI 匹配复用组件时的**学习样本**——写清典型入参，你的组件被自动选中的概率显著提高。examples 不随复用拷贝交付，可以放心写。

---

## 5. 提交流程

1. 按 §1-§4 完成组件与 examples。
2. 跑 §3 的 10 条自检（其中 9、10 是命令，必须真实通过）。
3. 通知组件库负责人（W2）合入；合入后由维护方统一跑 `build_indexes` + `refresh_release` 重锁索引（设计师无需操作）。
4. 若新增组件引入了**新的**对外契约（新分类、新 JSON 数据依赖、新外部依赖），先在任务卡回写区登记「需拍板」，不要自行扩白名单。

---

## 6. 背景：为什么是这种格式（一次说清，避免踩历史坑）

- **单文件自包含**：AI 复用组件 = 拷贝文件闭包 + 文件头加来源注释，零改写。任何外链（types.ts、style.scss）都会让拷贝变改写，破坏「复用即拷贝」。
- **纯 JS**：交付工作区的代码全是 JS（AI 生成 + 二开），库源保持同构，拷贝进去风格一致、无编译差异。
- **less 单语言**：产品线二次开发硬要求 less（D22）；且全仓库 scss 正在清零（D23），新组件绝不引入。
- **index.ts 保留**：库构建（`npm run build:library`）需要它；但复用拷贝不拷它，所以它只能是那固定三行。

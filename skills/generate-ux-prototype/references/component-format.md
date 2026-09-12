# 组件库改造规范 v1

> **状态**：正式稿 · 待设计师评审签字（签字后本文件即为组件库格式契约 / 冻结点）
> **依据**：SKILL-REPLACE-PLAN.md §5（组件复用方案）、§9 D7（库端改造）、D20（index.ts 保留修正）、D22（样式语言钉死 less，撤回 D21 scss 默认）、任务卡 tasks/W2-components.md M0
> **适用范围**：`assets/g-design-enterprise-v1.5.0/frontend/element-plus/src/components/`（下称 components/）全部存量组件（61 个目录）与设计师后续新增组件
> **现状基线**（2026-09-12 盘点）：58 个主 .vue + 3 个 service 组件 + 49 个 examples.vue + 49 个 style.scss + 53 个 types.ts + 63 个 index.ts（61 组件级 + basic/business 两个 barrel，complex 无 barrel）

## 0. 目的

把每个组件改造为**单文件自包含**格式：一个 .vue 文件内联全部 template / script / style。改造后：

- **复用 = 纯拷贝**：AI 复用组件时只拷文件（含闭包依赖）+ 文件头加一行来源注释，零改写；
- **二次开发同构**：交付工程里的复用组件与 AI 手写组件风格完全一致——纯 JS、内联 less scoped 样式、相对路径 import，无 TS / 外链样式 / barrel 依赖 / 来源锁；
- **单一格式**：库源只有一种写法，设计师新组件照此写，无双轨维护。

## 1. 目录规范

每个组件一个目录 `components/{basic|business|complex}/GName/`，目录内只允许（service 组件例外见 §8）：

| 文件 | 必需性 | 说明 |
|---|---|---|
| `GName.vue` | 模板组件必需 | 主组件，单文件自包含（§2-§7） |
| `index.ts` | **必须保留** | 供 `npm run build:library` 与分类 barrel 使用（D20 修正：不删任何 index.ts） |
| `examples.vue` | 可选 | 典型用法示例，供 AI 学习匹配；**不随复用拷贝交付** |
| 其他任何文件 | **禁止** | types.ts、style.scss 一律消除；不新增 README / 数据文件等 |

`index.ts` 标准写法（现状即如此，不变）：

```ts
import GButton from './GButton.vue'
export { GButton }
export default GButton
```

分类 barrel（`basic/index.ts`、`business/index.ts`）保持 `export{GButton}from'./GButton'` 现状。complex 无 barrel，由库根入口逐个引入（现状）。

## 2. SFC 自包含

`GName.vue` 固定三段全内联：

```vue
<template>…</template>
<script setup>…</script>
<style lang="less" scoped>…</style>
```

- 禁止 `<style scoped src="./style.scss">` 外链；禁止 `@import` 任何外部样式。
- 样式块声明为 **less**（任务卡 M0 §2 明确 `lang="less"`）：与生成工作区代码约定一致，复用拷贝时零改写。扁平 CSS 本身就是合法 Less——存量 49 个 style.scss 经盘点全部为扁平 CSS（零嵌套、零 `$` 变量、零 `@import`、零 `#{}`），可直接贴入；未来新组件允许使用 Less 嵌套等语法。
- `:deep()` 是 Vue scoped CSS 语法（非 sass），less 下合法，保留（存量 39 个文件在用）。
- 库根 `src/index.ts` 引用的 `tokens/index.scss`：按 D23 清零计划，库内 scss 将统一清除，最终态无 scss（D23 独立 PR 处理，本规范暂不展开细节）。

## 3. Script 纯 JS

`<script setup>` **不带 `lang="ts"`**、无任何 TS 标注（`GName.vue` 与 `examples.vue` 都适用——验收 grep 覆盖全部 .vue）。

转换规则（存量迁移与新手写都照此）：

| 现在（TS） | 改为（JS） |
|---|---|
| `withDefaults(defineProps<{type?:GButtonType}>(),{type:'default'})` | `defineProps({type:{type:String,default:'default'}})` |
| `defineProps<{nodes:TopologyNode[];title?:string}>()`（required、无默认） | `defineProps({nodes:{type:Array,required:true},title:{type:String}})` |
| `defineEmits<{(e:'search'):void;(e:'reset'):void}>()` | `defineEmits(['search','reset'])` |
| `import type{X}from'./types'` | 删除；可选值等类型信息转 JSDoc 注释 |
| `x as Record<string,IconNode[]>` 等断言 | 删除 |
| script 内 `export interface Column{…}` | 转 JSDoc 注释（盘点确认 4 处均无外部消费方） |

类型映射：`string→String`、`number→Number`、`boolean→Boolean`、数组→`Array`、对象→`Object`、函数→`Function`、`string|number→[String,Number]`、字面量联合（`'primary'|'danger'`）→`String`（可选值写入 JSDoc）。

- **不新增运行时 validator**——迁移是零改写，加校验属行为变更。
- v-model 模式保持现状：`modelValue` prop + `update:modelValue` emit（不用 defineModel）。

## 4. 文案

- **新组件**：组件内可见文案一律走 props 默认值或 slot 兜底（中文默认，页面可覆盖）；组件内部**不引入 i18n 机制**（保持零依赖）。页面级文案走工作区 i18n 约定，与组件无关。
- **存量迁移**：硬编码中文（如 GFilterBar 的「重置/查询」）**原样保留**——props/emits/slots API 完全不变是硬验收（§7），不借迁移扩 API。后续要开放文案 props 属 API 演进，走设计师正常迭代（版本化变更）。

## 5. 依赖白名单

`import` 仅允许以下来源：

1. `vue`
2. `element-plus`
3. `@element-plus/icons-vue`
4. `dayjs`
5. 相对路径的其他 G 组件——**一律直指 .vue 文件**：`import GTopology from '../GTopology/GTopology.vue'`，**不经目录 barrel**（不写 `../GTopology'`）。理由：复用闭包拷贝只带 .vue（§10），直指路径保证拷贝零改写。存量 2 处 barrel 引用（GAlarmTopology→GTopology、GMonitorPanel→GStatusTag）迁移时一并改写；examples.vue 同理改为 `import GButton from './GButton.vue'`。
6. **GIcon 专属例外**：`../../../icons/icon-nodes.json`、`../../../icons/icon-aliases.json`（图标数据资产约 420KB，由 export_icons 流程维护，不内联进 .vue）。

> 给 W1/T6 的契约信息：复用闭包必须包含**非 .vue 的相对 import**——拷 GIcon 时须连带拷 2 个 icon JSON 并保持相对路径。

## 6. 样式

- 颜色 / 圆角 / 间距 / 阴影 / 字号一律库 token 变量（`--g-*`、`--color-*`、`--space-*`、`--font-size-*` 等）。
- 禁 hex 字面量（存量 49 个 style.scss 与全部 .vue 内联块经盘点零命中）。
- 禁**静态**内联 `style="…"` 属性；动态绑定 `:style`（计算值）允许——GDashboardGrid 的 `gridTemplateColumns`、GMonitorPanel 的条形高度属此类，保留。
- 尺寸单位 px（D14）。
- `:deep()` 允许（覆盖 EP 内部样式）。

## 7. API 不变（硬验收）

迁移前后组件的 **props / emits / slots 对外 API 完全不变**：

- prop：名称、required、默认值、运行时类型一致；
- emit：名称一致（参数形状不变）；
- slot：名称一致。迁移不触碰 template，slots 天然不变；
- `migration-report.json` 逐组件记录迁移前后 defineProps / defineEmits 签名 diff，**必须为空**。

## 8. 特例：service 组件

GLoading / GMessage / GNotification 不是模板组件，无 .vue。保持 `index.ts` 再导出形态（如 `export const GLoading={service:ElLoading.service,directive:ElLoading.directive}`）+ 可选 `examples.ts`（import 自 `'./index'`）。types.ts 删除（盘点确认三个 service 的 types 均无消费方）。不强制补 .vue。

## 9. 连带改动（components/ 目录外，需拍板确认后随迁移一并处理）

| # | 位置 | 现状 | 处理建议 |
|---|---|---|---|
| 1 | `src/index.ts:10` | `export*from'./components/complex/GTopology/types'` | 库根公开导出经盘点无库包外消费方，删除该行；TopologyNode/TopologyEdge 仅 page-types.ts 内部使用（见 #2） |
| 2 | `src/page-types.ts:1` | `import type{TopologyNode,TopologyEdge} from'./components/complex/GTopology/types'` | 两个 interface 定义并入 page-types.ts 本体 |
| 3 | `frontend/element-plus/package.json` | devDependencies 无 `less` | 增加 `less`（vite 编译 `lang="less"` 必需） |

> 备选（不推荐）：样式块用纯 `<style scoped>` 可免加 less 依赖，但与生成工作区的 less 约定不一致，复用拷贝时需改写，违背零改写原则。
>
> **跨 W 所有权提示**：以上 3 个文件均在 assets/ 下、components/ 之外（W2 严格所有权仅含 components/ 与迁移工具）。实际编辑归属需用户拍板（W2 代改 / W4 文档 / W3 Node 化），M0 仅登记依赖，不越界编辑。

## 10. 复用拷贝约定（生成侧执行，设计师知悉即可）

AI 复用组件 = 拷贝 `GName.vue`（+ 闭包内相对 import 的文件，含 GIcon 的 JSON）到生成工程 `src/components/GName/`（平铺，库内分类不映射为目录），文件头加一行来源注释：

```vue
<!-- 源: g-design v1.5.0 g-button -->
```

`examples.vue` 与 `index.ts` 不随拷贝。便于二次开发者识别来源、做后续升级 diff。

## 11. 验收清单（M2 执行用）

- [ ] `find components/ -name "types.ts" -o -name "style.scss"` 零命中（index.ts 保留）
- [ ] `grep -r 'lang="ts"' components/` 零命中（含 examples.vue）
- [ ] `npm run build:library`（frontend/element-plus 下）通过
- [ ] migration-report.json 的 API diff 全为空
- [ ] 人工抽查 ≥20 个：business（13）/ complex（5）全查 + basic 抽 5；重点 GDataTablePro、GAlarmTopology、GTopology

## 12. 新组件提交 checklist（给设计师）

1. 按 §1-§7 写：单文件自包含、纯 JS、token 样式、文案走 props/slot、依赖白名单内。
2. 跑 `node scripts/migrate_components.mjs --check <组件目录>`：**零变更 = 合规**。
3. `npm run build:library` 通过。
4. （推荐）examples.vue 给 1-2 个典型用法，供 AI 匹配学习。

## 13. 改造前后示例（GButton，真实内容）

**改前（5 文件）**

```
GButton/
├── GButton.vue   <template><el-button v-bind="$attrs" :type="type"><slot /></el-button></template>
│                 <script setup lang="ts">import type{GButtonType}from'./types';withDefaults(defineProps<{type?:GButtonType}>(),{type:'default'});</script>
│                 <style scoped src="./style.scss"></style>
├── types.ts      export type GButtonType='primary'|'success'|'warning'|'danger'|'info'|'default'
├── style.scss    :deep(.el-button){font-family:var(--g-font-family);border-radius:var(--g-control-radius)}
├── index.ts      （保留不动）
└── examples.vue  （仅去 TS）
```

**改后（3 文件）**

```
GButton/
├── GButton.vue   ← 见下
├── index.ts      （不变）
└── examples.vue  （import 改为 './GButton.vue'，去 TS）
```

```vue
<template><el-button v-bind="$attrs" :type="type"><slot /></el-button></template>
<script setup>
/** type 可选值：'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default' */
defineProps({ type: { type: String, default: 'default' } })
</script>
<style lang="less" scoped>
:deep(.el-button){font-family:var(--g-font-family);border-radius:var(--g-control-radius)}
</style>
```

---

**评审签字**：设计师 ____________　日期 ____________

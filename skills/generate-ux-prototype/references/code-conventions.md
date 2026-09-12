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
4. **imports 顺序**: vue → vue-router → element-plus → @element-plus/icons-vue → dayjs → 相对子组件/素材/api/constants。
5. 常量放 `views/{slug}/js/constants.js`，全大写+下划线命名（`ALARM_LEVEL`、`STATUS_MAP`）。
6. 图标：`import { Search, Plus } from '@element-plus/icons-vue'`；用法 `<el-icon :size="20"><Search /></el-icon>` 或 `:icon="Search"`。
7. 反馈：轻提示 `ElMessage`；危险操作 `ElMessageBox.confirm(..., { type: 'warning' })`；表格 `v-loading`；空态 `el-empty`。
8. 表格：`el-table` + `el-table-column`；自定义列 `<template #default="{ row }">`；操作列 `fixed="right"` ≤3 个按钮（多了收进 `el-dropdown`）；≥8 条数据配 `el-pagination`。
9. 图片素材：`import logo from '../../assets/uploads/logo.png'` 或 `import icon from '../../assets/images/ran.svg'`（禁止裸路径 `src="/assets/..."`）。

## 3. 样式规范

- `<style lang="less" scoped>`；类名按组件功能命名（简短，如 `.header`、`.kpi-card`、`.filter-bar`），嵌套在根类下；嵌套 ≤ 3 层。
- 颜色一律资产 token 变量：`var(--g-*)` / `var(--color-*)`（全集见工作区 `src/assets/tokens/*.css`，build 实时校验兜底）；**禁 hex 硬编码**（build WARN）、禁内联 `style="..."`（`:style` 动态绑定仅限需变量计算的场景）。
- 单位一律 **px**（与资产 token 一致，D14）。无 rem 换算。
- Less 变量/混入可用（`assets/style/base.less` 内置常用混入）；SFC 内不 `@import` 外部 .less（预览兼容性）。
- SFC 样式内禁止定义 `:root`、`[data-theme]`、资产 token（`--g-*`/`--color-*`）；页面局部自定义属性用 `--page-*` 前缀。
- 换肤协议为资产库的 `data-theme="light|dark"`（详见 SKILL.md「换肤系统」）；自定义皮肤只属于 `src/assets/themes/theme-{name}.css`，不写进 SFC。

## 4. API 适配层约定（D16，页面取数唯一通道）

`init.mjs` 已生成 `src/api/{slug}.js`。**页面与组件只准从这个适配层取数，禁止直接 import `mock/modules`**（build 强制 FAIL）。二次开发时只改 api 文件内容，页面零改动。

```js
// ✅ 正确 — 页面从适配层取数
import { fetchList, createRecord } from '../../api/{slug}.js'

// ❌ 违规 — 页面直连 mock（build 拦截）
import { fetchList } from '../../../mock/modules/{slug}.js'
```

**Mock 函数按 REST 语义设计签名**（原型态与真实接口一致，二开时无需改页面）：

```js
// mock/modules/{slug}.js — 参数与返回都是页面消费的形状，delay 模拟网络
export async function fetchList({ keyword = '', page = 1, pageSize = 20 } = {}) {
  await delay()
  // …过滤/分页…
  return { list, total, page, pageSize }
}
```

**二开写法**（替换 api 文件原型态的 re-export；用 `import ... from` + `export { }` 两段式，勿用 `export {...} from` re-export 简写——sfc-loader 0.9.5 对 re-export 编译产物有缺陷，两段式在「真实工程外直接开 HTML」的场景也安全，见 W1-T3）：

```js
// src/api/{slug}.js 二开态示例（request 为自建 axios 实例）
import request from './request'

async function fetchList(params) { return request.get('/api/{slug}', { params }) }
async function fetchDetail(id) { return request.get(`/api/${slug}/${id}`) }

export { fetchList, fetchDetail }
```

导出名、参数、返回形状保持与 mock 一致。

## 5. Mock 数据模式

- 位置 `mock/modules/{slug}.js`（与 src 同级，init 已建）。函数签名按 REST 语义（见上节）；`Promise + setTimeout` 模拟异步。
- 数据 key 语义化（`deviceName` 禁止 `val1`）；主列表 ≥ 10 条状态多样。
- **混合策略**（D13④）：手写前 8-10 条保状态多样性，其余用 spread / 生成器扩展数量：
  ```js
  const more = Array.from({ length: 40 }, (_, i) => ({
    id: String(i + 11), name: `设备-${String(i + 11).padStart(3, '0')}`,
    status: statuses[i % statuses.length],
  }))
  export const mockData = [...handwritten, ...more]
  ```
- **截图输入例外**：数据保真转录，行数列数与图完全一致，逐格独立读取，严禁行间复制——不用生成器扩展。

## 6. i18n 模式（D15：locales.js 单文件双语言）

- **页面级**：每页一个 `views/{slug}/js/locales.js`（init 已建骨架）。zh + en 一次写完（en 机械翻译顺带产出）。**`messages` 存双语言源，`t` 是按 LANG 展平的字符串**——模板直接 `{{ t.title }}`，**禁止手动 `.zh`**（漏写展平会在界面渲染成 JSON 串）：
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

## 7. 复用 G 组件约定（D12/D17/D20）

资产库组件（`G*`，basic/business/complex 三类）以**纯拷贝 + 来源注释**方式复用，零改写：

1. **匹配**：按 spec 的 `useWhen` 语义匹配（`query_assets.mjs components --search …`）。
2. **拷贝**（一条命令完成闭包复制，替代手工多轮读写）：
   ```sh
   node scripts/collect_component.mjs <LIBRARY> <component-id> "{slug}/src" "{slug}/src/components"
   ```
   - 自动递归解析相对 import 拷齐依赖闭包；只拷 `GName.vue`（index.ts / examples.vue 不拷，D20）。
   - **落位**：`src/components/{basic|business|complex}/GName/GName.vue`——与资产库分类名一致，溯源与升级 diff 友好（D17）。页面内 import：
     ```js
     import GStatusTag from '../../components/business/GStatusTag/GStatusTag.vue'
     ```
   - 每个拷入文件自动加来源注释（版本 + 库内路径），如 `<!-- 源: g-design 1.5.0 g-status-tag (…) — 禁止修改；升级走资产库 -->`。
   - 额外生成 `index.js` interop 垫片——预览运行时兼容文件（sfc-loader 0.9.5 的目录式命名导入需要它；真实 Vite 工程原生解析，无需垫片），勿手改勿删。
3. **禁止改写拷入的组件文件**（含来源注释）。组件不合用时的正确路径：改需求描述走资产库升级（manage-design-assets），或在页面用 wrapper 组件包一层，而不是改拷贝件。build 与人工审查都会盯这条。
4. 依赖闭包不完整（组件还引用 types.ts 等未迁移文件）时 collect 会 FAIL 并列出缺失清单——这是资产库迁移 gap，如实上报用户，**不要手工内联修复**。
5. 落位子目录也可按业务自判放 `views/{slug}/components/`（D11），但 G 组件默认走上表分类落位；手写组件不受分类约束。

## 8. 相对路径计算（最易错项）

按 init 后实际目录结构（含 `api/`、`tokens/`）：

```
{slug}/
├── mock/
│   └── modules/{slug}.js                  ← Mock API（只被 src/api/{slug}.js 引用）
├── index.html                             ← 离线预览加载器
└── src/
    ├── api/{slug}.js                      ← ★ 接口适配层（页面取数唯一入口）
    ├── assets/
    │   ├── tokens/                        ← 资产 token 全套（FIXED）
    │   ├── uploads/logo.png               ← 素材
    │   └── images/ran.svg                 ← SVG 图标
    ├── components/
    │   ├── business/GStatusTag/GStatusTag.vue  ← 复用 G 组件（collect 落位）
    │   └── SharedCard.vue                 ← 手写跨页组件（按需创建）
    ├── locales/lang/zh-CN/common.json     ← 全局共享词条
    └── views/{slug}/
        ├── index.vue                      ← 页面主组件
        ├── components/StatusTag.vue       ← 页面私有子组件（按需创建）
        └── js/constants.js                ← 常量（含 COMPONENT_MODE）

从 views/{slug}/index.vue 引用:
  页面子组件:   import StatusTag from './components/StatusTag.vue'
  常量:        import { STATUS_MAP } from './js/constants.js'
  页面词条:    import { t } from './js/locales.js'
  API 适配层:  import { fetchList } from '../../api/{slug}.js'
  素材:        import logo from '../../assets/uploads/logo.png'
  SVG 图标:    import ranIcon from '../../assets/images/ran.svg'
  手写跨页组件: import SharedCard from '../../components/SharedCard.vue'
  复用 G 组件:  import GStatusTag from '../../components/business/GStatusTag/GStatusTag.vue'

从 views/{slug}/components/StatusTag.vue 引用:
  API 适配层:  import { fetchList } from '../../../api/{slug}.js'
  素材:        import logo from '../../../assets/uploads/logo.png'

从 src/components/SharedCard.vue 引用:
  API 适配层:  import { fetchList } from '../api/{slug}.js'
  素材:        import logo from '../assets/uploads/logo.png'
```

（starter `index.vue` 引用 api 层是 `../../api/{slug}.js`——从 `views/{slug}/` 出发上两级到 `src/`，再进 `api/`。）

## 9. 运行时错误预防（build 不覆盖）

1. `el-select` v-model 值必须在 options 中：初始值必须是某个 `el-option` 的 `value`，否则显示裸值。建议初始值 `''`（配合 `clearable`）。
2. `el-table` column `prop` 与 data key 匹配：`prop="xxx"` 必须对应数据对象的实际 key，否则列空白。
3. template 不引用未声明的变量：`<script setup>` 中未定义的变量在模板中不渲染但不报错。
4. token 使用前确认存在于 `src/assets/tokens/*.css`（可 grep 确认），build 实时校验兜底。

## 10. 高频错误预防（build 拦截项）

| # | 错误写法 | 正确写法 | 原因 |
|---|---------|---------|------|
| 1 | `import { Searchh } from '@element-plus/icons-vue'` | `import { Search }` | 图标名不在 295 白名单 |
| 2 | `<el-table-cloumn>` | `<el-table-column>` | 组件名不在 116 白名单 |
| 3 | `<StatusTag />` 但没 import | `import StatusTag from './components/StatusTag.vue'` | 标签无对应 import |
| 4 | `import logo from '../assets/uploads/logo.png'`（从 views/{slug}/ 出发） | `'../../assets/uploads/logo.png'` | 路径少一级 |
| 5 | `import { ElToast } from 'element-plus'` | `import { ElMessage } from 'element-plus'` | 导出名不在白名单 |
| 6 | `style="color: red"` | class + `<style lang="less">` 定义 | 禁止内联样式 |
| 7 | `import { fetchList } from '../../../mock/modules/{slug}.js'` | `from '../../api/{slug}.js'` | 页面禁 import mock（D16，build FAIL） |
| 8 | 直接编辑 `src/components/business/GStatusTag/GStatusTag.vue` | 保持原样；不合用走 wrapper 或资产库升级 | 拷入的 G 组件禁止改写（含来源注释） |
| 9 | `<style lang="scss">` 或新增 .scss 文件 | `<style lang="less" scoped>` | 样式语言全链路钉死 less（D22） |
| 10 | `<style>` 内 `:root { --g-x: … }` | 皮肤只放 `src/assets/themes/`；页面局部变量 `--page-*` | token 层与皮肤文件专属 |
| 11 | `slot-scope="scope"` | `<template #default="{ row }">` | 旧语法编译失败 |
| 12 | `v-if` 和 `v-for` 同标签 | 分开到不同标签 | 编译错误 |
| 13 | `src="/assets/uploads/x.png"` | `import img from '../../assets/uploads/x.png'` | 预览无法解析裸路径 |

## 11. 二开依赖差异（D22）

工作区是标准 Vue 工程，但预览运行时与真实 Vite 工程有三处已知差异，二次开发者需知：

1. **devDependency 固定 `npm i -D less`**：真实工程 Vite 零配置编译 Less（`main.js` 已 `import './assets/style/base.less'`）；无需 sass/其他预处理器。
2. **api 适配层两段式**：二开 `src/api/{slug}.js` 时用 `import ... from` + `export { }` 两段式，勿用 `export {...} from` re-export 简写（sfc-loader 0.9.5 re-export 缺陷经验，见 W1-T3；真实 Vite 工程无此限制，两段式是双保险）。
3. **复用 G 组件的 index.js 垫片**是预览专用兼容文件；真实工程可删（Vite 原生解析目录式命名导入），组件本体 `GName.vue` 与页面代码不受影响。
4. **el-pagination 用 v-model**：预览运行时（sfc-loader 0.9.5）下传单向 `:current-page` / `:page-size` prop 会静默不渲染（组件变注释节点）；写 `v-model:current-page` / `v-model:page-size`（T7 实测。真实 Vite 工程无此限制）。

真实工程 npm 依赖（`preview/src/main.js` 头部已注释声明）：`vue@^3.4`、`vue-router@^4.4`、`element-plus@2.13.5`、`@element-plus/icons-vue@^2.3`、`dayjs@^1.11`、`less@^4.2`。

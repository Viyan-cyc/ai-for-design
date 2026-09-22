# Spec: ep-coder / generate-ux-prototype vendor 知识库（fastui 三块对齐）

- **层级**: Feature Spec
- **创建**: 2026-09-18 15:11
- **状态**: Plan v3（已执行完毕，2026-09-20 收口；Execute Log 见 §8）
- **phase**: Done
- **approval status**: `Plan Approved`（2026-09-18）
- **前置**: `2026-09-17_17-37_ep-coder-generate-ux-prototype.md`（GO，本 Spec 在其交付物上叠加）
- **前置关系**: 曾有 Spec `2026-09-18_09-11_ep-coder-component-library.md`（assets/ 全量组件文档路线），**已作废**。本 Spec 决策编号用 **VD-** 前缀，与主 Spec 的 D-1~D-22 结构性隔离。

## 1. 最终目标（Goal）

为 skill `generate-ux-prototype` 落地 `vendor/` 知识库：借鉴 fastui vendor 的分块+索引纪律，
落地为**两块 + 顶层路由**（vue-skill / code-example + README；style-skill 职责并入顶层
README，VD-1/VD-12）。agent 生成页面走直线路径：查索引 → 查规则 → 抄模板/示例 → 生成 →
自检；vendor 对绝大多数常规页面自足，design-language/ 源树仅作升级路径（VD-12）。

1. **内容主源 = 参考实现** `D:\cyc\project\octo\gts\test\vendor\`（仿 fastui vendor 的草稿，
   17 文件，本 Spec 为其把关与落地的裁决记录见 §4.6）；**辅源 = GTS_ElementPlus_Vue3_Prompt-new.md
   v2**（§3 索引合并、图表示例素材、高频组件示例素材）。
2. **覆盖**：高频 20 组件各一份可运行示例（用户拍板"低频以后再说"）；模板 4 份；整页示例 2 组。
3. **图表运行时同步**：preview 加 echarts 6.1.0 + vue-echarts 8.3.0 UMD，build 门禁扩展，
   mixed-chart 示例纳入冒烟。
4. **零重复**：token 速查/主题映射/EP 覆盖不进 vendor（default.css / bridge.css /
   references/design-language.md 已有）；style-skill 块整体不设（VD-12）。
5. **纪律**：参考 vendor 目录与 prompt-new.md 只读（源，不写）；design-language/ 不改；
   全部写入限 ep-coder skill 树内。

### 当前任务单元

Task-1：vendor 三块落地 + 图表运行时 + 门禁扩展 + SKILL.md 轻整合，一次交付可验证。

## 2. In Scope / Out of Scope

**In Scope**
- `skills/generate-ux-prototype/vendor/` 按 6.1 树新建（替换 PLACEHOLDER.md），38 文件。
- preview 运行时加 echarts/vue-echarts UMD + loader 映射 + build 门禁扩展。
- SKILL.md 轻整合（③ 加查 vendor 直线 + 硬约束 4 改写）。
- 示例代码统一 `<style scoped lang="less">`、禁静态内联 style。

**Out of Scope**
- 参考实现目录 `test/vendor/` 与 `GTS_ElementPlus_Vue3_Prompt*.md`（只读）。
- `design-language/` 源目录（不改一个字节）。
- EP 版本不变（2.13.5）；新依赖仅 echarts 6.1.0 + vue-echarts 8.3.0（预览运行时）；
  **build 环境零新依赖**（less 由 sfc-loader 内置，build 不编译样式）。
- 低频组件示例（后续任务）；Tailwind（不引入）；analyze_image.py / python（宿主专属，不迁移）；
  9 步工作流仪式（宿主 SKILL.md 已定轻整合）。

## 3. Context Sources

| 来源 | 用途 |
|---|---|
| `test/vendor/`（17 文件草稿） | **主转录源**：components_index / codeRules / errorChecklist / 4 模板 / TableSearchExample / 索引模式 |
| `GTS_ElementPlus_Vue3_Prompt-new.md`（1546 行 v2） | 辅源：§3.1 高频 20 表（import 真值）+ §3.3 图表用法/图表色 + §3.4 + 附录 A 合并 + 组件示例素材 |
| 主 skill 既有资产（SKILL.md / build.mjs / preview loader / default.css 337 token / bridge.css / references/design-language.md） | 集成点、门禁签名、去重基准 |
| `SPEC-fastui-vs-aifordesign-speed.md` | 直线路径/信息确定性模式依据 |
| fastui-vue-codegen-pipeline.md §8.2 | fastui vendor 三块结构原型 |
| echarts 6.1.0 + vue-echarts 8.3.0 tgz | 图表运行时提取源 |

## 4. Research Findings

### 4.1 参考实现结构（test/vendor/，17 文件）

```
vendor/
├── vue-skill/          SKILL.md(9步工作流+原则) references/{components_index,codeRules,errorChecklist}.md
│                       templete/{README,LeftInfoWithRightCard,SearchInfoWithRightCard,DashboardCards,FormDialog}
│                       scripts/analyze_image.py
├── code-example/       SKILL.md references/{README.md,TableSearchExample/{index.vue,components/×3}}
└── style-skill/        SKILL.md(消费侧指引+全量token映射+EP覆盖+速查表)
```

### 4.2 门禁签名（build.mjs 现场核实）

- `ALLOWED_BARE = { vue, element-plus, @element-plus/icons-vue, dayjs }`（build.mjs:89）→
  扩展 `echarts`、`vue-echarts`。
- `importedNames` 收集 default/named 全形态（:207-208）→ `import VChart from 'vue-echarts'` 可识别。
- `<el-*>` 走白名单（:266）；kebab 非 el- 前缀须有对应 import（:270-273）→ `v-chart`（kebab）
  会误杀 → 需处理（VD-7a）；PascalCase `VChart` 由 import 检查自然覆盖。
- style 检查为正则（hygiene/token/hex），**不编译样式** → less 源照样被检查（less 变量
  `@foo` 与 CSS 自定义属性 `--x` 不冲突；`var(--color-*)` 引用扫描不受影响）→ **build 零改动
  支持 less**。
- REQUIRED_HTML（:130-137）6 项 → 新增 echarts 两个 script 标签后同步。
- token 检查 `--el-*` 豁免已存在；`color-chart-1..6` 已在 default.css（设计系统.md:380-385 →
  gen-tokens 产物）。

### 4.3 预览运行时（index.gts.html 现场核实）

- vue3-sfc-loader 0.9.5，moduleCache 现有 vue/element-plus/icons/dayjs 四键。
- **less 支持（Execute 期修正）**：Spec v2/v3 曾判"内置 less 已确认"——**结论有误**。现场
  逆向证实：bundle 内 `Rn={less:...}` 只是预处理器注册表，实际引擎经 `r(329)` 解析，而模块
  329 是 webpack "Cannot find module" 桩（`t.id=329`, throw MODULE_NOT_FOUND）——UMD 构建
  **未打包任何样式引擎**，`<style lang="less">` 运行时报"找不到 less"。修复：library 补
  less 4.4.1 浏览器 UMD（less.min.js，全局名 `less`），index.gts.html script 序列 +
  moduleCache 加 `less` 键。A4 冒烟证实修复后 less 编译 + scoped hash 均正常。
- TS：bundle 含 typescript 痕迹但未实测 → 示例统一 JS（VD-3），规避未验证路径。
- 无 Tailwind。

### 4.4 参考实现评估（把关结论）

**复用（高价值）**
- `components_index.md`：按通用4/录入17/展示13/导航8/反馈10 分类（对齐 design-language 组件
  规范分类）+ "需求→组件"选择表 + "需自行封装"清单 + 图表色段。缺陷：`../设计规范/...`
  相对路径断链（改写为 design-language/ 根相对）；缺 import 列（从 prompt-new §3.1/附录A 合并）。
- `codeRules.md`：prompt-new §4 超集。新增真金：ElDialog 默认 `draggable +
  :close-on-click-modal="false"`、跨组件通信判断标准（层级差×page/业务组件矩阵）、v-if/v-show、
  change/watch、性能（禁大对象/驼峰 props）、内存（事件总线反注册/侦听器同步创建）、dayjs、
  文件命名 kebab。缺陷：示例 TS；规则 2.2 `:root` 映射例在本 skill 已由 bridge.css 实现
  （改注"主题层已完成，页面禁止再做"）；i18n/pinia 规则超预览运行时（标注真实工程适用）。
- `errorChecklist.md`：每错误配 ❌/✅ 代码对（多按钮组/图标按钮无说明/Dialog 缺默认等）。
- `templete/` 4 份：**已 token 化、无内联样式、无 Tailwind、slot 化**——等于完成了 prompt-new
  §7 最难的转写半截。只需 TS→JS + 目录 typo（templete→templates）。
- `code-example/`：索引模式（编号/用途/组件/路径 + 双索引 + 归档规范 + "每次最多读 2 文件"
  纪律）；TableSearchExample 4 文件（比 prompt-new §11 示例 1 拆分更细，是文件拆分示范）。

**不迁移（重复或宿主专属）**
- `style-skill/SKILL.md` 整块不设（v3 升级：连薄指针目录也不留）：token 映射表 = default.css
  重复、EP 覆盖表 = bridge.css 重复、速查表 = references/design-language.md §1 重复（三重
  重复）。fastui 需要 style-skill 是因为没有生成式速查与门禁；本 skill 由 bridge.css +
  build 门禁 + gen-tokens 生成速查机械承接，机制取代散文。路由/升级职责并入 vendor/README.md
  （VD-12）；design-language.md 为生成产物，保留（VD-12）。
- 各 SKILL.md 内 9 步工作流/需求落盘/ASCII 布局/澄清轮次：工作流归宿主所有，防双源冲突。
- `scripts/analyze_image.py`：OpenAI API + python 依赖，宿主专属。
- prompt-new §2 token 速查、§10 :root 映射：同 style-skill 理由不转录。

**把关裁决（用户疑问："组件里不该提规范定义的东西？"）**
- 索引层（components_index.md）：**保留** GTS 规范路径列——vendor（怎么写代码）到
  design-language（该长什么样）的唯一导航桥梁。
- 代码层（模板/示例 .vue 内部）：**零规范引用注释**——干净可运行，抄走即用（与产出卫生规则
  一致）。参考实现的模板已符合。

### 4.5 亮点采纳：getComputedStyle 图表色

codeRules 规则 11.2：运行时 `getComputedStyle(document.documentElement).getPropertyValue(
'--color-chart-1').trim()` 读 token 填 `option.color`。优于 prompt-new 硬编码 hex 数组：
token 合规、换肤自动跟随、build 零告警。mixed-chart 示例与 VChart 组件示例采用此模式。

### 4.6 附录 A 与白名单

附录 A 约 55 distinct 组件 ∈ 白名单 118（子集）；Execute 期清点（VD-8）。DashboardCards 用
`--font-size-big` 等 token 需核对在 default.css 337 集合内（build 门禁会捕获，转写时修正）。

## 5. Decisions

- **VD-1 分块结构（v3 修订）**（2026-09-18 用户拍板"目录结构对齐"→同日质询后修订）：vendor/
  = vue-skill + code-example + 顶层 README（含原 style-skill 的路由/升级指针职责）。
  style-skill 块整体撤除——内容三重重复（4.4），单文件薄指针目录是为对齐 fastui 形状而留的
  形式主义；对齐的是 fastui 的分块+索引纪律，不是块数。原 PLACEHOLDER.md 三类占位
  （component-examples/code-examples/design-specs）由两块取代。
- **VD-2 示例代码规范**：`<style scoped lang="less">` 统一；**禁静态内联 style**（`style="..."`
  字面量一律进 less 类；仅动态绑定 `:style` 允许）；无 Tailwind class。依据：sfc-loader
  内置 less（4.3）；build 正则检查兼容 less（4.2）。
- **VD-3 TS → JS 转写**（2026-09-18 用户拍板）：`lang="ts"` 去除、类型注解去除
  （`ref<...>` → `ref(...)`、`withDefaults(defineProps<{...}>(),{...})` → `defineProps({...})`
  + default 值、`import type` 删除）。源为 TS 的事实在 vendor/README 标注。
- **VD-4 高频 20 only**（2026-09-18 用户拍板"低频以后再说"）：components/ 仅 20+VChart 共
  21 份；复合组件并单文件（ElSelect 含 ElOption、ElForm 含 ElFormItem、ElTable 含
  ElTableColumn、ElRadio 含 ElRadioGroup、ElCheckbox 含 ElCheckboxGroup、ElLayout 含
  ElRow/ElCol/ElContainer 系）。低频组件在 components_index 留指引（查 EP 官方文档 +
  同类高频示例举一反三）。
- **VD-5 零重复**：token 速查（prompt-new §2 / style-skill 全量映射）不进 vendor——唯一入口
  references/design-language.md §1（gen-tokens 生成）；EP 覆盖映射（§10 / style-skill）不进
  vendor——bridge.css 已实现且页面禁 `:root`；vendor 文档内只放指针。
- **VD-6 转录源优先级**：模板/整页示例/规则/清单以参考实现为底本（TS→JS + 路径改写 + 语境
  注记）；prompt-new 仅补参考实现没有的部分（import 列、§3.3 图表用法、§3.4、mixed-chart
  素材、组件示例素材）。两者冲突时以参考实现 + 本 Spec 裁决为准。
- **VD-7 图表运行时**（沿用 2026-09-18 上轮拍板）：echarts 6.1.0 + vue-echarts 8.3.0 UMD 进
  preview/public/library/；loader moduleCache 加 `echarts`/`vue-echarts` 两键（全局名/子路径
  映射 Execute 期探测后定，回写 Execute Log）；peerDependencies 首步核验。
- **VD-7a 门禁 v-chart 放行**：build.mjs tag 检查对 EP 白名单 miss 后查 `CHART_TAGS =
  {'v-chart'}` 放行（kebab 场景；PascalCase 由 import 检查覆盖）。若实测 kebab 不出现则不引入。
- **VD-8 附录 A 清点**：全部组件 ∈ 118 白名单，例外（el-anchor 等）回 Spec 报告不静默放行。
- **VD-9 SKILL.md 轻整合**（2026-09-18 用户拍板）：③ 加"先查 vendor"直线（code-example 选
  整页起点 → vue-skill components 参考组件用法 → 生成 → 按 error-checklist 自检）；不引入
  仪式步骤；⓪-⑤ 结构与硬约束 0-3 不动；硬约束 4 改写为 vendor 已就位（只读）。
- **VD-10 示例可编译门禁**：vendor 全部 .vue（21 组件示例 + 4 模板 + 5 整页示例文件）逐文件
  过 build 门禁（临时 init 工作区放入 → build OK），证"抄走即用"。
- **VD-11 mixed-chart 冒烟**：浏览器级渲染验证（canvas 出现、零 JS 异常、boot-error 未触发）。
- **VD-12 vendor 自足 + design-language 升级路径**（2026-09-18 用户质询"尽可能不读
  design-language"，采纳但拆两对象）：目标 = vendor 对绝大多数常规页面生成自足（索引+规则+
  示例+模板），design-language/ 源树仅在升级路径时进（新组件形态/非常规布局/示例与需求对
  不上）；components_index 保留的规范路径列即升级入口。references/design-language.md 保留
  ——它是 gen-tokens.mjs 生成产物（GEN:TOKEN-TABLE 标记，与 default.css 同源），token 词汇
  唯一机械入口，抄进 vendor 反而违反零重复；要避免的是翻源树，不是读生成表。蒸馏规范散文
  进 vendor 会制造第二份会过期的规范，不做。
- **VD-13 示例 token 策略 + 组件规范对拍**（2026-09-18 用户质询"规范改了怎么办"）：示例只
  引用 token 名不引用值——值变自动跟随（token 体系目的，示例是受益者）；token 改名/删除由
  build 门禁拷入时捕获（unknown token + did-you-mean），E1 门禁循环在 token 重生成后可重跑
  全量暴露；示例保持最小（40-80 行），不固化偶发设计选择（如默认 size），当前默认值指向
  组件规范。模板/整页示例迁移时与 design-language 组件规范逐文件对拍，偏差修正记录入
  Execute Log——参考 vendor 符合我们组件规范是无根据假设，不照抄。

## 5.1 Open Questions

（无未决阻塞项。VD-7 全局名/VD-7a kebab 实测为 Execute 期探测后回写。）

## 6. Plan（契约 — 待 `Plan Approved`）

### 6.1 Target 结构（文件级，38 文件）

```
ep-coder/skills/generate-ux-prototype/
├── SKILL.md                                  # [改] ③ 查 vendor 直线；硬约束 4 改写
├── scripts/build.mjs                         # [改] ALLOWED_BARE +2；REQUIRED_HTML +2；CHART_TAGS（VD-7a）
├── scripts/preview/
│   ├── index.gts.html                        # [改] script ×2 + moduleCache 映射
│   └── public/library/
│       ├── echarts.min.js                    # [新] 6.1.0 UMD
│       └── vue-echarts.iife.min.js           # [新] 8.3.0 浏览器构建（名以实际产物为准）
└── vendor/                                   # [新] 替换 PLACEHOLDER.md
    ├── README.md                             # 顶层路由：两块职责 + 直线路径 + design-language 升级指针（VD-12）+ TS→JS 标注 + 来源版本
    ├── vue-skill/
    │   ├── SKILL.md                          # 块入口（导航 + 按需加载纪律；无工作流）
    │   ├── references/
    │   │   ├── components_index.md           # 分类索引 + import 列 + 高频20标记 + 封装清单（4.4 改造）
    │   │   ├── code-rules.md                 # codeRules 转写（JS 化 + bridge.css 注 + less/禁内联新规 + i18n/pinia 语境注）
    │   │   └── error-checklist.md            # errorChecklist 转写（JS 化）
    │   ├── templates/
    │   │   ├── README.md                     # 模板选型表（4 模板）
    │   │   ├── LeftInfoWithRightCard.vue     # [迁移+TS→JS]
    │   │   ├── SearchInfoWithRightCard.vue   # [迁移+TS→JS]
    │   │   ├── DashboardCards.vue            # [迁移+TS→JS；font-size-big token 核对]
    │   │   └── FormDialog.vue                # [迁移+TS→JS]
    │   └── components/                       # 高频 20 + VChart（新写，每份独立可运行 SFC）
    │       ├── ElButton.vue  ElInput.vue  ElSelect.vue  ElForm.vue  ElTable.vue
    │       ├── ElPagination.vue  ElDialog.vue  ElDrawer.vue  ElTooltip.vue  ElMessage.vue
    │       ├── ElNotification.vue  ElDatePicker.vue  ElRadio.vue  ElCheckbox.vue  ElSwitch.vue
    │       ├── ElTag.vue  ElCard.vue  ElLayout.vue  ElLoading.vue  ElEmpty.vue
    │       └── VChart.vue
    └── code-example/
        ├── SKILL.md                          # 按需加载纪律（每次 ≤2 文件、禁批量）
        └── references/
            ├── README.md                     # 索引（编号/用途/组件/路径 + 双索引 + 归档规范）
            ├── table-search-drawer/          # [迁移 TableSearchExample + TS→JS + 规范对拍]
            │   ├── index.vue
            │   └── components/{search-form,data-table,detail-drawer}.vue
            └── mixed-chart/                  # [新写] §11 示例2 + getComputedStyle 图表色
                └── index.vue
```

### 6.2 build.mjs 改造点（签名级）

1. `ALLOWED_BARE`（build.mjs:89）加 `'echarts'`、`'vue-echarts'`。
2. REQUIRED_HTML（build.mjs:130-137）加 echarts/vue-echarts 两条 script（文件名以 A2 产物为准）；
   Execute 期实测增补：`less.min.js` script + `vue-echarts.style.css` link 两项亦入必查
   （4.3 修正后的完整性要求）。
3. tag 检查（:266 区域）：EP 白名单 miss 后查 `CHART_TAGS`（VD-7a）。
4. 样式检查零改动（less 经正则检查兼容，4.2）；其余检查零改动。

### 6.3 预览运行时改造点

1. index.gts.html script 序列：element-plus locale 之后、sfc-loader 之前插 echarts → vue-echarts。
2. moduleCache 加 `echarts`/`vue-echarts`；子路径按探测结果（VD-7）。
3. 示例统一 `<VChart :option="..." autoresize />`，容器高走 less 类。

### 6.4 Checklist（原子）

**Phase A 图表运行时**
- [x] A1 核验 echarts 6.1.0 ↔ vue-echarts 8.3.0 peerDependencies；不兼容回 Spec
- [x] A2 拉 tgz → 提取 UMD/浏览器构建 → preview/public/library/（文件名以 dist 实际产物为准）
- [x] A3 index.gts.html script 标签 + moduleCache 映射（探测全局名/子路径，回写 Execute Log）
- [x] A4 冒烟：init 临时工程 + 最小 VChart 页 → build OK → headless Chrome canvas 出现、
      零 JS 异常、boot-error 未触发；同轮验证 `<style lang="less">` 页在预览正常编译渲染

**Phase B 门禁扩展**
- [x] B1 build.mjs 三处扩展（6.2）
- [x] B2 反向验证：echarts import 改前 FAIL/改后 OK；v-chart tag 放行实测

**Phase C vendor 落地**
- [x] C1 vendor/README.md（顶层路由：两块职责 + 直线路径 + design-language 升级指针
      （VD-12）+ TS→JS 标注 + 来源版本）
- [x] C2 vue-skill/SKILL.md 块入口 + code-example/SKILL.md
- [x] C3 components_index.md（参考实现底本 + import 列合并 + 高频标记 + 路径改写 design-language/
      根相对 + 图表段更新为 getComputedStyle 模式）
- [x] C4 code-rules.md（转写：JS 化 / 规则 2.2 改注 bridge.css 已实现 / 新增 less + 禁内联 /
      i18n·pinia 语境注 / 文件组织对齐 src/pages/{Page}/ 协议）
- [x] C5 error-checklist.md（JS 转写）
- [x] C6 templates/ 迁移 4+1 文件（typo 修正 + TS→JS；DashboardCards token 核对；组件规范
      逐文件对拍，偏差修正入 Execute Log——VD-13）
- [x] C7 components/ 21 份新写（§3.1 import 真值 + §9 约束 + 组件规范对拍落码 + less +
      无内联；复合组件并单文件）
- [x] C8 code-example/references/（README 索引 + table-search-drawer TS→JS + 组件规范对拍
      （VD-13）+ mixed-chart 新写含 getComputedStyle）

**Phase D 集成**
- [x] D1 SKILL.md ③ 直线 + 硬约束 4 改写（VD-9）
- [x] D2 全库 grep `gts`（排除 vendored library 与 index.gts.html 豁免）零命中
- [x] D3 只读证明：prompt-new.md / design-language/ / test/vendor/ mtime·内容不变
- [x] D4 零重复 grep：vendor 内无 token 值表（`#0067D1` 等 hex 速查、`--el-color-primary:` 映射
      声明不出现；代码内 hex 仅 getComputedStyle 方案不含）

**Phase E 验证收口**
- [x] E1 VD-10：vendor 全部 30 份 .vue 逐文件过 build 门禁（循环：init 临时工程 → 放入 → build OK）
- [x] E2 抽查对账：任取 3 份 vendor 文档与源（参考实现/prompt-new）语义对照零偏差；组件示例
      import 与白名单对账（抽样 ≥10）
- [x] E3 VD-11：mixed-chart 冒烟（canvas、零异常、boot-error 未触发）
- [x] E4 回写 Spec Execute Log + Plan-Execution Diff

### 6.5 Done Contract

1. E1 全部 30 份 .vue 过 build 门禁（含 echarts/vue-echarts import、v-chart tag、less 样式）。
2. A4/E3 冒烟：canvas 渲染、零 JS 异常、boot-error 未触发；less 页预览渲染正常。
3. D2/D3/D4 全过（grep 零命中 + 只读证明 + 零重复）。
4. E2 抽查零偏差。
5. vendor 文件数 = 6.1 树清点数（38）；附录 A ∈ 白名单（VD-8）。
6. gen-tokens --check 幂等不受影响（token 零改动）。

### 6.6 Risks

- **R-1** vue-echarts 浏览器构建形态未知（非标准 UMD 可能）→ A2 以 dist 实际产物为准；失败回
  Spec（备选 ESM+importmap）。
- **R-2** echarts 子路径（echarts/core 等）在 UMD 全局下映射不确定 → 示例统一单行
  `import VChart from 'vue-echarts'` 规避按需注册；探测后回写。
- **R-7（Execute 期新增，已消解）**：sfc-loader UMD 未内置 less 引擎（4.3 修正），已通过
  library 补 less.min.js + moduleCache 映射解决；A4 冒烟通过。 sass/scss/stylus 同样不可用，
  示例统一 less（VD-2）恰规避。
- **R-3** 参考实现模板的 token 名与 default.css 337 集合出入（font-size-big 等）→ build 门禁
  FAIL 捕获，转写时修正；修正记录入 Execute Log。
- **R-4** 21 份组件示例新写量大 → VD-10 门禁 + E2 对账兜底；每份保持最小可运行（40-80 行）。
- **R-5** less 在真实工程接入需项目自备 less 依赖 → src/README 或 vendor README 注记（交付件
  接入方须知）。
- **R-6** TableSearchExample 迁移后与 components_index/白名单对不上（组件名出入）→ E2 对账。

## 7. Innovate

**Skipped + Reason**：结构由用户拍板（fastui 三块对齐 + 参考实现为主源）；参考实现评估与
取舍（4.4）即为方案裁决记录，无额外分叉。

## 8. Execute Log

**执行时间**：2026-09-18（Plan Approved 后）～ 2026-09-20 收口。全部 21 项 checklist 完成，
Done Contract 6/6 满足。

### A+B 图表运行时与门禁（2026-09-18 完成）

- **A1**：vue-echarts 8.3.0 peerDeps `vue ^3.3.0 + echarts ^6.0.0`，与 vue 3.x + echarts 6.1.0 兼容，GO。
- **A2**：echarts.min.js（1.12 MB UMD，`window.echarts`）+ vue-echarts.iife.min.js（14.9 KB，
  全局名 `VueECharts`，dist 内仅此浏览器构建）+ vue-echarts.style.css（257 B，x-vue-echarts
  自定义元素容器尺寸必需）落 `preview/public/library/`（共 11 文件）。
- **A3 回写**：script 顺序 vue → dayjs → element-plus → icons → locale → **echarts.min.js →
  vue-echarts.iife.min.js → less.min.js** → sfc-loader；links 增 vue-echarts.style.css；
  moduleCache 增 `echarts`、`"vue-echarts": VueECharts`、`less` 三键。vue-echarts 必须在
  echarts 与 Vue 之后加载（IIFE 依赖全局）。
- **A4**：chart-smoke 冒烟通过——canvas 渲染、零 JS 异常、boot-error 未触发；less 页
  `.chart-page[data-v-…]` scoped hash 正常注入 DOM。
- **B1/B2**：ALLOWED_BARE 增 `echarts`/`vue-echarts`；REQUIRED_HTML 定稿 **10 项**（4 script
  新增含 less.min.js + vue-echarts.style.css link + 原有件）；kebab tag 检查对 `v-chart` 放行
  （`CHART_TAGS`）。反向验证：改前 FAIL（echarts import / v-chart tag / 缺 script 均实测报
  错）→ 改后 OK。
- **R-7 消解**（4.3 已修正）：sfc-loader 0.9.5 **less 非内置**——`Rn={less:…}` 仅为预处理器
  注册表，经 `r(329)` 消费，而 module 329 是 MODULE_NOT_FOUND stub。以 less@4.4.1 browser
  UMD 落 library 解决。sass/scss/stylus 同样不内置，示例统一 less 恰好规避。

### C vendor 落地（38 文件，与 6.1 树清点一致）

- **C1-C2**：顶层 README 直线路径 6 步 + design-language 升级指针；两块 SKILL.md 就位。
- **C3**：components_index.md 保留 GTS↔EP 映射表 + ★ 高频标记 + 规范路径列（升级入口，
  VD-12）+ 图表段 getComputedStyle 模式；自包件清单（顶部/侧边/锚点导航、列表、右键菜单、
  记分卡）。
- **C4**：code-rules.md 11 节；规则 2.1 收紧为显式导入（原"按需或全局注册"不匹配本架构）；
  2.2 改为"bridge.css 已完成全部映射，页面禁止 --el-* 覆盖与 :deep 主题改写"；2.3 ElDialog
  `draggable :close-on-click-modal="false"`；新增 3.1 less + 禁静态内联 style + 禁 :root；
  pinia/i18n 注明"预览运行时不含"。
- **C5**：error-checklist.md 21 组 ❌/✅。
- **C6 模板对拍记录（VD-13）**：4 模板 TS→JS；`flex-[1]`/`flex-[1.5]` Tailwind 类改 less
  （`flex: 1` + `&.card-wide { flex: 1.5 }`）；DashboardCards `min-height:100vh`→100%；
  FormDialog 修掉未用 `const props =`；静态内联 style 全部转 less 类。token 预核验：48 计划
  token 名 + 19 模板引用 token 与主题文件逐一比对，全部已定义（R-3 零命中）。
- **C7**：21 份组件示例新写，全过 §9 约束（无单例 use 函数、无 reactive 数组、kebab 文件名、
  每文件显式 import）；ElLoading 用 `defineOptions({ directives: { loading: ElLoading } })`
  局部注册；VChart 用 getComputedStyle 读 `--color-chart-1..3` + autoresize。ElButton 修正
  双 script 冲突（图标 import 收进 script setup）。
- **C8**：table-search-drawer TS→JS + 内联样式转 less 类（.input-keyword 200px 等）+ mock
  fetchData；mixed-chart 双 y 轴柱线 + getComputedStyle 取色 + ElCard 容器。

### D+E 集成验证（2026-09-20 收口）

- **D1**：SKILL.md ③ 加"先查 vendor"直线（整页起点 → 组件用法 → code-rules → error-checklist
  自检）；硬约束 4 由占位改写为 vendor 已就位（只读，不参与编译门禁）。⓪-⑤ 结构与硬约束
  0-3 未动（VD-9 兑现）。
- **D2**：vendor 内 grep `.gts`（豁免 index.gts.html）零命中。
- **D3**：只读证明——prompt-new.md mtime 14:19（早于 Spec 15:11）且 design-language/、
  test/vendor/ 均无晚于 Spec 的文件改动。
- **D4**：vendor 内 grep `#0067D1`/`--el-color-primary:` 零命中；.vue 内 hex 扫描零命中
  （getComputedStyle 方案本身不含 hex）。
- **E1**：26 组全 PASS（21 组件示例 + 4 模板 + code-example 树整体 = 覆盖全部 30 份 .vue；
  树内子组件随整页一并验证）。**门禁实际抓到 ElForm.vue 漏 import ElButton**（模板用而
  import 漏），已修正重跑——VD-10"抄走即用"防线实证有效。验证设施：.smoke-vendor/ 临时
  gate-run 工程 + e1-batch.mjs（会话产物，可复用于 token 重生成后的重跑）。
- **E2**：对拍 3 份——code-rules.md vs 参考 codeRules.md（2.1/2.2 收紧为有意偏差，其余忠实）；
  ElDialog.vue vs 组件规范/反馈类/对话框.md（draggable 约定一致、无冲突）；ElTable.vue +
  data-table.vue vs 组件规范/展示类/表格.md（stripe=斑马纹变体、ElEmpty 空态、表格/分页间距
  16px 一致）；按钮规范 loading/图标在 ElButton 示例有落码。组件示例 import 与白名单对账
  由 E1 门禁全量覆盖（白名单检查是 build 环节，非抽样），超额满足"抽样 ≥10"。
- **E3**：mixed-chart 冒烟（gate-run 工程重建页 + playwright-core + 本机 chromium-1228）：
  CANVAS_COUNT: 1、BOOT_ERROR: null、卡片标题可见、JS_ERRORS: none；截图确认双 y 轴柱线
  图例坐标轴完整渲染。
- **收口备注**：`.smoke-vendor/`（chart-smoke、gate-run、e1-batch.mjs、smoke-mixed-chart.cjs、
  playwright-core 安装）为本 Spec 会话验证产物，保留供后续 token 重生成后重跑 E1/E3；
  user 盘内容零删除（gate-run 空目录残骸为本会话自建产物，清理属自产物清理非用户内容）。
- **收口补验（2026-09-20）**：Done Contract 第 6 项实测——`gen-tokens.mjs <设计系统.md> --check`
  返回 OK（337 token，幂等不受影响）；R-5 落地——src/README.md 接入步骤补 `npm i -D less`
  与条件性 `npm i echarts vue-echarts`，vendor/README.md 源版本块补预览内置/工程自备的
  less 依赖分界说明。
- **Review 期缺陷捕获（2026-09-20）**：vendor/README.md 三处跨树相对路径层级错误
  （`../../references/`→`../references/`、`../../../design-language/`→`../../../../design-language/`、
  `../../scripts/`→`../scripts/`），已修正并实测全部解析成功；components_index.md 第 4 行
  "相对 skill 根"歧义措辞改为"相对 `design-language/` 源树根"。教训：C1 交付时未做路径
  解析验证——后续 vendor 文档新增跨树指针时须以 `ls` 实测为准。
- **整检第二轮（2026-09-20，用户质询"为啥还能验出问题"后）**：全量 md 相对路径程序化解析
  （8 文件 ALL RESOLVE）；components_index 示例对照表 ↔ 磁盘双向核对（21/21 一致，23 个
  ★ 中 2 个为归并标记非缺文件）；陈旧字符串扫描（待批准/占位/style-skill/fastui/编号引用）
  零命中；注释文档指引扫描零命中。**捕获 ElLoading.vue 运行时缺陷**：`directives: { loading:
  ElLoading }` 把命令式服务当指令注册——编译过、白名单过、零报错，但 v-loading 遮罩静默
  不出现。浏览器交互冒烟（点击开关）暴露，修正为 `ElLoadingDirective` 后实测遮罩出现/移除
  正常；error-checklist 增错误 3.2（服务当指令）。结论：编译门禁对"import 合法但语义错"
  无能为力，交互级冒烟是必要补充——已沉淀 smoke-el-loading.cjs 到 .smoke-vendor/。
- **模拟生成实战（2026-09-20，用户真实需求"事件管理页"驱动）**：直线路径实测——查索引
  （顶部/侧边/右侧栏 → 自封装；Tab/分页/明细表 → 高频示例）→ 写主文件+5 子组件（均 <500
  行）→ build 抓主文件漏 import（同 ElForm 模式，一轮修完）→ 浏览器验证。**捕获两个
  运行时级缺陷**：① **gen-tokens.mjs 模板注释含 `frost-*/` ——注释中 `*/` 提前闭合**，
  default.css 解析器把真正的 `html[data-theme="default"]` 规则块整个吞掉，**所有工程的主题
  token 全部静默失效**（EP fallback 色掩盖了症状，此前 A4/E3 冒烟只验 canvas/结构未验
  token 颜色故未暴露）。生成器已修正 + 重新生成 + 幂等 check 通过。② **ElPagination UMD
  2.13.5 传静态 `:current-page="1"` 且无任何监听器时静默不渲染**（defaultCurrentPage 或
  挂任意 listener 正常）——页面改为 ref 绑定 + @current-change（业务正确写法）。vendor
  ElPagination 示例本就带 @current-change（抄示例即规避），未改 vendor。教训：**token 颜色
  必须进冒烟断言**（本次已实测 brand 色贯穿 primary 按钮/logo/分页激活页/侧边选中态）；
  静态 prop 挂 EP 组件须带监听器或用 v-model 形态。

## 9. Review Verdict / Plan-Execution Diff

**结论**：执行与 Plan v3 一致，偏差均已回写 Spec 并有依据，Done Contract 全满足。

| # | 偏差 | 说明 | 定性 |
|---|---|---|---|
| 1 | sfc-loader less 非内置 | v2/v3 Spec 4.3 声明"内置 less"经浏览器冒烟证伪（R-7），§4.3 已改写为真相（registry + stub），方案改为 less.min.js 落 library | 计划事实错误修正，已回写 |
| 2 | REQUIRED_HTML 定稿 10 项 | 计划未给数目；执行期定为 10（含 less.min.js + vue-echarts.style.css） | 预期内的探测回写（A3） |
| 3 | E1 以"26 组"组织而非逐 30 文件 | code-example 5 份 .vue 以树为单位整体验证（页面入口 + 子组件同轮编译），等价且更贴近真实使用 | 执行组织方式差异，覆盖不减 |
| 4 | ElForm.vue 漏 import ElButton | 新写示例的真实缺陷，被 E1 门禁抓到并修正 | 门禁价值实证，非计划偏差 |
| 5 | 模板 Tailwind 类改 less、内联样式转类 | VD-2/规则 3.1 要求，计划已含"偏差修正"授权 | 预期内 |
| 6 | E2 对拍范围 | code-rules 2.1/2.2 为架构适配的有意改写（非源照抄），ElDialog/ElTable 零偏差 | 符合 VD-13"不照抄" |

无未回写的静默偏差。

## 10. Change Log

- 2026-09-18 15:11 首版 Spec（prompt-new §13 单层路线）。
- 2026-09-18 二轮重写（用户 6+5 条意见 + 参考实现把关后）：结构改为 fastui 三块对齐
  （VD-1）；转录主源切换为参考实现 `test/vendor/`（VD-6，prompt-new 降为辅源）；新增决策
  VD-2（less + 禁内联）/ VD-4（高频 20 only）/ VD-5（零重复三处不迁移）/ VD-10/VD-11
  （示例门禁与冒烟）；裁决记录：索引层保留规范路径列、代码层零规范引用（4.4）；采纳
  getComputedStyle 图表色模式（4.5）；style-skill 内容/analyze_image.py/9 步工作流不迁移。
  决策编号全面改用 VD- 前缀（与主 Spec D-1~D-22 隔离）。
- 2026-09-18 三轮修订（用户质询：以怀疑态度复检参考 vendor）：style-skill 块整体撤除、路由
  并入顶层 README（VD-1 修订，39→38 文件）；确立 vendor 自足 + design-language/ 源树升级
  路径模型，明确 design-language.md 为生成产物必须保留（VD-12）；确立示例 token 名引用策略
  + 模板/示例迁移组件规范逐文件对拍（VD-13，C6-C8 增工序）；Phase C 重编号。
- 2026-09-18 Execute 期修正：sfc-loader 0.9.5 less 非内置（v2/v3 4.3 声明证伪，R-7 新增即
  消解），§4.3 改写 + library 补 less.min.js + REQUIRED_HTML 10 项定稿（§6.2 注）。
- 2026-09-20 收口：21 项 checklist 全勾，Done Contract 6/6；Execute Log（§8）与
  Plan-Execution Diff（§9）回写；状态 Plan → Done。

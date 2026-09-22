# SDD Spec: generate-ux-prototype 二次开发友好增强（i18n / 深浅主题 / mock）

## 0. Open Questions（已裁决 2026-09-20）
- [x] Q1 i18n 路线 → **vue-i18n UMD**（用户选"vue-i18n UMD（推荐）"）
- [x] Q2 深色皮肤 → **等设计补表，但须整理缺失清单给设计师**（用户原话："可以等设计补表，但跟我说还缺什么啊，总结整理一下，我去跟设计师说"）→ 交付物含设计侧 intake 清单；不内置 dark.css
- [x] Q3 速度策略 → **按需启用**（用户未提国际化 → 直接中文；要求了 → key 化 + 词典）
- [x] Q4 mock 形态 → **api.js 服务层 + mock 数据**（Promise 语义化函数，换后端只改 api.js）

## 1. Requirements (Context)
- **Goal**: 让 skill `ep-coder/skills/generate-ux-prototype` 生成的交付物（`src/` + 预览）开箱具备三项二次开发友好能力：① 国际化切换 ② 深浅主题切换 ③ mock 数据层；硬约束：**不显著拖慢每次页面生成**。
- **In-Scope**:
  - skill 静态资产修订：`scripts/init.mjs` 脚手架、`scripts/preview/`（index.gts.html、src/ 脚手架、public/library/）、`SKILL.md`、`references/`、`scripts/verify`（如需）。
  - 生成约定（页面协议）与随 `src/` 交付的接入文档（`src/README.md`）。
  - 一次性环境资产（如需新 UMD 库文件：下载步骤 + ensure/setup-env 接线）。
- **Out-of-Scope**:
  - `vendor/`（只读，硬约束 4）。
  - design-language 真值源（`design-language/样式Token/设计系统.md`）的改动；深色 token 表的"设计补齐"不属于本任务。
  - 真实后端对接、pinia、路由。
  - gen-tokens.mjs 生成器逻辑（除非深色皮肤决策要求其产出 dark 皮肤——届时另立决策）。

## 1.1 Context Sources
- Requirement Source: 本会话用户需求（2026-09-20）："生成的代码方便别人进行二次开发，想要国际化切换、深浅主题切换、mock 数据……且不会让代码生成过程很慢"
- Prior Spec（真相源，D-1~D-22）: `spec/specs/2026-09-17_17-37_ep-coder-generate-ux-prototype.md`
- Design Refs: `references/design-language.md`（消费指南）；`design-language/样式Token/设计系统.md`（真值源）
- Chat/Business Refs: 记忆 `project-generate-ux-prototype`（gen-tokens 注释闭合教训、UMD 下 defineExpose 陷阱）、`skill-output-style`（产出卫生）

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: `feature`（inline，不落独立 codemap 文件——地形已在旧 Spec + 本轮直读中覆盖，重复建图无增益）
- Key Index:
  - 脚手架源头: `scripts/preview/src/`（main.js、App.vue 由 init 写入目标、assets/themes 三件套、README.md）→ `scripts/init.mjs` cpSync 到每个工程
  - init 写入物: `init.mjs:98-140` 内嵌 starter 页面与 App.vue 模板字符串
  - 预览加载器: `index.gts.html`（FIXED 骨架；模块缓存 `moduleCache` 在 options 对象；已有 `window.setTheme`）
  - 换肤机制（已存在）: `src/assets/themes/README.md` 协议（一皮肤一文件、`html[data-theme="{name}"]`、换肤插槽 link、`--ux-mix-base` 深色注意）
  - 桥接层: `bridge.css`（FIXED）token→`--el-*` 全对位，深浅皮肤自动跟随，无需 EP dark
  - build 门禁: `build.mjs`（编译全 src 下 .vue/.js/.css/.json；禁 :root/[data-theme] 选择器于页面样式；hex 检查）；`build-data.mjs` collectSources 递归全 src 文本文件——新增 `i18n/`、`mock/`、`locales` 文件自动纳入预览与门禁，无需改脚本
  - i18n 现状: vendor `code-rules.md` 规则 10（真实工程 vue-i18n，key ≥3 个 `.`）；预览运行时**无 vue-i18n**；现约定"原型阶段写中文可接受"
  - mock 现状: starter 页仅 `// TODO: mock 数据` 注释；vendor 示例数据内联于组件；无服务层约定
  - EP locale: 预览仅 `element-plus-locale-zh-cn.min.js`；main.js 接线示例 `app.use(ElementPlus, { locale: zhCn })`

## 1.7 Minimum Chaos Unit Assessment
- Final Goal: 见 §1 Goal
- Current Task Unit: skill 资产与约定的增量修订（一次交付），含 4 个待决策分叉（§0）
- Why this unit is small enough: 全部改动落在已知文件集合（脚手架模板 + 2~3 个文档 + 可选 1~2 个库文件）；不动生成器主链路（gen-tokens/build 核心逻辑）；每项能力可独立验证
- In-Scope Boundary: §1 In-Scope
- Out-of-Scope Boundary: §1 Out-of-Scope
- Verification Evidence: `node scripts/build.mjs --dir` 对试点工程 RESULT: OK；预览 HTML 冒烟（主题/语言切换可见生效）；src/ 拷入真实工程路径的 README 步骤自洽
- Failure / Rework Plan: 任一能力冒烟失败回 Research 修订方案；分叉决策被推翻则回 Innovate 重选
- Model Autonomy Space: 分叉决策确定后的文件实现与 build 修复循环
- User Decision: 待分叉决策（§0 Q1~Q4）

## 2. Research Findings
### 事实
- F1 **换肤机制已齐备**：皮肤协议、换肤插槽、`window.setTheme`、`--ux-mix-base` 深色注意点全在；桥接层使 EP 自动跟随。缺的只有：默认第二皮肤（dark）、可见的切换 UI、以及"生成页面对深色的适配纪律"（页面已全程走 token，理论上深色即换 token 集）。
- F2 **深色 token 无真值源**：`设计系统.md:61` "本包没有完整深色 UI 色表；有深色需求时先补齐定义"；多处强调"深色值不代表完整深色 UI"、"状态不可推导"。→ 内置 dark.css 必然是"推导值"，与真值源纪律冲突，需用户显式裁决。
- F3 **i18n 现状**：预览无 vue-i18n；vendor 规则 10 已定 key 规范（`{msg.模块.分类.语义}`，≥3 个 `.`）与 vue-i18n 用法——真实工程接口已固定为 vue-i18n，原型层怎么接是要点。
- F4 **mock 现状**：无约定；数据内联。二次开发痛点 = 换真实接口时要在组件里翻数据。
- F5 **新增文件零脚本成本**：build-data 递归收集 src 下所有 .vue/.js/.css/.json；build.mjs 编译同一集合。加 `i18n/`、`mock/`、词典文件不改脚本即被预览+门禁覆盖。
- F6 **一次性 vs 每页成本**：主题切换 UI、i18n shim/库、EP en locale 均为脚手架/资产级（一次）；每页增量只有：文案 key 化 + 词典（一次翻译产出）+ mock/api 两个小文件（替代原内联数据，近似中性）。
- F7 **交付文档落点**：`scripts/preview/src/README.md` 随每个工程拷贝为 `src/README.md`——二次开发者第一入口；SKILL.md 是生成 agent 的规则入口。二者是约定的自然落点。

### 分叉与候选（对应 §0）
- **Q1 i18n**：
  - A 自研 shim（`src/i18n/index.js` 提供 `t()`/`setLocale`，词典文件 vue-i18n 兼容格式）：零新依赖、预览离线可用；真实工程需换 import（API 设计成 vue-i18n 子集则迁移机械）。
  - B 预览库加 vue-i18n UMD（`vue-i18n.global.prod.js` + moduleCache 映射）：src/ 与真实工程同 API（`useI18n`），拷入即用；一次性成本 = 下载资产 + ensure/setup-env 接线 + 冒险（UMD×sfc-loader 组合需冒烟验证，R-1）。
  - C 不做运行时切换：只约定文案 key 化 + 词典文件，切换留给真实工程。最省但预览里看不到切换效果。
- **Q2 深色皮肤**：
  - A 只交机制（切 API + 文档）：零违规，但"深浅切换"无开箱效果。
  - B best-effort 示例 `dark.css`：开箱可切；明确标注"示例值、非规范、待设计表替换"（违真值源纪律，需用户接受）。
  - C 阻塞等设计补深色表：本项挂起。
- **Q3 速度策略**：a 默认全量 i18n；b 按需（SKILL.md 规定"用户未要求国际化→直接中文"，要了才走 key+词典）；c 默认 i18n 但 en 允许占位。
- **Q4 mock**：a 页面内 `mock/` 数据 + `api.js` 服务层（返回 Promise，语义化函数名），换后端只改 api.js；b 仅数据文件；c 全局拦截器（过设计，不推荐）。

### 风险与不确定项
- R-1 vue-i18n UMD 在 vue3-sfc-loader/moduleCache 下的导出映射（named exports）未验证——选 Q1-B 则先做最小冒烟。
- R-2 EP en locale 需新增 `public/library/element-plus-locale-en.min.js` 资产 + index.gts.html 接线（若做 EP 文案跟随）。
- R-3 best-effort dark.css 若进入默认交付，存在被误当规范值复用的风险——须在文件头与 README 双重标注。
- R-4 预览切换 UI 放 index.gts.html（FIXED 层）还是 src/App.vue（随源码交付）：倾向前者（不污染交付物、骨架级能力），Plan 里定。

## 2.1 Next Actions
- ~~Plan 已落盘（§4）。等 `Plan Approved` → Execute（按 §4.3 checklist）。~~ 已执行完毕（2026-09-21，见 §5）。
- **交付深色主题工作文档给用户转设计师**：`ep-coder/skills/generate-ux-prototype/references/dark-theme-intake.md`（工作指南 A + 缺失清单 B + 验收标准 C）。
- 试点残留待用户裁决：`.uxproto-pilot/` 下 pilot-dev-friendly/-v2/-v3/-final/-final2 为调试残留，pilot-final3 为验证基准（复跑设施），smoke 脚本随基准保留。硬约束 0 禁删，未擅动。

## 7. Plan-Execution Diff
- 2026-09-20 Plan 修订 1（执行前）：dark-theme-intake.md 由"缺失清单"升级为"工作指南（怎么在 design-language 基础上改：改真值源文档 → 跑 gen-tokens 生成器 → 工程接线，设计师不碰代码）+ 缺失清单 + 验收标准"。来源：用户反馈"想让设计师明确知道怎么在 design-language 的基础上改"。
- 执行偏差 1（2026-09-21）：`build.mjs` ALLOWED_BARE 加 `'vue-i18n'`（一行）——§4.1 写"不动 build.mjs"是疏漏：src 内 bare import `vue-i18n` 必经构建门禁白名单。机械必经，无行为影响。
- 执行偏差 2：EP locale 引入方式从 §4.1 设想的"window 全局接线"落为 `import ... from 'element-plus/es/locale/lang/{zh-cn,en}'` + moduleCache 两条子路径映射 + App.vue `<ElConfigProvider :locale="EP_LOCALES[locale]">`。初版 window 映射方案过度设计，实现时废弃重写。
- 执行偏差 3：i18n/index.js 注释与文档**不得出现 import 语法形态的示例文本**——build 门禁 import 扫描器会连注释一起扫（`import { setLocale } from '@/i18n'` 示例即触发 bare import 报错）。已改为自然语言描述。
- 执行偏差 4：init 模板正确性修复轮——starter/App.vue 漏显式 import EP 组件（build 16 错）、`--font-size-xlarge` 不存在（真值源档位为 small/normal/normal1/medium/big/big1/big2，改 normal1）、App.vue 补装顺序（见 §5 E-2）。
- 执行偏差 5：i18n 启用形态——Plan 说"默认生成非 i18n 页面（直接中文）"，实现为**词典体系常驻脚手架、starter 页面直接走 key**（演示即启用态）；SKILL.md 判据相应改写为"用户没提国际化→可保留 key 或直写中文，要求时补 en 词典即可"。对生成速度无影响（key 化是模板自带，非每页增量工作）。
- 验证基线：试点工程 `pilot-final3`（全新 init + build RESULT: OK + CDP 冒烟 12/12 PASS），复跑设施随目录保留。
- 执行偏差 6（2026-09-21，用户反馈）：App.vue 切换 UI 从"语言/主题单选按钮组平铺"改为**图标占位按钮 toggle**——语言钮文本显示目标语言（中文环境显 EN / 英文环境显 中文），深浅钮 Moon/Sunny 图标摆动 default↔dark；tooltip 提示 + aria-label 兜底。词典 key 复用为 tooltip/aria 文案。验证基线更新为 `pilot-final4`（build OK + CDP 冒烟 16/16 PASS，含 toggle 双向与持久化断言）。
- 执行偏差 7（2026-09-21，用户质询"为什么切换功能和样式要写在 init.mjs 里"）：**按需启用回归裁决本意**——默认工程不再含任何切换 UI 与 i18n 装配：
  - `init.mjs` App.vue 还原为最小壳（只挂载页面）；starter 页还原为直接中文（Q3 原文"改动为零"）；
  - `main.js` 去掉 `app.use(i18n)`，EP 内置文案改由 `app.use(ElementPlus, { locale: zhCn })` 默认中文（不依赖 i18n 即有正确 EP 文案）；
  - i18n 装配（`i18n-scaffold/`，逐字拷贝版）移出默认脚手架，另存 `scripts/preview/i18n-scaffold/` 供按需拷贝；
  - 已验证的 toggle 实现沉淀为 `references/on-demand-toggle.md`（含幂等补装须先于 `useI18n` 等关键约束），SKILL.md 判据更新：**切换功能用户描述才出现，UI 形态由用户决定**；
  - 双路径验证：默认 `pilot-final5`（无工具条断言 + 直写中文断言，build OK + 冒烟 10/10）与按需启用 `pilot-final5-i18n`（拷贝 scaffold + 参考实现接入，build OK + 冒烟 16/16，含 i18n+toggle 完整链路）。

## 3. Innovate (Options & Decision)
### 决策（2026-09-20，用户裁决）
- **Q1 i18n = vue-i18n UMD**：src/ 与真实工程同 API（`useI18n` + 词典），拷入零迁移。版本取 **9.14.5**（npmmirror dist-tag `stable9`；peer `vue ^3.0.0` 匹配预览 vue 3.4；v11 线要求更高 vue 基线，不取）。风险 R-1 由冒烟先行收敛。
- **Q2 深色 = 等设计补表**：不内置 dark.css（遵守真值源纪律）。代价补偿：产出**深色 UI 定义缺失清单**（给设计师的 intake 文档），并保留现有一键换肤机制文档。
- **Q3 速度 = 按需启用**：SKILL.md 写明判据——用户未提国际化 → 页面直接写中文（现状不变，最快）；用户要求 → 该工程启用 key 化 + `src/i18n/` 词典 + 切换入口。SKILL.md 加"启用 i18n 时必须做的最小集"清单。
- **Q4 mock = api.js 服务层**：`src/api/{name}.js` 暴露语义化 Promise 函数；`src/api/mock/` 放数据。换真实后端只改 api/*.js 实现（或删 mock 前缀改 axios），组件零改动。约定进 SKILL.md + code-rules 引用 + README。
### 落选项理由
- 自研 shim：与 vendor 规则 10（真实工程 vue-i18n）双轨，二次开发要迁移。
- 仅 key 化：预览看不到切换，"开箱"不成立。
- 默认全量 i18n：多数原型用不上，每页多一轮翻译拖慢生成。
- best-effort dark.css / 全局 mock 拦截器：分别违真值源纪律 / 过度设计。

## 4. Plan (Contract)
### 4.1 File Changes
- **新增** `scripts/preview/public/library/vue-i18n.global.prod.js`：vue-i18n 9.14.5 UMD（从 npmmirror tarball 提取 `dist/vue-i18n.global.prod.js`，sha512 校验 `a157749c...` 见 registry）。**一次性资产。**
- **新增** `scripts/preview/public/library/element-plus-locale-en.min.js`：EP 2.13.5 `dist/locale/en.min.js`（与现有 zh-cn 文件同批次同源提取）。**一次性资产。**
- **修改** `scripts/preview/index.gts.html`：
  - 运行时区追加 `<script src="./public/library/vue-i18n.global.prod.js"></script>` 与 `<script src="./public/library/element-plus-locale-en.min.js"></script>`；
  - moduleCache 增加 `"vue-i18n": VueI18nDflt` 映射（实际全局名以冒烟确认为准，R-1）；
  - 不改加载器其他逻辑（保持 FIXED 区最小侵入）。
- **新增** `scripts/preview/src/i18n/index.js`（脚手架模板，随工程拷贝）：createI18n 装配 + locale 持久化（localStorage key `uxproto-locale`）+ `SUPPORTED_LOCALES = ['zh-cn','en']`；词典从 `./locales/{locale}.js` import。
- **新增** `scripts/preview/src/i18n/locales/zh-cn.js` 与 `en.js`：按 vendor 规则 10 命名（`msg.{page}.{category}.{semantic}`，≥3 个 `.`），starter 只放最小样例。
- **修改** `scripts/init.mjs`：
  - starter 页面模板改为演示三能力的小页面：搜索框 + 表格（api 服务层取数）+ 主题/语言切换按钮（调 App.vue expose 的 `setLocale`/`setTheme`，或直接调模块函数——以实现简明为准，签名见 4.2）；
  - `i18n` 启用形态按 Q3：**默认生成非 i18n 页面**（直接中文），SKILL.md 判据触发时才把页面文案换 key 化（脚手架 i18n/index.js 始终在 src/ 中，不启用也不碍事）。
- **修改** `scripts/preview/src/main.js`：追加 vue-i18n 接入示例（`app.use(i18n)`）+ EP locale 跟随（`i18n.global.locale` 变化时切 `--el-locale`——实现为注释示例 + 简明接线，签名见 4.2）。
- **新增** `scripts/preview/src/api/demo.js` + `scripts/preview/src/api/mock/demo-data.js`：starter 演示用服务层样例（Promise 函数 + 数据分离）。
- **修改** `scripts/preview/src/App.vue`（init 写入）：挂主题/语言切换演示 UI（app 级，页面级不重复）。
- **修改** `scripts/preview/src/README.md`：追加三节——i18n 接入与切换、主题切换 API 与新增皮肤、mock→真实接口迁移步骤（改 api/ 实现即可）。
- **修改** `SKILL.md`：
  - 工作流 ③ 增补：i18n 按需判据 + 启用最小集；mock 服务层约定（数据一律走 `src/api/`，页面不直接 import mock 数据文件）；
  - 硬约束 3 增补：文案 key 规则引用（i18n 启用时）；
  - 已知边界更新：深色皮肤"等设计补表"状态与 intake 清单指针。
- **新增** `references/dark-theme-intake.md`：**给设计师的深色主题工作文档**（Q2 补偿交付物；受众=人类设计师，写法面向行动）。两部分：
  - **A. 怎么在 design-language 基础上改（工作指南）**：
    1. 改哪里：值一律补进真值源 `design-language/样式Token/设计系统.md` 对应 token 组小节（新增"深色值"列或深色小节），不另建文档——真值源纪律；
    2. 格式：沿用现有浅色表结构（Token | 用途 | 值）；**派生态必须显式给全**（悬停/按下/禁用/获焦等不推导，每组给完整态）；
    3. 流向：设计文档改完 → 工程侧跑 `scripts/gen-tokens.mjs` 从文档重新生成皮肤 css（深色皮肤将生成为新皮肤文件，工程接线，设计师不碰代码）；
    4. 工程契约（设计师需知的约束）：皮肤作用域 `html[data-theme="dark"]`、必须提供桥接层消费的全部语义 token（缺一个即构建失败，fail-fast 防漏）；`--ux-mix-base` 只需给一个深色表面色值（EP light-N 色阶由桥接层 color-mix 自动派生，设计师无须手给 N 阶）。
  - **B. 缺什么（逐组清单）**：深色已定义（frost 材质、代码区、边框宽度）vs 未定义需补（品牌色 5 态、文本 5 级、图标 9 态、边框 6 项、背景 6 项、填充 6 项、功能色 5 组×2、表格 3 项、shadow 6、基础色板深色变体是否需要）+ 依据（`设计系统.md` 各节"深色未定义"声明行）。
  - 附**验收标准**（设计交付的 Done contract）：文档各组有深色值 → gen-tokens 生成 dark 皮肤 → 预览 `data-theme="dark"` 无未定义 token 报错 → 浏览器冒烟颜色正确。
- **不动**：`bridge.css`、`base.css`、`default.css`、`gen-tokens.mjs`、`build.mjs`、`build-data.mjs`、`vendor/`。

### 4.2 Signatures
- `scripts/preview/src/i18n/index.js`:
  - `export const SUPPORTED_LOCALES: string[]`（`['zh-cn','en']`）
  - `export const i18n: I18n`（createI18n 实例，legacy: false，fallbackLocale: 'zh-cn'，messages 预装配 zh-cn+en）
  - `export function setLocale(locale: string): void`（校验 ∈ SUPPORTED_LOCALES → i18n.global.locale 赋值 → EP locale 全局替换 → localStorage 持久化）
  - `export function getLocale(): string`
- `scripts/preview/src/api/demo.js`:
  - `export function getDemoList(params: { keyword?: string; page: number; pageSize: number }): Promise<{ list: object[]; total: number }>`（返回延迟 Promise，读 mock/demo-data.js）
- 词典文件：`export default { 'msg.demo.search.placeholder': '…', ... }`（扁平 key，vue-i18n 兼容）

### 4.3 Implementation Checklist
- [ ] 1. 资产获取：下载 vue-i18n 9.14.5 tarball 提取 UMD；从既有 EP 2.13.5 包路径提取 en locale（npmmirror tarball）。落 `scripts/preview/public/library/`。
- [ ] 2. R-1 冒烟：临时工程验证 vue-i18n UMD 在 vue3-sfc-loader/moduleCache 下 named import 可用（`useI18n`）+ EP en locale 全局名。失败则回 Research 改方案（备选：shim）。
- [ ] 3. index.gts.html 接线（script 标签 + moduleCache）。
- [ ] 4. 脚手架文件：i18n/index.js + locales/{zh-cn,en}.js + api/demo.js + api/mock/demo-data.js。
- [ ] 5. init.mjs starter 页/App.vue 模板更新（三能力演示 + 按需 i18n 形态）。
- [ ] 6. main.js 接入示例更新。
- [ ] 7. SKILL.md 规则更新（判据 + 最小集 + mock 约定 + 边界）。
- [ ] 8. references/dark-theme-intake.md 编写（工作指南 + 缺失清单 + 验收标准，受众=设计师）。
- [ ] 9. src/README.md 三节接入文档。
- [ ] 10. 端到端验证：init 试点工程 → build RESULT: OK → 预览冒烟（主题切换生效、语言切换生效含 EP 文案、mock 取数渲染、深色提示条不出现）。

## 5. Execute Log（2026-09-21 收口）
- [x] 1. 资产获取 —— vue-i18n 9.14.5 UMD（`VueI18n` 全局，12 命名导出）+ EP 2.13.5 `element-plus-locale-en.min.js`（全局 `ElementPlusLocaleEn`，`name:'en'`）落 `public/library/`，sha512 均验证。
- [x] 2. R-1 冒烟（node vm）—— UMD 在 Vue 全局先载后挂载；`createI18n` / `app.use` / `useI18n` 链路通；`i18n.global.locale` 是 ref，`.value` 切换响应式生效。R-1 消除，无需 shim 备选。
- [x] 3. index.gts.html 接线 —— head 两行 script（en locale、vue-i18n，插在 zh-cn 之后）+ moduleCache 三条映射（`"vue-i18n": VueI18n`、`"element-plus/es/locale/lang/zh-cn"`、`".../en"`）。见 §7 偏差 1/2。
- [x] 4. 脚手架文件 —— `src/i18n/index.js`（createI18n + setLocale/getLocale + EP_LOCALES + localStorage `uxproto-locale`）、`locales/{zh-cn,en}.js`（11 key 样例，两文件 key 集合一致）、`api/demo.js`（getDeviceList，delay(200) Promise）、`api/mock/demo-data.js`（12 条）。
- [x] 5. init.mjs starter/App.vue 模板 —— 表格+搜索+分页演示页；App.vue 工具条（语言 zh-cn/EN、主题 default/dark-disabled）+ ElConfigProvider。修复见 §7 偏差 4。
- [x] 6. main.js —— `app.use(i18n)` 接入示例；EP 文案走 ElConfigProvider（不重复接线）；依赖注释补 `vue-i18n@^9.14`。
- [x] 7. SKILL.md —— ③ 增三节（数据走服务层 / i18n 按需判据+最小集 / 主题切换机制+intake 指针）；已知边界更新深色状态。
- [x] 8. references/dark-theme-intake.md —— A 工作指南 / B 12 组缺失清单（含真值源出处）/ C 验收 4 条。
- [x] 9. src/README.md —— 目录结构（i18n/、api/）+ 接入步骤补依赖 + 国际化/主题/mock→真实接口三节。
- [x] 10. 端到端验证 —— 试点 `pilot-final3`：全新 init → build RESULT: OK（0 WARN）→ CDP 无头 Chrome 冒烟 12/12 PASS（挂载、mock 10 行、zh 词典、EP zh 文案、default 主题+token 值、dark 容忍、4 切换控件、en 词典、EP en 跟随、locale 持久化）。

### 执行排障记录
- **E-1 裸 import 无 moduleCache 映射 → loader 静默挂死**：`import from 'vue-i18n'` 缺映射时 vue3-sfc-loader promise 永不 resolve，无 rejection、无 console 错误，async 组件渲染为空注释占位（`app=<!---->`）。二分 18 轮定位。**修**：补映射。**沉淀：sfc-loader 下每个 bare specifier 必须有 moduleCache 条目，挂死即先查它。**
- **E-2 `useI18n()` 抛 `Error: 27`（NOT_INSTALLED）**：预览不执行 main.js，插件从未 `app.use`；且补装必须**先于** `useI18n()`（首次写在后面仍 27）。**修**：App.vue setup 首行幂等补装（`__VUE_I18N_SYMBOL__` 判据），真实工程 main.js 已装则自动跳过。
- **E-3 冒烟脚本自身缺陷**：`--dump-dom` 早于异步编译输出（不可用）；THEME MISSING banner 显示条件是 `html:not([data-theme])`，设 `data-theme="dark"` 不会触发（断言改为 dark 容忍）；localStorage 残留跨轮污染（`uxproto-locale=en` 导致 zh 断言假失败）→ 冒烟前 `localStorage.clear()` + 重载。

## 9. Project Sync Candidates
- 新 chat 路由检查：工作区根 `d:\cyc\project\octo\gts\test` 无 AGENTS.md/CLAUDE.md 路由入口（仅 octo-agent-dev/ 下有）——收口时向用户建议是否补默认 prompt 文档，未经同意不写入。
- 本任务结论若成立，候选沉淀：记忆 `project-generate-ux-prototype` 追加 D 决策行。

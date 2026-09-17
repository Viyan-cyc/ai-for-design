---
name: generate-ux-prototype
description: 生成或修改 G Design 页面原型：真实 Vue 3 + Element Plus 2.13.5 源码工作区（.vue SFC 纯 JS + api 适配层 + mock + i18n + 零构建离线预览，可拷入真实工程二次开发）。接受文字需求、模块描述、截图、Raw HTML。Triggers: 页面生成、原型、Vue 页面、Element Plus、列表页、看板、截图转码.
version: 1.1.0
---

# 生成 G Design 原型（Vue 3 源码交付）

交付件 = **真实 Vue 3 源码工作区**：`.vue` SFC（`<script setup>` 纯 JS）+ Less + 标准 ESM import，写在 `{slug}/src/` 下，可直接拷入任何 Vue 3 + Element Plus + Vite 工程二次开发；附带零构建离线预览 `{slug}/index.html`（浏览器直接打开）。对话以单个 `<artifact>` 链接结束。

资产库是独立分发包 `assets/`（设计侧维护：design-language 设计真值、pattern、el-docs、token 管线产物都在里面，更新后设计侧自行跑 `assets/scripts/` 再生；本 skill 只读消费）。**skill 与 assets 各自分发、任意放置**：init 从自身位置逐级向上自动定位资产包并输出 `ASSETS_ROOT:`，本文所有 `assets/…` 路径一律相对该根；跨盘/不在上级时 `--assets-root <dir>` 指定一次即被记住（存 skill 根 `assets-path.json`）。token CSS 全部在生成时现取；设计规范真值在包内 `design-language/`（设计师迭代处）。

## 技术栈（钉死，无开关）

- Vue 3（`<script setup>` 纯 JS 无 TS）+ Element Plus **2.13.5**（唯一 runtime）+ Vue Router 4 + Less + px
- 裸 import 白名单仅四项：`vue` / `vue-router` / `element-plus` / `dayjs`（+ element-plus 子路径；`less` 仅为构建期依赖）。**图标一律走 fetch_icons（IconPlus/Lucide），禁止 `@element-plus/icons-vue`**

## Output Contract（READ FIRST）

`init.mjs` 初始化出的工作区结构（**init 只创建必要文件，其余按需创建**）：

```
{slug}/
├── index.html                       # 离线预览加载器（FIXED）
├── preview-data.js                  # 源码映射（build 自动生成，FIXED）
├── mock/modules/{slug}.js           # Mock API（init 必建，与 src 同级）
├── public/library/element-plus/     # EP 2.13.5 预览运行时 UMD（FIXED）
└── src/                             # ★ 交付件
    ├── main.js                      # 工程入口（FIXED）
    ├── App.vue                      # 应用壳：路由出口（init 生成）
    ├── api/{slug}.js                # ★ 接口适配层（init 必建；二开唯一必改文件）
    ├── assets/tokens/               # ★ 资产库 token 全套（init 现取复制，勿手改）
    ├── assets/style/base.less       # Less 基础样式（FIXED）
    ├── assets/themes/               # 皮肤插槽（base.css + README 协议；自定义皮肤放这里）
    ├── assets/images/ uploads/ icons/  # 按需创建素材；icons/ 存 IconPlus/Lucide 图标（fetch_icons.mjs 写入 *.svg + 自动生成 barrel index.js）
    ├── locales/                     # 全部语言资源（init 必建：lang/{zh-CN,en-US}/common.json + pages/{slug}.js + index.js）
    ├── router/index.js              # 路由（init 必建 — 路径与 history 模式 FIXED，仅 routes 条目可编辑；见下文白页防线）
    ├── views/{slug}/                # ★ 页面主目录（init 必建）
    │   ├── index.vue                # 页面主组件（starter，替换它）
    │   └── js/constants.js          # 页面常量
    └── components/                  # 跨页复用组件（按需创建）
```

**Editable vs FIXED:**
- **You edit ONLY:** `views/**`、`components/**`、`api/**`、`locales/**`、`router/index.js`（仅路由表条目）、`mock/**`、`assets/uploads/`、`assets/images/`、`assets/icons/`（IconPlus/Lucide 图标及 fetch_icons 生成的 barrel index.js）、`assets/themes/`（皮肤文件）。
- **FIXED:** `main.js`、`App.vue`、`assets/tokens/`、`assets/style/base.less`、`public/`、`index.html`、`preview-data.js`、`router/index.js` 的文件路径与 history 模式。

**router/index.js 硬约束（白页防线）：** `index.html` 预览加载器按固定路径 `/src/router/index.js` 加载路由模块。不得挪动、改名、内联到 main.js，不得把 `createWebHashHistory` 换成 `createWebHistory`（file:// 下路由匹配失败 → 白页）。只准往 `routes` 数组里加条目。build.mjs 强制校验三项：文件存在、调用 `createRouter`、history 必须是 `createWebHashHistory` 或 `createMemoryHistory`。

## HARD RULES（src/ 内代码约束，细则见 [references/code-conventions.md](references/code-conventions.md)）

- 标准 ESM：`import { ref } from 'vue'`、`import { ElMessage } from 'element-plus'`；相对路径 import 子组件。
- 颜色一律资产库 token 变量 `var(--color-*)`（尺寸/字体/投影用 `--space-size-*`/`--radius-size-*`/`--font-size-*`/`--shadow-*`）；Element Plus 组件用语义 `type` prop。
- `<style lang="less" scoped>`；**禁止静态内联 `style="..."`**（`:style` 动态绑定允许）；SFC 样式内禁止定义 `:root`、`[data-theme]`、资产 token（页面局部变量用 `--page-*` 前缀）。
- 单位一律 px；全工作区禁止 scss / `lang="scss"`。
- 页面流式自适应（默认：容器不写死宽度 + 栅格断点；实现细则见 code-conventions「自适应规范」，设计真值在 design-language 响应式与无障碍.md）。
- 页面与组件**只准从 `src/api/{slug}.js` 取数**，禁止 import `mock/modules`（build 强制校验）。

## 读纪律（默认一律不读，命中才读；本 session 已读的文件禁重读）

| 场景 | 读什么 | 位置 |
| --- | --- | --- |
| 列表页（筛选 + 表格 + 分页，设备/工单/任务/用户等一切查询场景） | [pattern-list-page.md](../../assets/patterns/pattern-list-page.md) 先读再落笔；五段骨架 + 数据编排 + 状态列映射（STATUS_MAP 节） | `assets/patterns/` |
| 取数 / 保存 / 删除 / 批量等异步或写操作（**必读**；弹窗表单读其反馈细则节） | [pattern-states-feedback.md](../../assets/patterns/pattern-states-feedback.md) 六态壳 + 反馈闭环 | `assets/patterns/` |
| 纯静态展示页（无取数、无写操作） | 不读 pattern，遵守 code-conventions 即可 | — |
| 组件的用途/状态/"不要"（设计语义拿不准） | 对应组件规范（入口 `组件索引.md`） | `assets/design-language/组件规范/` |
| 组件方言写法拿不准 | 方言文档（探测：仅 el-form/el-dialog/el-tag 三篇存在） | `assets/frontend/element-plus/docs/` |
| 毛玻璃需求 | 设计系统 §7（档位/预算/装饰；§7.6 色块装饰判断）+ `query_tokens.mjs --search frost` | `assets/design-language/样式Token/设计系统.md#frosted-glass` |

- 模式覆盖：查询列表/设备管理/新建编辑由两篇 pattern 覆盖；详情/报警/拓扑类页面仍读 pattern-states-feedback.md（六态与反馈对所有页面类型生效）。
- **探测不到 = 无坑**：方言文档不存在的组件不代表没有规范——设计语义查组件规范，写法按 EP 官方 API + preflight 校验，不臆造。
- 组件规范/方言文档需要多份时**批量并行一次读完**。
- 表中 `assets/…` 路径相对资产包根——根 = init 输出的 `ASSETS_ROOT:`（分发时任意的实际位置），不是固定磁盘路径。

## Token 消耗纪律（GTS 生成规则）

- token 值**永不进上下文**：写 `var(--color-brand)` 让 CSS 解析；值不对由 build/preflight 兜底校验，禁止为"确认值"读设计系统.md 全文。
- **token 名从索引取，不凭规律猜**：写码前读工作区 `src/assets/tokens/token-index.md`（init 已随 tokens 拷入，全部真名按组列出，照抄即可）。索引里没有的（frost/公司色等专项）才用 `query_tokens.mjs --search`，禁止逐个探测式查询、禁止按前缀自行组词。
- token 名保持设计师原拼写与大小写；**禁造未定义值**——通配形式（如 `--frost-blur-*`）必须展开为实际存在的具体 token。
- 字号与行高**成对使用**（`font-size-big` ↔ `font-line-height-big`），不混搭别档行高。
- 间距分常规/紧凑两套，**按表取值不按比例缩放**；组件内间距标注含边框宽（`padding + border-width` = 目标间距）。
- 透明叠加（`color-hover` 等 rgba 值）与合成色（`color-mix`）不互换，各用各的 token。
- 用户要求与规范冲突时**指出差异**，不把用户说法表述成规范；布局规范未规定处用项目约定（code-conventions），不臆造设计规则。

## 上下文预算（生成全程执行）

单页目标预算：**定位+init ≤5k / 写码 ~30k / 验证 ≤5k / 规范按需 ≤10k，全程 ≤70-90k**。执行规则：

1. **禁读清单**（读了也不用于生成，纯浪费）：「读纪律」未命中的任何仓库/项目文档；`asset-manifest.json` 与 `tokens.json`（机器文件）；设计系统.md 全文（token 值不进上下文）。
2. **验证只认脚本输出**：build/smoke 的 `RESULT` 行即终态；FAIL 按行修复重跑，禁止现场手写调试脚本/puppeteer 脚本展开分析。
3. **截图输入节制**：一次一张、必要时裁剪；追问/修改轮次不重发已分析过的图。
4. **接近预算上限时**：先压缩会话上下文（安全点：init 完成开写之前），压缩后凭 SKILL.md + 工作区文件继续，无需重读资产库。

## 环境纪律（node 归因 + 降级禁令）

**交付契约不可降级：任何环境下都禁止「node 不可用所以改为纯 HTML/静态页」的替代交付**——那不是本 Skill 的产物，等于交付失败。环境故障时的唯一正确动作：按下面诊断 → 把结果原样报告用户 → 等待修复；不许自行更换交付形态、不许静默降级。

**`RESULT: FAIL` = 脚本已正常运行后的业务校验失败，与 node 安装无关**（能输出 FAIL 恰恰证明 node 可用）。高频原因：`asset library not found` = 逐级向上没找到资产包、也无有效 `assets-path.json`——向用户要 assets 完整路径后给 init 传 `--assets-root <dir>`（成功自动记住），或把 assets/ 放到 skill 上级任一层；`Artifact folder does not exist` = 先建目录；`target already exists` = 走 Modification Workflow；`puppeteer-core not found` = `npm i -g puppeteer-core`。连续 FAIL 3 次仍未修复 → 停下把输出原样报告用户，禁止换交付形态。

**skill 自带文件不是可修改对象**：禁止修改、调试、patch 本 skill 的 `scripts/` 与资产包内任何文件——那是 skill 本体与设计侧资产，不是本次任务的产物（例外：skill 根的 `assets-path.json` 是 init 自动写入的路径记忆，非源码）；疑似脚本缺陷时原样报告用户等待修复，不许就地改或绕过脚本自跑替代验证。

**node 真缺失时的排查顺序**（仅当 `node --version` 报 command not found 才进入）：①用户确认已装 → 多半是 agent 宿主进程 PATH 未刷新（Windows 装完 node 已启动的终端拿不到新 PATH），请用户重启 agent/终端；②nvm/fnm 管理需先 `nvm use <version>`；③仍不行建议 `winget install OpenJS.NodeJS.LTS`（≥18）。

**编译器依赖住共享池，不在 skill 包里**：`@vue/compiler-sfc` 依赖树（~19MB，纯 JS 无原生二进制，Windows/macOS(x64/arm64)/Linux 同一份）由 `scripts/setup-compiler.mjs` 安装到用户机器共享池（Windows `%LOCALAPPDATA%\OctoAgent\ux-prototype\`；macOS `~/Library/Application Support/OctoAgent/ux-prototype/`；Linux `$XDG_DATA_HOME`（默认 `~/.local/share`）`/OctoAgent/ux-prototype/`）。skill 包内只有 `verify/compiler/package.json` + `package-lock.json`（依赖声明与版本锁定真源，各机器装出同一棵树）。init/build 第 0 步经 `checkCompilerEnv()` 三段校验（1 秒）：包完整 → 依赖树在 → **lockfile 漂移**（skill 升级带来新 lockfile 时报 `COMPILER_ENV_OUTDATED`，按 HINT 重跑 setup 即升级）——**按 HINT 执行 setup 后重跑即可，禁止因依赖缺失/过期改用其他编译/交付方式**。registry 四档回落：`--registry` 参数 → `OCTO_NPM_REGISTRY` 环境变量 → 内网镜像 → 公网 npmjs（后两档自动逐个探测可达性，内网外网同一份 skill 零配置）；npm 完全不可用的机器用 `--from=<compiler-deps.zip>` 离线通道。排障时可单跑 `node scripts/ensure-compiler.mjs`（手动诊断工具：三段校验逐段报告，与 init/build 内联的是同一份逻辑）。

## 生成流程（All Input Types）

### Step 1 — 输入解析

- **意图先行判定**：用户发设计稿/截图并要求「还原 / 重新生成」时，**直接全新生成**（派生新 slug 建新目录），不读取、不比对已生成的旧页面——只有用户明确说「修改 / 对齐已有页面」才走文末 Modification Workflow。误判成修改流程会浪费大量轮次通读旧代码且全部作废。
- **Type 1 页面描述**：分析场景、目标用户、核心问题；扩展完备性（B 端控制台 = 顶栏 + 侧边导航 + 主内容区 + 状态反馈）。
- **Type 2 模块描述**：单个 UI 块 → 作为独立组件生成 + 页面以展示形态包裹。
- **Type 3 截图**：分析布局/组件/层级/视觉分区，映射到 Element Plus + 资产 token；**数据保真转录而非发明**——行列数与图完全一致（多一行少一行都算失真）、逐格独立读取、严禁行间复制/凑行、数字保持业务自洽（合计=分项和）；不确定的格子标注 TODO 而非编造。
- **Type 4 Raw HTML**：解析 DOM/CSS → 原生控件映射 EP 组件，颜色映射最近似 token，重复内容提为数据。

### Step 2 — 预检 + Init Workspace（MANDATORY）

1. **环境预检**：`node --version` 输出 `v` 数字（≥18）→ node 可用，此后本次会话任何脚本 FAIL 都不得归因 node 安装；`command not found` → 进入「环境纪律」排查，结果报告用户，全程禁止降级为纯 HTML 交付。
2. **Confirm {artifact-folder}**：运行时上下文提供的绝对路径；缺失则回退当前工作目录。
3. **Derive {slug}**：kebab-case ASCII，1–6 段语义英文（"设备管理" → `device-management`；单段如 `login`、`test8` 也合法）。
4. **Init**：
   ```sh
   node scripts/init.mjs "{artifact-folder}" "{slug}"
   ```
   资产包自动定位（init 从自身位置逐级向上找 `assets/`；跨盘/不在上级时加 `--assets-root <dir>`，成功后自动写入 skill 根 `assets-path.json`，下次免传）。成功输出 `RESULT: OK` + `HTML_PATH` + `SRC_DIR` + `PAGE` + `ASSETS_VERSION` + `ASSETS_ROOT`（后续 pattern/设计规范/token 查询路径的前缀）。token 全套随即复制到 `src/assets/tokens/`（含毛玻璃 token），并生成 api 适配层、mock 模块、全局词条、路由与 starter 页面。

### Step 2.5 — 图标获取（MANDATORY，页面用图标必经）

页面所有业务图标一律用 `fetch_icons.mjs` 获取——**内网走华为 IconPlus，外网自动降级 Lucide**（探测 `https://octo.hdesign.huawei.com` 不通即切 Lucide，从公开 CDN 在线拉 SVG），**禁止 `@element-plus/icons-vue`**（白名单不含它，build 直接 FAIL）。**关键词一律传英文 Lucide 图标名**（中译英由调用方完成，本地无字典），从 https://lucide.dev/icons 选名；写码前列全清单，先 fetch 再 preflight：

```sh
node scripts/fetch_icons.mjs --dir "{artifact-folder}/{slug}" --keywords "download,refresh,search"
```

- **内网**：走华为 IconPlus API（默认 `https://octo.hdesign.huawei.com`，无需传参），存为 `src/assets/icons/*.svg`（`ic_public_download` → `public-download.svg`，kebab-case 剥 `ic_` 前缀）。
- **外网**：IconPlus 不可达（3s 超时）自动降级为 **Lucide**——从公开 CDN 在线拉取 SVG，**本地不打包图标资源**。关键词即 Lucide 图标名，不存在的名会 WARN 并列出，按提示改名重跑。输出 `RESULT: FALLBACK | ... used Lucide icons from network` + `ICONS: ...`。
- **barrel 自动生成**：fetch_icons 每次运行后全量扫描 `src/assets/icons/*.svg` 重生成 `src/assets/icons/index.js`（`import xxx from './xxx.svg'` + `export const ICONS = { xxx }` 对象字面量；键名 kebab-case → camelCase，`public-download` → `publicDownload`；**JS 保留字追加 Icon 后缀，`package` → `packageIcon`**），并输出 `BARREL: ...` 行。**页面消费一律走 barrel**：`import { ICONS } from '../../assets/icons/index.js'` + `<img :src="ICONS.download" :width="20" :height="20" />`——组件不再手写逐个 .svg import（消灭图标路径层级错误），build 校验 `ICONS.key` 存在性（拼错 key 直接 FAIL）。API 文档见 [references/icon-api.md](references/icon-api.md)。
- **占位图标自动清理**：init 为保证 starter 开箱可 build，落了一个带 `<!-- init-placeholder -->` 标记的占位 `refresh.svg`（几何图形非真实图标），starter 页面 import 它演示 `<img>` 用法。**fetch_icons.mjs 每次运行时自动扫描并删除带标记的占位文件**（输出 `CLEANED:` 行），确保 barrel 只含真实业务图标、产物无残留。生成正式页时用 fetch_icons 拉取真实图标 + barrel 替换 starter 的占位 import 即可。

### Step 3 — 写码

在 `SRC_DIR` 下按 [references/code-conventions.md](references/code-conventions.md) 编写页面（组件拆分、常量/i18n/Mock 细则以该文为唯一来源）：

- `views/{slug}/index.vue` 为页面主组件（替换 starter），以组合编排为主。
- **无依赖的文件并行写**：constants.js、locales.js、mock 数据、互不依赖的子组件可在同一轮并行创建。
- **写码前先规划后落笔（preflight 强制）**：
  0. 按上方「读纪律」表：页面场景命中 pattern / 方言文档的，先读再落笔。
  1. 先列出每个待写文件的 imports——**按目录显式算好相对路径前缀**（`views/{slug}/` 出发上两级 `../../`，`views/{slug}/components/` 出发上三级 `../../../`；components/ 下少写一级是历史最高频 build FAIL 项）。
  2. 汇总本轮要用的全部 token 变量名、element-plus 导出名、词条 key，**一次提交 preflight 一条命令校验**（不通过按提示修正清单再跑；禁止写码中途反复 grep/node 查询）。**旗标各管各的，不混装**：`--exports` 只填 element-plus 导出名（vue 的 ref/computed 等不进任何清单）；`--tokens` 每项带 `--` 前缀（`--color-brand` 而非 `color-brand`）；`--imports`（可选，本轮有新增 import 目标才填）格式 `fromFile=rel1|rel2`，多项逗号分隔。图标走 barrel 后组件只需 import `assets/icons/index.js` 这一个目标；仍直接引 .svg 或其他素材时才逐个枚举：
     ```sh
     node scripts/preflight.mjs --dir "{artifact-folder}/{slug}" --tokens "--color-brand,--space-size-16" --exports "ElMessage,ElMessageBox" --imports "views/{slug}/components/X.vue=../../../locales/pages/{slug}.js|../js/constants.js,views/{slug}/index.vue=../../assets/icons/index.js"
     ```
  3. `RESULT: OK` 后以清单为准落笔——写码过程中 token/词条/路径以清单为准，不再现场发明。
  4. **新建文件的两段式**：规划清单里含本轮才新建的文件（如 `components/RuleDialog.vue`）时，第 2 步的 `--imports` 只填指向**已有文件**的 import，先过一轮 `RESULT: OK`；新建文件写完后，把指向它们的 import 补进清单再跑一轮 preflight 确认。禁止把指向未创建文件的 import 塞进第一轮——那必然 FAIL。
- **分批 build 早暴露**：build 毫秒级，不要等全部文件写完才跑——首个子组件 + constants/locales 写完即跑一轮（token 拼写/白名单类错误在第一个组件就暴露），全部写完再跑最终轮。
- **输出轮次纪律（防截断卡死）**：单轮回复夹带大段分析 + 多个大文件是历史最高频的「长时间无动静」元凶——输出超限截断时用户只看到卡住。每个 SFC 文件单独一轮输出；分析文字每轮不超过两三句；单文件超过 ~250 行时拆成 script / template / style 分轮写（`Write` 首轮 + `Edit` 续写）。
- **会话复用纪律**：同 session 内第二次及以后调用本 skill（换截图重生成、新页面）时，「读纪律」与规范文件**不重读**——上文已读内容仍在上下文，重读纯浪费；直接从 Step 2 init 开始。

### Step 4 — 生成前自检（MANDATORY，build 前必做）

preflight + HARD RULES + 白名单已机械覆盖语法/命名/样式类错误；人工只核对 build **不覆盖**的运行时项（细则见 [references/code-conventions.md](references/code-conventions.md) §9）：

1. `el-select` 初始值在 options 内、`el-table` 的 `prop` 与数据 key 匹配
2. template 引用的变量在 `<script setup>` 中已声明；`v-for` 有 `:key`
3. 页面/组件 import 的 api 导出名与 `src/api/{slug}.js` 的 export 逐一对照——新增 mock 函数必须同步补进 api 适配层导出（三道门禁都抓不到导出名缺失，漏了就是运行时错误态）

### Step 5 — Build & Verify（MANDATORY，自动刷新预览）

```sh
node scripts/build.mjs --dir "{artifact-folder}/{slug}"
```

- **Success:** `RESULT: OK` + `OK index.html verified (N pages, M components, K el-tag uses)`
- **Failure:** `RESULT: FAIL | <文件>: <原因>` → 修复 → 重跑（最多 3 次）
- **WARN:** hex 颜色、静态内联样式——非阻断，但应修正
- 校验为全自动机器检查（SFC 真编译 + 三类白名单 + 相对 import 解析 + token 存在性 + mock 隔离 + router 完整性等），无需人工复核清单，FAIL 按行修。

```sh
node scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
```

**build + smoke 一轮跑完 = 生成流程结束。** 最终收口一条命令串跑（修 FAIL 迭代期间只跑 build，smoke 留给收口）：`node scripts/build.mjs --dir "..." && node scripts/smoke.mjs --dir "..."`。不再起 serve / curl 探活 / 查杀进程 / 重复验证——smoke 自带渲染、token 品牌色、明暗切换、404 检查并自查进程清理。冒烟前置（每机器一次）：`npm i -g puppeteer-core`（自动探测系统 Chrome/Edge，不下载浏览器）。

### Step 6 — Output

```
<artifact type="text/link">{HTML_PATH value}</artifact>
```

浏览器直接打开 `index.html` 预览（file:// 可加载）；用户要本机预览地址时才 `node scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765`。交付说明注明演示假设与未验证项、二开入口（改 `src/api/{slug}.js` 对接真实接口，页面零改动）。

**沟通节奏**：写码/修 FAIL 不逐轮汇报，收口时一起说；装前置或耗时几分钟先告知。脚本报错：环境类失败原样转述用户；自己代码的 FAIL 直接修复重跑不转述。

## Modification Workflow（修改已生成页面）

用户要求修改已生成页面时，**不要重新生成**：

1. **Locate:** `{artifact-folder}/{slug}/src/views/{slug}/...`
2. **Edit:** 只做请求的改动——未提及内容保持不变。
3. **Re-verify:** 重跑 `build.mjs` → 输出同一 `<artifact>` link。

## 细则路由（一句话规则 + 去处，不在本文展开）

| 话题 | 一句话规则 | 细则 |
| --- | --- | --- |
| 换肤/皮肤 | 协议 `data-theme="light|dark"`（运行时 `documentElement.setAttribute`）；自定义皮肤只放 `src/assets/themes/theme-{name}.css`，页面消费 token 全套自动跟随 | 工作区 `assets/themes/README.md` |
| i18n | 每页一个 `src/locales/pages/{slug}.js`，zh+en 单文件双语言一次写完；`t` 是按 LANG 展平的字符串，模板直接 `{{ t.title }}` | code-conventions §7 |
| Mock / API 适配层 | mock 按 REST 语义设计签名，二开只改 api 文件、页面零改动 | code-conventions §5/§6 |
| UI Runtime 扩展点 | 接入其他 UI 库（如 SweetUI）= UMD 目录 + 白名单 + token 桥接 CSS 三件套，架构与生成流程不动 | 仓库 `docs/ui-runtime.md`（仓库外分发时不可用） |

## Token / 图标查询

- token 数值用 `query_tokens.mjs` 查询（按名/搜索/分组摘要，不整读 tokens.json）。
- 图标全走 `fetch_icons.mjs`（IconPlus/Lucide，见 Step 2.5），无需猜名；`el-*` 组件名写错时 preflight/build 会给相近项提示，按提示修正重跑即可。

```sh
node assets/scripts/query_tokens.mjs --name color-brand   # 查单个 token（含深色值）
node assets/scripts/query_tokens.mjs --search frost       # 子串搜索（名+描述+值）
node assets/scripts/query_tokens.mjs --list               # 分组摘要
```

## References

- **[references/code-conventions.md](references/code-conventions.md)** — 页面代码规范 / 自适应规范 / API 适配层 / i18n / 相对路径计算表 / 高频错误预防 / 二开依赖差异
- **[references/icon-api.md](references/icon-api.md)** — IconPlus 图标 API 文档（getConfig / getIconInfo / getIcon）+ 外网 Lucide 网络降级说明
- **[assets/design-language/00索引.md](../../assets/design-language/00索引.md)**（随 assets/ 分发）— 设计真值路由入口：组件规范 51 份 + 设计规范 7 份 + 设计系统.md

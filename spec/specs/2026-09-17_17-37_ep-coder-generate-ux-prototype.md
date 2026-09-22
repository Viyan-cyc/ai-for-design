# Spec: ep-coder / generate-ux-prototype skill

- **层级**: Feature Spec
- **创建**: 2026-09-17 17:37
- **状态**: REVIEW（2026-09-17 首轮 GO）→ 二轮增量 Execute（2026-09-18，R-2 增量包）→ 三轮增量完成（2026-09-18，Phase G 全绿）→ 四轮增量起草（2026-09-20，D-23~D-25）
- **phase**: Review
- **approval status**: `Plan Approved`（2026-09-17）；二轮增量 Plan Approved（2026-09-18，D-16~D-19）；三轮增量 Plan Approved（2026-09-18，D-20~D-22）；四轮增量待 Plan Approved（2026-09-20，D-23~D-25）

## 1. 最终目标（Goal）

在 `ep-coder/` 仓库内实现 skill **`generate-ux-prototype`**：

1. **输入**：用户需求（文本描述等）。
2. **输出**：Vue 3 + **Element Plus v2.13.5** 页面代码（`.vue` SFC），页面样式严格遵循 `design-language/`（GTS 设计语言 v2.2.1）定义的 token 与规范。
3. **交付形态**：继承 **gts-autin-coder** 的打包方式 —— 输出一个离线预览 `index.html`（vue-sfc-loader 运行时加载），`.vue` 源码本身即交付件。**命名全部去 gts 化**（见 D-14）。
4. **环境策略**：继承 **fastui-vue-creator** 的模式 —— 机器有 node 则直接复用；没有则由安装脚本下载 portable node；再 `npm i` 安装校验期依赖。**skill 包内不携带 `verify/compiler/node_modules`**（与 gts-autin-coder 不同）。

### 当前任务单元

Task-1：搭出 skill 骨架（SKILL.md + scripts + references + vendor 占位），scripts 复用改造，可独立验证。

## 2. In Scope / Out of Scope

**In Scope**
- `ep-coder/skills/generate-ux-prototype/` 下新建 SKILL.md、scripts/、references/、vendor/。
- 把 gts-autin-coder 的 `init.mjs / build.mjs / build-data.mjs / preview/ / verify/whitelists` 迁移改造（去 node_modules 依赖）。
- 引入 fastui-vue-creator 的 node 检测/安装模式（install.ps1 / install.sh + ensure-env 思路）。
- verify/compiler 改为：`package.json + package-lock.json` 随 skill 携带，运行时检测 node → npm i（npmmirror 源）。
- SKILL.md 生成工作流改写：token 来源指向 design-language，Element Plus 版本声明 2.13.5。

**Out of Scope**
- `fastui-vue-creator/template/`（不用真实脚手架工程，vue sfc 方案不需要）。
- vendor/ 实际内容（组件示例 / 代码示例 / 设计规范）—— **用户后续补充**，本期只留占位文件与 SKILL.md 中的预留章节。
- design-language 文档本身不改。
- 预览运行时 UMD 库的版本升级决策（见 Open Questions OQ-2）。

## 3. Context Sources

| 来源 | 用途 |
|---|---|
| `gts-autin-coder/gts-autin-coder/SKILL.md` | 交付契约、生成工作流、代码规范蓝本 |
| `gts-autin-coder/gts-autin-coder/scripts/{init,build,build-data}.mjs` | 工作区初始化 + 校验脚本（待迁移） |
| `gts-autin-coder/gts-autin-coder/scripts/preview/**` | 离线预览运行时（UMD 库 + index.gts.html + 主题 css） |
| `gts-autin-coder/gts-autin-coder/scripts/verify/{compiler,whitelists}` | compiler-sfc 校验器 + 组件/导出/图标白名单 |
| `octo-agent-dev/skills/fastui-vue-creator/SKILL.md` | node 获取策略、RESULT: 协议、硬约束（禁删文件、禁绕脚本、装环境是 agent 的活） |
| `octo-agent-dev/skills/fastui-vue-creator/scripts/{install/*.ps1,install.sh}` | 裸机装 portable node 脚本（待复用改造） |
| `octo-agent-dev/skills/fastui-vue-creator/scripts/lib/{paths,result}.mjs` | 路径推导 / RESULT 输出协议（参考复用） |
| `design-language/00索引.md` + `样式Token/设计系统.md` + `设计规范/组件库适配.md` | GTS token 唯一真值源、EP 主题接入要求 |

## 4. Research Findings

### 4.1 gts-autin-coder 侧（交付形态来源）

- 工作区结构：`{slug}/src/**`（交付件）+ `public/library/`（预览 UMD）+ `index.gts.html`（加载器）+ `preview-data.js`（源码映射，build 自动生成）。
- `init.mjs "<artifact-folder>" "<slug>"`：拷贝 preview 模板 → 输出 `RESULT: OK / HTML_PATH / SRC_DIR / PAGE`。
- `build.mjs --dir ...`：先 `build-data.refresh()` 重生成 preview-data.js，再用 **真实 @vue/compiler-sfc** 编译每个 .vue + 七类检查（结构/SFC/tag 白名单/import 白名单/JS ESM/style 卫生/theme 存在）。
- **关键耦合**：`build.mjs:92` 通过 `createRequire(join(__dirname,'verify/compiler/node_modules/@vue/compiler-sfc/package.json'))` 加载编译器 —— 这是"node_modules 不随 skill 携带"后必须改造的点。
- compiler 依赖仅 `@vue/compiler-sfc@^3.5.25`（lock: 3.5.25，源 npmmirror）。
- 预览 UMD 库为 **Element Plus 2.10.4** + vue.global.prod + vue3-sfc-loader + dayjs + icons iife + zh-cn locale。
- 主题：`src/assets/themes/{base.css, gts-bridge.css, gts-default.css}`，`--gts-*` token 桥接 Element Plus `--el-*`。
- 白名单：`verify/whitelists/{element-plus-components,element-plus-exports,element-plus-icons}.json`（121 组件）。

### 4.2 fastui-vue-creator 侧（环境策略来源）

- 工作流：⓪ node 检测/安装 → ① ensure-env → ② new-session → ③ 写码 → ④ verify → ⑤ 输出 `<artifact>`；RESULT: OK/FAIL 协议。
- **node 策略**（install.ps1/install.sh）：先探测系统 node（`node -v` 能跑就用，不看大版本，标记 `[node] 来源: system`）；没有才下载 portable node（manifest 驱动，50MB）。安装脚本本身 bash/PowerShell 原生，不需要预装 node。
- fastui 的共享池 1GB 依赖是内网 lake 组件库场景，**本 skill 不需要**——本 skill 只需 compiler-sfc 一个 npm 依赖。
- 硬约束可继承：禁 `rm`/`git clean`；禁绕脚本；装环境是 agent 的活；`RESULT:`/`HINT:` 原样转达（环境类失败）。
- `ensure-env.mjs` 模式：只读校验（共享池存在/lock hash/node 大版本），fail 时给 install HINT —— 本 skill 可简化为「node 存在 → npm ci/i 校验期依赖」。

### 4.3 design-language 侧（样式真值源）

- `design-language/00索引.md` 明确指出：**"怎么写代码（Element Plus API、Vue 方言、页面骨架）由工程侧 skill 资产库（`skills/generate-ux-prototype/library/`）负责"** —— 即 design-language 预期本 skill 存在，且其资产目录名叫 `library/`（与用户说的 vendor/ 后续放"组件示例/代码示例/设计规范"对应，命名待用户确认）。
- Token 命名体系：`color-brand`、`color-text-primary`、`space-size-16`、`radius-size-normal`、`shadow-1..6` 等（W3C DTCG 惯例，无 `--gts-` 前缀写入规范文档；毛玻璃处出现 `var(--brand-50)` 写法）。
- **设计文档 token 名（`color-brand` 等）≠ gts-autin-coder 皮肤 token 名（`--gts-color-primary` 等）**。两套名字不同、粒度不同（设计系统 436 行 token 表 vs gts 皮肤 ~30 个变量）。
- 组件库适配要求：EP 通过主题接口接入 GTS token，适配层做映射；不能直接用 EP 默认配色。

### 4.4 结论：能力融合映射

| 能力 | 来源 | 处置 |
|---|---|---|
| 工作区 init + 离线预览 + build 校验 | gts-autin-coder | 原样迁移，改造 compiler 加载方式 |
| node 检测/安装 | fastui install 脚本 | 迁移改造（去掉内网 manifest 依赖，换公开 npmmirror/nodejs 源，待确认） |
| RESULT 协议 / 硬约束条款 | fastui | 写入新 SKILL.md |
| token 真值 | design-language | SKILL.md 指向 design-language 文档；皮肤 css 需与 token 对齐（见 D-1/D-12） |
| vendor 资产 | 用户后续补充 | 占位 + SKILL.md 引用章节预留 |

## 5. Decisions（2026-09-17 用户确认）

- **D-1 token 体系**：皮肤层直接采用 **design-language 命名**（`--color-brand`、`--space-size-16`、`--radius-size-normal`…），新写皮肤 css + EP 桥接层；页面写 `var(--color-*)` 等。build.mjs style 检查规则同步改写。
- **D-2 EP 版本**：本期由 agent 从 npmmirror 下载 **element-plus 2.13.5** UMD（`dist/index.full.min.js` + `dist/index.css` + `dist/locale/zh-cn.min.js`）与 `@element-plus/icons-vue` IIFE 替换 `preview/public/library/`；白名单按 2.13.5 重新导出。
- **D-3 node 获取源**：公网。portable node 从 `https://npmmirror.com/mirrors/node/` 下载；npm registry 用 `https://registry.npmmirror.com`（与现有 compiler lock 一致）。install 脚本改造自 fastui（复用逻辑，去掉内网 manifest）。
- **D-4 vendor 命名**：目录名 `vendor/`；占位文件列明三个计划子目录（组件示例 / 代码示例 / 设计规范），内容用户后续补充。
- **D-5 npm 安装策略**（默认决策，可覆盖）：优先 `npm ci`（严格按 lock），失败回落 `npm i`；源由 lock 内 resolved URL（npmmirror）决定。
- **D-12 design-language 唯一标准**（2026-09-17 二轮确认）：设计规范、token、组件规范**只以 design-language/ 为唯一真值源**；gts-autin-coder 的 `references/design_system.md` 及其 token 词汇**作废，不迁移**。新 skill 的 design 参考文档直接从 design-language 派生。
- **D-13 无 yarn**（2026-09-17 二轮确认）：全链路只用 npm（`npm ci`/`npm i`）；fastui 的 yarn 安装、共享池依赖链接逻辑**不复制**。
- **D-14 全链去 gts 命名**（2026-09-17 二轮确认；2026-09-18 D-20 修订预览入口名）：skill 内任何文件名、变量、CSS 前缀不出现 `gts` 字样。具体改名：`index.gts.html` **保留**（2026-09-18 用户改为要求恢复此名，见 D-20）；`data-gts-theme` → `data-theme`；`--gts-page-*` → `--page-*`；`gts-bridge.css` → `bridge.css`；`gts-default.css` → `default.css`（token 本身已是 design-language 命名，见 D-1）；`window.__GTS_SRC__` → `window.__UX_PROTO_SRC__`；预览 UMD 文件名保持通用名（element-plus.full.min.js 等本就无 gts）。
- **D-16 环境源切 manifest 模式**（2026-09-18 三轮增量确认）：内网机器不可达 npmmirror，install 链路改为 fastui 的 manifest 模式 —— ① `references/env-config.json` 改为 manifest 格式（`manifestUrl` 直引用 fastui 托管 URL `https://octo.hdesign.huawei.com/design/fastui-env/manifest.json`，不自投放）；② install.sh/ps1 需要下载 node 时拉远端 manifest（`node.version` + `platforms{file,sha256,stripComponents}`），按 `dirname(manifestUrl)+file` 下载，用 manifest 内嵌 sha256 校验（替代 SHASUMS256.txt）；③ `npmRegistry` 从远端 manifest 读取（`--registry` 覆盖），透传 setup-env。风险已告知并接受：fastui 团队改动 manifest（升 node/挪包）会直接影响本 skill 安装链路。
- **D-17 lockfile 内网源重生成**（2026-09-18 三轮增量确认）：compiler 依赖 lock 的 resolved URL 从 npmmirror 全量改为内网源 `http://mirrors.tools.huawei.com/npm`（fastui manifest 同款），`npm install --registry=<内网源>` 重生成 package-lock.json；lock hash 变化由 ensure-env 的 sha256 比对自然感知，`setup-env.mjs` 默认 registry 回退值同步改（env-config.npmRegistry 字段删除后从 manifest 拿不到时 fallback 内网源）。
- **D-18 字体瘦身方案 B**（2026-09-18 三轮增量确认）：删除 skill 内 `preview/src/assets/fonts/`（17MB，4 个 woff2）与 `base.css` 的 4 条 `@font-face`；**font-family 栈保留 `'HarmonyOS Sans'` 名字**（浏览器解析本机已装字体，未装则回退微软雅黑/苹方/Arial）；init 复制模板不再带字体文件。
- **D-19 token 生成器 gen-tokens.mjs**（2026-09-18 三轮增量确认）：新增维护工具 `scripts/gen-tokens.mjs`，从 `design-language/样式Token/设计系统.md` 生成 ① `default.css` 规则表格段（语义色/色板/图表/代码色/间距/圆角/边框等，~90% token）；② `references/design-language.md` §1 token 速查表（`<!-- GEN:TOKEN-TABLE -->` 标记圈住，其余手写章节保留）。frost-*/字体栈为脚本内嵌模板片段（散文式定义不可靠解析，~25 行 CSS，设计更新时改片段）。`bridge.css` 保持手写（工程映射决策，非文档可推导）。解析器遇表结构不兼容时报错停止（不静默）。定位同 gen-whitelists.mjs：设计更新时跑，不进日常工作流。
- **D-20 预览入口恢复 index.gts.html**（2026-09-18 六轮增量确认）：预览加载器文件名定为 `index.gts.html`（用户要求，与既有工具链对齐；此为对 D-14 中该文件名的唯一修订，其余去 gts 项不变）。模板 `scripts/preview/index.gts.html`、init 产物与 HTML_PATH 输出、build/build-data 结构检查与文案、SKILL.md、design-language.md 换肤协议、themes/README、src/README 全部同步；E5 grep 检查以 `index.gts.html` 为唯一 gts 豁免。
- **D-21 产出卫生**（2026-09-18 六轮增量确认）：skill 产物不留作废方案的修补性说明、代码注释不写指向 spec/文档的指引（D-xx 编号引用属 Spec，不入代码）。已清理：字体"不随包携带/本机已装则命中"类残留句与"内嵌字体补 @font-face"操作指引（gen-tokens.mjs 模板 2 处改后重跑生成器 + base.css + src/README.md）；代码注释中的 D-16/D-17/D-19 编号引用（install.sh/ps1、setup-env.mjs、gen-tokens.mjs）。全库 grep `D-\d+` 零命中；`--check` 幂等通过。
- **D-22 build 全量报错**（2026-09-18 六轮增量确认）：build.mjs 从 fail-fast（一次一个错，n 错 n 轮）改为收集式全量报错——errors 数组收集全部错误，尾部输出 `RESULT: FAIL | N error(s)` + 逐条 `ERROR: <file>: <msg>`；.vue 逐文件检查改为按文件 continue（parse 失败不遮蔽其他文件的错误）。结构级致命错（index.gts.html/src 缺失、骨架不完整、compiler 加载失败、无页面入口）保持 `fatal()` 立即退出。目的：n 个错 1 轮修完，减少生成页面的返工轮次。
- **D-23 图标尺寸规则**（2026-09-20 四轮增量确认）：SKILL.md 硬约束 3 追加图标尺寸规则。背景：另一会话生成页实测两处裸用图标（`<component :is>` + class/font-size 与 bare svg 直放固定盒）渲染 260×260px——EP 图标组件是无宽高属性的裸 `<svg viewBox="0 0 1024 1024">`，font-size 对其无效，build 门禁（静态）与控制台（零报错）均不拦。规则内容（通用措辞，不点名 EP）：① 不自带尺寸基线的 SVG 图标必须包 `<ElIcon :size="…">` 或显式 CSS 设定宽高，禁止裸用 + 仅 font-size/class 控制；② 图标放入 `ElButton :icon` 等自带包装的，无需再包；③ 内网 svg 文件图标用 `<ElIcon :size="16"><img src="…"/></ElIcon>` + 一行 `.el-icon img{width:100%;height:100%}`。规则进 skill 自有约束，**不进 vendor 转录**（vendor 源文档无此规则，转录忠实性优先）。
- **D-24 init 自建 artifact-folder**（2026-09-20 四轮增量确认）：init.mjs 删除 artifact-folder 的预存检查（现 61-63 行 existsSync+isDirectory 双条件 fail），改为仅拦"路径存在但不是目录"；不存在时放行，由既有 `mkdirSync(dest, {recursive: true})`（88 行）连带创建。依据：① 另一会话实测首跑因目标目录未预建 fail（50.9s+重试一轮）；② 同门先例 fastui `new-session.mjs:118-119` 对 outputs 目录直接 `mkdirSync(recursive)`；③ 同脚本内 dest 已自建而 artifact-folder 要求预存，行为不一致。净变化：删两行改一条件。
- **D-25 UMD 运行时已知坑入 SKILL.md**（2026-09-20 四轮增量确认）：SKILL.md 硬约束 3 末尾追加"UMD 运行时已知坑"小节，3 条：① 跨组件命令式调用（模板 ref + `defineExpose`）在 vue3-sfc-loader UMD 下报 "is not a function"（正常 vite 环境无此问题）→ 改用 prop 信号 + 子组件 `watch` 模式；② ElPagination 写静态 `:current-page` 且无监听器在 EP 2.13.5 UMD 下静默不渲染 → ref 绑定 + `@current-change`；③ jumper 组件 UMD 下渲染英文 "Go to"，中文"前往 X 页"须自组 ElInput 实现。动机：skill 交付给无记忆的 agent 使用，本项目真实踩过的静默类坑不落入 skill 文档则每个新 agent 原样重踩。**不加浏览器冒烟**（fastui 同等面板预览架构下不做，视觉对错归人眼；静态白屏 lint 亦暂缓，见 Change Log 九轮）。

## 5.1 Open Questions

（OQ-1~4 已转为 D-1~D-4；无未决阻塞项。）

## 6. Plan（契约 — 待 `Plan Approved`）

### 6.0 补充决策（Plan 期定型）

- **D-6（已废止，被 D-14 取代）**：~~保留工程惯例名~~ → 命名体系全面去 gts 化，见 D-12/D-14。
- **D-7 install.ps1 注释用 ASCII**：fastui 实测 PS 5.1 读无 BOM UTF-8 按 ANSI 解释，中文注释会炸脚本；新写 install.ps1 的注释一律英文/ASCII，规避编码问题。
- **D-8 环境配置单点**：`references/env-config.json` 承载 `{nodeVersion, nodeMirrorBase, npmRegistry, envDirName}`，install.sh / install.ps1 / setup-env.mjs 三处读取同一份，替代 fastui 的内网 manifest。
- **D-9 环境目录**：`%LOCALAPPDATA%/EpCoder/ux-proto-env`（win）/ `~/Library/Application Support/EpCoder/ux-proto-env`（mac），可用 `EP_UX_PROTO_ENV_DIR` 或 `--env-dir` 覆盖。池内只放 portable node（无 1GB 依赖池 —— 本 skill 唯一 npm 依赖是 compiler-sfc）。
- **D-10 依赖安装方式**：`setup-env.mjs` 把 skill 携带的 compiler 清单复制到 `<envDir>/compiler/`，在那里用解析出的 node + npm JS 入口执行 `npm ci`（失败回落 `npm i`），完成后写 `<envDir>/env.lock.json`（nodeVersion + package-lock.json sha256）。`ensure-env.mjs` 只读校验：node 可用（池优先/系统次之）+ compiler-sfc 可加载 + lock hash 一致。**（Review 后修订：原方案把 node_modules 装进 skill 的 `scripts/verify/compiler/`，违背用户"node_modules 不放进 skill"的原始要求；改为依赖只装 `<envDir>/compiler/`，skill 内仅保留 package.json + package-lock.json 两个文本清单，见 D-15。）**
- **D-15 node_modules 永不进 skill 包**（2026-09-17 用户质询后确立）：`scripts/verify/compiler/` 只携带 `package.json` + `package-lock.json`（几 KB 文本，锁传递依赖 + 供 ensure-env 做 hash 比对），`node_modules` 一律装到 `<envDir>/compiler/`。setup-env（复制清单+npm ci）、ensure-env（从 envDir 加载）、build.mjs（按 env-config 解析 envDir 后加载 compiler-sfc）三处一致。
- **D-11 node 版本校验**：下载后用同镜像的 `SHASUMS256.txt` 比对（替代 fastui 的 manifest 内嵌 sha256）。

### 6.1 Target 结构（ep-coder/skills/generate-ux-prototype/）

```
ep-coder/skills/generate-ux-prototype/
├── SKILL.md                                   # [新写] 融合：gts-autin 工作流（去 gts 命名）+ fastui 环境策略（去 yarn）
├── references/
│   ├── design-language.md                     # [新写] 从 design-language/ 派生的消费版：token 全表 + 布局/组件要点（D-12：gts-autin design_system.md 不迁移）
│   └── env-config.json                        # [新写] nodeVersion/nodeMirrorBase/npmRegistry
├── scripts/
│   ├── install/
│   │   ├── install.sh                         # [改造自 fastui] 无 manifest 无 yarn；npmmirror 直链 + SHASUMS 校验
│   │   └── install.ps1                        # [改造自 fastui] 同上；注释 ASCII（D-7）
│   ├── setup-env.mjs                          # [新写，参考 fastui 模式] npm ci compiler 依赖 + 写 env.lock.json（无 yarn）
│   ├── ensure-env.mjs                         # [新写简化] 只读校验 node + compiler-sfc + lock hash
│   ├── init.mjs                               # [迁移改名] index.gts.html→index.html 等去 gts 引用
│   ├── build-data.mjs                         # [迁移改造] __GTS_SRC__→__UX_PROTO_SRC__
│   ├── build.mjs                              # [迁移改造] ① compiler 加载失败→提示跑 ensure-env；② 去 gts 命名；③ style/token 检查规则重写（见 6.2）
│   ├── preview/
│   │   ├── index.html                         # [迁移改名+校对] index.gts.html → index.html；data-gts-theme → data-theme
│   │   ├── public/library/                    # [替换] EP 2.13.5 UMD 全套（见 6.3）
│   │   └── src/
│   │       ├── main.js / README.md            # [迁移+校对] 去 gts 引用
│   │       └── assets/themes/
│   │           ├── base.css                   # [迁移+校对] reset + 字体
│   │           ├── default.css                # [重写] design-language token 全量定义（值忠实转录自 设计系统.md；原 gts-default.css）
│   │           └── bridge.css                 # [重写] --el-* ← design-language token 桥接（原 gts-bridge.css）
│   └── verify/
│       ├── whitelists/{components,exports,icons}.json   # [重导出] 按 2.13.5 实际导出
│       └── compiler/{package.json,package-lock.json}    # [迁移原样] node_modules 不携带
└── vendor/
    └── PLACEHOLDER.md                         # [新写] 计划子目录：component-examples / code-examples / design-specs（用户后续补充）
```

### 6.2 build.mjs 改造点（签名级）

1. **compiler 加载**（build.mjs:90-96 区域）：加载失败时错误信息改为 `compiler deps missing — run: node scripts/ensure-env.mjs`，其余逻辑不动。
2. **命名替换**：`index.gts.html` → `index.html`（结构检查 :111、init 输出、REQUIRED_HTML 里的 preview-data 路径不变）；`data-gts-theme` → `data-theme`（:128 检查与主题 css）；`window.__GTS_SRC__` → `window.__UX_PROTO_SRC__`；`gts-page-root` 等页面类前缀 → `page-*`（init 起始模板 + SKILL.md 代码规范，与 `--page-*` 变量前缀同规则）；build.mjs 内 WARN/FAIL 文案中的 `--gts-*` 字样同步改写。
3. **style 卫生检查**（原 :258-265）：
   - 保留：禁 `:root`。
   - 改写：禁 `data-theme` 选择器定义（主题文件专属）；SFC `<style>` 内自定义属性定义（`--[a-z][a-z0-9-]*\s*:`）只允许 `--page-*` 前缀；定义 design-language token（如 `--color-brand:`）→ FAIL（token 只属于 themes/）。
4. **token 存在性检查**（原 :305-333）：
   - 定义收集：`src/assets/themes/*.css` 收集全部 `--x:` 定义；SFC styles 收集 `--page-*` 定义。
   - 引用检查：SFC styles + templates + themes css 中 `var(--x)`（无 fallback）必须在定义集合内；`--el-*` 引用豁免（EP 自身 css 运行时提供；桥接层内部互引合法）。
   - 保留：SFC 内 hex → WARN。
5. **whitelist / bare-dep / 结构检查**：逻辑不动，数据换成 2.13.5 重导出结果。

### 6.3 EP 2.13.5 运行时替换步骤（Execute 期一次性操作）

1. 从 npmmirror 拉 `element-plus-2.13.5.tgz`、`@element-plus/icons-vue` 对应版本 tgz → 临时目录解包。
2. 提取 `dist/index.full.min.js` → `preview/public/library/element-plus.full.min.js`；`dist/index.css` → `element-plus.index.css`；`dist/locale/zh-cn.min.js` → `element-plus-locale-zh-cn.min.js`；icons `dist/index.iife.min.js` → `element-plus-icons-vue.iife.min.js`。dayjs/vue 运行时沿用现文件，冒烟不通过再升级。
3. 白名单生成：临时 `npm i vue element-plus@2.13.5 @element-plus/icons-vue` → node 脚本 `require('element-plus/dist/index.full.js')` 枚举导出（components = 大写开头组件键转 kebab；exports = 大写开头键；icons = 模块键）→ 写三份 json + 报告计数。
4. 冒烟：浏览器打开生成的 index.html，console 无 EP 加载错误（人工/宿主环境允许时）。

### 6.4 Implementation Checklist（原子）

**Phase A 骨架迁移** ✅
- [x] A1 创建目录树 + `vendor/PLACEHOLDER.md`
- [x] A2 迁移 `scripts/build-data.mjs`（改 `__GTS_SRC__` → `__UX_PROTO_SRC__`）
- [x] A3 迁移 `scripts/init.mjs`（改名 index.html 引用；其余原样）
- [x] A4 迁移 `scripts/verify/compiler/{package.json,package-lock.json}`（不含 node_modules）
- [x] A5 迁移 `scripts/preview/index.html`（改名+去 gts 属性）+ `src/main.js` + `src/README.md`
- [x] A6 迁移改造 `scripts/build.mjs`（按 6.2）

**Phase B 环境链路（npm-only，无 yarn）** ✅
- [x] B1 写 `references/env-config.json`（nodeVersion=v22.14.0，mirror=npmmirror，registry=npmmirror）
- [x] B2 写 `scripts/setup-env.mjs`（npm ci→fallback npm i；写 env.lock.json）
- [x] B3 写 `scripts/ensure-env.mjs`（只读校验 + RESULT 协议）
- [x] B4 改造 `scripts/install/install.sh`（npmmirror 直链 + SHASUMS 校验 + handoff setup-env；删 yarn/manifest/python3 逻辑）
- [x] B5 改造 `scripts/install/install.ps1`（同 B4；ASCII 注释）

**Phase C 主题与运行时** ✅
- [x] C1 下载并提取 EP 2.13.5 UMD 全套 → preview/library（vue/dayjs/sfc-loader 沿用，冒烟通过无需升级）
- [x] C2 生成 2.13.5 三份白名单（组件 118 / 导出 534 / 图标 293；compiler 目录 vue 污染已还原并重跑 setup-env）
- [x] C3 通读 `设计系统.md` 全文 → 重写 `default.css`（324 个 token，20/20 抽检通过，hex 全合法，代码区纯 ASCII；修掉 1 个西里尔同形字符）
- [x] C4 重写 `bridge.css`（39 个 token 引用全部命中 default.css；状态钩子：hover/focus 边框、禁用不透明化）
- [x] C5 校准 `base.css` / `index.html` / `main.js` / 两份 README 的 token 引用（全 var() 引用可解析）；themes README 残留 1 处 "GTS" 字样清除
- [x] C6 冒烟：headless Chrome 真实渲染 init 产物（init→改 token 页→build→打开）：SFC 编译成功（scoped hash）、EP 组件全挂载、零 JS 异常、boot-error 未触发

**Phase D 文档** ✅
- [x] D1 写 `references/design-language.md`（token 速查 + EP 桥接映射 + 页面协议 + 换肤协议 + 图表/代码区）
- [x] D2 写 `SKILL.md`（工作流 ⓪-⑤ + 硬约束继承：禁删文件/禁绕脚本/npm-only/装环境是 agent 的活 + 页面代码规范 + vendor 预留章节）

**Phase E 验证收口** ✅
- [x] E1 `node scripts/ensure-env.mjs` → RESULT: OK（NODE_SOURCE: system / COMPILER_VERSION: 3.5.25）
- [x] E2 `node scripts/init.mjs` 两个 slug（login-form、user-detail）→ OK
- [x] E3 最小 token 页面 → `node scripts/build.mjs` → OK
- [x] E4 反向用例 ×3：未定义 token（无 fallback）→ FAIL exit 1；非白名单组件 `<el-fake-widget>` → FAIL exit 1；hex 硬编码 → WARN（设计如此）
- [x] E5 全库 grep `gts`（排除 vendored library 与 node_modules）→ 零命中
- [x] E6 回写 Spec Execute Log + Plan-Execution Diff（本节）

**Phase F 二轮增量（2026-09-18，D-16~D-19）**
- [x] F1 字体瘦身：删 `preview/src/assets/fonts/`（17MB）+ `base.css` 去 4 条 `@font-face`（font-family 栈保留 'HarmonyOS Sans' 名字）；init/README 无字体残留引用
- [x] F2 `references/env-config.json` 改 manifest 格式：`manifestUrl`（fastui 托管 URL）+ envDirName/envDirEnvVar；删除 nodeVersion/nodeMirrorBase/npmRegistry 字段
- [x] F3 `install.sh` 改造 manifest 驱动：需要下载时拉 manifest → platforms 取本平台 file/sha256/stripComponents → 下载 + 内嵌 sha256 校验（替代 SHASUMS256.txt）→ registry 从 manifest 读取透传 setup-env；保留 pool/system/download 三级与 `--manifest=` 覆盖
- [x] F4 `install.ps1` 同 F4 改造（ASCII 注释不变；ConvertFrom-Json 原生解析）
- [x] F5 `setup-env.mjs` registry 回退值改内网源 + `verify/compiler/package-lock.json` resolved 全量重写为 `http://mirrors.tools.huawei.com/npm`（确定性改写 + 计数核对 17 包）
- [x] F6 新增 `scripts/gen-tokens.mjs`（解析 设计系统.md 表格 → 生成 default.css 规则段 + design-language.md §1 速查表；frost/字体内嵌模板；结构不兼容报错停止）
- [x] F7 gen-tokens 首跑 + 与手写版 diff 审查（6.5A-4）
- [x] F8 端到端回归：ensure-env / init+build / E4 反向 ×3 / E5 grep（含新增文件）
- [x] F9 回写 Spec Execute Log（二轮）

**Phase G 三轮增量（2026-09-18，D-20~D-22）**
- [x] G1 模板 `preview/index.html` → `preview/index.gts.html`；init.mjs 产物/输出、build.mjs/build-data.mjs 检查与文案、SKILL.md、design-language.md、themes/README、src/README 全部引用同步
- [x] G2 D-21 清理：gen-tokens.mjs 模板（§5.1 节头 + 速查表字体行）→ 重跑生成器再生成 default.css 与 design-language.md §1（337 token 不变，--check 幂等 OK）；base.css 字体注释、src/README.md 字体指引段删除；setup-env.mjs/install.sh/install.ps1/gen-tokens.mjs 中 D-xx 编号引用删除；grep `不随|内嵌字体|@font-face|woff2` 与 `D-\d+` 验证
- [x] G3 build.mjs 全量报错（D-22）：`fatal()`（结构级）与 `fail()`（收集式）分离；.vue 逐文件 continue；尾部 `RESULT: FAIL | N error(s)` + 逐条 `ERROR:`；SKILL.md ④ 同步"错误一次全列出"
- [x] G4 回归：ensure-env OK（ENV_OUTDATED → setup-env 重装 → OK）/ init+build OK（login-form，产物 index.gts.html）/ 多错误页 5 错一轮全列出（exit 1）/ parse 坏文件不遮蔽其他文件 / starter 重建 OK / grep gts 仅剩 index.gts.html 豁免
- [x] G5 回写 Spec Execute Log（三轮）

**Phase H 四轮增量（2026-09-20，D-23~D-25）**
- [x] H1 D-23 图标尺寸规则：SKILL.md 硬约束 3 追加图标条目（裸 SVG 必须包 ElIcon 或显式宽高；自带包装的免包；svg 文件用 ElIcon+img 模式）
- [x] H2 D-25 UMD 已知坑：SKILL.md 硬约束 3 末尾追加"UMD 运行时已知坑"小节（defineExpose 信号模式 / ElPagination ref 绑定 / jumper 自组 ElInput）
- [x] H3 D-24 init.mjs：删预存检查，改"存在但非目录"拦截；SKILL.md ② 无需改动（无前置条件可写）
- [x] H4 回归：ensure-env OK；init+build OK（不带预建目录直跑 init——验证自建）；裸图标页面 build 仍 OK（图标规则是文字约束，非门禁检查——确认无误报性拦截）；E5 grep gts 豁免不变
- [x] H5 回写 Spec Execute Log（四轮）
- [x] H6 D-26 光影还原沉淀：根因事件页两轮光效对照迭代（hero 角部高光 + topo 中心辐射）用户过关后，配方沉淀为 vendor 整页示例 `code-example/references/glow-cards/index.vue`（两形态对照 + 色相跟语义走：brand-*/red-*/orange-* 成对替换、峰值取该色系最浅档、中心辐射 fade 拉满 transparent 100%），code-example README 索引（总览表/详情段/分类表）同步。设计语言真相源 design-language.md 不收录页面级配方（十轮曾误落 §3.5，已回退）。执行于十轮，先于 H1~H5（用户指定"先修复再沉淀"）。

### 6.5 Validation（Done Contract）

1. E1-E3 全部 `RESULT: OK`；E4 如期 FAIL；E5 零命中。
2. preview/library 内 EP 文件头标注 `v2.13.5`；白名单计数与生成脚本输出一致。
3. `default.css` token 值与 `设计系统.md` 抽查一致（抽查 ≥10 个关键 token：color-brand、color-text-primary、space-size-16、radius-size-normal、shadow-1 等）。
4. 端到端产物 index.html 可离线打开（声明验证方式与限制）。

### 6.5A 二轮增量 Done Contract（2026-09-18）

1. F1 后 skill 内无字体文件；init 产物无 `fonts/` 目录；`base.css` 无 `@font-face`；font-family 栈仍含 `'HarmonyOS Sans'`；预览冒烟字体回退链不报错（渲染用系统字体）。
2. F2/F3/F4 后 install 脚本 `--check`（或等价探测）能解析 fastui manifestUrl 的 schema；本机无法达内网 URL 时给出 `MANIFEST_UNREACHABLE` 类 FAIL + HINT（预期行为，内网验证待投放后）。
3. F5 后 lock 内零 npmmirror 残留（grep 验证）；`setup-env.mjs` 在本机用内网源重装 OK（本机若不可达内网则声明限制，改用 npmmirror 临时代验证链路逻辑，lock 以内网 resolved 落盘为准）。
4. F6/F7 生成器首跑输出与现手写版 `default.css` diff 归零或差异逐条审查通过（token 计数 324 不减）；`design-language.md` §1 速查表生成段与手写版语义等价。
5. F8 回归：ensure-env OK / init+build OK / E4 反向用例不变 / E5 grep 零命中（含新增文件）。

### 6.5B 三轮增量 Done Contract（2026-09-18）

1. init 产物预览入口为 `index.gts.html`；HTML_PATH 输出该名；build 结构检查指向该名；全库 grep `gts`（排除 vendored library）仅剩 `index.gts.html` 文件名引用。
2. D-21 后 skill 产物无"不随包携带/本机已装命中"类修补句、无内嵌字体操作指引、代码注释无 D-xx 编号引用（Spec 除外）；gen-tokens `--check` 幂等通过（337 token 不变）。
3. D-22 后多错误页面一轮 build 全量列出（验证：5 错同轮 `ERROR:` 输出，exit 1）；单文件 parse 失败不遮蔽其他文件的错误；结构级致命错仍立即退出。

### 6.5C 四轮增量 Done Contract（2026-09-20）

1. D-23 后 SKILL.md 硬约束 3 含图标尺寸规则（裸 SVG 包 ElIcon/显式宽高、自带包装免包、svg 文件 ElIcon+img 模式三点齐全）；不进 vendor/（vendor 目录零 diff）。
2. D-25 后 SKILL.md 含"UMD 运行时已知坑"3 条（defineExpose→prop 信号、ElPagination 静态 prop→ref 绑定+jumper 自组）；条目为操作指引（改用什么写法），非事故叙述。
3. D-24 后 init.mjs 对不存在的 artifact-folder 直接成功（自建）；对"存在但是文件"的路径报 FAIL 且信息含路径；对正常场景（已存在的目录）行为不变。
4. H4 回归全绿：ensure-env OK / init+build OK / 裸图标 starter 页 build 零新告警（确认 D-23 未引入门禁检查）/ gts grep 仅 index.gts.html 豁免。
5. D-26 后 vendor 新增整页示例 `code-example/references/glow-cards/index.vue`：两形态（角部高光/中心辐射）同一页对照，色相跟语义走（示例含 brand 系与 red 系各一），峰值取色系最浅档、中心辐射 fade 至 transparent 100%、白底留白；示例 build 门禁通过（token/无 hex）；code-example README 三处索引同步（总览表/详情段/分类表）；design-language.md 无该配方（页面级配方不入设计语言真相源）。

### 6.6 Risks

- **R-1** EP 2.13.5 UMD 全局依赖（dayjs 全局、locale 注册方式）与 2.10.4 有差异 → C6 冒烟兜底，必要时升级 dayjs/vue 运行时文件。
- **R-2** npmmirror 直链在本机不可达（代理）→ 执行前 curl HEAD 探测，失败回报用户。（二轮增量改写：**内网目标环境不可达 npmmirror 已被确认为事实**，链路整体切 manifest + 内网 registry，见 D-16/D-17；原风险语义并入 R-6/R-7）
- **R-3** install.ps1 编码坑 → D-7 规避；Windows 上做语法级验证。
- **R-4** design-language token 表 436 行转录量大 → 抽查校验（6.5-3），发现冲突回 Spec。（二轮增量后长期缓解：D-19 生成器消除手抄环节）
- **R-5** 去 gts 改名涉及多文件联动（build 检查/init/preview/themes）→ E5 全文 grep 兜底。
- **R-6**（新增）manifestUrl 直引用 fastui 托管空间：fastui 团队升级 node/挪包/下线服务会静默影响本 skill 安装链路 → 用户已知情接受（D-16）；缓解：install 脚本 FAIL 时 HINT 提示 manifest 可达性排查 + 本地 `--manifest=<url>` 覆盖逃生口。
- **R-7**（新增）内网 registry `http://mirrors.tools.huawei.com/npm` 本机（执行环境）不可达 → lock 重生成时若不可达，用 npmmirror 临时装、落盘 lock 手工改写 resolved 前缀为内网源（确定性文本替换，17 包规模可控）；真实内网验证声明为投放后待办。
- **R-8**（新增）gen-tokens 解析器依赖 `设计系统.md` 表格结构稳定 → 表结构变更时解析器报错停止（设计如此），届时修解析器；首跑 diff 审查（6.5A-4）兜底正确性。
- **R-9**（新增）删字体后预览观感变化（无 HarmonyOS Sans 的机器落到微软雅黑/苹方）→ 字体栈顺序保证回退自然；用户已确认方案 B（D-18）。

## 7. Innovate

**Skipped + Reason**：融合路线由用户显式指定（gts-autin 交付形态 + fastui 环境策略 + design-language token），无方案分叉需要评估。

## 8. Execute Log

**执行时间**：2026-09-17（Plan Approved 后连续执行）

**产物**：`d:\cyc\project\octo\gts\test\ep-coder\skills\generate-ux-prototype\`（28 个文件，不含 node_modules / vendored library）

```
SKILL.md                       # 工作流 ⓪-⑤ + 硬约束（继承 fastui：禁删/禁绕/npm-only）
references/
  design-language.md           # token 消费指南（真值源=design-language 包）
  env-config.json              # nodeVersion/mirror/registry/envDir 单源
scripts/
  install/install.sh|.ps1      # 裸机装 node（pool>system>npmmirror 下载+sha256）→ 接 setup-env
  setup-env.mjs                # npm ci（fallback npm i）装 @vue/compiler-sfc；写 env.lock.json
  ensure-env.mjs               # 只读校验：node + compiler 可加载 + lock hash 一致
  init.mjs                     # <artifact-folder> <slug> → 完整预览工程骨架
  build.mjs                    # 真实编译门禁 + token/样式纪律检查
  build-data.mjs               # src/ → preview-data.js 源码映射
  gen-whitelists.mjs           # 维护工具：EP 版本升级时重新生成白名单
  verify/compiler/{package,package-lock}.json   # 仅 @vue/compiler-sfc ^3.5.25
  verify/whitelists/*.json     # EP 2.13.5：118 组件 / 534 导出 / 293 图标
  preview/index.html + src/…   # 交付骨架（base/bridge/default.css + 字体 + main.js + README）
vendor/PLACEHOLDER.md          # 三类资产占位（用户后续补充）
```

**验证证据**（Done Contract §6.5 对照）：

1. E1 `ensure-env` → `RESULT: OK`（NODE_SOURCE: system，COMPILER_VERSION: 3.5.25，ENV_DIR: `%LOCALAPPDATA%\EpCoder\ux-proto-env`）。
2. E2 init 两个 slug OK（login-form / user-detail）；E3 build starter OK。
3. C6/E3 合并冒烟：init 工程 → token 页面（el-card/form/input/button/alert + 4 类 token）→ build OK → headless Chrome `--dump-dom`：SFC 编译成功（`data-v-` hash）、EP 组件全部挂载、零 JS 异常、`#ux-boot-error` 未触发。**局限**：无像素级视觉验收（人工确认颜色/字体观感）。
4. E4 反向用例：未定义 token → `RESULT: FAIL | unknown token var(--color-typo-ghost)` exit 1；非白名单组件 → `FAIL unknown Element Plus tag <el-fake-widget>` exit 1；hex 硬编码 → WARN（按 6.2 设计为 WARN 级）。
5. 白名单计数与生成输出一致（118/534/293）；EP 文件头 `/*! Element Plus v2.13.5 */`。
6. E5 全库 grep（排除 `library/` vendored 与 node_modules）零命中；tokens 抽检 20/20 与 `设计系统.md` 一致。

**关键执行事实（Reverse Sync）**：

- EP 2.13.5 UMD 内置 dayjs，无需外部 dayjs 全局；冒烟一次通过，vue/dayjs/sfc-loader 未升级。
- init.mjs 语义：`<artifact-folder>` 必须**已存在**（不自动 mkdir）；`--dir` 形式的记忆有误，实为位置参数。
- build.mjs hex 检查为 WARN 级（不阻断）；未定义 token 无 fallback 为 FAIL 级。
- 白名单生成时 `npm i vue` 污染过 compiler 清单 → 已还原 pristine `package.json`/`package-lock.json` 并重跑 setup-env（npm ci 重装 17 包，ensure-env OK）。
- default.css 转写中发现 1 个西里尔同形字符（`--purple-10` 值内 `е`）→ 已修，全文件 hex+ASCII 校验通过。
- install.sh 实际验证仅 `bash -n` 语法级（本机为 Windows）；install.ps1 未做执行级验证（R-3 部分存留）。

## 9. Review Verdict / Plan-Execution Diff

**三轴评审**（2026-09-17，Execute 完成后）：

| 轴 | 检查 | 结论 |
| --- | --- | --- |
| Spec 质量 | 目标/边界/检查表/Done Contract 完整可验证 | PASS：6.4 检查表 A1–E6 全部有证据；6.5 五条 Done Contract 全满足（含 E4 如期 FAIL、E5 零命中） |
| Spec↔代码一致性 | 逐条对照 Plan §6.1 结构、§6.2 build 改造点、§6.3 替换步骤 | PASS：结构无缺件（28 文件树见 §8）；build 六组检查全部落地；6.3 步骤 1–4 全执行 |
| 代码质量 | 迁移文件逐个复读 + 反向用例 + 浏览器冒烟 | PASS（附 2 项 Review 修复，见 Diff） |

**Review 修复（Review 期发现并当场修复）**：

1. `install.sh read_cfg` 依赖 `node -e` 解析 env-config.json —— 而该脚本的职责恰恰是给**没有 node 的裸机**装 node（先有鸡还是先有蛋）。改为 sed 提取（PS 安装器本就原生解析），5 字段功能验证通过。
2. `install.sh` 在 `set -u` 下 `EFFECTIVE_NODE` 仅在 pool/system 分支赋值，裸机（download 路径，本脚本核心场景）走到 112 行报 unbound variable，**下载根本不会发生**。补初始化空串，`set -u` 模拟验证通过。

**Plan-Execution Diff**（与 Plan 的全部偏差，均已回写）：

| # | Plan 原文 | 实际执行 | 影响 |
| --- | --- | --- | --- |
| 1 | 6.3-2 「dayjs/vue 冒烟不通过再升级」 | 未升级（EP 2.13.5 UMD 内置 dayjs，冒烟一次过） | 无；R-1 关闭 |
| 2 | 6.4-A1 计划 `envDirName` 环境 | 实际 `env.lock.json` 写入 `%LOCALAPPDATA%\EpCoder\ux-proto-env\`（安装器/ensure/setup 三方一致） | 无 |
| 3 | gen-whitelists 标注为「Execute 期一次性工具」 | 保留在 `scripts/gen-whitelists.mjs` 作为 EP 升级维护工具（SKILL.md 未将其列入工作流） | 有益偏差 |
| 4 | E3「生成最小 token 页面」 | 由 C6 冒烟合并完成（同一 token 页面同时覆盖 E3 与 C6） | 无，证据双算 |
| 5 | install.sh 曾计划用 node 解析配置 | Review 期改为 sed（见上） | 修复裸机阻断 |

**Overall Verdict：GO**。Skill 已可用；遗留项：install.sh/install.ps1 仅有语法级+模拟验证（macOS 裸机执行级验证待有条件时补）；vendor 三类资产待用户补充；install.ps1 的 ASCII 注释策略已在文件头注明原因。

**Change Log 追加**：
- 2026-09-17 Review：install.sh 两处裸机缺陷修复（read_cfg 去 node 依赖、EFFECTIVE_NODE 初始化）；Execute Log + Diff 落盘；verdict GO。
- 2026-09-17 Review 追记（用户质询驱动）：skill 内 `node_modules` 违背原始要求 → 新增 D-15，D-9/D-10 修订；setup-env/ensure-env/build 三脚本改为依赖装 `<envDir>/compiler/`；skill 内 node_modules 已删除（仅剩清单）。链路重验证全 OK（setup OK / ensure OK / build OK / E5 零命中），且已证明删除后链路不依赖旧位置。package-lock.json 保留理由：npm ci 必需 + 锁 17 包传递依赖可复现 + ensure-env 的 sha256 过期检测依据。
- 2026-09-18 五轮（二轮增量 Execute，Phase F 全绿）：
  - **F1**：`preview/src/assets/fonts/`（17MB 4×woff2）已删；`base.css` 无 `@font-face`；default.css/base.css 字体栈保留 'HarmonyOS Sans'（4+2 处）；init 产物无 fonts/ 目录。回归验证通过。
  - **F2**：env-config.json = `{manifestUrl: https://octo.hdesign.huawei.com/design/fastui-env/manifest.json, fallbackNpmRegistry: http://mirrors.tools.huawei.com/npm, envDirName, envDirEnvVar}`。
  - **F3/F4**：install.sh / install.ps1 改 manifest 驱动（--check 探测各平台 HEAD+1字节 Range；下载+内嵌 sha256 校验；registry 从 manifest 透传）。E2E 双路径本地验证 OK（本地 HTTP manifest + 便携 node tarball 夹具；ps1 修 3 个真实坑：PS5.1 Range 头须 AddRange、Windows 商店 python3 壳、GNU tar 不识 C:\ 需绝对路径 System32\tar.exe）。fastui manifestUrl 本机不可达 → `MANIFEST_UNREACHABLE` FAIL+HINT 符合 6.5A-2 预期；内网实达验证留投放后（R-6/R-7 声明）。
  - **F5**：lock 17 包 resolved 全量重写为内网源，grep npmmirror 零残留。本机验证链路时临时换 npmmirror lock 装池（npm ci 严格跟 lock resolved、无视 --registry —— 正是 D-17 预判的行为；内网源本机 curl 不可达），验证 npm ci→OK→ensure-env OK 后 lock 已还原内网 resolved 落盘。
  - **F6/F7**：`scripts/gen-tokens.mjs` 落地（解析 设计系统.md §1.2~§6.2 全部规则表 + §3.2 散文映射 radius-size-infinity；`#XXXXXX / N%` 记法转 rgba；frost-*/字体栈内嵌模板；表头列名校验不匹配即停；`--check` 幂等模式）。首跑 diff：**324 个唯一 token 与手写版逐一比对 0 缺失 0 新增 0 值差**（阴影 0px/0 记法归一后）；337 声明 = 324 + 13 紧凑档覆盖；design-language.md §1 速查表由 GEN:TOKEN-TABLE 标记包裹自动重写（示例值取自解析结果）。6.5A-4 满足。
  - **F8**：ensure-env OK（改 lock 后先报 ENV_OUTDATED 如期，重装后 OK）/ init+build OK（login-form）/ E4 反向 ×3 与预期一致（hex→WARN+OK、`<el-fake-widget>`→FAIL、未定义 token→FAIL）/ E5 grep gts 零命中（含 gen-tokens.mjs 等新增文件）/ gen-tokens --check OK。
  - **F9**：本条目。二轮增量 Done Contract 6.5A 1~5 全满足（其中 2/3 的内网实达部分按声明留投放后验证）。
- 2026-09-18 六轮（三轮增量，Plan Approved）：用户 5 条输入 → 疑问 3 条当场解答（design-language.md 消费视图定位；token 查表非猜测 + build 秒级；build 原为 fail-fast 逐轮报错）+ 修正 2 条转化为 D-20（预览入口恢复 index.gts.html，D-14 修订注记）/ D-21（产出卫生：删作废方案修补句、注释不写文档指引）。追加 D-22（build 全量报错，n 错 1 轮）。新增 Phase G（G1~G5）与 Done Contract 6.5B。
- 2026-09-18 七轮：三轮增量 Execute 完成，Phase G1~G5 全勾，6.5B 全满足。gen-tokens --check 幂等 OK；回归链 ensure-env（先报 ENV_OUTDATED，重装后 OK）/ init+build OK / 5 错一轮全列 / parse 不遮蔽 / gts grep 仅 index.gts.html 豁免。Review 追记（用户质询驱动）：boot-error 样式残留 `font-family: Consolas, monospace`（token 体系外裸写字体，迁移自 gts-autin 模板）→ 删除该行，继承 body 的 var(--font-family)；init 产物 grep 验证零残留。
- 2026-09-18 八轮：build 未知 token 提示增强（用户质询"design-language 是否真提效"的评估产出之一）——tokenHints() 打分函数（共享分段×2 + 前 6 字符前缀×2 + 段数同构×1，取 top4），未定义 token 的 FAIL/WARN 提示补齐 did-you-mean（与 icons/el-tag 同机制）。验证：primry→primary、foucs→focus、nromal→normal 三类拍错正确 token 均入提示；正常页零误报。component-library Spec（2026-09-18_09-11）评审意见另记：执行前需修文件名过期/决策编号撞车/D-19 瘦身勿删 token 速查表等 5 项。
- 2026-09-20 九轮（四轮增量起草，Plan 期）：用户指另一会话（91a34510）生成页"图标超大、侧边栏样式不对、耗时长"→ 本会话诊断：图标 260×260 根因 = EP 图标是无宽高裸 svg、font-size 无效（另会话两处裸用，smoke-bigsvg 探针实锤）；侧边栏 = 展开态无宽度定义被裁切；耗时 65.3min 墙钟 = 生成 12m35s + 用户侧空闲 41min + 收尾元分析 11min（另会话自析 12.5min 口径一致、被采信）。对照 fastui-vue-creator 逐项核（SKILL.md 全文/verify.mjs/new-session.mjs）：静态 lint 有先例（verify.mjs:345-390 WARN/FAIL 两档，理由 = 判据是否工程内闭合——本 skill 预览 index.gts.html:150 `app.use(ElementPlus)` 全量全局注册，EP 组件漏 import 预览不坏 → lint 对本 skill 价值仅剩 vue API 白屏类，响亮失败非静默，暂缓挂起）；artifact 自建有先例（new-session.mjs:118-119 mkdirSync recursive）；浏览器冒烟无先例且用户指明 index.gts.html 即面板预览产物（人眼在环对等）→ 撤回。讨论收敛：图标规则/UMD 三坑强制（skill 交付给无记忆 agent，静默坑不入文档必重踩）、init 顺手、lint 挂起观察。落 D-23~D-25 + Phase H + 6.5C，待 Plan Approved。
- 2026-09-20 十轮（光影还原 + D-26 沉淀）：用户以根因事件处置页为载体还原设计稿光影。hero 卡（角部高光：brand-10 峰值 radial at 0% 0% + brand-05 实底 + 斜向 sheen）一轮过关；topo 拓扑卡（中心辐射）五轮迭代：① 全卡罩色（改）→ ② 辐射范围过大"不精致"（改）→ ③ 34% 椭圆现硬边圈"没有设计稿的感觉，要淡的丝滑的圆润的"（改：峰值降 brand-05 + fade 拉长）→ ④ 质感对了但"扩散范围没有充满整张卡片"的相反反馈实指范围过大（改）→ ⑤ `46% 48% at 50% 44%` + transparent 100% 过关。循环协议 = 调 token → build → 截图 → 用户对照设计稿判定（build/smoke 只证结构正确，"像不像"由人眼判）。用户确认"先修复再沉淀"排序。沉淀：初版写入 design-language.md §3.5，用户质询两点成立——① 层级错（页面级配方不该进设计语言真相源）② 色相写死品牌蓝太定制（告警场景红色系同样成立）→ 定位改为 vendor 示例 `code-example/references/glow-cards/`（003 号，两形态同页对照 + 色相跟语义走成对替换），design-language.md §3.5 回退归零，code-example README 三处索引同步。H1~H5 仍待 Plan Approved。
- 2026-09-20 十一轮（四轮增量 Execute，Plan Approved，Phase H 全绿）：
  - **H1**：SKILL.md 硬约束 3 图标条目重写为三点齐全（裸 SVG 必须包 `<ElIcon :size>`/显式宽高；自带包装——ElButton `:icon` prop、ElMessage icon 选项——免包；svg 文件用 `<ElIcon><img/></ElIcon>`）。
  - **H2**：SKILL.md 硬约束 3 末尾新增"UMD 运行时已知坑"小节，3 条操作指引式（defineExpose→prop 信号+watch；ElPagination 静态 prop→ref 绑定+`@current-change`；中文 jumper 自组 ElInput）。
  - **H3**：init.mjs 预存拦截改三态：不存在→`mkdirSync recursive` 自建；存在但非目录→`fail('Artifact folder exists but is not a directory: <path>')`；已存在目录→行为不变。
  - **H4 回归全绿**：① ensure-env `RESULT: OK`；② init 不带预建目录直跑自建成功（`.smoke-vendor/h4-regress-nonexistent`）+ 该工程 build `RESULT: OK`；③ init 目标为文件（先建真文件再 init）→ `RESULT: FAIL | Artifact folder exists but is not a directory: <path>` 如期；④ 裸图标 starter 页 build 全输出零 WARN（确认 D-23 未引入门禁检查，图标规则纯文字约束）；⑤ 大小写敏感 grep `gts` 全 skill 树命中均为 `index.gts.html` 文件名引用（大写 GTS 命中为 vendored 文件/文档品牌名，D-20 协议范围内豁免）。
  - **H5**：本条目。6.5C 1~4 全满足（第 5 条 D-26 已于十轮满足）；Phase H 全勾，四轮增量收官。


## 10. Change Log

- 2026-09-17 17:37 首版 Spec 落盘（Research）。
- 2026-09-17 二轮：D-1~D-4 用户确认；Plan 落盘。
- 2026-09-17 三轮：用户三条修正 → D-12（design-language 唯一标准，gts-autin 设计资产作废）、D-13（npm-only 无 yarn）、D-14（全链去 gts 命名）；Plan 全量改写（index.html / data-theme / --page-* / default.css / bridge.css / __UX_PROTO_SRC__），D-6 废止，E5 新增 grep 检查。
- 2026-09-18 四轮（二轮增量，Plan Approved）：用户五问 → 新需求三项确认。D-16（manifest 模式，直引用 fastui manifestUrl，风险知情接受）、D-17（lockfile 内网源重生成，修 npmmirror 不可达硬阻塞）、D-18（字体方案 B：删文件保字体名）、D-19（gen-tokens.mjs 生成器，生成 90% 规则段 + frost/字体内嵌模板，bridge.css 保持手写）；新增 Phase F 检查表 F1~F9、Done Contract 6.5A、Risks R-6~R-9、R-2 改写。
- 2026-09-18 五轮：二轮增量 Execute 完成，Phase F1~F9 全勾，6.5A 全满足；default.css 转为生成器产物（手写版退役）。
- 2026-09-18 六~七轮：D-20~D-22 确认与执行（详见 Execute Log 六~七轮条目）。
- 2026-09-20 九轮：四轮增量起草——D-23（图标尺寸规则入硬约束 3，不进 vendor）、D-24（init 自建 artifact-folder）、D-25（UMD 已知坑 3 条入 SKILL.md）；静态白屏 lint 挂起（全局注册下 EP 组件漏 import 不坏，仅剩响亮类白屏）、浏览器冒烟撤回（面板预览人眼在环对等 fastui）。新增 Phase H（H1~H5）与 Done Contract 6.5C，待 Plan Approved。
- 2026-09-20 十轮：光影还原完成（hero 一轮过、topo 五轮过）→ D-26 光影配方沉淀为 vendor 示例 glow-cards（003 号，两形态同页对照、色相跟语义走；初版误落 design-language.md §3.5 经用户质询回退改层）；Phase H 增 H6（已完成）与 6.5C 增第 5 条。H1~H5 仍待 Plan Approved。
- 2026-09-20 十一轮：四轮增量 Execute 完成，Phase H1~H6 全勾，6.5C 全满足。SKILL.md 增图标规则（D-23）与"UMD 运行时已知坑"小节（D-25）；init.mjs 支持自建 artifact-folder + 存在但非目录拦截（D-24）。H4 回归全绿（ensure-env / init 自建+build / 文件目标如期 FAIL / starter 页零新告警 / gts grep 豁免不变）。

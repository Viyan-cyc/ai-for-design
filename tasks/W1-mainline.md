# 任务卡 W1 · 主链路（用户自领）

> 把本文件全文喂给你的 AI 会话，让它按步骤执行。完成后回到 SKILL-REPLACE-PLAN.md §13 打勾。

## 你的角色

你负责 ai-for-design 工程改造的 W1 主链路。背景与全部决策见 `SKILL-REPLACE-PLAN.md`（必读：§4 架构、§5.3 组件规范、§9 决策日志 D1-D20、§12 风险）。本文只列你的步骤与验收标准。

## 前置（30 分钟）

1. **T0 基线提交**（若无人做过）：在仓库根 `git add -A && git commit`（排除 node_modules，先写 .gitignore：node_modules/、dist/、preview-dist/、.DS_Store）。推远端、设 main 保护、约定每任务一分支 `w1/xxx`。
2. 通读 `D:\cyc\project\octo\test2\gts-autin-coder\` 全部源码（SKILL.md + scripts/）。

## 步骤

### T1 P0 技术验证（半天，阶段门）
1. 按 tasks/W2 卡片的 M0 规范手工迁移 GButton 一个组件（可让 AI 做，你人工过目）。
2. 用 gts-autin-coder 的 init.mjs 起一个测试工作区，把迁移后的 GButton.vue 拷进 src/components/basic/GButton/，写一个引用它的 stub 页面。
3. build.mjs 编译 + 浏览器打开 index.gts.html 确认渲染。
4. **产出验证结论**回填本文件末尾「结论区」：sfc-loader 对内联 less/纯 JS SFC 的兼容性；资产库 element-plus.css 桥接与 EP 2.13.5 的变量 diff 结果。这决定 W4 文档写法——结论未出，W4 的 D1/D2 不要开工。
5. commit + push 分支。

### T2 工具链合入 + 去 gts 化（半天）
- 复制 gts-autin-coder 的 `scripts/{init,build,build-data,serve}.mjs`、`scripts/preview/`、`scripts/verify/` 到 `skills/generate-ux-prototype/scripts/`。
- 全量改名：`index.gts.html` → `index.html`；`data-gts-theme` → `data-theme`；删除 gts-bridge.css / gts-default.css / dark.less / gts 字体；代码与输出文案中 gts 字样清零（`grep -ri gts` 验证为 0 命中）。
- 目录重组：`preview/public/library/element-plus/`（UMD 归位）；`verify/whitelists/element-plus/`。

### T3 EP 2.13.5（1 小时）
- 从官方 dist（npm 包 element-plus@2.13.5 的 dist/index.full.min.js + dist/index.css + icons + zh-cn locale，或 CDN）替换 preview UMD 四件套。
- 按 2.13.5 重新导出三份白名单（components/icons/exports）。
- 决策点 C 已定：官方 dist；用户后续提供专属构建则替换。

### T4 init.mjs 改造（半天）
- 新增参数 `--assets-root <path>`（走 SKILL-REPLACE-PLAN.md §4.1 定位协议：包根 → asset-catalog.json → 库目录）。
- token 现取：`{assets}/frontend/element-plus/tokens/*.css`（含 components/ 子目录）glob 复制到工作区 `src/assets/tokens/`；生成 manifest 记录来源与版本。
- 生成 `src/api/{slug}.js` 适配层（内容：re-export mock，D16）。
- locales 改为 `src/locales/` 全局 common.json（跨页词条，初始为空对象）+ 页面 locales.js 由 AI 生成时自建（D15，init 不建页面级文件）。
- 输出保持 `RESULT: OK` + HTML_PATH + SRC_DIR + PAGE 协议。

### T5 build.mjs 改造（半天）
- token 存在性校验：启动时解析工作区 `src/assets/tokens/**/*.css` 提取全部 `--*` 定义名作为白名单（不再有内置速查表）。
- 删除 rem 换算提示与 px WARN（D14，px 合法）。
- 新增校验：`src/views/**` 与 `src/components/**` 禁止出现 `mock/modules` 的 import（D16，只能 import src/api/）。
- 白名单路径适配 `verify/whitelists/element-plus/`。

### T6 collect_component.mjs（2 小时）
- 用法：`node collect_component.mjs <assets-root> <component-id> <workspace-src> <target-dir>`。
- 逻辑：读 spec `components/specs/{id}.json` 定位 `GName.vue` → 正则解析相对 import（`from './x'`、`from '../GIcon/GIcon.vue'`）→ 递归闭包 → 按库内相对路径镜像复制到 target-dir → 每文件头插 `<!-- 源: g-design {version} {id} -->`。
- 只拷 `GName.vue`（index.ts/examples.vue 不拷，D20）。缺文件即报错列出缺失清单，不静默。

### T7 端到端验收（半天，需 W2 M2 + W3 N5 完成）
1. hybrid 模式生成一页（含 ≥2 个复用 G 组件）；free 模式生成一页。
2. 明暗主题切换（data-theme）、毛玻璃风格页、自定义皮肤插槽各验一次。
3. 二开演练：把 api/{slug}.js 从 re-export mock 改写为假 axios 实现，确认页面零改动可跑。
4. 全部通过 → 在 §13 打勾 T7 → 通知合并。

## 验收标准（W1 整体）
- `grep -ri gts skills/generate-ux-prototype/` 零命中
- T7 四项实测全过
- 所有 commit 走分支 + PR


---

## 结论回写区（执行中随时追加，每条带姓名+日期）

<!-- 格式：- [日期] (姓名/卡号) 结论或问题一句话；细节缩进展开。写完 commit 到本任务分支 -->

- [2026-09-12] (cyc/W1-T1) **T1 P0 技术验证通过**，两项结论如下：
  - **结论 1 — sfc-loader 兼容性 ✅**：按 component-format v1 迁移的 GButton（纯 JS `defineProps` 对象语法 + 内联 `<style lang="less" scoped>` + `:deep()`）在工作区中 init → build（`OK 1 page, 2 components`）→ 由 vue3-sfc-loader 正常识别为自定义组件并编译。P0 验证页 `tasks/p0-workspace/p0-verify/index.gts.html` 可直接打开确认渲染（含 G 组件与原生 EP 按钮对照、点击计数）。
  - **结论 2 — token 桥接与 EP 2.13.5 兼容性 ✅（附一个小修正项）**：资产库 `tokens/element-plus.css` 定义 97 个 `--el-*` 桥接变量，与官方 element-plus@2.13.5 dist/index.css（562 个变量）对比，仅 `--el-alert-title-color` / `--el-alert-description-color` 两个变量在 2.13.5 中不存在（2.10.4 中同样不存在——资产库定义的是自设语义变量，非 EP 官方变量；alert 组件在 2.x 中实际读取 `--el-alert-title-font-size` 等结构变量，文字颜色走通用文本变量）。**处理**：这两行对 EP 行为无影响（属无效但无害的赋值），迁移 107 组件时无需处理；W3 做 build_tokens 时保留原样即可，设计师下次更新 tokens.json 可顺手删。另：preview UMD 当前是 EP 2.10.4，T3 换 2.13.5 时按官方 dist 四件套替换，白名单需同步重导。
  - **W4 可开工**：D1/D2 文档所依赖的两个前置结论均已落定。

- [2026-09-12] (cyc/W1-T2+T4) **工具链合入完成**（commit 3ef6db3）：init/build/build-data/serve 四脚本重写 + preview/verify 重组 + 5 个 .py 删除；去 gts 化 grep 零命中；mock 隔离负向测试（.vue 与 .js 双通道）正确 FAIL；init 输出含 ASSETS_VERSION/token manifest/api 适配层/COMPONENT_MODE。
- [2026-09-12] (cyc/W1-T3) **EP 2.13.5 落地 + 连带修复 3 个 preview 缺陷**（commit 1a5f66c，浏览器确认通过）：
  - 官方 dist 五件套：EP main/css/zh-cn locale（2.13.5）+ icons 2.3.2 + dayjs 1.11.19；三份白名单按官方产物重导：116 组件（theme-chalk css + 5 个无独立 css 的组件）/ 130 公开导出 / 295 图标。决策点 C 定案：官方 npm dist。
  - **缺陷 1（重要，资产库侧）**：资产库 token 入口是 index.scss，无 index.css——preview 引用 404，token 层整体失效且无报错（t2-smoke 也中招，靠 fallback 看不出来）。修复：init.mjs 按 index.scss 加载顺序生成平铺 index.css。**W3 注意**：N2 移植 build_tokens.py 时可考虑让资产库直接产出 index.css 平铺版（当前方案是 skill 侧兜底，可用）。
  - 缺陷 2：init 页面模板 api 相对路径多跳一级（../../../api → ../../api），路由加载即死。
  - 缺陷 3（重要，工具链侧）：vue3-sfc-loader 0.9.5 对 `export {...} from` re-export 编译产物走 require() 只查 moduleCache 不回落 getFile，而 src/api/{slug}.js 原型态恰是纯 re-export。修复：loader 启动时预载全部 /mock/*.js 注册 moduleCache。**W4 注意**：D2 code-conventions 需写明——src/api/{slug}.js 二开态建议用 `import ... from + export { }` 两段式而非 re-export 简写，避免真实工程外任何直开 HTML 的场景踩同类问题（真实 Vite 工程无此限制）。
  - 无头浏览器实测：5 行表格渲染、主按钮背景 rgb(0,103,209) = 资产 token #0067D1 生效（EP 默认 #409EFF）、用户浏览器确认渲染正确。


- [2026-09-12] (cyc/W1-T8) **STYLE_LANG 开关落地（scss 默认 + less 双模验证通过）**：
  - **依赖落地**：npm sass@1.93.2（isomorphic dart2js）+ immutable 5.1.4 UMD 组装为 `sass.browser.js`（5.4MB，暴露 window.sass.compileString）。两个组装坑：① dart.js 结尾无分号，拼接 epilogue 触发 ASI 陷阱，须注入分号；② dart2js 运行时在 window 留下 `exports`/`scheduleImmediate`/`fs` 等 CJS 探测全局，会让后续 UMD（vue3-sfc-loader）误判环境导致 loader 全局丢失，尾部须 delete。npm 源 tgz 不入库（已 gitignore），组装脚本一次性使用。
  - **关键发现 — sfc-loader 0.9.5 内联 `<style lang="scss">` 处理链**（读源码确认）：① 编译前先 `me(relPath: lang)` 预载模块，moduleCache 未命中才走 getFile —— 不注册就报「源码映射中找不到 scss」；② 内置 scss 预处理器经 `preprocessCustomRequire: e => moduleCache[e]` 取编译器，取的是 `moduleCache['sass']` 并调 **legacy renderSync** API。修复：moduleCache 注册 `scss: {}`（占位满足①）+ `sass` 适配器（renderSync → compileString，满足②）。less 能工作正是同一机制的先例（moduleCache['less']）。
  - **限制**：dart-sass 浏览器包的 `renderSync` 是 Node 专用（运行时检测直接 throw），必须走 compileString 适配；legacy options 键为 `file` 而非 `filename`。
  - init：`--style-lang scss|less`（默认 scss）→ 只保留对应 base.* 文件 + main.js import 重写 + constants.js 记录 STYLE_LANG + 页面模板 `<style lang>` 跟随；build：1b 节校验全部 SFC `<style lang>` 与 assets/style 下 base 扩展名与声明一致（D21 单语言）；build-data：TEXT_EXT 加 .scss。
  - **浏览器实测（无头 Chrome）**：scss 工作区（4176）5 行表格 + 主色 rgb(25,25,25) token 生效 + 内联样式 scoped 生效 + 注入 $变量/@mixin 后 padding 输出 37px 证明真 sass 编译；less 工作区（4179）同等全过。负向：less 工作区混入 .scss base 文件时 build 正确 FAIL。
  - **W4 注意**：D2 需写二开依赖差异——scss→`npm i -D sass`，less→`npm i -D less`（Vite 零配置，模板 main.js 已 import 对应 base.*）。

- [2026-09-12] (cyc/W1-T6) **collect_component.mjs 落地 + 预览端到端验证通过**：
  - **功能**：`node collect_component.mjs <assets-root> <component-id> <workspace-src> <target-dir>`。spec 定位入口 .vue → 正则解析相对 import（含 `export … from` / 动态 `import()` / `import type`）→ 递归闭包 → 按每文件自身库内路径段的 level 落位 `{target}/{basic|business|complex}/GName/GName.vue`（D17；入口 level 与 spec.level 交叉校验）→ 每文件插来源注释（版本+库内路径，禁止修改）。
  - **闭包策略（D20 落地）**：只拷 .vue；index.ts 作为 re-export 跳板继续 walk 但不拷；闭包内出现其他 .ts（types.ts）即迁移 gap → 报缺失清单 FAIL，不静默。
  - **新发现 1 — 目录式命名导入渲染空（重要）**：`import { GStatusTag } from '…/GStatusTag'` 经 sfc-loader 0.9.5 编译为 `require().GStatusTag` 命名访问，但裸 .vue 编译产物是组件对象本身（无命名属性）→ undefined → 渲染 `<!---->`。修复：collect 为每个组件额外生成 interop 垫片 index.js（两段式 `import GComponent from './GName.vue'` + `export { GComponent as GName }`，规避 re-export 缺陷，同 T3 结论）；getFile 目录式后备 index.js 优先。
  - **新发现 2 — 垫片路径自指（重要，排查耗时最久）**：loader 把裸目录请求的返回内容按裸路径（如 `/src/components/business/GStatusTag`）记录为模块 → 垫片内部 `'./GStatusTag.vue'` 相对解析成**兄弟路径** `…/GStatusTag.vue`（目录外）→ getFile 需追加「.vue 请求回退目录内真实组件 X/X.vue」的后备。**注意此处绝不能回退 index.js**——垫片请求到自己会循环导入，页面整体静默挂起（preload promise 不 settle、无任何报错）。该症状无 console error，只有 getElementById 全空，排查靠注入 getFile 请求日志定位。
  - **build.mjs 连带**：相对 import 候选新增组件目录式 `…/{lastSeg}/{Pascal(lastSeg)}.vue`（`/components/business/GStatusTag` → GStatusTag.vue）。
  - **验证**：正向全过——GStatusTag 单件（1+1 文件）、GMonitorPanel→GStatusTag 闭包（2+2 文件）、build 3 components OK、无头浏览器 rows=5/panels=3/三个面板标题/3 个真实 EP tag（warning/primary/danger）/token #0067D1 生效/boot 无错误。负向全对——types 依赖报缺失清单、不存在 id 报错、重复复制报 target exists。
  - **垫片性质**：预览运行时兼容文件（非库代码），真实 Vite 工程原生解析目录式命名导入，无需垫片。
- [2026-09-12] (cyc/W1-T9) **D22 回退完成 — 全链路只剩 less**：
  - init.mjs：删 `--style-lang` 参数与 STYLE_LANG 常量逻辑；main.js 固定 import base.less；页面模板固定 `<style lang="less" scoped>`；constants.js 的 STYLE_LANG 改为固定值 `less`（保留导出，二开者可读）；输出行删 STYLE_LANG。
  - **连带发现 — 资产库 token 自带 .scss**：init 拷 tokens 时带入 index.scss 与 element-plus.scss（Sass 构建期源产物，`@forward var.scss` 编译期定制用），运行态由预编译 element-plus.css 桥接承载，拷进工作区纯冗余且会触发 build 负向 → init 现在删除这两个文件。**W2/W3 注意**：资产库里的 .scss 源产物属于库自身的构建配置，不影响产品线（二开者拿到的是工作区拷贝，已被 init 清掉）；但若 W3 移植 build_tokens.py 时继续产出 .scss，需在 N 任务的交付物说明里写清「.scss 仅存在于资产库，不入工作区」。
  - preview/index.html：删 sass.browser.js/immutable.js 两个 script 标签、compileSass 函数、moduleCache 的 scss/sass 注册；.scss/.sass handleModule 改为直接报错（D22 提示）。三个文件已从仓库删除：base.scss、sass.browser.js（5.4MB）、immutable.js。
  - build.mjs 1b：改为「工作区禁止出现 .scss 与 lang="scss"」（不再读 STYLE_LANG 声明）；build-data.mjs TEXT_EXT 删 .scss。
  - **验证**：重建 t9-verify 工作区——init 产出 base.less/main.js import less/`<style lang="less">`/无任何 .scss；build OK（1 page, 1 components）；负向两条正确 FAIL（混入 bad.scss、页面改 lang="scss"）；build-data OK；无头浏览器 rows=5/tags=5/token 主色 rgb(0,103,209) 生效/boot 无错误。
- [2026-09-12] (cyc/W1-merge) **合入书峯 W3 N1-N4（merge eb2f495）+ 修复跨队 Windows 入口 bug（021d9e8）**：
  - 合并冲突两处均为我方超集（.gitignore 旧 3 行版、init.mjs D22 回退 vs 对方空改动），取 ours。
  - **重要跨队发现 — 入口判断 Windows 兼容 bug（10 处）**：书峯移植的 .mjs 脚本统一用 `import.meta.url === \`file://${fs.realpathSync(process.argv[1])}\`` 判断直接执行，POSIX 下恰好成立（real 以 / 开头拼出三斜杠），**Windows 下永不相等**（realpath 给反斜杠 → file://D:\... vs import.meta.url 的 file:///D:/...），main() 静默跳过、exit 0 假装通过。修复 10 处（tests×2 + 资产库 6 脚本 + installer + scripts/build_release）→ pathToFileURL 规范化。**教训：书峯报的「10 checks PASS」在 Windows 上实际只执行了部分用例**（token 传播用例此前从未真正跑过）；合入后 validate_package 10/10 PASS 才是真全过。W3 N5 删 .py 前建议书峯在 Windows 上重跑一次全套。
  - 连带：build_tokens.mjs 可跑后，其生成文件头注释（build_tokens.py→.mjs）模板更新落到库内 4 个生成文件 → refresh_release 重锁 511 哈希（sourceReleaseSha256 变更，这是 py→mjs 移植的预期产物，N5 时无需再锁一次版本号，最终重锁走 build_release --version 1.5.1）。
- [2026-09-12] (cyc/W1-xplat) **跨平台适配完成 — Mac（书峯）/ Windows（cyc）双侧全绿**（commit c808514 + 518636c）：
  - **migration_diff.mjs（N1 对照框架）18/18 PASS（Windows）**，连带修 4 类 Windows 差异：① py 无 UTF-8 模式时 GBK 代码页读 UTF-8 源报 UnicodeDecodeError → runPy 加 `PYTHONUTF8=1`；② py `write_text` 默认 newline=None 把 \n 翻译成 \r\n → 快照与 stdout 比较均 CRLF 归一（换行差异不算移植缺陷）；③ py 版 build_indexes 把 `str(Path(...))` 反斜杠路径写进 JSON 产物且 py sorted() 按字节序把反斜杠条目排最后 → 文本级归一无法同时消除分隔符与排序差异，templates.json 等改 **JSON 语义比较**（parse 后归一分隔符+数组重排）；④ release 锁/manifest 的哈希型 JSON 走结构化比较（哈希值占位，正确性由两侧各自 validate_library 全绿保证）。
  - **validate_coordination.mjs 7/7 PASS（Windows）**：fresh install 用例原来调 installer/install_skills.py，Windows 无解释器直接死 → 改跑 installer/install_skills.mjs（主链路等价）。
  - **Python 3.12.10 已装**（winget，`C:\Users\Tony\AppData\Local\Programs\Python\Python312`；Windows 官方包只有 python.exe，无 python3/py launcher——脚本用候选列表 ['python','python3'] 兜底）。migration_diff 仍依赖 Python 跑旧 .py 对照，**N5 删 .py 后该依赖自然消失**。
  - 结论：**两平台都已配好**。入口判断 bug（10 处）+ 本轮测试框架差异修复后，三套测试在 Windows 全绿：migration_diff 18/18、validate_package 10/10、validate_coordination 7/7；书峯 Mac 侧 N1-N4 交付时同套测试通过。书峯 N5（删 .py + build_release --version 1.5.1 重锁）前无需再专门回 Windows 验证——对照框架已证明 py 与 mjs 产出语义一致，删 .py 后 validate_package/coordination 纯 Node 化，不再有解释器差异面。
  - 连带：.gitignore 加 `__pycache__/`（migration_diff 跑 .py 的字节码缓存不入库）。
- [2026-09-12] (cyc/W1-T7pre) **T7 前置两小修完成**（W4 发现 1+2 落地）：
  - init.mjs 头注释删除 `src/README.md` 行（选择删注释而非补模板——W4 已把二开说明改道 `src/api/{slug}.js` 文件头 + code-conventions，再补 README 会形成第二份说明源）；连带修第 157 行注释。
  - starter 模板 `{{ t.title }}` → `{{ t.title.zh }}`（locales.js 中 title 是 `{zh,en}` 对象，原样渲染成 `[object Object]`；与 code-conventions.md:96 示例对齐）。
  - 冒烟：init RESULT: OK（ASSETS_VERSION 1.5.1）+ build RESULT: OK，产物中 `t.title.zh` 生效。
- [2026-09-12] (cyc/W1-T7) **T7 端到端验收通过**（无头 Chrome 实测，非仅编译）：
  1. **hybrid 页**（device-monitor，48 条 mock、20 行表格）：init 1.5.1 → collect_component 双组件（GMetricCard + GStatusTag，闭包+来源注释+interop 垫片全对）→ build OK → 浏览器渲染 20 行、4 张 KPI 卡、状态标签色系正确（success 11/danger 3/warning 4）、`data-surface="brand"` 主卡底色 rgb(0,103,209)=资产 token #0067D1。
  2. **free 页**（alarm-insight，手写看板）：7 根趋势柱 + 6 条告警全渲染，COMPONENT_MODE='free' 落 constants。
  3. **明暗切换**：`setTheme('dark')` 后 `--color-brand` #0067D1→#2E86DE、success tag 底→#00291D（语义暗层生效）；**自定义皮肤**：theme-deep-blue.css 按插槽协议注册后 `--color-brand`=#105cf6 生效；**毛玻璃**：`data-material="frosted"` → backdrop-filter blur(20px)+半透明表面（frosted.css 预设链路通）。
  4. **二开演练**：api/{slug}.js 换「假 axios」实现（URL/方法对齐真实后端形状），页面零改动正常取数。
  5. **gts 验收**：`grep -riI gts skills/generate-ux-prototype/` 唯一命中是 vendored sfc-loader 里的 `SVGTSpanElement`（SVG 标准类型），源码/文档/配置零命中。
  - **发现并修复：sfc-loader 0.9.5 预览运行时 bug**——`el-pagination` 传单向 `:current-page` prop 时整个组件渲染成注释节点（v6/v10/v11 矩阵复现，`@current-change` 或 `v-model:current-page` 均正常）。修复：页面用 `v-model:current-page`/`v-model:page-size`。**code-conventions 需补一条**（T7 后续）；真实 Vite 工程不受影响。
  - 产物：`%TEMP%/t7-verify/{device-monitor,alarm-insight}`（临时目录，不入库）。
- [2026-09-12] (cyc/W1-T7fix) **i18n 渲染缺陷修复（用户验收发现）**：T7 两个演示页与 starter 把 `{{ t.title }}` 插值到 `{zh,en}` 对象上，界面渲染成 JSON 串。根因是「模板手动 `.zh`」约定本身易错（照规范写也会漏）。修复：locales.js 改为 **`messages` 双语言源 + `t` 按 `LANG` 展平成字符串**（`Object.fromEntries`，string 直通兼容单语言页），模板统一 `{{ t.xxx }}`，code-conventions §6 重写并**禁止手动 `.zh`**；init 脚手架与 T7 两演示页同步修正（含 metric `:key` 的 m.title.zh）。浏览器复验：两页 + 新 init 冒烟产物 JSON 泄漏 0、中文词条正常。接 vue-i18n 路径不变（拆 messages 进 JSON，模板零改动）。
- [2026-09-12] (cyc/W1-T7fix2) **i18n 目录规范化（用户拍板）**：页面词条从 `views/{slug}/js/locales.js` 迁到 **`src/locales/pages/{slug}.js`**——语言资源统一在 `src/locales/` 下（lang/*/common.json 跨页共享 + pages/{slug}.js 页面级），对齐主流 vue-i18n 工程直觉。D15 单文件双语言 + t 展平不变。改动：init.mjs（6g 写入位置 + starter import + 头注释）、SKILL.md、code-conventions §6/§8 路径表、T7 两演示页迁移并 build+浏览器复验通过。
- [2026-09-12] (cyc/W1-T7fix3) **组件落位平铺（用户拍板）**：复用 G 组件落位从 `src/components/{basic|business|complex}/GName/` 改为 **`src/components/GName/` 平铺**——资产库的 basic/business/complex 分类只保留在来源注释里，不映射成工作区目录（Vue 工程通用习惯；collect_component.mjs 落位路径/COPIED/ENTRY 输出同步去层，spec level 字段仍与库路径交叉校验做布局 sanity）。init.mjs 始终创建 `src/components/`（含 .gitkeep，空目录也进 git）。文档同步：SKILL.md Step4/Step5、code-conventions §7 落位与 import 示例、§8 路径表、component-format.md:125；component-format.md:18 保留（资产库库内格式契约，库内目录分类不映射到工作区）。E2E 验证：init comp-smoke → collect g-status-tag → COPIED 平铺 GStatusTag/GStatusTag.vue → build OK；T7 演示页组件目录同步平铺并 build 通过（3 components）。
- [2026-09-12] (cyc/W1-D23) **scss 全仓库清零（D23 第③步，代执行——丰宁/书峯已下班，用户委托）**：资产库 tokens 层 Sass 源退役，纯 CSS 化。改动清单：① build_tokens.mjs 删 bindings/{element-plus,index}.scss.tpl 两模板、改产 `tokens/index.css`（平铺 @import 十二层，头注释统一 /* */ 风格）；② 库 src/index.ts / main.ts import `../tokens/index.scss` → `.css`；③ 库 package.json 删 sass devDep（lock 同步 -391 行）、`exports."./tokens"` 改指 index.css（接口契约变更，设计师侧下游需知会）；④ asset-manifest prototypeBaseFiles 两 scss → index.css；⑤ init.mjs 删 T9 的 scss 剪裁 + 平铺 index.css 生成段与 rmSync（库直产、拷贝即可，index.css 保留库 GENERATED 头）；⑥ validate_package 第 6 条改查 index.css 层传播（brand-50/space-16 → primitive.css + index.css 含 @import "./primitive.css" 且无 scss 引用）；⑦ validate_library 扩展清单去 .scss；⑧ 顺手清死代码：tokens.json 删 element-plus-6 组（EP 官方 theme-chalk 无 --el-alert-title-color/-description-color，V1.3 死变量）与 element-plus-dimensions 组的 el-compile-* 六值（仅被已删的 scss 编译桥消费）+ element-plus.css.tpl 对应 .el-alert--warning 规则；⑨ 库 README / design/color-rules.md / component-format.md §2 文档同步；⑩ refresh_release 重锁 401 哈希（锁内 scss 0 命中）。**验收全过**：`find . -name "*.scss"`（排除 node_modules/.git）0 命中、git 跟踪 scss 0；npm ci（无 sass）+ build:library ✓ 211 modules；build_tokens 18 outputs 稳定；validate_package 10/10 + validate_coordination 7/7；init 冒烟（tokens 纯 css、无 init 覆盖头）→ build OK。历史冒烟产物（p0-workspace 旧工作区）含 scss 已随清理删除；examples/ 两演示页 index.css 内容等价（头注释差异）保留不动。
- [2026-09-12] (cyc/W1-review) **全仓库代码评审清理（用户发起）**：① **N5 漏网修复**——资产库 7 个文档（README / components/README / design/{color-rules,icon-rules,rules,frosted-glass} / frontend README）残留 .py 命令，全部改 .mjs；frontend README 的 resolve_source_assets.py 引用指向替换工程中已消亡的脚本，整句改为「页面模板源码只读参考」；rules.md「生成 CSS/SCSS」改「生成 CSS 分层」。② 死代码：init starter 删 STYLE_LANG 常量（D22 后是无人消费的占位）与 starter 未使用的 COMPONENT_MODE import；preview scaffold 删死 router/index.js（init 无条件覆盖重写，scaffold 版永不生效——连带 init 补 mkdirSync(router) 防 writeFileSync 无目录 FAIL）。③ 遗物清理（前一轮）：T8 时代 npm 源包 sass/immutable 两个 tgz 删除 + .gitignore 失效条目清理。④ 评审确认保留：components/ 目录（specs=collect 组件源、templates=六套模板源、index.json/templates.json=query_assets 摘要，全主链路）；migrate_components.mjs（designer M3 --check 活流程）；check_frost_*.cjs（设计师可选 QA，VALIDATION.md 引用）；collect 的 split('\') 防御。⑤ 验证：validate_package 10/10 + validate_coordination 7/7 + validate_library valid + refresh 重锁 + init→build 冒烟 OK。
- [2026-09-12] (cyc/W1-setup) **设计师傻瓜式安装（用户需求：设计师不懂代码，要在自己的 agent 上一键装好并用上 assets）**：① 新增 `installer/setup.mjs` 交互向导——自动探测常见 skills 目录（~/.claude/skills 等 4 处）供选择、无候选时手动输入；已装同版本自动 --rebind、旧版本拒绝并提示先移除（不越权删用户文件）；完成提示三步（配置 skills 来源 / 直接说话 / 包勿删）。② 包根双击入口：INSTALL-Windows.bat / INSTALL-mac.command / INSTALL-linux.sh（调向导）。③ **根治路径依赖（此前裸调 init 不带 --assets-root 会 FAIL）**：init.mjs 探测链插入绑定文件候选（agents/package-location.json 的 packageRoot）；collect_component.mjs 支持 [LIBRARY] 省略（自动读绑定 + 包根→库目录下钻，4 参旧形态向后兼容）。④ 文档同步：README 安装段分「设计师推荐/命令行/脚本」三层；SKILL.md Step4、usage.md、code-conventions §7 的命令示例标 LIBRARY 可省略。**验证**：沙箱安装 → init/collect/build 全链零路径参数通过（COPIED GStatusTag → build OK 2 components）；同版本重跑自动 rebind ✓；validate_package 10/10 + validate_coordination 7/7。
- [2026-09-12] (cyc/W1-setup-fix) **安装入口形态修正（用户澄清）**：① 使用者不是双击文件的场景——设计师在**自定义 agent 对话里**用 skill，双击入口（.bat/.command/.sh）退役删除；安装改为「AI 代跑 `node installer/setup.mjs`」，README 安装段改写（说一句话让 AI 装）。交互向导保留：AI 可代答或用户直接传参，两条路都通。② coder/（skill 试跑产物）退出版本控制并加入 .gitignore。验证：validate_coordination 7/7。
- [2026-09-12] (cyc/W1-examples-del) **examples/ 两个 T7 演示页删除（用户拍板）**：包体积 942.7k → 58017k 的主因是 T7 两演示页固化入库（cc312a9，git 跟踪 +42MB：HarmonyOS 字体 4 字重 ×2 份 + element-plus 运行库 ×2 份）。用户拍板「直接删掉，什么都不需要保留」：t7-device-monitor / t7-alarm-insight / t7-README.md 三者已删。引用面核实：全仓库仅 t7-README.md 自引用，无悬空；README.md 引用的 frosted-color-card.html 是另一毛玻璃离线示例（数 KB），不属此决策，保留。T7 验收结论以本卡 W1-T7/T7fix/T7fix2/T7fix3 各条回写为准，不受影响；D23 回写「examples/ 两演示页……保留不动」的表述由本决策取代。删后 git 跟踪体积 76.7MB → 35.1MB；validate_package 10/10 + validate_coordination 7/7。skill preview 自带字体（~17MB）用户明确不砍。注：删除暂存被并行会话吸收进 7391f33（docs(setup)）提交，内容正确、提交归属混杂。
- [2026-09-12] (cyc/W1-gitkeep) **.gitkeep 退役（用户发现）**：init 创建 src/components/ 时不再写 .gitkeep——该文件只在"空目录要进 git"时有意义，而实际场景 collect 很快填入组件，残留反而混进交付件（T7 试跑两次都出现）。连带发现真 bug：init 末尾 removeEmptyDirs 会把空的 src/components/ 删掉（当年 alarm-insight 没有 components 目录的根因）——此前一直靠 .gitkeep 占位才幸免。修复：KEEP_EMPTY 集合豁免 src/components（用户拍板的"始终创建"语义），目录空着也保留；.gitkeep 生成行删除；examples 演示页内残留的 .gitkeep 清除。验证：init 产出 components 空目录在、无 .gitkeep、build OK、validate_coordination 7/7。

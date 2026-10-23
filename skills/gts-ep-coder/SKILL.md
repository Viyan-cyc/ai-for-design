---
name: gts-ep-coder
description: 根据用户需求生成 Vue 3 + Element Plus 2.13.5 页面（.vue SFC），样式严格遵循 design-language 设计 token；输出离线可开的双击即看 HTML 预览与可拷入真实工程的 src/ 源码。做页面、改页面、看效果时使用。
version: 0.2.2
---

# gts-ep-coder

把自然语言需求变成 Vue 3 + Element Plus 2.13.5 的 `.vue` 页面，样式严格走 design-language token 体系（见 `references/design-language.md`）。

交付两件东西：

1. **`index.gts-ep.html`** —— 离线预览（本地 UMD 运行时 + 浏览器内 SFC 编译，双击即看，无需服务器）；
2. **`src/`** —— 标准工程源码，可整目录拷入任何 Vue 3 + Element Plus 2.13.5 工程（接入说明见 `src/README.md`）。

页面代码是主交付物；预览 HTML 只是让你和用户**当场看到编译渲染结果**的手段。

---

## 验证失败与重试上限

- 同一批交付首次验证失败时，汇总本轮全部已发现的错误，集中修复后重跑；最多进行 2 轮修复重跑，即首次验证加 2 次重跑，最多 3 轮验证。
- 一轮指执行本次交付既定的必要检查；每次针对失败集中修改代码、配置或环境后重新验证，计一轮修复重跑。一轮内不同检查各执行至多一次，不分别计轮；前置检查失败时，不强行执行依赖它的后续检查。本规则不新增浏览器、运行或其他验收要求。
- 每轮修复重跑必须有针对错误的修复。同一错误再次出现，且没有新的诊断依据或可行修复方案时，提前停止；有新依据和方案的，也只能在剩余额度内继续。脚本自身异常或环境失败时，按已有 HINT 处理，遵守原有编辑边界；无法解决则报告阻塞，不反复执行同一失败操作。
- 达到上限仍失败，明确报告“未通过”，说明剩余错误、相关日志及源码位置；不得声称完成、绕过检查或降低验收标准。仅提供已有源码或预览时，标明其验证状态。
- 额度按同一批交付累计，不因切换错误、检查项、内部步骤或对话轮次重置。仅用户提出新的修改任务或明确要求继续时开始新的验证批次；澄清需求或询问进度不重置额度。


## 工作流

```
⓪ 确认 node  →  ① ensure-env  →  ② init 建工程  →  ③ 写 .vue 页面  →  ③.5 fetch-icons  →  ④ build 门禁  →  ⑤ 交付
  (没有就装)                                    ↑                 │
                                                └── build 验证未过 ─┘  最多2轮修复重跑
```

> 页面首次使用图标或图标引用集合变化时执行 fetch-icons；只改数据/样式不重复执行，无图标可直接 build。
> build失败按“验证失败与重试上限”集中修复；若修复改变图标引用，再执行③.5。

脚本都在本 skill 的 `scripts/` 下，**除 ⓪ 的安装脚本外都要 node 才能跑**。
工作流脚本的输出采用以下格式，**先读 `RESULT:` 那一行再决定下一步**（可选的 `query-tokens.mjs` 返回 JSON，读取其 `result` 与每项 `status`）：

```
RESULT: OK
KEY: value …

RESULT: FAIL | <CODE>: <原因>
HINT: <可直接执行的下一步>
```

### ⓪ 确认 node —— 机器上没有 node 时，**装它是你的活，不是用户的**

先跑 `node -v`：

| 结果 | 怎么办 |
|---|---|
| 有版本号输出 | 直接进 ① |
| `command not found` / `不是内部或外部命令` | 直接跑安装脚本（见下）。装环境本来就在本 skill 职责范围内，用户全程不该接触安装命令 |

```bash
# macOS
bash "<skillDir>/scripts/install/install.sh"
```
```powershell
# Windows
powershell -ExecutionPolicy Bypass -File "<skillDir>\scripts\install\install.ps1"
```

`<skillDir>` 就是**本文件（SKILL.md）所在目录**，照着拼绝对路径。这两个脚本是 bash / PowerShell
原生的，不需要机器先有 node；没有时它们会先从内网 manifest 下载 portable node（带 sha256 校验），
**内网不通时自动回落到 skill 内置的 fallback manifest（npmmirror 包源，node v24.16.0，同样带
sha256 校验）**，然后自动接续 `setup-env.mjs` 装 compiler 依赖（**npm-only，本 skill 不用 yarn**；
npm 源也带两级回落：内网源 → 公网 npmmirror）。

机器上已有能跑的 node 时它们会直接复用（任意大版本，无版本门禁），日志里 `[node] source: system`
就是走了这条路——**不要因为"没看到下载"就以为它没装**。内网 manifest 拉取失败且走了回落时，
日志会出现 `[manifest] primary unreachable, using fallback` / `using fallback manifest` 这类行，
属预期行为；实在装不上（两源都失败）会报 `MANIFEST_UNREACHABLE` / `NPM_INSTALL_FAILED` 并给
`HINT:`。

升级 node 版本时：内网 manifest 与 `references/fallback-node-manifest.json`（file/sha256/baseUrl）
需要同步更新，保持两个来源版本一致。

装环境要几分钟，告诉用户正在装。装完回到 ①。

### ① `ensure-env.mjs` —— 每个会话开头跑一次

```bash
node scripts/ensure-env.mjs
```

校验三件事：node 可用（共享池 portable node 优先）、`@vue/compiler-sfc` 可加载（真实编译器，
build 门禁用）、`env.lock.json` 的 lock hash 与 skill 携带的 `package-lock.json` 一致。

| `RESULT: FAIL` 的 CODE | 怎么办 |
|---|---|
| `COMPILER_MISSING` / `ENV_LOCK_MISSING` / `ENV_OUTDATED` | **直接执行 `HINT:` 里那条命令**（`setup-env.mjs` 或 install 脚本），完成后重跑 ensure-env。要几分钟，告诉用户在装环境 |
| `ENV_CONFIG_BROKEN` / `SKILL` 组装不完整 | 停下。这是 skill 没组装好，不是用户能解决的问题，如实说明并给出 `HINT` 里的路径 |
| `COMPILER_LOAD_FAILED` | 按 `HINT:` 重装依赖；仍失败把输出整段报给用户 |

**装不上时把 `RESULT: FAIL`、`DETAIL:`、`HINT:` 原样报给用户**——那是环境问题，人的活（见硬约束 0.2）。

### ② `init.mjs` —— 每个需求建一次工程（幂等）

```bash
node scripts/init.mjs "<artifact-folder 绝对路径>" "<slug>"
```

- `<slug>`：小写英文/数字/连字符，2–6 段（如 `login-form`、`device-list`）。
- 返回值记住三个：`HTML_PATH`（预览入口）、`SRC_DIR`（你写代码的地方）、`PAGE`（init返回的PascalCase页面目录名，如DeviceList）。

init 会生成完整骨架：`index.gts-ep.html` + `public/library/`（UMD 运行时）+ `src/`（App.vue、
main.js、api 服务层示例、主题三件套、starter 页面）。
**默认不含任何切换 UI**（国际化 / 主题切换均为按需能力，见下方判据）。

### ③ 写代码 —— 主战场

**只写 `src/` 下**：页面放 `src/pages/{Page}/index.vue`（一页一目录，子组件/样式放同目录），
`App.vue` 修改挂载与需求明确的装配。主题 css（`src/assets/themes/`）与 `index.gts-ep.html` 是交付件骨架，
不改不删；换肤按 `src/assets/themes/README.md` 协议追加。

#### 必须遵守的代码规则

编码前完整读取 `vendor/vue-skill/references/code-rules.md` 并遵守所有适用条款；当前有效上下文已完整读取同版本时复用，不重复加载。该文件是项目编码规则的统一来源，不能以熟悉Vue、主入口摘要够用或追求速度为由跳过。

其中包含组件职责拆分、800行审视界线、同构与嵌套循环、服务/mock与中英文分层、交互状态、命名、样式、通信和资源清理。编写同构区域时先组织配置数组，再写一份循环模板；不同图标或翻译key不构成重复手写的理由，详见规则5.8。交付前必须做一次代码自查，见该文件最后一节；构建通过不能代替规范自查。它们是编码要求，不新增机器门禁。

#### 资料怎么读

代码规则必读；下面的token目录、组件API与详细示例才按需查询，每次查询解决一个具体不确定项：

- **Token**：先复用已核实名称或常用速查。名称或用途不确定时，可用 `node scripts/query-tokens.mjs "次要文本" "边框" "--color-brand" --limit 5` 一次批量查询；返回真实候选、用途和值，未命中明确列出。只复制返回名称，不拼接前后缀；结果截断时缩小关键词，不因此读完整目录。已有准确名称就直接写，不强制查询。 多个参数分别查询；同一参数内空格表示同时满足，查不同用途请分参数。常用中文词可归一化为候选类别，未命中会给分类提示；准确名称不自动纠正。
- **组件**：用法确定就直接写；不确定时搜索 `vendor/vue-skill/references/components_index.md` 定位，只读对应示例中有关的属性、插槽或事件。示例仍不能回答时，再定向查对应资料，不从其他组件推断API。
- **布局**：需要结构参考时才查 `vendor/code-example/references/README.md` 或 `vendor/vue-skill/templates/README.md`，选一个合适起点；没有合适项就按需求编写，不继续遍历示例库。示例的数据、slot和接口占位按业务补全。
- **规则与自查**：按上面的必读约定执行；自查覆盖全部适用规则，不以“没有报错”跳过。需要错误示例解释时才查 `error-checklist.md`，不用反复阅读同一示例。
- **名称**：组件导出或EP图标名称不确定时，用宿主已有搜索工具批量查 `scripts/verify/whitelists/`；组件标签清单是 `el-xxx`，导出和图标清单是 PascalCase，不混查格式；不临时编写 `node -e` 等探针，也不为每页做全量名称预检。公司图标仍走③.5的原检索流程。

普通按钮、输入框、表格等直接使用组件和桥接主题，状态样式由组件承担；不重新查配色并逐项覆盖。只为页面布局、内容层级或明确的视觉需求选择额外token。查询用宿主已有工具，不要求安装rg；正常使用只执行指定脚本，不为了解脚手架而读取运行库实现。

找到足够信息就停止，直接继续编码；当前上下文已有且未变化的内容不重复读取。匹配行无法解释用途时才扩大到相关分类或条款，不为了读完整个参考库而补读无关文件；本项不免除必读代码规则。`vendor/` 只读；详细资料分工见 `vendor/README.md`，不要求每页先打开该入口。

#### 数据走服务层（src/api/）

- 业务记录、统计值、图表数据经 `src/api/{模块}.js` 的语义化函数（返回 Promise）获取，**页面不直接 import
  mock 数据文件**（它们放 `src/api/mock/`，只被 api 层消费）。starter 的 `api/demo.js` 是样例。菜单/栏目结构、按钮配置与枚举映射是UI配置，可在组件内声明；包含业务记录时仍走服务层。
- 对接真实后端 = 改 `api/` 实现（换 fetch/axios），页面零改动——这是服务层存在的意义。
- 新增接口按同样式扩展：每个业务模块一个 `api/{模块}.js`，mock 数据沉到 `api/mock/`。
- 交付卫生：完成页面和服务源码替换、业务不再引用starter后，在最终build前运行
  `node scripts/cleanup-starter.mjs --dir "<工程目录>"` 清理预置的 `api/demo.js` 与 `api/mock/demo-data.js`。
  脚本仅删除仍为starter原样的文件，已改造内容WARN保留；安全规则不变，不手动删用户文件。
- 源码修改、清理及必要取图均完成后，再运行最终build，避免先build再固定清理重跑。
  `src/README.md` 是通用接入说明，无需按每页业务改写模块名；仅修改README等非运行文档不重跑build。

#### 国际化：按需启用（默认不含任何 i18n 代码）

- **用户没提国际化 → 页面直接写中文**（starter 页默认直接中文，改动为零）。
- **用户要求国际化（或明确多语言）→ 该工程启用**，最小集：
  1. 装配：从 `scripts/preview/i18n-scaffold/` 拷贝 `i18n/` 到工程 `src/`（含 createI18n、
     locales、EP_LOCALES 映射；复用公共接线，词典按业务成对更新并清理demo词条，不复制两套Vue页面）；
  2. 文案 key 化：页面用 `const { t } = useI18n()` + key（key 命名 `msg.{页面}.{分类}.{语义}`，
     至少 3 个点，见 code-rules 规则 10.2）；
  3. 词典进 `src/i18n/locales/{zh-cn,en}.js`（**两份 key 集合必须一致**，en 缺失会回落中文）；
     - 词典边界（只收两类，判定法：对接真实后端后词条还用得上吗）：
       ① 界面文案（标签/按钮/占位符/提示/空态）；
       ② 枚举显示名——封闭集合的 code→label（如 level/status/业务域），存于数据的只有 code，
          显示文案由 `t()` 解析；对接后端后词典保留，仅把 code 集合对齐后端枚举表。
       记录内容**不进词典**：标题/描述/设备或资源名称/人名/时长等开放文本，存于 mock、
       对接后被真实数据取代，组件不得对数据值做 `t()` 包装（否则真实数据会显示 key 路径，
       破坏「页面零改动」契约）。拿不准封闭/开放时，按记录内容处理。
  4. App.vue 接线 + 切换 UI：**UI 形态按用户描述决定**（图标/下拉/菜单项均可），参考实现见
     `references/on-demand-toggle.md`（含预览必需：统一安装须先于 `useI18n`，EP 文案经
     `ElConfigProvider` 跟随）。真实工程入口通过 `installI18n(app)` 在mount前安装；仅启用国际化时允许对main追加该接线，不改其他骨架。
- 启用 i18n 的工程，`ElMessage` 等命令式提示文案同样走 `t()`。

#### 主题切换：机制常驻，UI 按需

- 换肤**机制**随工程交付（`src/assets/themes/` 协议：一皮肤一文件（.less）、`html[data-theme="{name}"]`、
  bridge.less 自动跟随、新增皮肤插槽）——这部分不删不用重做，页面颜色全程走 token。
- **切换 UI 默认不在**。用户要求深浅切换 → 接入 UI，**形态按用户描述决定**（图标 toggle/
  下拉/菜单项均可），参考实现见 `references/on-demand-toggle.md`。
- **内置 default + dark 两套皮肤**。两套皮肤均由 gen-tokens 从 `design-language/样式Token/设计系统.md` §1.2 统一双主题表（`Token｜用途｜Light｜Dark`）生成，无工程回填项。

#### 页面自适应（桌面区间弹性）

- 所有页面按桌面区间弹性交付（约 1024–1920+）：布局折叠式（内容重排），不做等比缩放。
- 编码规则见 `vendor/vue-skill/references/code-rules.md` 第十二节（容器流式、ElRow/ElCol
  响应式栅格、宽度纪律、@media 口径、表格自适应）；断点与窗口适配口径见
  `references/design-language.md` §3.3。
- 布局按上述响应式口径编写；完成规则自查且构建通过后交付预览链接，不要求agent打开浏览器或执行多视口测试；未运行不宣称视觉验收。

### ③.5 `fetch-icons.mjs` —— 图标检索替换（有新增或变化的图标时）

```bash
node scripts/fetch-icons.mjs --dir "<工程目录>" [--base-url <url>] [--timeout <ms>]
```

页面首次使用图标或图标引用集合变化时，在 build 前执行；引用未变可沿用已有结果。

扫描 `src/` 下所有 `.vue`/`.js`/`.mjs` 中 `@element-plus/icons-vue` 的实际 import，去重后批量请求
IconPlus API（探测即取配置，再 `getIconInfo → getIcon×2` 并行拉深浅两套），命中的图标生成深浅
两套 SVG 文件 + barrel `src/assets/icons/index.js`。预览 moduleCache 自动合并 barrel 与 EP 图标：
**命中 → 公司 SVG（data-theme 纯 CSS 切换深浅），未命中 → EP 原样**。
**重跑是增量的**：图标名对应的双文件（`.light.svg` + `.dark.svg`）已落盘即跳过网络、文件原封
不动——已确认的图标不会被后续轮次改写；只检索新出现的名字。

- **执行时机**：首次有图标或图标引用集合变化时，在 ④ build 前执行
- 页面照常写 `import { Search } from '@element-plus/icons-vue'`，
  fetch-icons负责检索并接到本地统一图标入口；命中用公司图标，未命中仍用EP
- **默认 base-url**：`https://octo.hdesign.huawei.com`（可通过 `--base-url` 覆盖）
- **超时**：配置探测固定5s；搜索与深浅SVG请求各默认10s（可用 `--timeout` 调整）。探测、搜索、并行下载分阶段执行，总耗时不是10s上限；无自动重试。配置不可达回退EP，搜索异常报FAIL，下载缺失按下述规则回退
- `RESULT: OK` + `RESOLVED: <n>, MISSED: <m>, CACHED: <c>` → 继续走 ④ build
  （CACHED 是其中来自缓存、未发网络请求的图标数；`CACHED: n` 且全量命中时本轮零请求）
- `RESULT: FAIL |` → 报给用户（服务异常）。已落盘的命中文件仍有效，不影响 build
- **IconPlus 不可达时**：脚本输出 `RESOLVED: 0, MISSED: <n>` 正常退出（全部用 EP 原样），不是 FAIL
- **匹配边界**：优先英文名称精确匹配，否则选候选最高分；名称有效不等于业务语义必然正确，不自行调整接口、评分阈值或搜索协议。
- **深色缺失**：浅色成功、深色未返回时复用浅色并写出双文件；后续视为缓存命中，不会自动补取深色。双文件存在不等于两主题均独立获取成功。
- **miss 是正常的**：不是所有 EP 图标名都能在公司库命中，未命中的保持 EP 原样，页面天然完整
- 页面没有使用图标时可直接 build；手动执行也会正常输出 `RESOLVED: 0, MISSED: 0`

### ④ `build.mjs` —— 编译与交付检查

```bash
node scripts/build.mjs --dir "<工程目录（含 src/）>"
```

build 用真实 `@vue/compiler-sfc`（parse + compileScript + compileTemplate）编译每个 `.vue`，
并做 token/样式纪律检查。首次跑之前确保 ① 已通过。**错误一次全列出**：FAIL 时逐条给
`ERROR: <file>: <msg>`，一轮改完再跑即可，不用逐个试。

- `RESULT: OK` → 拿 `HTML_PATH` 走第 ⑤ 步；这是静态构建通过，不代表已做浏览器运行验收。构建输出 `index.gts-ep.html`；旧工程中已有的其他HTML不自动删除，交付以本次 `HTML_PATH` 为准
- `RESULT: FAIL |` → 读每条 `ERROR:`（含 `file:line`），改代码，**再跑一次 build**。
  代码问题在重试额度内集中修复；达到上限或提前停止时如实报告未通过
- `WARN: ...`（token 有 fallback 但未定义、样式内出现 hex 等）→ **必须处理**，
  不因为 `RESULT: OK` 就当作做完了
- 另：修改 `src/` 后预览 HTML 不会自动更新，完成本轮源码修改后重跑build刷新 `preview-data.js`；仅README等非运行文档修改不需要

> 编译失败 ≠ 报告用户。`verify` 的编译错误、白名单错误、token 违规都是你自己的代码问题，
> 按提示在重试额度内修复；达到上限或提前停止时报告未通过。**环境类失败**（装不上、compiler加载不了）按HINT处理或报告阻塞。

最终build前按code-rules最后一节完成一次自查并直接修正偏差，不新增检查命令或报告。

build同步固定预览加载器，使已有工程使用当前解析规则；业务src不因此重写。源码映射仅在检查通过后刷新。共享工具池新增Less校验依赖，ensure提示过期时按HINT更新一次。

### ⑤ 交付 —— 不能省

build 返回 `RESULT: OK` 之后，必须向用户交付预览页面的可点击链接：

```
预览：<HTML_PATH 的绝对路径>（双击用浏览器打开）
```

**预览路径必须输出为 artifact 链接**（不是纯文本），让用户可直接点击打开。源码在 `<SRC_DIR>` 下，
无需作为链接输出。

**这一步没做，整件事就不算完成**，和 build 不通过是同等级别的未完成。

---

## 硬约束

### 0. 绝不删除用户磁盘上的任何东西 —— 这条没有例外

**禁止执行任何删除命令**：`Remove-Item` / `rm` / `rmdir` / `del` / `git clean`，不论加什么参数、
不论那个目录看起来多像垃圾残留。清理是 skill 脚本自己的职责，不是你的。

目录名乱码极可能是正常中文目录——编码显示问题从来不是删除的理由。建目录/复制失败时原样报告，
让用户自己看。同理禁止：`sudo`（agent 没有交互通道，会静默挂住）、改用户机器的全局配置
（`~/.npmrc`、shell profile、系统代理）。脚本自己的开关（`--env-dir` 等）不在此列。

### 0.1 不要绕过脚本

脚本失败时，**唯一正确的动作是按 `HINT:` 处理或如实报告失败**：

| ❌ 禁止 | 为什么 |
|---|---|
| 自己起 dev server / vite 代替 build | 绕过 build 就没有编译门禁，你会开始"我觉得应该好了" |
| 修改、调试 `scripts/` 下的任何文件 | 那是 skill 的一部分，不是本次任务的产物。脚本有 bug 应该报告 |
| 环境装不上就换个方式硬凑 | 凑出来的环境与用户的不是同一个。装不上是环境问题，报给用户 |

**脚本报错按“验证失败与重试上限”处理。**（环境类失败原样转达；
build的编译/token错误在重试额度内修复，达到上限或提前停止时如实报告。）

### 0.2 「装环境」是你的活，「装不上」才是人的活

| 情况 | 谁的活 |
|---|---|
| 机器上没有 node / compiler 依赖缺失 / lock 过期 | **你的活。** 跑 ⓪ 安装脚本或 `HINT:` 给的命令，自动装完继续 |
| 装的过程失败（下载不动、sha256 不匹配、权限不足） | **人的活。** 把 `RESULT: FAIL` + `DETAIL:` + `LOG:` 路径原样给用户 |

**说"装不上、卡在这一步"是诚实；换个东西糊弄过去是不诚实。**
以下兜底一律禁止：

- 让用户自己去 nodejs.org 下载 node（下载是安装脚本的活，npmmirror 直连）
- 生成"看起来像"的纯 HTML/静态图代替 .vue 源码（交付物是能拷进真实工程的组件代码）
- 手工改 `node_modules` 或绕过 `npm ci` 去凑依赖

### 1. build 不通过就不算做完

**这是最重要的一条。** 不允许在 `build.mjs` 没有 `RESULT: OK` 的情况下告诉用户"做好了"。
按前述验证额度修复；未通过时如实报告剩余错误。

### 2. 业务源码与固定骨架边界

| 允许 | 路径 |
|---|---|
| ✅ 新建/修改 | `src/pages/{Page}/` 下的任何文件 |
| ✅ 新建/修改 | `src/api/`、业务hooks/辅助模块与用户素材；请求多语言时的 `src/i18n/` |
| ✅ 修改 | `src/App.vue`（挂载页面与按需装配）；启用i18n时main仅追加规定的安装接线 |
| ❌ 不动 | `index.gts-ep.html`、`public/library/`、`src/main.js`（仅允许上行i18n接线例外）、`src/assets/themes/*.less`（交付骨架，改了换肤/预览体系就散了） |

换肤需求走 `src/assets/themes/README.md` 协议**追加**皮肤文件，不动既有三件套。

### 3. 页面代码规范（design-language）

- **样式一律 `<style scoped lang="less">`**；禁止 `:root` / `html` / `body` / `[data-theme]` 选择器（build 会拒）。
- **所有颜色走 token**：`var(--color-brand)` 这类规范名；页面局部派生值用 `--page-*` 前缀定义；页面不得定义 `--el-*`，已有运行时变量可引用。
  页面里不写 hex 色值；build对硬编码hex给出WARN，按前述要求处理。名称检查不验证每处CSS继承/作用域，局部 `--page-*` 定义必须覆盖其使用位置。
- **只用真实 Element Plus 组件**，模板标签一律 **PascalCase**（`<ElTable>`），模板里用到的每个
  组件、`ElMessage` 等命令式 API、vue 的 API（`ref`/`reactive`/…）**每个文件各自 import**——
  漏 import 编译能过但运行时白屏。编译宏（`defineProps` 等）不用 import。
- 图标从 `@element-plus/icons-vue` 导入（如 `import { Search } from '@element-plus/icons-vue'`）。
  EP 图标是**无宽高的裸 svg**，直接放模板里 font-size 控不住尺寸（会撑到 200px+）：
  - 裸 svg 图标必须包进 `<ElIcon :size="N">` 或显式写 `width`/`height`；
  - 组件自带包装（如 ElButton 的 `:icon` prop、ElMessage 的 icon 选项）不必再包；
  - 引用 svg 文件用 `<ElIcon><img …/></ElIcon>` 模式。
- 间距/圆角/字号/投影等同样用 token：`var(--space-size-16)`、`var(--radius-size-normal)`、
  `var(--shadow-1)`。
- 组件状态（悬停/聚焦/禁用/加载）由 Element Plus + 桥接层自动获得，页面不重绘状态色。
- **自适应纪律**：布局容器禁写死总宽（内容流式，控件固有定宽配 `max-width: 100%` 兜底）；
  字体禁用 vw/vh 视口缩放；多卡片用响应式栅格（细则见 code-rules 第十二节）。
  build 会对 `zoom` 与 font-size vw/vh 出 WARN。
- token 速查与协议见 `references/design-language.md`；组件/导出/图标白名单见
  `scripts/verify/whitelists/*.json`（EP 2.13.5：118 组件 / 534 导出 / 293 图标）。

#### UMD 运行时已知坑（预览跑 UMD、真实工程跑构建工具，行为有差异——按下面写法写两边都稳）

1. **跨组件命令式调用不用 `defineExpose` 方法**：模板 ref + `defineExpose` 暴露的方法在预览
   运行时下会报 "is not a function"。改用 **prop 信号 + 子组件 watch**：父组件递增一个计数
   prop，子组件 `watch` 它执行动作。
2. **ElPagination 分页状态用 ref 绑定**：静态 `:current-page="1"` 在运行时下组件可能静默
   不渲染。写法：`v-model:current-page`（或 `:current-page` 绑 ref）+ `@current-change`。
3. **中文 jumper 自组**：EP jumper 在运行时下显示英文 "Go to"。需要中文"前往 X 页"时不用
   jumper，自组 ElInput + 按钮，配合规则 2 的 `@current-change`。

### 4. vendor/ —— 参考资产（只读）

`vendor/` 已就位：`vue-skill/`（组件示例、code-rules、error-checklist、页面模板）、
`code-example/`（整页示例）、顶层 `README.md`（两块职责与读取路由）。代码规则按工作流③必读，其余资料仅在组件/API有疑问或需要结构参考时查询。**不要往 vendor 写任何东西**；vendor 是参考资产，不参与编译与 build 门禁，
示例中引用的 token 名拷入页面后由 build 检查。

---

## 交给用户的话怎么说

- 装环境时：说在准备环境、需要几分钟，不要贴命令和路径
- 修复过程中不逐条播报编译错误；通过、达到上限或提前停止时统一说明结果
- 做完时：给出预览 HTML 路径（双击即开），源码路径无需作为链接输出

## 已知边界

- 预览 HTML 依赖本地 UMD 运行时（`public/library/`），修改 `src/` 下运行源码后必须重跑build刷新源码映射；仅README等非运行文档改动除外
- `dayjs` 已被 Element Plus UMD 内置，页面代码仍可 `import dayjs from 'dayjs'`（映射已接好）
- 深色主题：dark 皮肤已全量正式化（由 design-language 统一表 Dark 列生成，覆盖全部 token，
  无缺口）；浅色／深色成对维护，改 token 先改 design-language 再重跑 gen-tokens，不手写深色值

## 维护回归（仅修改skill时）

共享环境更新后，维护者执行 `node scripts/verify-build.mjs` 和 `node scripts/verify-fetch-icons.mjs`。普通页面不执行它们。当前离线源码支持JavaScript、Vue SFC、CSS/Less和字面量动态import；不把TS/JSX、CSS modules或非字面量动态路径默认为可用。本地CSS依赖优先在JS中显式import；build会将已验证样式及资源路径编入离线映射，标准src保持原样。

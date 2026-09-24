---
name: generate-ux-prototype
description: 根据用户需求生成 Vue 3 + Element Plus 2.13.5 页面（.vue SFC），样式严格遵循 design-language 设计 token；输出离线可开的双击即看 HTML 预览与可拷入真实工程的 src/ 源码。做页面、改页面、看效果时使用。
version: 0.1.0
---

# generate-ux-prototype

把自然语言需求变成 Vue 3 + Element Plus 2.13.5 的 `.vue` 页面，样式严格走 design-language token 体系（见 `references/design-language.md`）。

交付两件东西：

1. **`index.gts.html`** —— 离线预览（本地 UMD 运行时 + 浏览器内 SFC 编译，双击即看，无需服务器）；
2. **`src/`** —— 标准工程源码，可整目录拷入任何 Vue 3 + Element Plus 2.13.5 工程（接入说明见 `src/README.md`）。

页面代码是主交付物；预览 HTML 只是让你和用户**当场看到编译渲染结果**的手段。

---

## 工作流

```
⓪ 确认 node  →  ① ensure-env  →  ② init 建工程  →  ③ 写 .vue 页面  →  ③.5 fetch-icons  →  ④ build 门禁  →  ⑤ 交付
  (没有就装)                                             ↑                        │
                                                        └── 验证未过 ────────────┘  循环至通过
```

脚本都在本 skill 的 `scripts/` 下，**除 ⓪ 的安装脚本外都要 node 才能跑**。
所有脚本的输出都是固定格式，**先读 `RESULT:` 那一行再决定下一步**：

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

- `<slug>`：小写英文/数字/连字符，1–6 段（如 `login-form`、`device-list`）。
- 返回值记住三个：`HTML_PATH`（预览入口）、`SRC_DIR`（你写代码的地方）、`PAGE`（主组件名）。

init 会生成完整骨架：`index.gts.html` + `public/library/`（UMD 运行时）+ `src/`（App.vue、
main.js、api 服务层示例、主题三件套、starter 页面）。
**默认不含任何切换 UI**（国际化 / 主题切换均为按需能力，见下方判据）。

### ③ 写代码 —— 主战场

**只写 `src/` 下**：页面放 `src/pages/{Page}/index.vue`（一页一目录，子组件/样式放同目录），
`App.vue` 只改挂载点。主题 css（`src/assets/themes/`）与 `index.html` 是交付件骨架，
不改不删；换肤按 `src/assets/themes/README.md` 协议追加。

动手前**先查 `vendor/`**（入口 `vendor/README.md`，两条直线按需取用）：

1. 需求是典型页面（表格+搜索+详情、图表看板等）→ 从 `vendor/code-example/references/` 选最接近的
   整页示例作起点，改造成本远低于从零写；
2. 具体组件用法拿不准 → 查 `vendor/vue-skill/components/` 对应示例；页面样式规则、文件组织、
   通信约定在 `vendor/vue-skill/references/`（code-rules.md 是总纲）。

生成后按 `vendor/vue-skill/references/error-checklist.md` 过一遍再交 build。不要往 vendor 写任何
东西；vendor 覆盖不了的非常规需求再扩展查 token 词汇（`references/design-language.md`）。

#### 数据走服务层（src/api/）

- 页面数据一律经 `src/api/{模块}.js` 的语义化函数（返回 Promise）获取，**页面不直接 import
  mock 数据文件**（它们放 `src/api/mock/`，只被 api 层消费）。starter 的 `api/demo.js` 是样例。
- 对接真实后端 = 改 `api/` 实现（换 fetch/axios），页面零改动——这是服务层存在的意义。
- 新增接口按同样式扩展：每个业务模块一个 `api/{模块}.js`，mock 数据沉到 `api/mock/`。

#### 国际化：按需启用（默认不含任何 i18n 代码）

- **用户没提国际化 → 页面直接写中文**（starter 页默认直接中文，改动为零）。
- **用户要求国际化（或明确多语言）→ 该工程启用**，最小集：
  1. 装配：从 `scripts/preview/i18n-scaffold/` 拷贝 `i18n/` 到工程 `src/`（含 createI18n、
     locales、EP_LOCALES 映射；**逐字拷贝，不要重写**——预览 moduleCache 与 build 白名单按此接线）；
  2. 文案 key 化：页面用 `const { t } = useI18n()` + key（key 命名 `msg.{页面}.{分类}.{语义}`，
     至少 3 个点，见 code-rules 规则 10.2）；
  3. 词典进 `src/i18n/locales/{zh-cn,en}.js`（**两份 key 集合必须一致**，en 缺失会回落中文）；
  4. App.vue 接线 + 切换 UI：**UI 形态按用户描述决定**（图标/下拉/菜单项均可），参考实现见
     `references/on-demand-toggle.md`（含预览必需：幂等补装须先于 `useI18n`，EP 文案经
     `ElConfigProvider` 跟随）。真实工程入口需 `app.use(i18n)`。
- 启用 i18n 的工程，`ElMessage` 等命令式提示文案同样走 `t()`。

#### 主题切换：机制常驻，UI 按需

- 换肤**机制**随工程交付（`src/assets/themes/` 协议：一皮肤一文件（.less）、`html[data-theme="{name}"]`、
  bridge.less 自动跟随、新增皮肤插槽）——这部分不删不用重做，页面颜色全程走 token。
- **切换 UI 默认不在**。用户要求深浅切换 → 接入 UI，**形态按用户描述决定**（图标 toggle/
  下拉/菜单项均可），参考实现见 `references/on-demand-toggle.md`。
- **内置 default + dark 两套皮肤**。两套皮肤均由 gen-tokens 从 design-language 统一双主题表（§1.2 `Token｜用途｜Light｜Dark`）生成，无工程回填项。

#### 页面自适应（桌面区间弹性）

- 所有页面按桌面区间弹性交付（约 1024–1920+）：布局折叠式（内容重排），不做等比缩放。
- 编码规则见 `vendor/vue-skill/references/code-rules.md` 第十二节（容器流式、ElRow/ElCol
  响应式栅格、宽度纪律、@media 口径、表格自适应）；断点与窗口适配口径见
  `references/design-language.md` §3.3。
- 交付前自查：1280 与 1024 视口下无横向溢出、无内容裁切（预览窗口缩到该宽度看一眼）。

### ③.5 `fetch-icons.mjs` —— 图标检索替换（③ 之后、④ 之前必跑）

```bash
node scripts/fetch-icons.mjs --dir "<工程目录>" [--base-url <url>] [--timeout <ms>]
```

**这一步是必跑的，不是可选的。** 写完页面代码后必须执行，不能跳过。

扫描 `src/` 下所有 `.vue`/`.js` 中 `@element-plus/icons-vue` 的实际 import，去重后批量请求
IconPlus 三步 API（`getConfig → getIconInfo → getIcon×2`），命中的图标生成深浅两套 SVG 文件
+ barrel `src/assets/icons/index.js`。预览 moduleCache 自动合并 barrel 与 EP 图标：
**命中 → 公司 SVG（data-theme 纯 CSS 切换深浅），未命中 → EP 原样**。

- **执行时机**：③ 写完页面代码后、④ build 前必须执行，**不可跳过**
- 页面照常写 `import { Search } from '@element-plus/icons-vue'`，
  fetch-icons 负责把命中的图标替换为公司图标，源码零改动
- **默认 base-url**：`https://octo.hdesign.huawei.com`（可通过 `--base-url` 覆盖）
- **默认超时**：10s（单轮批量，超时整体 FAIL 不重试，已落盘的命中文件保留，重跑幂等）
- `RESULT: OK` + `RESOLVED: <n>, MISSED: <m>` → 继续走 ④ build
- `RESULT: FAIL |` → **重跑一次**；仍失败才报给用户。已落盘的命中文件仍有效，不影响 build
- **IconPlus 不可达时**：脚本输出 `RESOLVED: 0, MISSED: <n>` 正常退出（全部用 EP 原样），不是 FAIL
- **miss 是正常的**：不是所有 EP 图标名都能在公司库命中，未命中的保持 EP 原样，页面天然完整
- **即使页面没有用 EP 图标也要跑**（脚本会输出 `RESOLVED: 0, MISSED: 0` 正常退出）

### ④ `build.mjs` —— 编译门禁（真实编译，不是 lint）

```bash
node scripts/build.mjs --dir "<工程目录（含 index.html 与 src/）>"
```

build 用真实 `@vue/compiler-sfc`（parse + compileScript + compileTemplate）编译每个 `.vue`，
并做 token/样式纪律检查。首次跑之前确保 ① 已通过。**错误一次全列出**：FAIL 时逐条给
`ERROR: <file>: <msg>`，一轮改完再跑即可，不用逐个试。

- `RESULT: OK` → 拿 `HTML_PATH` 走第 ⑤ 步
- `RESULT: FAIL |` → 读每条 `ERROR:`（含 `file:line`），改代码，**再跑一次 build**。
  这是你的代码问题，修完重跑即可，不要转述给用户
- `WARN: ...`（token 有 fallback 但未定义、样式内出现 hex 等）→ **必须处理**，
  不因为 `RESULT: OK` 就当作做完了
- 另：修改 `src/` 后预览 HTML 不会自动更新，**每次改动后都要重跑 build** 刷新 `preview-data.js`

> 编译失败 ≠ 报告用户。`verify` 的编译错误、白名单错误、token 违规都是你自己的代码问题，
> 按提示改完重跑。**环境类失败**（装不上、compiler 加载不了）才报给用户。

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

**脚本报错不是让你绕开的障碍，是让你转达的信息。**（环境类失败原样转达；
build 的编译/token 错误是你自己的代码问题，修完重跑，不转述。）

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
编译失败就读错误、改代码、重跑 build，直到通过。

### 2. 只碰 `src/` 下与 App.vue

| 允许 | 路径 |
|---|---|
| ✅ 新建/修改 | `src/pages/{Page}/` 下的任何文件 |
| ✅ 修改 | `src/App.vue`（挂载页面组件） |
| ❌ 不动 | `index.gts.html`、`public/library/`、`src/main.js`、`src/assets/themes/*.less`（交付骨架，改了换肤/预览体系就散了） |

换肤需求走 `src/assets/themes/README.md` 协议**追加**皮肤文件，不动既有三件套。

### 3. 页面代码规范（design-language）

- **样式一律 `<style scoped>`**；禁止 `:root` / `html` / `body` / `[data-theme]` 选择器（build 会拒）。
- **所有颜色走 token**：`var(--color-brand)` 这类规范名；页面局部派生值用 `--page-*` 前缀定义。
  页面里不写 hex 色值（build 检查）。
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
`code-example/`（整页示例）、顶层 `README.md`（两块职责与直线路径）。生成页面前先查 vendor
（见工作流 ③）。**不要往 vendor 写任何东西**；vendor 是参考资产，不参与编译与 build 门禁，
示例中引用的 token 名拷入页面后由 build 检查。

---

## 交给用户的话怎么说

- 装环境时：说在准备环境、需要几分钟，不要贴命令和路径
- 编译失败自己修时：不要每轮都汇报，修好了一起说
- 做完时：给出预览 HTML 路径（双击即开），源码路径无需作为链接输出

## 已知边界

- 预览 HTML 依赖本地 UMD 运行时（`public/library/`），**改 `src/` 后必须重跑 build** 刷新源码映射
- `dayjs` 已被 Element Plus UMD 内置，页面代码仍可 `import dayjs from 'dayjs'`（映射已接好）
- 深色主题：dark 皮肤已全量正式化（由 design-language 统一表 Dark 列生成，覆盖全部 token，
  无缺口）；浅色／深色成对维护，改 token 先改 design-language 再重跑 gen-tokens，不手写深色值

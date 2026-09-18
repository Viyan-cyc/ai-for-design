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
⓪ 确认 node  →  ① ensure-env  →  ② init 建工程  →  ③ 写 .vue 页面  →  ④ build 门禁  →  ⑤ 交付
  (没有就装)                                        ↑             │
                                                    └── 验证未过 ──┘  循环至通过
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
原生的，不需要机器先有 node；没有时它们会从 npmmirror 下载 portable node（带 sha256 校验），
然后自动接续 `setup-env.mjs` 装 compiler 依赖（**npm-only，本 skill 不用 yarn**）。

机器上已有能跑的 node 时它们会直接复用（任意大版本，无版本门禁），日志里 `[node] source: system`
就是走了这条路——**不要因为"没看到下载"就以为它没装**。

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
main.js、主题三件套、starter 页面）。

### ③ 写代码 —— 主战场

**只写 `src/` 下**：页面放 `src/pages/{Page}/index.vue`（一页一目录，子组件/样式放同目录），
`App.vue` 只改挂载点。主题 css（`src/assets/themes/`）与 `index.html` 是交付件骨架，
不改不删；换肤按 `src/assets/themes/README.md` 协议追加。

页面样式规则、token 用法、组件引入约定见「硬约束」§3 与 `references/design-language.md`。

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

build 返回 `RESULT: OK` 之后，必须向用户交付：

```
预览：<HTML_PATH 的绝对路径>（双击用浏览器打开）
源码：<SRC_DIR 的绝对路径>（接入真实工程见其中 README.md）
```

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
| ❌ 不动 | `index.gts.html`、`public/library/`、`src/main.js`、`src/assets/themes/*.css`（交付骨架，改了换肤/预览体系就散了） |

换肤需求走 `src/assets/themes/README.md` 协议**追加**皮肤文件，不动既有三件套。

### 3. 页面代码规范（design-language）

- **样式一律 `<style scoped>`**；禁止 `:root` / `html` / `body` / `[data-theme]` 选择器（build 会拒）。
- **所有颜色走 token**：`var(--color-brand)` 这类规范名；页面局部派生值用 `--page-*` 前缀定义。
  页面里不写 hex 色值（build 检查）。
- **只用真实 Element Plus 组件**，模板标签一律 **PascalCase**（`<ElTable>`），模板里用到的每个
  组件、`ElMessage` 等命令式 API、vue 的 API（`ref`/`reactive`/…）**每个文件各自 import**——
  漏 import 编译能过但运行时白屏。编译宏（`defineProps` 等）不用 import。
- 图标从 `@element-plus/icons-vue` 导入（如 `import { Search } from '@element-plus/icons-vue'`）。
- 间距/圆角/字号/投影等同样用 token：`var(--space-size-16)`、`var(--radius-size-normal)`、
  `var(--shadow-1)`。
- 组件状态（悬停/聚焦/禁用/加载）由 Element Plus + 桥接层自动获得，页面不重绘状态色。
- token 速查与协议见 `references/design-language.md`；组件/导出/图标白名单见
  `scripts/verify/whitelists/*.json`（EP 2.13.5：118 组件 / 534 导出 / 293 图标）。

### 4. vendor/ —— 参考资产（内容后续补充）

`vendor/` 下将放置：`component-examples/`（组件示例）、`code-examples/`（代码示例）、
`design-specs/`（设计规范）。当前为占位；补充完成后，生成特定组件/复杂布局时**先查 vendor
示例再动手**。不要往 vendor 写任何东西。

---

## 交给用户的话怎么说

- 装环境时：说在准备环境、需要几分钟，不要贴命令和路径
- 编译失败自己修时：不要每轮都汇报，修好了一起说
- 做完时：给出预览 HTML 路径 + src/ 路径，说明预览双击即开、源码接入方法在 README

## 已知边界

- 预览 HTML 依赖本地 UMD 运行时（`public/library/`），**改 `src/` 后必须重跑 build** 刷新源码映射
- `dayjs` 已被 Element Plus UMD 内置，页面代码仍可 `import dayjs from 'dayjs'`（映射已接好）
- 本 skill 无深色皮肤（design-language 无完整深色 UI 表）；深色需求先补 token 定义，不自行推导

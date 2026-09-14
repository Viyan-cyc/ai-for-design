# 六脚本 CLI 速览

`ASSETS_ROOT` 可指向包根目录、包内 `assets/` 或资产库目录本身(内含 `asset-manifest.json`,如 `assets/g-design-enterprise-v1.5.0`)。下例 `LIBRARY` = 资产库目录,`SKILL` = 本 skill 目录(`skills/generate-ux-prototype`)。

## 资产查询(库内脚本,只读)

```sh
node LIBRARY/scripts/query_assets.mjs templates --brief          # 页面模板清单(单行摘要:id/name/useWhen)
node LIBRARY/scripts/query_assets.mjs components --brief         # 组件清单(单行摘要)
node LIBRARY/scripts/query_assets.mjs components --search 状态 --brief  # 搜索 + 单行摘要
node LIBRARY/scripts/query_assets.mjs components g-button        # 单组件 spec(完整)
node LIBRARY/scripts/query_assets.mjs tokens frost-common        # token 分组数值
```

`--brief` 用于全量/搜索清单(输出量约 1/5);单条 spec 不用。

## 初始化工作区

```sh
node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}"   # 安装态自动定位资产库;未安装态可加 --assets-root <ASSETS_ROOT>
# RESULT: OK + HTML_PATH / SRC_DIR / PAGE / ASSETS_VERSION
```

- `--assets-root` 可省略:自动按 包根布局 → `ASSETS_ROOT` 环境变量 → 当前目录 探测。
- 成功后 token 全套复制到 `src/assets/tokens/`(含毛玻璃 token),并生成 api 适配层、mock 模块、全局词条、路由与 starter 页面。

## 复用组件(hybrid/reuse 命中时)

```sh
node SKILL/scripts/collect_component.mjs [LIBRARY] <component-id> "{slug}/src" "{slug}/src/components"  # LIBRARY 可省略(安装态自动读绑定)
# RESULT: OK + ENTRY / FILES / COPIED 清单(含自动生成的 interop 垫片 index.js)
```

- 自动递归解析相对 import 拷齐依赖闭包;只拷 `GName.vue` + 闭包内相对 import 的文件(含 GIcon 的 JSON)。
- 落位 `src/components/GName/GName.vue`(平铺);每个拷入文件加来源注释,禁止改写。
- 同一目标重复执行会 FAIL(防覆盖);依赖闭包不完整时报缺失清单,如实上报,不手工内联修复。

## 写码前预检(规划清单一条命令校验)

```sh
node SKILL/scripts/preflight.mjs --dir "{artifact-folder}/{slug}" \
  --icons "Search,Bell,CaretRight" \
  --tokens "--color-brand,--g-bg-surface" \
  --exports "ElMessage,ElMessageBox" \
  --imports "views/{slug}/components/GlobalNav.vue=../../../locales/pages/{slug}.js|../js/constants.js,..."
# RESULT: OK | plan preflight passed — 全过才开写
# RESULT: FAIL + 逐条问题(含相近项提示)— 修正清单后重跑
```

- `--imports` 条目格式 `fromFile=rel1|rel2`,fromFile 相对 `src/`(posix 风格);import 目标须能解析到 `.js`/`.vue`/`index`。
- token 白名单从工作区 `src/assets/tokens/` 实时提取(与 build 同源);图标/导出读 skill 自带 JSON 白名单(与 build 同源)。
- 把本轮要用的全部图标/token/导出/相对 import 一次列全提交,避免写码中途反复查询。

## 校验

```sh
node SKILL/scripts/build.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK + "OK index.html verified (N pages, M components, K el-tag uses)"
# RESULT: FAIL | <文件>: <原因>  → 修复后重跑(最多 3 次)
# WARN: hex 颜色、静态内联样式 — 非阻断,但应修正
```

校验覆盖:@vue/compiler-sfc 真编译 + `el-*` 白名单(116) + 图标白名单(295) + 导出白名单(130) + 相对 import 解析 + 裸依赖白名单 + ESM 语法 + token 存在性(从工作区 `src/assets/tokens/` 实时提取) + 样式卫生 + mock 隔离 + scss 禁用 + router 完整性(文件存在 + createRouter + history 必须 file:// 兼容 + export default)。

## 无头冒烟(build 通过后收口)

```sh
node SKILL/scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
# 前置(每机器一次):npm i -g puppeteer-core;自动探测系统 Chrome/Edge,不下载浏览器
```

检查项:页面无报错渲染、`--el-color-primary` 解析为资产品牌色、`setTheme('dark')` 明暗切换生效、非 favicon 资源 404 为空。`--selector` 可指定页面特征选择器(默认 `.event-card, .page-root, main, #app .el-button`)。

**build + smoke 一轮跑完 = 生成流程结束。** 不再起 serve / curl 探活 / 查杀进程 / 重复验证——smoke 自带渲染、token 品牌色、明暗切换、404 检查并自查进程清理。

## 本机预览(用户明确要求时才起)

```sh
node SKILL/scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
# 浏览器限制 file:// 动态加载时的备选:http://localhost:8765/index.html
```

`file://` 可直接加载 `index.html`,无需启动 serve;仅当用户明确要求本机预览地址时才启动。

## 毛玻璃

需求涉及毛玻璃时:按需读 LIBRARY/design/frosted-glass.md(control/card/overlay 预设与应用预算),`query_assets.mjs tokens frost-common` 查数值;token 文件已随 init 进工作区 `src/assets/tokens/`。

## 交接(跨阶段任务)

跨阶段产物(requirements.json / insights.json / task-handoff)结构与交接规则见包根 [workflow.md](../../../workflow.md);schema:[task-handoff.schema.json](../handoff/task-handoff.schema.json)。mode=direct-reference 时无需上游分析文件。

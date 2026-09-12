# 调用示例（五脚本 CLI 速览）

`ASSETS_ROOT` 可以指向包根目录、包内 `assets/` 或资产库目录本身（内含 `asset-manifest.json`，如 `assets/g-design-enterprise-v1.5.0`）。下例 `LIBRARY` = 资产库目录，`SKILL` = 本 skill 目录（`skills/generate-ux-prototype`）。

## 资产查询（库内脚本，只读）

```sh
node LIBRARY/scripts/query_assets.mjs templates --brief          # 页面模板清单（单行摘要：id/name/useWhen）
node LIBRARY/scripts/query_assets.mjs components --brief         # 组件清单（单行摘要）
node LIBRARY/scripts/query_assets.mjs components --search 状态 --brief  # 搜索 + 单行摘要
node LIBRARY/scripts/query_assets.mjs components g-button        # 单组件 spec（完整）
node LIBRARY/scripts/query_assets.mjs tokens frost-common        # token 分组数值
```

`--brief` 用于全量/搜索清单（输出量约 1/5）；单条 spec 不用。

## 生成工作区

```sh
node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}"   # 安装态自动定位资产库；未安装态可加 --assets-root <ASSETS_ROOT>
# RESULT: OK + HTML_PATH / SRC_DIR / PAGE / ASSETS_VERSION
```

`--assets-root` 可省略：自动按 包根布局 → `ASSETS_ROOT` 环境变量 → 当前目录 探测。

## 复用组件（hybrid/reuse 命中时）

```sh
node SKILL/scripts/collect_component.mjs [LIBRARY] <component-id> "{slug}/src" "{slug}/src/components"  # LIBRARY 可省略（安装态自动读绑定）
# RESULT: OK + ENTRY / FILES / COPIED 清单（含自动生成的 interop 垫片 index.js）
```

## 校验与预览

```sh
node SKILL/scripts/build.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK + "OK index.html verified (N pages, M components, K el-tag uses)"
# RESULT: FAIL | <文件>: <原因>  → 修复后重跑（最多 3 次）

node SKILL/scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
# 浏览器限制 file:// 动态加载时的备选：http://localhost:8765/index.html

node SKILL/scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# 无头冒烟：渲染 + token 品牌色 + 明暗切换 + 资源 404 检查
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
# 前置（每机器一次）：npm i -g puppeteer-core；自动探测系统 Chrome/Edge
```

## 毛玻璃示例

需求涉及毛玻璃时：按需读 LIBRARY/design/frosted-glass.md（control/card/overlay 预设与应用预算），`query_assets.mjs tokens frost-common` 查数值；token 文件已随 init 进工作区 `src/assets/tokens/`。

## 交接（跨阶段任务）

跨阶段产物（requirements.json / insights.json / task-handoff）结构与交接规则见包根 [workflow.md](../../../workflow.md)；schema：[task-handoff.schema.json](task-handoff.schema.json)。mode=direct-reference 时无需上游分析文件。

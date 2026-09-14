# 调用示例（脚本 CLI 速览）

`ASSETS_ROOT` 可以指向包根目录、包内 `assets/` 或资产库目录本身（内含 `asset-manifest.json`，如 `assets/g-design-enterprise-v1.5.0`）。下例 `LIBRARY` = 资产库目录，`SKILL` = 本 skill 目录（`skills/generate-ux-prototype`）。

## 资产查询（库内脚本，只读）

```sh
node LIBRARY/scripts/query_assets.mjs tokens frost-common        # token 分组数值
node LIBRARY/scripts/query_assets.mjs tokens --search brand      # token 值搜索
node LIBRARY/scripts/query_assets.mjs tokens                     # 全部分组摘要
```

## 生成工作区

```sh
node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}"   # 安装态自动定位资产库；未安装态可加 --assets-root <ASSETS_ROOT>
# RESULT: OK + HTML_PATH / SRC_DIR / PAGE / ASSETS_VERSION
```

`--assets-root` 可省略：自动按 `--assets-root` → `agents/package-location.json` 绑定 → 脚本位置逐级上溯找锚点 → `ASSETS_ROOT` 环境变量/当前目录 探测。

## 写码前预检（规划清单一条命令校验）

```sh
node SKILL/scripts/preflight.mjs --dir "{artifact-folder}/{slug}" \
  --icons "Search,Bell,CaretRight" \
  --tokens "--color-brand,--g-bg-surface" \
  --exports "ElMessage,ElMessageBox" \
  --imports "views/{slug}/components/GlobalNav.vue=../../../locales/pages/{slug}.js|../js/constants.js,..."
# RESULT: OK | plan preflight passed — 全过才开写
# RESULT: FAIL + 逐条问题（含相近项提示）— 修正清单后重跑
```

- `--imports` 条目格式 `fromFile=rel1|rel2`，fromFile 相对 `src/`（posix 风格）；import 目标须能解析到 `.js`/`.vue`/`index`。
- token 白名单从工作区 `src/assets/tokens/` 实时提取（与 build 同源）；图标/导出读 skill 自带 JSON 白名单（与 build 同源）。
- 把本轮要用的全部图标/token/导出/相对 import 一次列全提交，避免写码中途反复查询。

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

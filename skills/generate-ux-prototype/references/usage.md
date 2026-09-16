# 调用示例（脚本 CLI 速览）

资产库内嵌于本 skill 的 `library/` 目录——所有脚本自动使用，无需传路径。下例 `SKILL` = 本 skill 目录；`LIBRARY` = `SKILL/library`。

## 资产查询（库内脚本，只读）

```sh
node LIBRARY/scripts/query_assets.mjs tokens frost-common        # token 分组数值
node LIBRARY/scripts/query_assets.mjs tokens --search brand      # token 值搜索
node LIBRARY/scripts/query_assets.mjs tokens                     # 全部分组摘要
```

## 生成工作区

```sh
node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}"   # 内嵌资产库自动使用，零配置
# RESULT: OK + HTML_PATH / SRC_DIR / PAGE / ASSETS_VERSION
```

## 图标获取（IconPlus API → .svg）

```sh
node SKILL/scripts/fetch_icons.mjs --dir "{artifact-folder}/{slug}" \
  --keywords "下载,文件,搜索" \
  [--base-url "https://octo.hdesign.huawei.com"] \
  [--size 24] [--style "线性"] [--color "GTS_线性_Gray-10"] \
  [--topK 25] [--source-id 6] [--tags "..."] [--file-type svg] [--force]
# RESULT: OK + ICONS: download.svg,file.svg,search.svg + DIR: .../src/assets/icons
# RESULT: FALLBACK | IconPlus API unreachable, using Lucide icons + ICONS: ...
# RESULT: FAIL | <reason>
```

默认 base-url=`https://octo.hdesign.huawei.com`（无需传参）；`--keywords` 逗号分隔批量搜索，支持中文关键词。默认 size=24 / style=线性 / color=GTS_线性_Gray-10 / tags=基础图标。已存在的 `.svg` 默认跳过（SKIP），`--force` 覆盖。生成的文件名规则：`ic_public_download` → `public-download.svg`。写码前批量获取，获取后 `import downloadIcon from '../../assets/icons/download.svg'`，用法 `<img :src="downloadIcon" :width="20" :height="20" />`。

**连通性降级**：API 不可达时自动切换本地 Lucide 图标（370 个常用 B 端图标，内置中文→英文关键词映射），生成相同 `.svg` 格式。输出 `RESULT: FALLBACK | IconPlus API unreachable, using Lucide icons`，AI 按 ICONS 列表正常 import，用法无差异。

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
- token 白名单从工作区 `src/assets/tokens/` 实时提取（与 build 同源）；`--icons` 校验 `@element-plus/icons-vue` 白名单（IconPlus 图标不走 `--icons`，通过 `--imports` 相对路径解析自动校验）。
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

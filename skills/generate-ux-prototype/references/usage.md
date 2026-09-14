# 六脚本 CLI 速览

`ASSETS_ROOT` 可指向包根、包内 `assets/` 或资产库目录(内含 `asset-manifest.json`)。`LIBRARY`=资产库目录,`SKILL`=本 skill 目录。**不要读取脚本源码——命令格式如下。**

## 资产查询(只读)

```sh
node LIBRARY/scripts/query_assets.mjs templates --brief          # 模板清单(单行摘要)
node LIBRARY/scripts/query_assets.mjs components --brief         # 组件清单
node LIBRARY/scripts/query_assets.mjs components --search 状态 --brief  # 搜索
node LIBRARY/scripts/query_assets.mjs components g-button         # 单组件 spec(完整)
node LIBRARY/scripts/query_assets.mjs tokens frost-common        # token 分组数值
```

`--brief` 用于清单(输出量约 1/5);单条 spec 不用。

## 初始化工作区

```sh
node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}" [--assets-root <ASSETS_ROOT>]
# RESULT: OK + HTML_PATH / SRC_DIR / PAGE / ASSETS_VERSION
```

`--assets-root` 可省略:自动按 包根→`ASSETS_ROOT` 环境变量→当前目录 探测。成功后 token 全套复制到 `src/assets/tokens/`,并生成 api 适配层、mock 模块、全局词条、路由与 starter 页面。

## 复用组件

```sh
node SKILL/scripts/collect_component.mjs [LIBRARY] <component-id> "{slug}/src" "{slug}/src/components"
# RESULT: OK + ENTRY / FILES / COPIED 清单(含 interop 垫片 index.js)
```

自动递归拷贝依赖闭包;只拷 `GName.vue`+闭包内相对 import。落位 `src/components/GName/GName.vue`(平铺);禁止改写。同目标重复执行会 FAIL(防覆盖);闭包不完整报缺失清单。

## 写码前预检

```sh
node SKILL/scripts/preflight.mjs --dir "{artifact-folder}/{slug}" \
  --icons "Search,Bell,CaretRight" \
  --tokens "--color-brand,--g-bg-surface" \
  --exports "ElMessage,ElMessageBox" \
  --imports "views/{slug}/components/GlobalNav.vue=../../../locales/pages/{slug}.js|../js/constants.js,..."
# RESULT: OK | plan preflight passed — 全过才开写
# RESULT: FAIL + 逐条问题(含相近项提示)— 修正后重跑
```

`--imports` 条目格式 `fromFile=rel1|rel2`,fromFile 相对 `src/`(posix 风格)。token 白名单从工作区 `src/assets/tokens/` 实时提取;图标/导出读 skill 自带 JSON 白名单。全部图标/token/导出/import 一次列全提交。

## 校验

```sh
node SKILL/scripts/build.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK + "index.html verified (N pages, M components, K el-tag uses)"
# RESULT: FAIL | <文件>: <原因>  → 修复后重跑(最多 3 次)
# WARN: hex 颜色/静态内联样式 — 非阻断,应修正
```

覆盖:@vue/compiler-sfc 真编译+`el-*`白名单(116)+图标白名单(295)+导出白名单(130)+相对 import 解析+裸依赖白名单+ESM 语法+token 存在性+样式卫生+mock 隔离+scss 禁用+router 完整性。

## 无头冒烟

```sh
node SKILL/scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
# 前置(每机器一次):npm i -g puppeteer-core;自动探测 Chrome/Edge
```

检查:页面无报错渲染、品牌色解析、明暗切换、非 favicon 资源 404。**build+smoke 一轮=流程结束。** 不起 serve/curl/重复验证。

## 本机预览(用户明确要求时才起)

```sh
node SKILL/scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
```

`file://` 可直接加载 `index.html`,无需启动 serve。

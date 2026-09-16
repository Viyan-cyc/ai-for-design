# generate-ux-prototype 生成速度优化方案

> 定稿日期：2026-09-16。评审依据：`分析报告1.txt`、`分析报告2.txt`、会话 `73049b89`（截图转码实测）、分支 `origin/pure_mfn`（图标 fetch 逻辑）。

## 一、根因（一句话）

不是"规划不够谨慎"，是**规划期命名信息不可得**：token 名靠一套不准的规律猜（命中 60%）、图标名靠猜 + 漏 import、FAIL 兜底又最弱（build 报一个停一个、token 报错零提示），于是反复"猜 → build 报错 → 查 → 改"。

## 二、已拍板的决策（用户 2026-09-16 定）

| 决策点 | 结论 |
| --- | --- |
| token 真名清单载体 | **放资产包管线**（`generate-css.mjs` 顺带生成），不放 init stdout |
| 清单是否带值 | 不带色值/px，只带名 + 分组（守"值不进上下文"铁律） |
| 图标工具归属 | **放 skill 侧**（`fetch_icons.mjs` 是生成时动作，与 init/build 同类） |
| 图标体系 | **走 IconPlus**，替换 Element Plus 图标组件 |
| 图标降级 | 内网请求华为 IconPlus；网外（连通性检查失败）**网络请求 Lucide**，**不在本地放图标资源** |
| 翻译字典 | **保留**（中文关键词 → Lucide 英文名的映射字典，属代码逻辑非图标资源） |
| slug | **放行单段**（1~6 段），去掉"至少两词"的旧约定 |

## 三、动作清单

### A．token 真名清单（放资产包管线）✅ 必须

- **问题**：SKILL.md 教"按命名骨架猜 token"，骨架是错的，命中 60%。
- **改**：
  1. `assets/scripts/generate-css.mjs`：新增输出 `assets/frontend/element-plus/tokens/token-index.md`，从 `tokens.json` 抽全部 token 名、按组归类（只名不含值）。
  2. 放 `frontend/element-plus/tokens/` 内：init.mjs 整目录复制 token 到工作区，index 免费跟随，init 零改动。
  3. `SKILL.md`「Token 消耗纪律」：删"按命名骨架写、不探测"，改"写码前读工作区 `src/assets/tokens/token-index.md` 取真名；清单没有的才 `query_tokens --search`"。
- **注意**：首次改完脚本手动跑一遍 generate-css 生成初始 `token-index.md` 一起提交；此后设计师重跑管线自动更新。

### B．slug 放行单段 ✅ 必须

- **改**：`init.mjs` 正则 `/^[a-z0-9]+(-[a-z0-9]+){1,5}$/` → `{0,5}`；`SKILL.md` "2–6 段" → "1–6 段"。
- **效果**：`test8`/`login` 直接合法，文件夹名 = slug = 用户指定名。

### C．build 聚合报错 ✅ 必须

- **改**：`build.mjs` 把散落的 `fail(...)`（即打即退）改成先 `errors.push(...)` 收齐、全部校验跑完统一打印（最多列 20 条截断）、最后 `exit(1)`。
- **效果**：N 次 build 循环 → 1 次。

### D．i18n key 存在性校验 ✅ 必须

- **改**：`build.mjs` 解析每个 `.vue` 的 `<script>`+`<template>` 扫 `t.xxx` 引用，比对 `locales/pages/{slug}.js` 的 messages key，未定义的 FAIL。
- **效果**：`t.greeting` 这类运行时错，从 smoke 阶段前移到 build 一次拦下。

### E．图标 IconPlus + 网络 Lucide 降级 ✅ 必须

- **改**：
  1. 合并 `origin/pure_mfn` 的 `fetch_icons.mjs`、`icon-api.md`；`SKILL.md` 加"Step 2.5 获取图标"；`code-conventions.md` 图标用法改 `import x from '.../x.svg'` + `<img :src>`。
  2. **去掉本地 `lucide-icons.json`**，Lucide 降级改为**网络请求**（公网 CDN 拉 `.svg`）。
  3. 保留中文→英文翻译字典（代码逻辑）。
  4. 适配资产外置措辞（pure_mfn 是外置前分支，SKILL.md 仍写"内嵌资产库"）。
  5. 清文档笔误：图标实存 `.svg`，文档两处误写 `.vue`。
- **代价（已告知）**：Lucide 与华为 IconPlus 图标风格不一致，网外降级观感有差异。

### F．文档说明性小修 🔸 可选

- preflight 示例省略号改逗号实际值 + "多项逗号分隔"；`--imports` 标可选；init 输出文件摘要 + starter 标记。

## 四、实施顺序

A → B → C → D → E → F。改动面：`assets/scripts/generate-css.mjs`（资产管线）+ skill 内 `SKILL.md` / `init.mjs` / `build.mjs` / `preflight.mjs` / `code-conventions.md` + 新增 `fetch_icons.mjs` / `icon-api.md`。

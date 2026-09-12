# 任务卡 W3 · 全工程 Node 化

> 把本文件全文喂给你的 AI 会话，让它按步骤执行。完成后回到 SKILL-REPLACE-PLAN.md §13 打勾。

## 你的角色

你负责把全工程 Python 移植为 Node（D18）。依据：全部 Python 约 410 行、纯标准库、零 pip 依赖，1:1 机械移植。必读 `SKILL-REPLACE-PLAN.md` §9 D18（含三条实施约束）。

## 前置

- T0 基线提交完成后开工（分支 `w3/xxx`）。
- Python 源清单：`assets/g-design-enterprise-v1.5.0/scripts/`（8 个，共 329 行）、`scripts/build_release.py`（35 行）、`installer/install_skills.py`（46 行）、`tests/validate_package.py`、`tests/validate_coordination.py`。
- 先浏览全部 .py，列出每个的输入/输出/副作用清单（给自己建对照表）。

## 步骤

### N1 对照验证框架（上午 2 小时，先做，它是后面一切的质量保证）
写 `tests/migration_diff.mjs`：
- 对同一输入分别跑旧 .py（python3/python，Windows 注意用 `python` 兜底）和新 .mjs，输出各自到临时目录。
- 逐字节 diff 产出（token CSS、manifest、release 哈希、校验输出文本）。文本类产出允许仅文件头注释差异（GENERATED 头会从 .py 改成 .mjs，这是唯一允许的差异，其他差异一律算 FAIL）。
- 输出 `PASS/FAIL <脚本名>` 清单。

### N2 资产库 8 脚本移植（全天主菜，逐个过 N1）
顺序（依赖序）：
1. `query_assets.py` → `query_assets.mjs`（**优先**——W1 主链路要用的资产查询：templates/components/tokens 搜索与摘要，读 index.json/templates.json/tokens.md）
2. `build_tokens.py` → 重点：token 引用解析（var() 递归 resolve）、环检测、主题回退（light/dark 后缀组）、bindings/*.tpl 模板替换。生成头注释改为 `/* GENERATED from design/tokens.json; run scripts/build_tokens.mjs */`
3. `build_indexes.py`、`schema_tools.py`、`asset_graph.py`、`export_icons.py`、`refresh_release.py`
4. `validate_library.py` → 重点：protectedFiles 哈希锁、结构校验逻辑逐条对照（--skip-lock 参数保留）
每移植一个 → N1 diff PASS → 单独 commit。全部 PASS 前**不删任何 .py**。

### N3 顶层编排 + 安装器（2 小时）
- `scripts/build_release.py` → `build_release.mjs`：逻辑同构（版本号重写、catalog/manifest 更新），其中 subprocess 调 Python 子脚本改为调 node 子脚本。
- `installer/install_skills.py` → `installer/install_skills.mjs`：保持 CLI 兼容（`node installer/install_skills.mjs TARGET [--rebind]`），功能逐条对照（同名 skill 停止、写 package-location.json、--rebind 重绑）。
- `installer/install-skills.ps1/.sh` 包装脚本改为调 node 版。

### N4 测试移植（半天）
- `tests/validate_package.py` → `validate_package.mjs`：**注意它第 8-10 行 import 的 resolve_source_assets/validate_source_draft 将随 W1 改造消失**——这两项校验重写为：新 skill 结构存在性校验（SKILL.md/references/关键脚本）+ 在临时工作区跑一次 `node build.mjs` 冒烟。其余校验项（catalog/manifest 一致性等）1:1 保留。
- `tests/validate_coordination.py` → `validate_coordination.mjs`。
- 手工跑两个测试确认通过。

### N5 删 Python + 重锁哈希（最后一步，等 W1 T7 验收通过后执行）
- `git rm` 全部 .py。
- `node scripts/build_release.mjs --version 1.5.1`：因 token CSS 头注释变化，protectedFiles 哈希全变，需重锁（D18 约束②，这是正常发布流程不是事故）。
- 全文档 `grep -rn "python3\|\.py " *.md` 清零（README/AI-ENTRY/workflow/各 references）。
- 更新 SKILL-REPLACE-PLAN.md §13 打勾。

## 验收标准
- N1 对全部移植脚本 PASS（差异仅限生成头注释）
- `git grep -l "\.py"` 在仓库根为零命中（SKILL-REPLACE-PLAN.md 历史记录除外）
- validate_package.mjs / validate_coordination.mjs 通过
- build_release.mjs --version 1.5.1 跑通且 validate_library 过


---

## 结论回写区（执行中随时追加，每条带姓名+日期）

<!-- 格式：- [日期] (姓名/卡号) 结论或问题一句话；细节缩进展开。写完 commit 到本任务分支 -->

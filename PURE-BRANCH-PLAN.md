# Pure 分支改造方案（已拍板，执行中）

> 2026-09-14 定稿。pure 分支只保留 `skills/generate-ux-prototype` 的功能：
> 资产只留 token + 设计规范，不要组件、不要代码模板。
> 上下文丢失时从本文件恢复执行进度（文末有进度勾选）。

## 目标形态（全部家当 ≈ 36M，35M 是 skill 内 vendored @vue/compiler-sfc）

```
ai-for-design/                            # pure 分支
├── PURE-BRANCH-PLAN.md                   # 本文件（改造完成后可删）
├── asset-catalog.json                    # 2K  ★保留——定位锚点（包根识别）
├── README.md                             # 改写为单 skill 说明
├── .gitignore                            # 清理失效条目
├── assets/g-design-enterprise-v1.5.0/
│   ├── asset-manifest.json               # 2K   库根锚点 + assetVersion（init 读）
│   ├── design/                           # 373K 全套设计规范 + tokens.json 数值源
│   │   ├── tokens.json                   # 唯一可编辑数值源（结构化 JSON，非 CSS）
│   │   ├── rules.md color-rules.md color-tokens.md frosted-glass.md icon-rules.md
│   │   ├── tokens.md index.json          # 生成索引/数值表
│   ├── frontend/element-plus/tokens/     # 73K  生成 CSS（init.mjs:132 硬依赖，快照消费）
│   │   └── 含 element-plus.css 桥接层（--el-* → 公司 token）
│   └── scripts/query_assets.mjs          # 只留 tokens 子命令（icons/components/templates 分支删）
└── skills/generate-ux-prototype/         # 原样骨架，内部做减法（见 §三）
```

## 关键依赖事实（为什么这么删）

1. **init.mjs 只读库的两处**：`frontend/element-plus/tokens/`（拷贝）+ `asset-manifest.json`（读 assetVersion）。定位靠 `locateAssetLibrary`：包根含 `asset-catalog.json` 或库根含 `asset-manifest.json` 即识别 → 所以顶层 asset-catalog.json 必须保留。
2. **design/tokens.json 是数值源，tokens/*.css 是生成产物**（`GENERATED, do not edit`）。工作区消费的是 CSS 形态。已拍板方案 A：照搬产物快照，不移植生成器（bindings/*.tpl 删了，token 更新 = 上游重生成后整体替换快照）。
3. **query_assets.mjs**：tokens 子命令只读 `design/tokens.json`；icons 子命令读 `frontend/element-plus/src|assets`（将删 → 分支删）；components/templates 读 `components/`（将删 → 分支删）。
4. **manage-design-assets** 依赖完整库，与 pure 冲突 → 整个 skill 删。
5. 字体已于 2026-09-14 从 preview 模板移除（commit e840839，main 已含），pure 基线自带。

## §二 删除清单

### 仓库层（整删）

- [ ] `skills/manage-design-assets/`
- [ ] `skills/extract-structured-requirements/`
- [ ] `skills/derive-experience-insights/`
- [ ] `installer/`
- [ ] `scripts/build_release.mjs`
- [ ] `tasks/` `tests/` `examples/` `coder/` `demo-output/`
- [ ] `AI-ENTRY.md` `skill-catalog.json` `workflow.md` `asset-manifest.yaml`
- [ ] `SKILL-REPLACE-PLAN.md` `UPGRADE-LOG.md` `VALIDATION.md` `validation-results.json`
- [ ] `.DS_Store`

### 资产库层

- [ ] `frontend/element-plus/` 下除 `tokens/` 外全部：`node_modules/ dist/ src/ assets/ bindings/ configs/ schemas/ examples/ package.json package-lock.json tsconfig.json vite.config.ts vite.preview.config.ts index.html README.md licenses/`
- [ ] `components/`（specs/templates/索引，249K）
- [ ] `release/`（source-lock.json）
- [ ] 库内 `scripts/` 除 `query_assets.mjs` 外全部（build_tokens / migrate_components / validate_library / export_icons / asset_graph / schema_tools / refresh_release / build_indexes / migration-report.json）

### skill 层

- [ ] `scripts/collect_component.mjs`
- [ ] `references/component-format.md` `references/designer-component-guide.md` `references/task-handoff.schema.json`

## §三 保留 + 配套修改

### 保留

- `frontend/element-plus/tokens/` 12 css（init 硬依赖 + build token 校验同源）
- `design/` 全套（SKILL.md 按需读 + query_assets tokens 子命令）
- `asset-manifest.json` + 顶层 `asset-catalog.json`（定位锚点）
- `agents/package-location.json` 读取逻辑（外部库绑定能力保留）
- `references/ui-runtime.md`（不动）
- `references/usage.md`、`code-conventions.md`（改写）

### 代码/文档改动（4 处）

1. **init.mjs 候选链修复**：现链 `--assets-root → 绑定 → 固定上溯4级 → cwd`。把固定 4 级上溯改为**从脚本位置逐级上溯找 asset-catalog.json / asset-manifest.json**（git root 任意深度都命中），保留 `--assets-root → 绑定 → 上溯 → cwd/env` 顺序。
2. **query_assets.mjs 砍分支**：删 icons / components / templates 三个子命令，只留 tokens；usage 参数说明同步。
3. **SKILL.md**：
   - 删「生成选项：组件模式开关」整节（含 COMPONENT_MODE 表）
   - 删 Step 4（组件匹配与复用）整节，Step 5-8 重编号为 4-7
   - Step 2 模板参考 → 改为无模板直接按需求写（六套模板没了）
   - 自检清单第 10 条（G 组件未改动）删
   - 上下文预算条款里模板/组件条目删（「组件 spec 只读命中项」等）
   - 资产库定位协议中 components/templates 示例删，只留 tokens 示例
   - frontmatter description：「tokens and reusable components are fetched live」→ 只提 token；触发词里组件相关表述清理
   - References 清单：删 component-format / designer-component-guide / task-handoff 行
   - HARD RULES / code-conventions 引用里「G 组件复用」表述清理
   - Output Contract 目录树里 `components/` 行改注释（页面私有/跨页组件仍按需创建，但无 collect 落位）
4. **references/code-conventions.md**：删 G 组件复用 / collect 章节；**references/usage.md**：六脚本改五脚本（删 collect 行）

## §四 执行顺序与验证

1. [x] 建 pure 分支（已在）
2. [ ] 删仓库层 → init 冒烟确认定位协议未断
3. [ ] 删库层 → init/build/smoke 三绿
4. [ ] query_assets 砍分支 + init 候选链改造 → 换 cwd 跑 init 验证自动定位
5. [ ] SKILL.md / references 删改 → grep 残留（collect_component / COMPONENT_MODE / templates / designer-component）应为零
6. [ ] 改写 README + 清理 .gitignore → 最终 init/build/smoke + commit

## 验证命令速记

```sh
node skills/generate-ux-prototype/scripts/init.mjs <tmp-dir> <slug>
node skills/generate-ux-prototype/scripts/build.mjs --dir <tmp-dir>/<slug>
node skills/generate-ux-prototype/scripts/smoke.mjs --dir <tmp-dir>/<slug>
```

冒烟通过标准：init `RESULT: OK`；build `RESULT: OK`；smoke `RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0`。

# Spec：vendor 新增 005 毛玻璃材质示例 + 006 内容状态示例

- **日期**：2026-09-23 11:26
- **层级**：Feature Spec
- **状态**：DONE（2026-09-23 执行完毕，见 §6 执行记录）
- **任务来源**：2026-09-23 会话——对照 design-language 真值与 vendor 代码示例覆盖面，决策优先补 A（整块毛玻璃材质，§7.1–7.5/7.7）与 B（内容状态空/加载/错误，`设计规范/内容状态.md`）；C/D/E 等真实需求驱动，本次不做。

## 1. 最终目标与边界

**Goal**：给 `skills/generate-ux-prototype/vendor/code-example/references/` 新增两个整页示例，把"有完整设计真值但零代码消费"的两大缺口闭合：
- **005 frost-material**：设计系统 §7 整块毛玻璃材质（含 §7.7 调用约定的页面级实现）；
- **006 content-states**：内容状态规范（内容状态.md）的空/加载/错误七类状态整页示范。

**In Scope**
- 两个示例目录 + 各自 `index.vue`（005 含子组件，006 单文件）
- `vendor/code-example/references/README.md` 索引表更新（005/006 两行 + 详情节 + 分类索引节）
- `vendor/code-example/SKILL.md` 需求类型路由表加两行
- 试点工程 build 门禁 + CDP 冒烟验证
- 005 页面内自带 `data-material`/`data-frost-level`/`data-frost-tint`/`data-transparency`/`.g-frost-backdrop` 的属性选择器实现（scoped 样式，**不动 base/bridge 主题层**）

**Out of Scope**
- 不改 skill 主题文件（base.less / bridge.less / default.less / dark.less）——`data-material` 接线进主题层是独立任务，本次不碰
- 不改 gen-tokens.mjs / build.mjs / init.mjs 等 scripts/
- 不写图表选型规范（等设计师交付）
- 不做 C（图表 accessible 配色）/ D（导航壳）/ E（步骤向导）
- 不动 pilot-dark 与 5 个旧试点目录

## 2. Research Findings（已核验事实）

1. **frost token 全量就位**：default.less L252–274 与 dark.less L246–263 均有 23 个 `--frost-*`（blur control/card/overlay = 12/20/28px；surface control/card/overlay light α=.68/.76/.84、dark α=.64/.72/.80；hover-add .04 / active-add .08；transition 120ms ease-out；border-color；三档 shadow；backdrop-base/blue/lavender/teal；tint×3；surface-solid）。均由 gen-tokens 生成，示例只引用不定义。
2. **属性选择器实现零命中**：主题四件套 grep `data-material|g-frost-backdrop|data-frost|data-transparency|data-decoration` = 0 行。§7.7 调用约定须由示例页 scoped 样式自带。
3. **白名单齐备**：el-result / el-skeleton / el-segmented / el-alert / el-progress / el-radio-group / el-radio-button / el-switch / el-button / el-table / el-empty / el-tag / el-card 全部在 `element-plus-components.json`。
4. **内容状态规范七类 Empty**（内容状态.md 表）：首次使用/成功零条/筛选无结果/无权限/请求失败/对象已删除/部分模块失败。视觉规则：空态放内容区域、保留表头工具栏、中性说明 `--color-text-secondary`、主文字 `--color-text-primary`、错误说明 `--color-error`、间距 `--space-size-8/16`、背景继承容器不新增空态专属底色；错误态用错误语义不用中性空态。
5. **§7 规则要点**（示例须体现）：常驻毛玻璃面积 10–20%（上限 25%）；一个位置一层模糊，卡内按钮标签实色不再开 backdrop-filter；hover/active 只调填充 alpha（+.04/+.08）不改 blur，active 阴影 none；focus 加 2px `--color-border-focus` 外轮廓偏移 2px；降级用 `--frost-surface-solid`；渐变背景放独立父级 `.g-frost-backdrop`；装饰（§7.6，004 已覆盖）不与整块毛玻璃同用。
6. **先例模式**：003/004 均为页面级自带 CSS 实现、零主题层支持、零 scripts 改动；README/SKILL.md 索引双登记是既定流程。
7. **骨架工程可跑**：init 生成 starter，build 热跑 0.6s，CDP 冒烟设施现成（.uxproto-pilot/cdp-*.mjs 先例）。

## 3. Detailed Design & Implementation（Plan）

### 3.0 File Changes 总表

| # | 文件 | 动作 |
|---|---|---|
| F1 | `vendor/code-example/references/frost-material/index.vue` | 新建 |
| F2 | `vendor/code-example/references/frost-material/components/frost-surface.vue` | 新建 |
| F3 | `vendor/code-example/references/content-states/index.vue` | 新建 |
| F4 | `vendor/code-example/references/README.md` | 编辑（索引表 + 005/006 详情节 + 分类索引节） |
| F5 | `vendor/code-example/SKILL.md` | 编辑（需求类型路由表加 2 行） |
| F6 | 试点工程（init 新建，`management-event6` 不用——**用 `frost-states-pilot`**，路径 `D:/cyc/project/octo/gts/test/frost-states-pilot/frost-states-pilot/`） | init + 拷入两示例改造验证 |
| F7 | `D:/cyc/project/octo/gts/test/.uxproto-pilot/cdp-frost-states.mjs` | 新建（冒烟脚本，先例 cdp-frost-decor.mjs） |

> F6/F7 是验证设施：F6 是临时试点工程（任务结束去留随 003/004 试点惯例，由用户裁决），F7 参照 .uxproto-pilot 既有脚本先例。

### 3.1 F1+F2：frost-material（005）

**页面结构**（单页对照展台，全 token、无 hex）：

- **页面骨架**：`<ElConfigProvider>` 不用；根节点 `.page`（min-height 流式，max-width 1280 居中）。
- **板块 1 `.g-frost-backdrop`**：独立父级承载柔和渐变背景——`background: var(--frost-backdrop-base)` + 两个 radial-gradient（blue ellipse 70% 100% at 15% 20% / lavender 65% 90% at 90% 75%，72%/75% 处透明），蓝紫仅以 `--frost-backdrop-blue`/`--frost-backdrop-lavender` 引用。渐变只在父级，卡片区域垫其上。
- **板块 2 三档材质对照**（`.material-row`，ElRow/ElCol 响应式栅格 :xs=24 :md=8）：
  - 每档一张 `frost-surface.vue` 卡（control/card/overlay），结构 = 标题 + 说明 + 档位 tag + 演示按钮。
  - 属性标记：`data-material="frost"`（示例页选择器实现为 frosted 等义，见下）…——**定稿**：示例内部实现直接采用设计文档 §7.7 原文属性名：`data-material="frosted"`、`data-frost-level="control|card|overlay"`。
- **板块 3 染色对照**：中性磨砂 vs `data-frost-tint="blue|lavender|teal"` 三张小卡（card 档），同一实现经属性切换。
- **板块 4 交互状态**：同一张 card 档卡 + hover/active（alpha 增量经 `--frost-hover-add`/`--frost-active-add` + color-mix 对 surface 实现增量，**不写死 rgba**）+ focus 2px `--color-border-focus` 轴外轮廓 offset 2px + `data-transparency="reduced"` 回退对照卡（`--frost-surface-solid` 实色）。
- **板块 5 面积预算注记**：页面只对 §7.3 预算做注释说明（10–20% 上限 25%），卡内按钮/标签实色（体现"卡内不再开模糊"），页面上毛玻璃表面 = 3+3+2 张卡 ≤ 视口 20%。

**F2 `frost-surface.vue` props 签名**：

```js
// props
//   level: 'control' | 'card' | 'overlay'  → 写 data-frost-level 到根元素
//   tint:  'none' | 'blue' | 'lavender' | 'teal' → data-frost-tint（none 不写属性）
//   title: String, description: String
// slots: default（卡内清晰内容）
defineProps({ level: String, tint: { type: String, default: 'none' }, title: String, description: String })
```

**scoped 样式核心规则**（F1+F2 内实现，全部走 token）：

选择器全集（示例内实现）：`[data-material='frosted']` 基线 + `[data-frost-level='control|card|overlay']` 三档（各自 blur/surface/shadow 组合）+ `[data-frost-tint='blue|lavender|teal']` 三色（仅叠加 tint，无属性时保持中性）+ `[data-transparency='reduced'] [data-material='frosted']` 降级（solid 表面 + `backdrop-filter: none`）+ `:hover`/`:active`（增量层）+ `:focus-visible`（2px `--color-border-focus` outline，offset 2px）。作用域限定在示例自身，不影响其他页面。

**hover/active 增量——定稿实现**（`--frost-surface-*` 是 rgba 全值，color-mix 无法分离 α，故用同色相增量层）：
```less
[data-material='frosted'] {
  position: relative;
  background: var(--frost-surface-card);
}
[data-material='frosted']::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: var(--frost-surface-solid);   // 同色相基色（light 白 / dark #2a2a2a）
  opacity: 0;
  transition: opacity var(--frost-transition);
  z-index: 0;
}
[data-material='frosted']:hover::after { opacity: var(--frost-hover-add); }   // +0.04
[data-material='frosted']:active::after { opacity: var(--frost-active-add); } // +0.08
// ::after 是子内容，不参与 backdrop-filter（backdrop-filter 只模糊元素背后的东西），
// 同色相 α 叠加在已模糊表面之上——与"只调整填充层 alpha"语义一致，且双主题自动正确。
// 内容 z-index:1 保持清晰（与 004 模式一致）。
```

**验证断言（005）**：
- A1: build RESULT: OK（真实编译 + token 检查 + 白名单）
- A2: CDP 冒烟——`--frost-blur-card` resolves；`[data-material='frosted']` 元素 backdrop-filter 非 'none'；`data-transparency="reduced"` 作用域内 backdrop-filter = none 且背景 = `--frost-surface-solid` 值；hover 后表面亮度变化 >0（执行层 diff 断言）；light/dark 双主题截图。
- A3: 面积预算注释存在于页面注释。

### 3.2 F3：content-states（006）

**页面结构**（单文件，状态对照展台，ElSegmented 切换 + 真实模拟）：

- **演示数据**：`const rows = [...]` 8 条 mock（走页面内 mock 数组——内容状态演示页不需要服务层；**例外说明**：SKILL.md 数据走服务层规则的意图是业务页面数据可替换，本示例页是教学展台，数据是展示物本身，写死在页面内并在注释说明）。
- **状态机**：`ref('idle' | 'loading' | 'success' | 'empty' | 'filtered-empty' | 'no-permission' | 'error' | 'gone' | 'partial-fail')`
- **切换器**：ElSegmented（9 值：初始/加载中/有数据/空结果/筛选无结果/无权限/加载失败/已删除/部分模块失败）。
- **主区域**：ElTable（保留表头工具栏——内容状态规范"普通表格空态保留表头及工具栏"）+ 工具栏（搜索框 ElInput + 清除筛选按钮，体现"筛选无结果"保留已输入条件）。
- **九态实现**：
  - idle → 区域内中性说明"尚未添加数据" + 新建按钮（有创建权限时提供入口）
  - loading → ElTable `v-loading` + 骨架（ElSkeleton 在工具栏区域下方）
  - success → 8 行数据
  - empty → ElEmpty "暂无数据"（中性，无错误图标）
  - filtered-empty → ElEmpty "未找到符合条件的结果" + "清除筛选"按钮 + 保留输入框内容
  - no-permission → ElResult error 图标？——**规范**："说明访问受限，不泄露受限数据"；用 ElResult info 图标 + "暂无查看权限" + 申请权限按钮（真实流程存在时才提供——示例中按钮存在但注释说明该原则）
  - error → ElResult error + "加载失败，请重试" + 重试按钮（回 loading）
  - gone → ElResult warning "内容不存在或已移除" + 返回列表按钮
  - partial-fail → 上半区成功数据 + 下半区（或右侧卡）"此区域暂不可用" + 区域内重试 + 更新时间标注
  - （初始 → idle；重试回 loading；旧请求晚到不覆盖新结果——示例内用请求序号 guard 演示注释）
  - **live 区域**：aria-live="polite" 属性在状态容器上（规范"异步无结果用低打扰状态通知"）
- **样式纪律**：中性说明 `--color-text-secondary`、主文字 `--color-text-primary`、错误说明 `--color-error`、间距 `--space-size-8/16`、`--font-line-height-normal`；空态背景继承容器不新增底色；不用整块投影。

**验证断言（006）**每态一轮断言，共 9 组：
- B1: ElSegmented 点到"加载失败" → 表格区域出现 ElResult + 重试按钮 → 点击重试 → loading → success 数据行数 > 0
- B2: "筛选无结果"态：输入条件保留（input value 非空）+ "清除筛选"按钮存在；点击后回 success
- B3: "无权限"态：不泄露数据（表格行数 = 0）
- B4: "部分模块失败"：成功区域行数 > 0 且 失败区域重试按钮存在（部分失败不遮盖有效数据）
- B5: 每态截图（9 态 + light/dark × 2 主题 = 抽查 3 态双主题）

### 3.3 F4/F5：索引登记

**F4 README.md**：
- 示例总览表加两行：`005 frost-material | 整块毛玻璃材质三档对照（§7.1-7.5+7.7），属性选择器页面级实现 | data-material 属性选择器, backdrop-filter (CSS) | references/frost-material/`；`006 content-states | 内容状态九态整页对照（空/加载/错误） | ElSegmented, ElResult, ElSkeleton, ElTable | references/content-states/`
- 详情节两段（仿 003/004：用途/两态或九态形态/通用规则/文件结构/适用场景；005 详情须包含 §7.3 面积预算与"卡内不再开模糊"规则、006 详情须包含七类 Empty 判定表精简版与"不要"清单）
- 分类索引节两处表更新

**F5 SKILL.md**：需求类型路由表加：
```
| 毛玻璃/材质强调（标签/卡片/浮层） | frost-material |
| 空态/加载态/错误态处理 | content-states |
```

### 3.4 F6 试点验证流程

1. `node scripts/init.mjs "D:/cyc/project/octo/gts/test/frost-states-pilot" "frost-states-pilot"` 
2. 两示例 `index.vue` + F2 组件拷入 `src/pages/FrostStates/`（App.vue 挂载页名 FrostStates）——005/006 拆两个页面目录？**定稿：拆两页** `src/pages/FrostMaterial/`、`src/pages/ContentStates/`，App.vue 用 ElSegmented（或两个按钮）切页——**改定：App.vue 只挂 ContentStates？**——**最终**：init starter 的 App.vue 改挂一个入口页，入口页用 ElSegmented 切两示例。**入口页名 `index.vue`，目录 `src/pages/FrostStates/`**（一页一目录，含两个子组件 = 拷入的 005/006 index 改名为子组件 frost-material.vue / content-states.vue）
3. build（F1/F2/F3 原样拷入，不改内容——示例即验证物）
4. cdp-frost-states.mjs 冒烟（端口先例 9225；断言 A2/B1–B4 + 抽查双主题截图）

### 3.5 Checklist（原子步骤）

- [x] 1. init 试点工程 `frost-states-pilot`
- [x] 2. 写 F1 `frost-material/index.vue`（含 §7.7 属性选择器 scoped 实现 + backdrop 渐变父级 + 三档对照 + 染色对照 + 状态对照 + 面积预算注释）
- [x] 3. 写 F2 `frost-surface.vue`（props: level/tint/title/description + default slot；含 ::after 增量层实现）
- F2 归属 005 子组件 → 2/3 可同轮写完
- [x] 4. 写 F3 `content-states/index.vue`（九态状态机 + ElSegmented + ElTable 工具栏 + 规范文案与 token 纪律 + live 区域）
- [x] 5. 拷入试点工程（FrostStates 入口 + 两子组件 + App.vue 挂载）
- [x] 6. build → 修错 → OK（全量报错一轮改完；详见 §6）
- [x] 2'. 005 详情节 + 3'. 006 详情节 + 4'. 总览表/分类索引表/路由表（F4+F5）→ **在验证通过后写**
- [x] 7. 写 cdp 冒烟脚本 F7（断言 A2 + B1–B4 + 双主题截图 4 张）
- [x] 8. 冒烟全绿 → 更新记忆锚点（ep-coder 记忆文件追加 2026-09-23 段）
- [x] 9. 试点工程 frost-states-pilot 去留 → 用户裁决：**保留**

### 3.6 验证方式（整体）

| 层 | 内容 | 判据 |
|---|---|---|
| build 门禁 | 真实编译 + token/白名单/hex/自适应纪律 | RESULT: OK + 零新 WARN |
| CDP 冒烟 | A2 + B1–B4 断言 | 全 PASS（脚本输出 PASS 数） |
| 双主题 | light/dark 抽查截图 | 用户过目（还原循环协议：build/smoke 只证结构，视觉人眼判定） |
| 索引一致性 | F4/F5 与实际文件对应 | 人工核对 |

## 4. 风险与预案

| 风险 | 预案 |
|---|---|
| `::after` 增量层方案在 scoped less 下 border-radius:inherit 与 backdrop-filter 叠加渲染异常 | 回退方案：增量改用 hover 时直接换 `background` 为预定义 token 组合（surface 档位间切换 control→card→overlay α 递增近似增量，注释说明近似性），build+截图验证取舍 |
| content-states 九态演示页复杂度超预期 | 九态数据驱动单表实现（同一 ElTable + 状态分支），状态机收敛为 computed；九态断言拆两轮跑 |
| ElSegmented 是较新组件 UMD 运行时行为未知 | 回退：改 ElRadioGroup（el-radio-button），白名单确认在列 |
| dark 主题下 frost 渐变 backdrop 与卡面层对比不足 | 抽查 dark 截图时用户判定；必要时示例注释加"深色下提高 tint alpha"指引（不写死值） |
| 示例代码纪律：import 必须在 build 白名单内 | 只 import 白名单组件 + vue 三件（ref/computed/watch）；code-rules 示例纪律（agent 会照抄） |
| UMD 已知坑 | 不用 defineExpose 方法调用（无跨组件命令式调用需求）；无 ElPagination（不用分页） |
| 示例注释含 import 语法形态文本 | 注释不写 import 示例文本（build import 扫描器连注释一起扫——五轮增量教训） |
| §7.7 属性选择器 scoped 实现与 004 的 frost 装饰伪元素（004 用 xx--yy 类名后接 ::） | 005 类名用连字符形态（brand-card-panel 形态教训：`xx--yy` 后接 `::` 会被 build 误判 token 定义）——005 全部类名连字符形态，避免 `--` 后接 `::` |

## 4.1 Done Contract

- 005/006 示例文件落地且 build OK + 冒烟断言全 PASS
- README/SKILL.md 索引双登记完成且与实际文件一致
- light/dark 双主题截图用户过目（视觉验收由用户）
- 记忆锚点更新
- 试点目录去留有用户裁决

## 4.2 Open Questions

1. （已答）属性实现位置：示例页 scoped 自带（路线一），不动主题层。
2. （已答）试点工程名：`frost-states-pilot`（management-event6 名额留给真实需求）。
3. （已答）ElSegmented vs ElRadioGroup：采用 ElSegmented，UMD 行为冒烟验证通过，无需回退。
4. （已答）"部分模块失败"布局：上下堆叠（成功表格 + partial-fail-panel），B4 验证通过。

## 4.2 Change Log

| 日期 | 变更 |
|---|---|
| 2026-09-23 11:26 | 首版 Plan 落盘（Research 事实 7 条已核验；hover/active 增量方案在 Plan 内推导定稿：`::after` + `--frost-surface-solid` 同色相增量层） |
| 2026-09-23 | DONE：执行完毕，F1–F7 全落地，视觉验收通过，试点保留（见 §6） |

## 5. Resume / Handoff

- **恢复锚点**：本 Spec 唯一真相源；执行中断恢复时先读 §3.5 Checklist 看断点，再读 §3.1 定稿实现口径。
- **关键结论**：① frost token 已全量在主题但属性选择器零实现，示例页 scoped 自带；② hover/active 增量唯一可行口径 = `::after` 同色相增量层（`--frost-surface-solid` 基色 + `--frost-hover-add`/`--frost-active-add` opacity），rgba 全值无法 color-mix 提 α；③ 006 九态由单表状态机驱动，ElSegmented 切换器失败回退 ElRadioGroup；④ 索引登记在验证通过后写；⑤ 类名禁 `xx--yy`+`::` 形态（build 误判教训）。
- **下一步动作**：（已完结）无待办。遗留独立任务：`data-material` 属性接线进 bridge.less 主题层（路线二）。

## 6. 执行记录（反向同步）

**2026-09-23 执行完毕，DONE。**

### 6.1 实际落地（与 Plan 的差异）

| 项 | Plan 口径 | 实际落地 |
|---|---|---|
| F1 结构 | 5 板块 | 3 section：三档材质对照（frost-backdrop 父级 + ElRow 三卡，各带实色演示按钮）、薄染色对照（中性+blue/lavender/teal 四卡）、交互状态与回退（hover/active、focus、实色回退 + reduced 勾选框演示 data-transparency）；面积预算以页头描述 + section-note 呈现 |
| F2 props | level/tint/title/description + slot | 增加 `solid`（Boolean，实色回退对照卡用）与 `tabindex`（focus 演示卡用）；根元素另写 `data-frost-solid` |
| F3 状态机 | 'idle'\|... 九值 ref | 同九值 ref；ElSegmented 状态切换器 + 工具栏（ElInput 搜索 + 条件性"清除筛选"+ 新建事件按钮）；600ms setTimeout 模拟异步 + requestSeq guard（旧请求晚到不覆盖新结果）；aria-live="polite" 状态注记；partial-fail = 成功表格 + `.partial-fail-panel`（重试 + `--color-error` 语义） |
| 骨架 | init + App.vue 挂 FrostStates | 同此；FrostStates/index.vue 用 ElSegmented 切两子组件 frost-material.vue / content-states.vue |
| F7 断言 | A2 + B1–B4 | A2.1–A2.11（token live/三档/blur 12-20-28/rgba 表面/::after 0 opacity 与 solid 基色/三染色/染色 gradient/backdrop 径向渐变/reduced 切换实色往返）+ B1.1–B4.3 + B5（九态项数）+ dark 断言，共 27 条 |

### 6.2 执行中的修错

1. F1 初稿遗留杂物（占位组件、废 script 块）——按产出卫生规则重写干净，`reduced` 接真实勾选框。
2. F2 首版 invalid CSS（rgba 逗号叠层）+ 垃圾选择器 + 漏"active 阴影 none"——改为 `background-color` + 同色 linear-gradient 染色技术，补 `&:active { box-shadow: none; }`。
3. build FAIL `unknown token var(--color-gray-0)`——调色板 token 正名 `--gray-0`（无 color- 前缀），修 vendor 源 + 重拷试点，重建 `RESULT: OK (2 pages, 4 components, 0 el-tag uses)` 零 WARN。
4. CDP 第 1 轮：A2.11 勾选框选择器 `.frost-backdrop` 内找不到——`.reduced-toggle` 不在 backdrop 内，改全局选择器 + null guard。
5. CDP 第 2 轮：`Buffer.from(undefined)`——captureScreenshot 结果在 `r.result.data` 非 `r.data`。
6. CDP 第 3 轮：B3.1 断言 `.el-result__icon--info` FAIL——EP 2.13.5 UMD ElResult info 图标 svg 类实为 `icon-info`，DOM 探针确认后修正。第 4 轮 27/27 PASS。

### 6.3 验证结果

- build 门禁：`RESULT: OK (2 pages, 4 components, 0 el-tag uses)`，零 WARN。
- CDP 冒烟（cdp-frost-states.mjs，端口 9231）：`RESULT: OK | 27/27 PASS`，零 unhandledrejection。
- 截图 4 张（`.uxproto-pilot/frost-states-shots/`）：frost-material-light / frost-material-dark / content-success-light / content-success-dark——**用户视觉验收通过**。
- F4/F5 索引登记：README 总览表 005/006 两行 + 两详情节 + 分类索引（按功能/按组件）+ SKILL.md 路由表两行，已与实际文件人工核对一致。
- 试点目录 `frost-states-pilot` 用户裁决：**保留**。
- 记忆锚点已追加 2026-09-23 段（project-generate-ux-prototype.md）。

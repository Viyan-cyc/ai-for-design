# Feature Spec: generate-ux-prototype skill 优化评估与任务拆分

- **层级**：Feature Spec
- **状态**：DRAFT（Research 收口；实现需另立 Plan 并获得 `Plan Approved`）
- **日期**：2026-09-28
- **来源**：management-event20 页面生成任务复盘（~35% 时间花在读文档/踩 token 陷阱）中提出的 6 条优化建议 → 本任务逐条核实事实基础，评估通用性与必要性，筛出必做项。
- **Spec 唯一真相源**：本文件。

---

## 1. 最终目标

对 generate-ux-prototype skill 的候选优化逐条做出**有证据的判定**（通用/条件通用/个例；必做/应做/可做/不做），并把「必做 + 应做」收敛为可执行的任务单元。本任务单元只产出本 Spec，**不改 skill 任何文件**。

## 2. In Scope / Out of Scope

**In**：skill 目录 `ep-coder/skills/generate-ux-prototype/` 下 SKILL.md、references/、scripts/（gen-tokens.mjs、init.mjs、build.mjs 只读核实，本轮不改）。
**Out**：management-event20 工程文件；vendor/ 内容调整；skill 之外的任何目录；本轮一切代码/文档写入。

## 3. Research Findings（逐条核实结果）

证据均在 `ep-coder/skills/generate-ux-prototype/` 内：

| # | 上一轮的建议 | 核实结果 | 证据 |
|---|---|---|---|
| F1 | design-language.md token 摘要与真实 default.less 漂移 | **部分属实，且有新发现**。① 速查表写 `--space-size-4..80`，真实为 13 个离散值（4/8/12/16/20/24/32/40/48/56/64/72/80），生成时确实试过不存在的 `--space-size-28/-6/-2`；② `--shadow-1..6` 记法使 agent 以为裸形式 `--shadow-2/--shadow-4` 存在，实际只有方向变体（`-left/-right/-top/-bottom`），生成时踩过；③ `--color-text-*` 未枚举，agent 会误推 `--color-text-tertiary`（icon 有 tertiary，text 没有）；④ **文档过期 bug**：§1 守则写「如 `color-bg-6` 未定义，引用即构建失败」，但 default.less 已定义 `--color-bg-6` | default.less:191-194（间距）、239-249（阴影）、22-28（文本）；design-language.md:23/29（`..` 记法）、:37（过期例子）；gen-tokens.mjs 注释明确速查表由其模板片段生成（8-10 行） |
| F2 | build-gate 检查清单进 SKILL.md | **建议本身失真**：SKILL.md 已完整记载 :root/--page-*/hex/白名单等门禁规则（硬约束 3 + ④ 节），真正缺口只有一个——已知坑第 2 条建议「v-model:current-page」，但**没说 v-model 不能绑 prop**（prop 只读，compileScript 直接 FAIL）。本次踩的正是这个：`v-model:current-page="page"`（page 为 prop）→ build FAIL | SKILL.md:306-315（UMD 坑清单）；build.mjs 实测报错 `v-model cannot be used on a prop` |
| F3 | verify-i18n 脚本（双词典 key 一致 + t() 引用扫描） | **属实且无兜底**：SKILL.md 要求「两份 key 集合必须一致」但零校验；缺 key 只在运行时暴露（页面显示 `msg.xxx` 裸路径）；build.mjs 无任何 i18n 校验（仅把 vue-i18n 列为白名单依赖）。本次靠人工比对补漏 6 个 key。skill 已有 `verify-fetch-icons.mjs` 先例，落点自然 | build.mjs:91（grep i18n 仅此一处）；SKILL.md:140；scripts/verify-fetch-icons.mjs 存在 |
| F4 | mock 数据生成器 | **低价值**：mock 内容领域强耦合（工单标题/设备名/处理人词汇无法泛化），生成器产物仍需 80% 重写；且每次手写成本是一次性的 | 本次 mock（24 工单 × 11 字段 + subtasks）手写约 20 分钟，内容全部来自需求描述词汇 |
| F5 | init.mjs 双嵌套问题 | **属实但是文档缺口，非脚本 bug**：init.mjs 语义正确（`dest = join(artifactFolder, slug)`），歧义在 SKILL.md ② 节没说「artifact-folder 是父目录，slug 子目录创建于其内」。本次把 `test/management-event20` 当父目录 + slug `management-event20` → 双层嵌套 | init.mjs:88-92；SKILL.md:96 |
| F6 | vendor「1-2 个示例文件」限制拆分 | **不建议**：该限制是刻意的上下文保护（references/README.md:240-242 明文），多轮分读即可解决，本次并未因此产生返工 | vendor/code-example/references/README.md:238-243 |

**关键架构事实**（改变实现形态）：design-language.md 的 token 速查表由 `gen-tokens.mjs` 的内嵌模板片段自动生成（`<!-- GEN:TOKEN-TABLE -->` 标记）——修正离散集记法应改 gen-tokens 模板后重跑生成器，而非手改文档；default.less 同样由它生成。build 门禁已对未定义 token FAIL + "did you mean" 提示（build.mjs:360-393），文档修正的价值是把失败左移到写码前，省一轮 build 往返。

## 4. 评估矩阵（通用性 × 必要性）

| 判定 | 内容 | 通用性 | 理由 |
|---|---|---|---|
| **必做 P0** | T1：token 速查表离散集精确化（经 gen-tokens.mjs）+ 过期例子修正 + SKILL.md 补「v-model 不可绑 prop」 | 高（每次生成页面的写码与过门禁环节必然触及） | ① 离散 token 猜错是确定性成本，每页都会发生；② bg-6 过期例子是主动误导，属文档 bug；③ 现有 UMD 坑条目给出的建议在 props 场景直接导致 build FAIL，属纠错；三者全部是低风险文档/模板修正 |
| **应做 P1** | T2：verify-i18n.mjs（词典一致性 + t() 引用扫描） | 条件通用（i18n 为按需能力；但一旦启用，~160 key × 2 词典的一致性靠人工必漂移） | 有 verify-fetch-icons 先例；缺 key 的失败暴露点在用户眼前（裸 key 路径），代价高于构建期 |
| **应做 P1** | T3：SKILL.md ② 节补一句「artifact-folder 是父目录，`{slug}/` 创建于其内」 | 高（每次 init 必经） | 一句话防一类嵌套混乱，成本趋近于零 |
| **可缓 P2** | T4：gen-tokens 增发机器可读 tokens.json（与 whitelists/*.json 并列） | 中 | build FAIL + hint 已兜底；收益是省一次构建往返，非正确性问题 |
| **不做** | T5：mock 数据生成器 | — | 领域耦合，产物需大面积重写 |
| **不做** | T6：vendor 读取限制调整 | — | 刻意设计，多轮分读可解，未造成实际成本 |

## 5. 任务单元（供后续 Plan 使用，本轮不执行）

### T1（P0）token 文档真值修正
- **文件**：`scripts/gen-tokens.mjs`（速查表模板片段：间距行改精确枚举 13 值、阴影行注明「1/3/5/6 + 2/4 仅方向变体」、文本行枚举全部 `--color-text-*`）→ 重跑生成器刷新 design-language.md；`references/design-language.md`:37 手改过期 bg-6 例子（换一个真实未定义的示例，如 `color-bg-7` 或改述）；`SKILL.md` UMD 坑第 2 条追加「v-model 不能绑 prop（prop 只读，compileScript FAIL），绑 prop 时用 `:prop` + `@event` 回传」。
- **验收**：重跑 `gen-tokens.mjs --check` 通过；速查表中不存在 `..` 区间记法；SKILL.md 无与 build 实际行为矛盾的建议。

### T2（P1）verify-i18n.mjs
- **文件**：新增 `scripts/verify-i18n.mjs`；SKILL.md 国际化小节追加一步「跑 verify-i18n」（③ 与 ④ 之间或 build 前后皆可，Plan 定）。
- **行为**：工程存在 `src/i18n/locales/{zh-cn,en}.js` 时，校验两文件 key 集合完全一致；尽力扫描 src 内 `t()` 字面量引用（模板字符串动态 key 按 `t('...')` 静态前缀校验或跳过，Plan 定精度）；输出 `RESULT: OK/FAIL` 固定格式，与现有脚本一致。
- **验收**：对 management-event20 工程回放——人为删除 en 词典一个 key → FAIL 并指出缺 key；恢复后 OK。动态 key 不误报。

### T3（P1）init 用法澄清
- **文件**：`SKILL.md` ② 节。
- **验收**：新会话照 SKILL.md 执行 init 不会产生双层 `{slug}/{slug}/`。

### T4（P2，可缓）tokens.json
- gen-tokens.mjs 追加输出 `scripts/verify/whitelists/tokens.json`；非正确性收益，待 T1-T3 落地后再议。

## 6. Done Contract

- **本任务单元 Done**：本 Spec 落盘且 §3 每条结论附文件级行号证据；用户对任务单元取舍（T1/T2/T3 是否都做、T4 缓议）显式表态。
- **实现类任务 Done（T1-T3 各自）**：见 §5 各自验收；且 skill 自身工作流不被破坏（gen-tokens 重跑后 default.less 零 diff、SKILL.md 既有约束零删改）。

## 7. Open Questions

1. T2 的 t() 扫描精度：只做词典一致性（简单确定）还是连 t() 引用一起扫（覆盖全但需处理动态 key）？→ Plan 阶段定，建议先做词典一致性 + 静态字面量 t() 扫描，动态前缀尽力。
2. T4 是否本轮一并做？→ 建议缓。

## 8. Change Log / Reverse Sync

- 2026-09-28：初版。Research 阶段修正了上一轮分析的两处失真（shadow-2/4 系「仅方向变体」而非完全不存在；bg-6 已定义、文档例子过期），并新增关键架构事实（速查表由 gen-tokens.mjs 生成）。
- 2026-09-28：Spec 落点变更（用户指令）：所有 spec 统一放 `ep-coder/spec/`（本文件已从 `mydocs/specs/` 迁入，历史 spec 一并迁移）。后续 Spec 一律落此处。

## 9. Next Action

等待用户：确认 T1/T2/T3（+T4 缓议）的任务单元取舍 → 进入 Plan（产出文件级改动清单与签名）→ `Plan Approved` 后执行。

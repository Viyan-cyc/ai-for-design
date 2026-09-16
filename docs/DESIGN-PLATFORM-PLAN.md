# 设计平台执行方案（GTS 2.2 × Element Plus 生成管线）

> 版本：v3（2026-09-16 定稿，**开工版**——本文档即最终方案，历史讨论已收敛进各节，不再保留过程记录）。状态：待执行，执行顺序见 §七。
>
> 自包含：供其他 session / 协作者直接阅读，不需要对话上下文。
>
> 背景一句话：用户（前端工程师）维护"AI 生成 UX 原型"工程（pure 分支，单 skill `skills/generate-ux-prototype`，Vue 3 + Element Plus 2.13.5 工作区，init/build/smoke 门禁链）。设计师以 md 包交付设计规范。本方案回答：如何按业界标准搭建"规范 → token → CSS → AI 生成代码符合规范"的完整链路，并让设计师后续迭代零摩擦。

---

## 一、核心定调：单一来源 + 派生产物分离

```
docs/design-language/      设计唯一来源（md，设计师在此迭代，永不双拷贝）
skills/.../library/        全部是派生产物（脚本可再生）+ 工程侧自有资产
```

三个推论：

1. **00索引.md 本身就是 manifest**——设计师加新组件文档 + 更新索引 = 自动收编。原方案的"收编白名单 sync"环节取消（那是为"设计师整包另发"设计的，现在设计师直接在基线上迭代，环节消失）。
2. **机器管线只剩一条**：`设计系统.md token 表 → extract → tokens.json → generate → CSS`。md 文档零加工原样消费。
3. library/ 内除 patterns/ 与 docs/（工程侧自有资产）外，全部可再生——删了重跑脚本即恢复。

**输入事实**（GTS 2.2 包，源自 gts-pc-ui-skill 2.1.0）：65 份纯 md；token 表四列格式 `Token | 用途 | 引用 | 解析值`（机器可解析，extract 的前提）；无 JSON 无 CSS——可执行层由消费侧自建；包内引用的 check_color_bindings.py / .gts/* 是原 skill 包运行时机械漏删，职责由消费侧门禁承担，不找设计师要。gts-ux-spec.txt 单文件样例**否决**作为交付格式（手工单文件自带拼接事故，违背单一来源）。

---

## 二、仓库目标结构

```
ai-for-design/
├── docs/
│   ├── DESIGN-PLATFORM-PLAN.md              # 本文档（治理记录）
│   └── design-language/                     # ★ 设计单一来源（62 份，已就位，设计师迭代处）
│       ├── 00索引.md                         #    路由表 + 设计师更新契约（manifest）
│       ├── 样式Token/设计系统.md              #    token 唯一来源（extract 唯一输入）
│       ├── 设计规范/ 8 guidelines
│       │   （AI生成规则.md 不留独立文档，内容已吸收进 SKILL 重构清单 §五-4）
│       └── 组件规范/ 51 份 + 组件索引 + 组件规则
└── skills/generate-ux-prototype/
    ├── SKILL.md                             # AI 消费层（重构清单见 §五）
    ├── references/                          # 工程方言（code-conventions / ui-runtime / usage）
    ├── scripts/                             # init / build / smoke / preflight（保留，换数据源）
    └── library/                             # ★ 派生产物 + 工程侧自有资产
        ├── tokens.json                      #    extract 产物（DTCG，入库可审 diff）
        ├── frontend/element-plus/tokens/    #    generate 产物 CSS（路径不变，内容全换）
        │   ├── index.css                    #    入口 @import
        │   ├── primitive.css                #    基础色板字面值（brand-50: #0067D1）
        │   ├── semantic.css                 #    语义 var() 链（--color-brand: var(--brand-50)）
        │   ├── charts.css / code.css        #    图表序列 / 代码高亮
        │   ├── frost.css                    #    毛玻璃（含回填的 G 1.5.1 已验证值，设计师补齐后替换）
        │   └── element-plus.css             #    bridge：--el-* → --color-*，全仓唯一一份
        ├── docs/                            #    自研组件方言文档（10~15 份，见 §四）
        ├── patterns/                        #    pattern-list-page 等迁入（工程侧页面骨架资产）
        ├── scripts/query_tokens.mjs         #    查询 CLI（query_assets.mjs 演化，读新 tokens.json）
        └── asset-manifest.json              #    assetVersion→2.2，designSource→docs/design-language
```

关键取舍：**init 消费路径保持原样**（`frontend/element-plus/tokens/` 目录位置、manifest 定位锚点），只换内容——变更面最小，E2E 回归才有干净对照。

---

## 三、收编判定（已执行，2026-09-15 落位基线）

净结论：62 份收编进 `docs/design-language/`，不收仅 2 类。业界依据（六层架构：Tokens / 组件规范 / Guidelines / 代码层 / AI 消费层 / 治理；Material 3 / Carbon / Fluent 2 同构）：

| 包内容 | 判定 | 理由 |
|---|---|---|
| 设计系统.md | 收 | Token 唯一来源 → extract 成 DTCG |
| 组件规范 51 份 + 索引 + 规则 | 收 | 设计真值：何时用 / 状态 / "不要"清单 |
| 页面布局 / 内容状态 / 响应式与无障碍 / 键盘与焦点 / 国际化 / 视觉品质* / 组件库适配 | 收 | Guidelines 一级公民（\*图标节注记：类型规范归设计师，图标资产走用户检索库——拍板出口 a） |
| 00索引.md | 改造收 | llms.txt 式消费索引（已重写，含更新契约） |
| AI生成规则.md | 内容吸收 | 业界位置是 SKILL.md，两本 AI 规则书必漂移；约束清单见 §五-4 |
| 兼容与迁移.md、脚本/.gts 簿记 | 不收 | changelog 职责 / 原包漏删机械 |

**已完成的基线改造**（源头改进，非消费侧遮蔽）：索引重写（消费路由 + 设计师契约）；脏点清理（`color-erroe-subtle`→`color-error-subtle` 修正、Sweet UI 残留删、脚本引用删）；frost 回填（GTS frost 数值"待补齐"，先以 G 1.5.1 已验证值回填过渡，退回设计师补齐后替换）；键盘与焦点.md 文首加注（EP 内建行为优先，禁叠加冗余 ARIA）。

**治理原则**：不要求设计师删任何东西；guidelines 质量不合格的**退回设计师补齐**，消费侧不代写（单一来源原则）。

---

## 四、三层文档体系（防打架，所有权分明）

| 层 | 内容 | 位置 | 归谁 |
|---|---|---|---|
| 页面骨架 | 列表页怎么搭、五态壳 | library/patterns/ | 工程侧 |
| 组件设计真值 | 何时用、视觉参数、"不要" | design-language/组件规范/ | 设计师 |
| 组件代码方言 | el-* 在本工作区怎么写：API 子集、kebab-case、提交逻辑、build 陷阱 | library/docs/ | 工程侧 |

读序：页面场景 → patterns-index；组件语义 → 组件索引命中设计真值；写实现拿不准 → library/docs/ 方言文档。**三层永不合并**。

### 组件方言文档（library/docs/，缺口与配方）

现状缺口：116 个白名单组件只有 3 份方言文档（el-form/el-dialog/el-tag）——agent 写 el-table/el-pagination 只能凭记忆赌 API。ict-coder 包（A2UI 生成器，同源 GTS 色）评估结论：**格式样板，非内容来源**——其 props 表格式 / _shared 共享类型 / API 验证门+常见陷阱 / session 缓存纪律 / 截图保真规则可抄；其 AntD/A2UI API 内容不可抄（抄了即污染）。

拼装配方（每份）：

```markdown
# el-dialog
> GTS: 对话框（组件规范/反馈类/对话框.md） | EP 2.13.5 | 白名单: ✅
## 何时读（1 行）
## API 子集（props/events/slots 表：名称|类型|默认|说明，仅白名单验证过的子集）
## 标准形（HTML+JS 含提交逻辑）
## 约束（方言坑 + build traps + GTS「不要」合并 bullet）
```

- 头部 **GTS↔el-\* 映射行**是翻译锚点：方言文档未覆盖的组件，agent 仍需"GTS 中文名 → EP API 名"的转换依据（GTS 全部中文命名，如"级联选择器"→`el-cascader`）；同时也是 docs 覆盖进度的声明文件。
- 共享内容抽 `_shared.md`（纯 JS 提交逻辑模式、kebab-case 规则），3 份以上引用不复读。
- **放量纪律：只配有真坑的组件（form/table/dialog/select/date-picker/drawer/message/notification 等），10~15 份封顶**；badge/divider 这类零坑组件不配——探测不到方言文档 = 无坑，按 GTS 规范 + preflight 写。不追 51 全套（ict-coder 敢写全量是因为它没有别的 API 源；我们有 EP 官方 + preflight，抄全量 = 制造新漂移面，它自己的 charts_usage 引用不存在的 PatGauge 就是前车之鉴）。
- props 表进不进骨架：**el-form.md 样稿先行拍板**（对照 ict-coder Button.md 格式）。

### 退役清单

- 自研页面自适应规范（L1+L2，RESPONSIVE-PLAN 产物）→ 真值归 响应式与无障碍.md，有价值的实现细节降级并入 references/ 工程方言。
- 旧 G Design 1.5.1 全套（library/design/ 的 tokens.json / rules / color-rules / frosted-glass md）→ 被 design-language/ 取代。
- 旧 12 个生成 CSS → 新管线产物原位顶上。

---

## 五、SKILL.md 重构清单（AI 消费层，一次到位）

1. **双索引读纪律**：页面场景 → patterns-index（工程侧）；组件语义 → design-language/组件索引（设计师侧）——修订 #5 落地点。
2. **session 缓存纪律**（自 ict-coder）：本 session 读过的文件禁重读；组件文档批量并行读一次。
3. **截图保真规则**（自 ict-coder）：fidelity overrides expansion——行列数与截图一致、禁凑行、逐格独立读、数字逻辑自洽。
4. **吸收 AI生成规则.md 约 8 条**：保留 token 名大小写与单位、字号行高成对、禁造未定义值（`*` 须展开为实际存在 token）、常规/紧凑间距按表不缩放、透明叠加与合成色不互换、组件内间距含边框宽、用户要求与规范冲突时指出差异而非表述为规范、布局未规定处用项目约定不臆造。
5. **方言文档探测读**：library/docs/ 存在才读；探测不到 = 无坑组件。
6. **token 消耗纪律**：规范是查询库不是上下文——常驻仅索引；token 值永不进上下文，写 `var(--color-brand)` 由 CSS 解析，语义拿不准走 query_tokens.mjs；每页规范消耗控制在 10K 量级。
7. HARD RULES 不动：纯 JS 禁 TS（build FAIL TS）、skill 自带文件禁改、preflight 优先。

---

## 六、门禁与治理

- **门禁**（保留+强化）：build token 存在性校验（读工作区 CSS 实时提取）；进阶 stylelint token-only（业务样式禁裸 hex/px，只准 var(--token)）——AI 生成不符合规范的代码被门禁打回，不靠模型自觉。
- **设计师契约**（00索引.md 已载，两点补充）：① token 表四列格式与章节锚点冻结（加 token 只加行）；② 版本号写进 00索引.md 头部；补充 ③ 新增组件规范必须同步更新组件索引（索引即 manifest，没路由到 = 不存在）；④ 图表选型规范缺位（只有配色、没有"什么数据讲什么图"），列入退回补齐清单。
- **更新流**：设计师改 design-language/ → 工程侧跑 `extract → generate → 门禁 → smoke → diff 审计 → commit`。tokens.json 入库，数值变更可审——design tokens as code 的治理核心。
- **与管线正交、独立进行**：DOC-E2E-ISSUES P1/P2（init api 模板矛盾、preflight 时序）最先修。

---

## 七、执行顺序（开工清单，含全部已拍板修订）

```
 0. DOC-E2E-ISSUES P1/P2 修复（正交，最先，独立线）
 1. 语义名 diff 报告（GTS 2.2 vs 旧 1.5.1）→ 定命名迁移成本
    （若沿用旧前缀形态 --color-*/裸名：pattern/docs 迁移退化为名字核对，bridge 结构保留）
 2. DTCG schema 样稿 + extract 脚本 → 真包试跑 → diff 用户审
 3. generate：CSS 五件套（primitive/semantic/charts/code/frost 回填值 + bridge + index）
 4. 自研 docs 迁移：换命名 + 加 GTS↔el-* 映射行 + el-form.md 样稿（props 表格式拍板）
 5. patterns 迁入 library/patterns/（换新 token 名引用）
 6. SKILL.md 重构（§五清单 7 条）
 7. 门禁接新源：build 校验读新 CSS；preflight 白名单核对
 8. asset-manifest 更新（2.2 + designSource→design-language）
 9. E2E：真实页面 init/build/smoke + 视觉核对
10. 原子切换收尾：删旧 library/design/ + 旧 12 CSS + 退役 L1+L2（修订 #1：旧资产最后删）
11. design-language/ 发设计师 + 契约生效 + 退回补齐机制运行（脏点已清理/新增图表选型缺口）
```

---

## 八、风险注记

- **中文路径**：extract/generate 须在 win32 正确处理 CJK 路径（工程已有先例，实现时注意）。
- **单拷贝约束**：skill 若脱离本仓单独分发则读不到 design-language/——本仓即交付物，约束成立；未来要独立分发再嵌派生拷贝，现在不做。
- **frost 过渡**：GTS frost 数值"待补齐"，过渡期用 G 1.5.1 回填值（修订 #2）；设计师补齐后 extract 直接覆盖，回填值退场。
- **ict-coder 残留提醒**：其 charts_usage.md 引用了组件目录不存在的组件（PatGauge/PatStackedBar）——参考其格式时内容必须以 GTS 包与 EP 实际 API 为准。

---

## 附：已否决的方案（防回潮）

- **gts-ux-spec.txt 单文件交付格式**：手工单文件自带拼接事故（字体系统写两遍、章节号重复、数值打架），违背单一来源。
- **消费侧收编白名单 sync**：为"设计师整包另发"设计；设计师直接在基线迭代后，00索引.md 即 manifest，环节取消。
- **组件方言文档 51 份全量**：制造漂移面；10~15 份封顶，探测不到 = 无坑。
- **Tailwind token 路线**（ict-coder 的 design_system.md 形态）：tokens → Tailwind preset 是另一条业界路线，但与 EP theming 配对，CSS vars 是本项目正确选择。
- **pattern 与组件方言合并**：页面骨架 ≠ 零件说明书，两层保持分离。

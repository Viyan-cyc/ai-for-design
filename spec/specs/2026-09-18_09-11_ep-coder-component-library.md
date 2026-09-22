# Spec: ep-coder / generate-ux-prototype 组件库（assets/ 知识库）

- **层级**: Feature Spec
- **创建**: 2026-09-18 09:11
- **状态**: Plan（待批准）
- **phase**: Plan
- **approval status**: 待字面 `Plan Approved`
- **前置**: `2026-09-17_17-37_ep-coder-generate-ux-prototype.md`（GO，本 Spec 在其交付物上叠加）

## 1. 最终目标（Goal）

为 skill `generate-ux-prototype` 建立 fastui 模式的组件库（用户原话："先把ep-coder的组件库搭建起来，跟fastui对齐"）：

1. **形态**：assets/ 知识库，agent 生成页面时走直线路径——查组件索引 → 读单组件文档 → 抄可复制示例（复刻 fastui vendor 的"信息确定性"模式，见 SPEC-fastui-vs-aifordesign-speed.md 根因 2/6）。
2. **覆盖**：全量映射组件（用户拍板）——派生源 GTS prompt-new.md 附录 A 全部 EP 组件各一份文档（索引镜像"高频 20 置顶"结构）；§9 核心组件文档更详尽；新增 vue-echarts 图表文档。
3. **图表运行时**：preview 离线运行时新增 echarts + vue-echarts UMD（用户拍板"文档+运行时一起做"），build 门禁同步扩展。
4. **可重定位**：assets/ 默认在 skill 包内，使用者可指定任意位置（env var 覆盖）；设计师更新设计文档无需重发 skill 包（用户拍板，动机原话）。
5. **纪律**：GTS_ElementPlus_Vue3_Prompt-new.md **只读**（派生源，不写）；design-language/ 源目录**不改**（复制到 assets/doc/）；所有写入只发生在 ep-coder skill 树内。

### 当前任务单元

Task-1：交付 assets/ 结构（doc/ 复制 + components/ 组件文档 + vendor/ 迁移）+ SKILL.md/references 集成 + API 确定性保障。

## 2. In Scope / Out of Scope

**In Scope**
- `skills/generate-ux-prototype/assets/` 新建：`doc/`（design-language v2.2.1 副本）、`components/`（工程侧组件库，GTS prompt-new 派生）、`code-skill/`（编码规则+页面模板+示例）、`vendor/`（原三类资产占位迁入）。
- 单组件文档（附录 A 全量映射，预计 65-75 份）+ 索引（高频 20 置顶）+ 图表文档（VChart）+ 编码规则 + 页面模板 + 可复制示例。
- 图表运行时：`preview/public/library/` 新增 `echarts.min.js`（6.1.0）+ `vue-echarts` 浏览器构建（8.3.0）+ `index.html` script 标签；build.mjs 白名单/结构检查扩展 `v-chart`；图表示例纳入 build 门禁。
- SKILL.md 更新：工作流加"查组件库"步骤、vendor 章节改写为 assets 章节、位置覆盖协议、硬约束（assets 只读）。
- references/design-language.md 处置（D-19）。
- API 确定性方案（D-20）。

**Out of Scope**
- GTS_ElementPlus_Vue3_Prompt.md / -mid.md / -new.md 本身（只读；派生源以 -new.md 为准）。
- design-language/ 源目录（不改一个字节）。
- EP 版本不变（2.13.5）；echarts/vue-echarts 之外的新依赖不引入。

## 3. Context Sources

| 来源 | 用途 |
|---|---|
| `GTS_ElementPlus_Vue3_Prompt-new.md`（1546 行，v2，**主派生源**）§3.1（高频 20）+ 附录 A.1-A.6（全量映射）+ §3.4（12 项无EP对应） | 组件索引 + 每组件 import/用途骨架 |
| 同上 §3.2/§3.3（VChart Props/Events/Exposes + GTS 图表色 color-chart-1..6 + 图表规范）+ §9.13 | 图表文档 + 图表示例 |
| 同上 §9（核心组件工程约束+"不要"清单） | 核心组件文档的约束章节 |
| 同上 §4+§5 | coding-rules.md（编码规则+错误检查清单） |
| 同上 §6+§7+§11（含示例 2 混合图表） | page-templates.md + examples/*.vue |
| `GTS_ElementPlus_Vue3_Prompt.md` / `-mid.md` | 旧版参照，仅 diff 时回查 |
| `design-language/`（00索引+样式Token+组件规范53份+设计规范7份，338K/62 md） | doc/ 副本源；组件文档内"设计规范参见"链接目标 |
| EP 2.13.5 包（npmmirror tgz）+ 既有三份白名单（118/534/293） | API 提取真值（D-20）；import 名真值 |
| echarts 6.1.0 + vue-echarts 8.3.0（npmmirror tgz，版本用户指定） | 图表运行时 UMD 提取源 |
| `SPEC-fastui-vs-aifordesign-speed.md` | 模式设计依据（根因排名，特别是 2🔴 token/命名可得性、6🟢 组件文档策略） |
| 现有 `SKILL.md`（222 行）、`references/design-language.md` | 集成点改造对象 |

## 4. Research Findings

### 4.1 fastui 模式的结构本质

vendor/ 205 md / 103 组件目录；读取路径 `components_index.md → 单组件文档 → examples/Readme` 直线。快的原因不是文档多，而是：**文档直给属性名（零猜测）+ 示例可照抄 + 无 token 猜谜**。本任务的组件库必须满足同一确定性标准。

### 4.2 原料→产物映射（基于 GTS_ElementPlus_Vue3_Prompt-new.md v2）

| GTS prompt-new 章节 | 内容 | 产物 |
|---|---|---|
| §3.1 高频 20 组件 + 附录 A.1-A.6 全量 | 7 类映射表（GTS组件名→EP组件→import→说明） | `components/components_index.md`（高频 20 置顶，镜像 prompt 高频优先结构） |
| §3.2/§3.3 | 图表高频 4 类 + VChart 完整用法 + GTS 图表色 | `components/v-chart.md` + 图表示例 |
| §3.4 | 12 项 EP 外组件处理方案 | `code-skill/non-ep-components.md` |
| §9.1-9.13 | 核心组件工程约束（含 §9.13 图表） | 对应组件文档的约束章节 |
| §4 + §5 | 编码规则 + 错误检查清单 | `code-skill/coding-rules.md` |
| §6 + §7 | 布局规范 + 2 页面模板 | `code-skill/page-templates.md` + `code-skill/examples/` |
| §11 | 完整代码示例 ×2（搜索表格抽屉 + 混合图表） | `code-skill/examples/search-table-page/`（3 文件）+ `chart-mixed-line-bar.vue` |
| design-language/组件规范/53 份 | 设计侧规范（何时用/视觉参数/不要清单） | **不复制内容**，组件文档内链接指到 `../doc/组件规范/...`（分工见 4.3） |

### 4.3 分工边界（design-language/00索引.md:25 原文锚定）

"本目录只回答'设计上应该长什么样'（何时用、视觉参数、状态、'不要'清单）。**怎么写代码**（Element Plus API、Vue 方言、页面骨架）由工程侧 skill 资产库负责，两者不互相重复。"
→ doc/ = 设计侧真值；components/ = 工程侧 API/代码；组件文档放 API 与代码，视觉参数链接到 doc/。

### 4.4 现有集成点

- `SKILL.md:204-208` vendor 章节（"补充完成后先查 vendor 示例再动手"）→ 改写为 assets 章节。
- `references/design-language.md` 为上期派生的 token 消费指南 → 与 doc/ 形成双源，需处置（D-19）。
- build.mjs token 检查针对工作区 themes/*.css，与 assets 无耦合 → 脚本零改动成立。

## 5. Decisions

- **D-16 assets/ 伞形结构 + 位置覆盖**（2026-09-18 用户拍板）：
  - `assets/` 下放 `vendor/`（三类资产）+ `doc/`（design-language 目录内容）+ 组件库目录（落位见 D-17b，待确认）。
  - 默认位置 `ep-coder/skills/generate-ux-prototype/assets/`；使用者设置环境变量 `EP_UX_PROTO_ASSETS_DIR` 后用指定位置。
  - **覆盖缺失不静默回退**：env var 已设但目录不存在 → agent 显式报错停下（HINT 指回默认位置或修正路径），防止读到过期文档产出错样式。
  - 动机（用户原话）："设计师后续想更新设计规范文档，但又不想找我重写发布skill包"。
- **D-17a 覆盖范围=全量映射组件**（2026-09-18 用户拍板）：派生源换至 GTS_ElementPlus_Vue3_Prompt-new.md（v2，用户 2026-09-18 上午交付）。附录 A 全部 EP 组件各一份文档；索引镜像"高频 20 置顶"结构；§3.4 无 EP 对应项单列 non-ep-components.md；§9 核心组件文档更详尽。
- **D-22 图表=文档+运行时一起做**（2026-09-18 用户拍板）：
  - 版本锁定：**echarts 6.1.0 + vue-echarts 8.3.0**（用户指定；Execute 首步核验两者 peerDependencies 兼容性，不兼容时回 Spec 报告再定）。prompt 正文写"基于 ECharts 5.x"，以实际锁定版本 6.1.0 实测为准，文档标注真实版本。
  - 依赖关系澄清：echarts 是核心库，vue-echarts 是其 Vue 封装，**两者都进 preview/library/**（缺一不可）；只装 echarts 会偏离 prompt 的 VChart 模式，违背照抄零猜测。
  - 运行时：提取 `echarts/dist/echarts.min.js`（UMD，全局 `echarts`）+ vue-echarts 浏览器构建（全局 `VChart`，文件名以包内 dist 实际产物为准）→ `preview/public/library/`；`preview/index.html` 加 script 标签。
  - 门禁：build.mjs EP tag 白名单扩展 `v-chart`（放行 VChart tag）；v-chart 不走 EP 组件导出校验（其 API 真值来自 §3.3 表格，非 EP UMD）。
  - 图表示例纳入 E1 build 门禁（可编译+token 合规）；浏览器级图表渲染冒烟并入 C6 同类验证。
- **D-17b 落位=按功能建目录**（2026-09-18 用户拍板）：
  - `assets/components/` — 组件库：`components_index.md`（入口）+ ~70 份单组件文档 + `api/`。
  - `assets/code-skill/` — 代码规范与生成代码：`coding-rules.md` + `page-templates.md` + `non-ep-components.md` + `examples/`。目录名采用用户原话（"可能是code-skill（代码规范，生成代码的目录）"）。
  - 通用原则（用户原话）："反正有什么功能，就会新建一个文件夹来存放"——后续新功能类资产在 assets/ 下新建同级目录，README 维护目录清单。
- **D-18 doc/ 副本唯一许可偏差**：复制 design-language 时仅修正 `00索引.md` 中对旧锚定路径的引用（"skills/generate-ux-prototype/library/" → "assets/components/"），其余 61 个文件字节级忠实复制。理由：锚定行指向不存在路径会误导 agent。design-language 源不动。
- **D-19 references/design-language.md 处置 = 瘦身为指针**（2026-09-18 用户拍板）：真值移 assets/doc/，该文件改写为"真值指针（→ assets/doc/）+ EP 桥接速查表"，消除双源。
- **D-20 API 真值 = 提取脚本**（2026-09-18 用户拍板）：新增维护脚本 `scripts/gen-component-api.mjs`——临时 npm 安装 EP 2.13.5（沿用 gen-whitelists 模式），从 UMD 枚举每组件 props/emits → 生成 `assets/components/api/element-plus-2.13.5.api.json`；Execute 期照抄进各组件文档，杜绝 API 幻觉。fallback：提取不完整时该组件文档只写 GTS prompt 来源约束 + 保守 API。
- **D-21 "gts" 字符串纪律延伸**（D-14 延伸澄清）：派生文档 prose 中用"设计语言组件名"等表述替代"GTS 组件名"，保持全库 grep `gts` 卫生检查可用（E5 同标准）。

## 5.1 Open Questions

（OQ-1~3 已转为 D-17b/D-19/D-20 用户确认；无未决阻塞项。）

## 6. Plan（契约 — 待 `Plan Approved`）

### 6.1 Target 结构

```
ep-coder/skills/generate-ux-prototype/
├── SKILL.md                                   # [改] ②读文档步骤接入组件库直线路径；§4 vendor→assets；
│                                              #      位置覆盖协议；硬约束+1（assets 只读）
├── references/
│   ├── env-config.json                        # [不动]
│   └── design-language.md                     # [改写，D-19] 真值指针 → assets/doc/ + EP 桥接速查
└── assets/                                    # [新] 知识库根（EP_UX_PROTO_ASSETS_DIR 可覆盖；按功能建目录）
    ├── README.md                              # [新] 目录清单 + 位置覆盖协议 + 更新方法（设计师视角）
    ├── doc/                                   # [复制] design-language v2.2.1 全量（62 md；仅 00索引.md 锚定行修正，D-18）
    ├── components/                            # [新] 组件库（D-17b）
    │   ├── components_index.md                # [新] 入口：高频 20 置顶 + 全量分类索引（附录 A 重组 + doc/components 分工声明）
    │   ├── api/
    │   │   └── element-plus-2.13.5.api.json   # [生成，D-20] 每组件 props/emits 机器提取
    │   ├── <ep-component>.md × 65-75          # [新] 单组件文档（骨架见 6.2）
    │   └── v-chart.md                         # [新] 图表文档：VChart Props/Events/Exposes + GTS 图表色 + §9.13 规范
    ├── code-skill/                            # [新] 代码规范与生成代码（D-17b）
    │   ├── coding-rules.md                    # [新] 编码规则 + 错误检查清单（§4+§5 派生）
    │   ├── page-templates.md                  # [新] 布局规范 + 模板选型指引（§6 + §7 说明部分）
    │   ├── non-ep-components.md               # [新] EP 外组件处理方案（§3.4 派生）
    │   └── examples/
    │       ├── left-info-with-right-card.vue      # [新] §7 模板 1
    │       ├── search-table-page/                 # [新] §11 示例 1（多文件结构示范）
    │       │   ├── SearchTablePage.vue
    │       │   └── components/{SearchForm,DetailDrawer}.vue
    │       └── chart-mixed-line-bar.vue           # [新] §11 示例 2（折线+柱状混合图）
    └── vendor/                                # [移] 原 vendor/ 迁入（PLACEHOLDER.md 内容同步更新路径）
        └── PLACEHOLDER.md
```

### 6.2 单组件文档模板（6.3 骨架，全 ~70 份统一）

```markdown
# <组件中文名> <ElName>

import 语句（照抄，来自白名单真值）
## 常用 API（props/emits/slots —— D-20 提取或保守来源）
## 设计语言约束（§9 有则写；无则引用通用规则）
## 常见坑（§5 错误清单相关条目）
## 最小示例（可复制的短代码块）
## 设计规范参见（链接 ../doc/组件规范/<类>/<X>.md；仅设计侧存在的组件有此节）
```

- 核心升级：§9 覆盖的 12 组件（按钮/表单/输入框/选择器/表格/对话框/抽屉/分页/页签/标签/空状态/警告消息通知）约束章节全文收录。
- 分工纪律：视觉参数（颜色/尺寸值）不复制进组件文档，一律链接 doc/（4.3）。

### 6.3 Checklist（原子）

**Phase A 结构与复制**
- [ ] A1 `assets/` 骨架 + `assets/README.md`（目录清单+覆盖协议+更新方法；含"新功能=新目录"原则）
- [ ] A2 `doc/` 复制 design-language 全量（62 md 忠实转录；00索引.md 仅锚定行修正）+ 抽查校验
- [ ] A3 `vendor/` 迁入 assets/ + PLACEHOLDER.md 路径说明更新

**Phase B API 真值**
- [ ] B1 `gen-component-api.mjs`：临时装 EP 2.13.5 → 枚举组件 props/emits → api json + 计数报告
- [ ] B2 提取覆盖率核对（对照 118 组件白名单；不完整组件记入 fallback 名单）

**Phase C 图表运行时**（D-22）
- [ ] C0 peerDependencies 核验：echarts 6.1.0 ↔ vue-echarts 8.3.0 兼容性；不兼容 → 回 Spec 报告
- [ ] C1 npmmirror 拉 echarts@6.1.0、vue-echarts@8.3.0 tgz → 提取 UMD/浏览器构建 → preview/public/library/（文件名以包内 dist 实际产物为准）
- [ ] C2 preview/index.html 加 script 标签 + src/main.js 无需改动（全局注册方式写进 SKILL.md 组件文档）
- [ ] C3 build.mjs：tag 白名单扩展 v-chart；图表相关结构检查核对（style 检查逻辑复用）
- [ ] C4 图表冒烟：init 工作区 + 图表示例 → build OK → headless Chrome 渲染无异常（canvas 出现、boot-error 未触发）

**Phase D 组件与规范文档**
- [ ] D1 `components/components_index.md`（高频 20 置顶 + 附录 A 全量重组 + 索引使用说明 + 分工声明）
- [ ] D2 `components/` 核心组件文档（§9 约束全收录：按钮/表单/输入框/选择器/表格/对话框/抽屉/分页/页签/标签/空状态/警告消息通知等）
- [ ] D3 `components/` 其余映射组件文档（附录 A 骨架 + API + 最小示例；§9 无约束的用通用规则）
- [ ] D4 `components/v-chart.md`（§3.2/§3.3/§9.13 派生 + GTS 图表色表 + 实际锁定版本标注）
- [ ] D5 `code-skill/`：`coding-rules.md` + `page-templates.md` + `non-ep-components.md`
- [ ] D6 `code-skill/examples/` 4 份产物（§7 模板 1 单文件、§11 示例 1 三文件、§11 示例 2 图表；改写为独立可运行页面，token 引用全可解析）

**Phase E 集成**
- [ ] E1 SKILL.md：工作流 ② 接入"索引→组件文档→示例"直线路径；vendor 章节→assets 章节；覆盖协议；硬约束（assets 只读、不写 assets）
- [ ] E2 references/design-language.md 瘦身为指针（D-19）
- [ ] E3 全库 grep `gts`（排除 vendored library）保持零命中（D-21 验证）

**Phase F 验证收口**
- [ ] F1 示例 build 门禁：init 临时工作区 → 放入 examples 全部产物 → build.mjs → RESULT: OK（证示例可编译+token 合规）
- [ ] F2 反向抽查：组件文档 import 语句与白名单逐一对账（抽样 ≥20）；API 表与 api json 对账（抽样 ≥10）
- [ ] F3 位置覆盖演练：设 EP_UX_PROTO_ASSETS_DIR 指向不存在路径 → SKILL.md 协议要求显式报错（人工按协议走查）；指向副本目录 → 路径解析正确
- [ ] F4 文档抽查：任取 5 份组件文档，核对与 GTS prompt-new 源章节无语义偏差、与 doc/ 链接可达
- [ ] F5 回写 Spec Execute Log + Plan-Execution Diff

### 6.4 Validation（Done Contract）

1. F1 示例全部通过 build 门禁（RESULT: OK，含图表示例）。
2. F2 对账抽样零偏差；api json 组件数 = 白名单 118（或 fallback 名单已记录）。
3. 组件文档数量 = 附录 A 映射的 distinct EP 组件数 + v-chart（Execute 期精确清点，预计 65-76）。
4. doc/ 副本 62 文件与源 diff 为空（除 00索引.md 锚定行）。
5. C4 图表冒烟通过：canvas 渲染、零 JS 异常、boot-error 未触发。
6. F3 覆盖协议两分支行为符合 D-16；E3 grep 零命中。
7. GTS_ElementPlus_Vue3_Prompt*.md 与 design-language/ 源目录 mtime/内容不变（只读证明）。

### 6.5 Risks

- **R-1** UMD 提取 props/emits 对部分组件（如 ElTableV2 等特殊形态）不完整 → B2 覆盖率核对 + fallback 路径（D-20）。
- **R-2** doc/ 副本快照会过期 → 机制固有；更新路径 = 设计师替换 doc/ 或用覆盖位置（README 写明）。
- **R-3** 65-75 份文档转录量大 → F2/F4 抽查协议兜底；发现语义偏差回炉。
- **R-4** 示例改写可能引入 token 引用错误 → F1 build 门禁真编译兜底。
- **R-5** 组件文档 API 写入与 EP 2.13.5 实际行为有出入（props 之外的事件签名/插槽文档化有限）→ 声明局限：api json 只覆盖 props/emits；文档 API 表以提取值为准，模型记忆不作为来源。
- **R-6** echarts 6.1.0 与 vue-echarts 8.3.0 兼容性未预验证（prompt 正文标注"基于 ECharts 5.x"，与用户指定 6.1.0 有版本代差风险）→ C0 首步核验 peerDependencies + C4 真实渲染冒烟双兜底；不兼容回 Spec。
- **R-7** vue-echarts 浏览器构建产物形态未知（可能非标准 UMD 单文件）→ C1 以包内 dist 实际文件为准，探测失败则改用 ESM+importmap 方案并回写 Spec。

## 7. Innovate

**Skipped + Reason**：模式由用户显式指定（复用 fastui 组件模式 + assets 伞形结构 + 全量覆盖），无方案分叉需要评估。

## 8. Execute Log

（待 Execute 后回写）

## 9. Review Verdict / Plan-Execution Diff

（待 Review 后回写）

## 10. Change Log

- 2026-09-18 09:11 首版 Spec 落盘（Research 完成；D-16/D-17a 用户已拍板）。
- 2026-09-18 二轮：OQ-1~3 用户确认 → D-17b 定型（assets 按功能建目录：doc/ + components/ + code-skill/ + vendor/，新功能=新目录）、D-19 定型（瘦身为指针）、D-20 定型（API 提取脚本）。
- 2026-09-18 三轮（派生源更新 + 图表范围拍板）：用户交付 GTS_ElementPlus_Vue3_Prompt-new.md（v2，§3 高频优先重构 + vue-echarts 图表能力）→ 派生源切换至 -new.md（D-17a 修订）；D-22 新增（图表=文档+运行时一起做，echarts 6.1.0 + vue-echarts 8.3.0 用户指定，两者皆进 preview/library）；6.1 结构树 / 6.3 Checklist（新增 Phase C 图表运行时，重排为 A/B/C/D/E/F）/ 6.4 Done Contract / 6.5 Risks（R-6/R-7）同步改写。**Plan 完整，待字面 `Plan Approved`。**

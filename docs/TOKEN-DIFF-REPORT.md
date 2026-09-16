# 语义名 Diff 报告（GTS 2.2 vs 旧库 G Design 1.5.1）

> 2026-09-16。执行方案 DESIGN-PLATFORM-PLAN.md §七-第 1 步产物。数据源：旧 `library/design/tokens.json`（567 唯一名）vs 新 `docs/design-language/样式Token/设计系统.md`（280 唯一名）。机械 diff + var() 链解析比对。
>
> **⚠ 2026-09-16 更新**：报告初版后，工程侧按 W3C DTCG 命名规范对设计师命名做了 A 档改名（v2.2.1，已落基线）：`radius-size-infinite`→`radius-size-full`、`font-family-other`→`font-family-numeric`、`shadow1/3/5/6`→`shadow-1/3/5/6`、`shadow2-l/r`→`shadow-2-left/right`、`shadow4-t/b/l/r`→`shadow-4-top/bottom/left/right`、`gray-0White/gray-100Black`→`gray-0/gray-100`。§2.2 映射表中涉及上述旧名的行以新名为准；契约第 ④ 条（命名规范）已写入 00索引.md。

## 一、总体结论：迁移成本为低，桥接层结构可 100% 保留

| 维度 | 结果 |
|---|---|
| **语义色**（业务代码引用面 `--color-*`） | 45/54 解析值**完全一致，0 真值差异**；引用链差异仅 7 处且全部为同一事实（`gray-0`→`gray-0White` 端点改名） |
| **基础色板** | 132 个色阶名与值**完全一致**（147 行新表，132 同名同值、15 个新别名/公司色） |
| **业务代码引用的命名** | `--color-*` 语义名**零改名**——pattern/docs/生成页面的迁移退化为"核对"而非"重写" |
| 桥接层 `--el-* → --color-*` | 结构原样保留，仅 frost 回填值需并入 |

## 二、命名映射（旧 → 新）

### 2.1 不变（零成本，204 个）

- 全部语义色名：`color-brand(-hover/-focus/-active/-disabled)`、`color-text-*`、`color-icon-*`、`color-border*`、`color-bg-1..6`、`color-hover/select`、`color-error/alert/warning/success/info/none(-subtle)` 等 45+45（浅/深）
- 全部基础色阶：`{hue}-{05..90}` 132 个（rose/red/orange/yellow/green/mint/cyan/blue/indigo/purple/pink/brand/gray）
- 图表：`color-chart-1..6` 名称不变（**值有变**，见 2.4）
- 边框：`border-width-none/normal/independent`、`border-style-*` 不变

### 2.2 系统性改名（机械映射，脚本可自动）

| 旧 | 新 | 数量 |
|---|---|---|
| `space-{n}`（2/6/10 除外） | `space-size-{n}` | 13 个 |
| `radius-small/normal/medium/large/x-large/xx-large/full` | `radius-size-small/normal/medium/big/big1/big2/infinite` | 7 个 |
| `font-size-normal-1` | `font-size-normal1` | 1 个 |
| `font-size-large/x-large/xx-large/display-1..4`（24/30/36/40/48/60/80px） | `font-size-big/big1..big6`（24/30/36/40/48/60/80px） | **值一致，纯改名** 7 个 |
| `line-height-*` 同上对应 | `font-line-height-*` | 7 个 |
| `font-family-numeric` | `font-family-other` | 1 个 |
| `shadow-1/nav-left/nav-right/float/top/bottom/left/right/selected/dialog` | `shadow1/shadow2-l/shadow2-r/shadow3/shadow4-t/shadow4-b/shadow4-l/shadow4-r/shadow5/shadow6` | **几何值逐一等值**（如 shadow-1=0 1px 3px 10% ↔ shadow1；shadow-dialog=0 20px 32px 10% ↔ shadow6），纯改名 10 个 |
| `color-code-*`（37 个，`color-` 前缀） | `code-*`（新表仅 12 个子集） | 前缀变更 + **子集缩减**（quote/bullet/javadoc/doctag/section/class/name/function/params/attr/property/variable/string/literal/number/regexp/boolean/symbol/template-variable/subst/tag/selector-* 等未入新表） |
| `color-corporate-*`（15 个） | `company-*`（15 个） | 前缀变更 |
| `gray-0` / `gray-100`（兼容别名） | `gray-0White` / `gray-100Black`（保留原名） | 别名反向：新表只有原名 |
| `g-*` 兼容层（60 个） | **无新对应** | 见 2.5 |

### 2.3 新增（旧库没有）

- `font-family-other`、`space-size-4..80` 紧凑列（第二密度配置）、`radius-size-big/big1/big2`（预留档）、`shadow2-l/r`、`shadow4-t/b/l/r`（方向档拆分）
- 公司辅助色 `company-*` 15 个（替代旧 `color-corporate-*`）
- `font-size-big4/5/6`（48/60/80px，旧库归在 display 档）
- frost 全节（`--frost-blur-*` 等，部分「待补齐」——回填策略见执行方案修订 #2）

### 2.4 真值变化（极少数，需知会）

| Token | 旧值 | 新值 | 说明 |
|---|---|---|---|
| `color-chart-1..6` 默认序列 | 旧 1.5.1 六色 | **新六色**（chart-1: `#6190FF`→`#2070F3` 等） | 图表默认序列更新，唯一大范围真值变化；无障碍序列旧库 6 色 → 新表给出 blue/green/indigo/cyan/orange/brand 的 60 档 |
| `color-bg-6` | `rgba(201,201,201,0.20)` | **待确认**（新表明示两处标注冲突，未确认前不得用于页面） | 生成侧门禁应拒绝该 token 直至设计师定值 |
| 覆盖/透明类（bg-mask/hover/table-header/fill 系） | 字面 rgba | 新表给 `gray-90 / 5%` 形式 | 解析后等值（`#191919 / 5%` = `rgba(25,25,25,0.05)`），extract 时需展开为 rgba |
| border-width 数值 | `0` | `0px` | 形式差异 |

### 2.5 旧库独有、新包没有（需消费侧裁决）

| 族 | 数量 | 处置建议 |
|---|---|---|
| `el-*`（bridge 95 个） | 95 | **保留**——这是消费侧产物不是设计数据，generate 继续产出 |
| `g-*` 兼容层 | 60 | **保留过渡**——pattern 与部分文档引用它；generate 时由语义 token 派生（`--g-white: var(--color-bg-2)` 等），设计师补齐前不删（对应修订 #2 的 frost 同款处理） |
| `frost-*` 旧命名族（blur-control/surface-control 等 30 个） | 30 | frost 回填值的载体，generate 保留至设计师补齐 |
| 旧 `glass-*/visual-*`（17 个） | 17 | 旧 aurora-glass 风格遗留；新包 frost 体系统一后**可删**（切换收尾时） |
| `spec-*`（实现尺寸 14 个） | 14 | 工程实现尺寸（advanced-filter 列宽等），非设计 token——**迁出 token 管线**，转 patterns/ 工程侧资产 |
| `code-*` 未入新表的 25 个语法细项 | 25 | 新表只给 12 个语义大类；generate 时未定义细项由大类色派生或弃用，知会设计师确认为何缩减 |
| `space-2/6/10`、`border-width-focus`、`shadow-*` 旧方向名 | 少量 | 新表无对应：space-2/6/10 违反 4px 网格被移除（合理）；border-width-focus 未入表（退回清单可列） |

## 三、对执行方案的影响判定

1. **§七-1 判定：语义名基本兼容成立。** 迁移策略 = 语义层零改动 + 尺寸层机械改名（extract 时产出映射表，旧名→新名仅存在于生成产物内部，业务代码只写 `--color-*`/`--space-*` 等引用面）。
   - ⚠️ 注意：`space-*/radius-*` 在 pattern/docs 中以 `--g-space-*` 或 `var(--space-*)` 引用——bridge/兼容层继续提供旧名派生，业务零感知。
2. **引用链改名 7 处**（gray-0→gray-0White）：extract 时按新名生成，兼容层同时暴露两个名字（保留旧别名一个版本周期）。
3. **图表六色真值更新**：唯一影响视觉的实质变化，E2E 视觉核对时重点看图表页。
4. **`color-bg-6` 进入门禁黑名单**：新表明示待确认，token 校验遇它直接 FAIL 并提示"设计师未定值"。
5. **code-* 缩减、border-width-focus 缺失**：列入退回设计师的补齐清单（连同图表选型规范缺位，共 3 项）。

## 四、第 2 步试跑结果（2026-09-16，extract 真包试跑）

extract 脚本落位 `skills/generate-ux-prototype/scripts/extract-tokens.mjs`（schema `gts-flat-dtcg/1`：token 名不带 `--` 前缀、`$value` 字面值或 `{别名}`、审计信息入 `$extensions.gts.*`）。对真实 `设计系统.md` 试跑结果：

| 项 | 结果 |
|---|---|
| 解析 token 总数 | **330**（色板 132 + 语义 57 + 公司色 15 + 代码 12 + 间距 13 + 圆角 7 + 边框 7 + 字体 28 + 阴影 10 + frost 种子 49） |
| 别名校验 | 0 错误（所有 `{别名}` 命中色板；`resolvedHex` 与色板逐个对账一致） |
| 待确认 | 1 个——`color-bg-6`（进 generate 黑名单，不出 CSS） |
| 未解析表 | 13 张，**全部是非 token 表**（路由表/规则表/延展组合/部署位置/档位选择），签名机制正确跳过 |
| 交叉验证 | 与旧库 `semantic-light` 54 项比对：45 同值 + 6 个 rgba 空格格式差异（值等价）+ 3 个未入新 schema（`color-bg-6` 待确认属预期；`g-shadow` 旧兼容层按方案排除；`color-portal-highlight` 旧库门户官网专用，新包无此场景，随旧库退役） |

关键解析规则已固化进脚本：间距/圆角/字号/行高裸数字 → 补 px；typography 成对行 → 一次产两个 token；透明叠加色（`gray-90 / 5%` 形式）→ rgba 字面值 + `gts.ref/alpha` 记录来源（var() 无法合成透明度）；`g-*`/`el-*`/`spec-*` 不进 schema（generate 派生/迁出）。

→ §七-3：generate 产 CSS 五件套（primitive/semantic/charts/code/frost 回填 + bridge + index）。

### 旧版下一步（已被上行取代）

→ §七-2：DTCG schema 样稿 + extract 脚本。schema 直接按新表四列结构建模（palette/ui-colors/charts/code/spacing/radius/typography/border/shadow/frost 十个 section），尺寸层沿用新名（`space-size-*`/`radius-size-*`/`font-size-*`/`shadow1..6`），兼容层（`g-*`、旧名别名）作为 generate 阶段的派生产物，不进 schema。

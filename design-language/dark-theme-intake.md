# 深色主题补齐指南（给设计师）

> **本文档任务已全部完成，转为存档**：设计师 2026-09-22 交付统一双主题规范（`Token｜用途｜Light｜Dark` 统一表），真值源已完成集成——浅色／深色在 `design-language/样式Token/设计系统.md` §1.2 成对维护，工程 dark 皮肤全部由统一表生成，**无工程回填项**。下文 §B 清单与回填表仅作历史记录。
> 受众：design-language 设计侧。目标：在 design-language（真值源 `design-language/样式Token/设计系统.md`）基础上补齐深色 UI 色表，使工程侧能生成完整深色皮肤。
> 工程侧对接人拿到本文档后可自行判断补齐进度；**设计师不碰代码**。

---

## A. 怎么改（工作流程）

### A.1 改哪里 —— 只改真值源，不另建文档

所有深色值**直接补进 `design-language/样式Token/设计系统.md`** 对应 token 组小节：

- 现有浅色表格增加"深色值"列，或在组内新增"深色主题"小节（格式与浅色表一致：Token | 用途 | 浅色 | 深色）；
- 派生态必须**显式给全**：悬停/按下/禁用/获焦等交互态不做推导，每组把完整状态列齐；
- 真值源中已有的"深色未定义"声明行（如 §1.2 背景色、§6.4 投影）在补齐后同步更新措辞。

**不要**：另建深色规格文档、在工程 css 里直接写值、只给主色让工程"自动生成"派生态。

### A.2 填什么格式 —— 语义 token，不是色板

按用途填语义 token（`--color-text-primary`、`--color-bg-4` 这类规范名对应的深色值），不是单独的深色色板。可参考浅色值的组织方式：每组先定基础色（品牌 5 态、文本 5 级……见 §B 清单），再给组件消费的语义对位。

工程侧约束（设计师需知，不需要动手）：

| 约束 | 说明 |
|---|---|
| 作用域 | 深色皮肤整体在 `html[data-theme="dark"]` 下生效，逐 token 独立定义 |
| 完整性门禁 | 桥接层消费的语义 token **缺一个即构建失败**（fail-fast，防漏定义静默走默认色） |
| 色阶派生 | Element Plus 的 light-N 色阶由桥接层 `color-mix` 自动派生，**设计师只需给一个 `--ux-mix-base` 深色表面色**（如卡片/面板底色），无须手算 N 阶 |
| 投影 | 深色阴影几何可与浅色一致，只调整颜色与透明度；须明确给出（不自动套用浅色 80% 配置，见真值源 §6.4） |

### A.3 流向 —— 设计文档改完之后的自动化

```
设计师补真值源深色值
      ↓
工程侧跑 scripts/gen-tokens.mjs（从设计文档重新生成皮肤 css）
      ↓
生成 dark.css 皮肤文件 → 按 themes/README.md 协议接线
      ↓
预览验证（见 §C 验收标准）
```

### A.4 用 LLM 辅助起草（可选）
设计师可用 LLM 加速起草，但分工固定：**LLM 只起草，设计师裁决；产出只进真值源，不碰工程文件**。

**喂两份材料（缺一不可）**：
1. `design-language/样式Token/设计系统.md` —— 真值源全文（浅色值、token 命名与语义都在这里）；
2. 本文档 —— §B 是任务清单，§A.2 是工程约束。

**给 LLM 的指令要点**：
- 逐项补齐 §B 状态表中的剩余组（填充/表格/投影/frost/深色 accessible），并正式化 §B "工程回填待设计师正式化"表的 10 项；输出直接对齐真值源表格形态（Token | 用途 | 浅色 | 深色），token 名与真值源现有名称**逐字一致**，禁止编造新 token 名；
- 先定基础组（品牌 5 态 / 文本 5 级 / 背景 6 项 / 混色基底 `--ux-mix-base`），再对位组件语义组——产出必须是一套整体协调的深色 ramp，不逐组孤立取色；
- 悬停/按下/禁用/获焦等状态色写成显式值：LLM 可提案候选，设计师逐个确认后录入真值源，即为"显式给值"（真值源守则 3 禁止的是工程侧构建时自动推导，不禁止起草辅助）；
- 输出前自查：对照 §B 无缺组；文本/背景对比度自检（正文 ≥ 4.5:1）。

**LLM 不能做的**：
- 不得生成 dark.css 或任何工程 css/代码——皮肤由工程侧在真值源改完后跑 `gen-tokens.mjs` 生成（§A.3 流向），LLM 直出的文件会在下次重生成时被覆盖丢失；
- 不得另建深色规格文档（§A.1 纪律）；
- 第 10 组（基础色板深色变体是否整表提供）是设计裁决题：LLM 列选项与利弊，设计师拍板。

最终验收仍走 §C（工程侧执行），LLM 环节无法替代。

> **现成的 LLM 指令**：同目录 `dark-theme-llm-prompt.md` 是写好的指令全文——设计师连同真值源一起上传，粘贴即用，无需自己组织提示词。

## B. 缺什么（逐组清单）

> **状态更新（2026-09-22，终态）**：设计师交付统一双主题规范并已集成——全部 12 组 + 图表 default 11 色 / accessible 6 色双主题 + 业务告警状态色**两主题齐值**（97 语义键，§1.2 统一表）。**全部缺口清零，工程回填 10 项退役**（设计师正式值与回填值级一致）。

| # | Token 组 | 需补项 | 状态 |
|---|---|---|---|
| 1 | 品牌色 | brand 5 态 | ✅ 统一表齐值（disabled 深色取 brand-70） |
| 2 | 文本色 | 5 级 + link 6 项 + on/inverse-disabled | ✅ 统一表齐值（link 族浅色同步正式启用） |
| 3 | 图标色 | 9 项 | ✅ 统一表齐值 |
| 4 | 边框色 | 7 项含 border-active | ✅ 统一表齐值（separator 带 alpha） |
| 5 | 背景色 | bg-1..6 + mask | ✅ 统一表齐值（bg-6 浅色同步正式化） |
| 6 | 填充色 | 8 项 | ✅ 统一表齐值（回填退役） |
| 7 | 功能色 | 全交互态 + subtle/subtler | ✅ 统一表齐值（info 双轨体系 + warning-strong 转正） |
| 8 | 表格色 | header / zebra | ✅ 统一表齐值（回填退役） |
| 9 | 投影 | shadow-1..6 深色值 | ✅ §6.2 Dark alpha 列（几何同浅色） |
| 10 | 基础色板 | 深色变体裁决 | ✅ 设计师裁决：主题无关，两主题同值（统一规范 §9） |
| 11 | 混色基底 | `--ux-mix-base` 深色值 | ✅ 统一规范 §1.4（Light #FFFFFF / Dark #191919） |
| 12 | frost 深色材质 | 深色材质参数组 | ✅ §7 正式化（中性深灰 surface + Dark alpha 阴影 + 色板端点染色） |
| 附 | 图表深色序列 | — | ✅ default 11 色 + accessible 6 色双主题齐值 |
| 附 | 业务告警状态色 | urgent/primary/secondary/success/running/none | ✅ 统一表齐值 6 项 |

### 工程回填（已全部退役，仅存档）

设计师正式值与回填值级一致，10 项已从生成器 DARK_BACKFILL 删除：

| Token | 回填值（已退役） | 设计师正式值（统一表 Dark 列） |
|---|---|---|
| `color-hover` | rgba(255,255,255,0.06) | 同值 |
| `color-select` | rgba(46,134,222,0.20) | 同值 |
| `color-table-header` | rgba(255,255,255,0.06) | 同值 |
| `color-table-zebra` | rgba(255,255,255,0.03) | 同值 |
| `color-fill` | rgba(255,255,255,0.06) | 同值 |
| `color-fill-subtle` | #2a2a2a | 同值 |
| `color-fill-disabled` | #393939 | 同值 |
| `color-fill-disabled-subtle` | rgba(255,255,255,0.06) | 同值 |
| `color-info` | #2070f3 | 同值（统一表显式收录 color-info 键） |
| `color-info-subtle` | #1f55b5 | 同值 |

### 新版规范（design-language-new）审阅结论——后续状态

> 上轮"不采纳"的 5 组命名倒退、frost 清空、typo 问题，设计师在 2026-09-22 统一双主题规范中已全部修正：命名零倒退（shadow1/radius-size-infinite/gray-0White/font-family-other 均 0 处）、frost 正式化、`color-info-seconday`→`secondary` 已统一迁移、无 typo。该节历史理由仅存档。

1. **token 命名倒退 5 组**（`shadow1`/`shadow2-l`/`radius-size-infinite`/`gray-0White`/`font-family-other`）：工程侧 2026-09-16 已按 W3C DTCG 规范对齐为 kebab-case（`shadow-1`/`shadow-2-left`/`radius-size-full`/`gray-0`/`font-family-numeric`），全套工程资产（桥接层、组件文档、生成器）已消费该命名，倒退成本高且违反命名契约（见 00索引 头部"新增 token 命名遵循 W3C DTCG 惯例"）。
2. **§7 frost 数值清空**（"待补齐"）：G 1.5.1 已验证基线是 2026-09-16 设计师答复确认的回填值，清空丢失已验证数据。（现已正式化，见 §B 组 12）
3. **拼写**：§1.2 浅色表 `color-erroe-subtle` 为 typo（§1.2D 用的是正确的 `color-error-subtle`），建议修正；`color-info-seconday`（secondary）为原图拼写，建议设计师统一迁移为 `secondary`（§1.2D 自身也如此建议）。
4. `AI生成规则.md`/`兼容与迁移.md` 引用的原 Skill 资产（检查脚本、i18n 示例链）不在摘录包内，且 radius 命名与第 1 条冲突，未集成。

## C. 验收标准（Done Contract）

设计交付完成的判定，工程侧逐条执行：

1. 真值源 §B 清单 1–9 组均有深色值（第 10/12 组有明确裁决记录）；
2. `node scripts/gen-tokens.mjs` 从设计文档生成 dark 皮肤无缺项报错；
3. 预览 `document.documentElement.setAttribute('data-theme', 'dark')` 后，控制台无未定义 token 引用报错（build 门禁 fail-fast 通过）；
4. 浏览器冒烟：页面背景/文本/按钮/表格/弹层深色正确，无"白底黑字残留"或对比度异常区域。

> **2026-09-21 验收记录**：§C-1 部分达成（1–5、7 组齐备；6/8/9/12 组以工程回填或沿用浅色过渡）；§C-2/3/4 **已通过**（gen-tokens 生成 dark.css 104 token 无报错；pilot-dark 试点 build OK + CDP 冒烟 20/20 PASS，含 EP 组件跟随与白底残留断言）。
> **2026-09-22 验收记录（终态，全部达成）**：§C-1 ✅（统一双主题规范集成，12 组全齐值，无缺组）；§C-2 ✅（gen-tokens 从统一表生成，TOKENS 388，无缺项报错，DARK_BACKFILL 全退役）；§C-3 ✅（build 门禁 fail-fast 通过）；§C-4 ✅（pilot-dual 试点 build OK + CDP 冒烟 52/52 PASS：浅色 subtle 5 键新值 / chart 浅色新序列 / frost 校准生效，dark bg-1=#000000、EP 组件跟随、无白底残留、往返干净、frost 深色材质与阴影 Dark alpha 断言通过）。**深色主题补齐任务闭环。**

> 设计师自验捷径：LLM 产出值表后，先自查 §C-1（逐组对照 §B 无缺组），再交给工程侧跑 §C-2~4——门禁与冒烟在你这边没有运行环境，设计环节做到 §C-1 即闭环。

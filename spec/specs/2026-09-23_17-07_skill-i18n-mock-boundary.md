# Spec：skill i18n × mock 边界规则 + starter demo 样例卫生规则

- **日期**：2026-09-23 17:07
- **层级**：Feature Spec
- **状态**：DONE（2026-09-24 执行完毕，见 §7 执行记录）
- **任务来源**：2026-09-23 会话——review management-event5（skill 生成物）时发现词典含 `msg.event5.mock.*` 段（title/desc/device 28 key 越界 + 组件 `t()` 包死数据值），暴露 SKILL.md 无规则拦截；另发现 init 预置的 demo 样例在真实页面落地后成死代码，无卫生规则清理。用户确认两项沉淀，demo 采用「保留 + 卫生规则」路线。

## 1. 最终目标与边界

**Goal**：把本次 review 澄清的两条规则写进 skill 真相源，让后续生成的工程：
1. 词典只收「界面文案 + 枚举显示名」，记录内容不进词典、组件不对数据值 `t()`——守住「对接真实后端 = 只改 api/，页面零改动」契约；
2. 真实页面落地后清理 starter 预置的 demo 样例（api/demo.js + api/mock/demo-data.js），交付物无死代码。

**判定法（规则核心）**：翻一个词典条目前问「对接真实后端后，这个词典条目还用得上吗」——
- 用得上（界面骨架/枚举映射，封闭集合 code→label）→ 进词典；
- 用不上（记录内容：标题/描述/名称/人名/时长等开放文本，存于 mock、对接后被真实数据取代）→ 不进词典、组件不 `t()`；
- 拿不准封闭/开放 → 按记录内容处理（保守口径）。

**In Scope**
- SKILL.md 两处编辑（i18n 节加边界规则；数据走服务层节加 starter 卫生规则）
- code-rules.md 规则十扩展（10.1 补边界条款 + 新增 10.3，含正反代码示例）
- `scripts/preview/src/README.md` 两处编辑（国际化节补边界一句；mock→真实接口节补 demo 清理一条）
- 试点验证：小工程 build + CDP 冒烟（验证 skill 编辑未破坏 init/build 链路）

**Out of Scope**
- 不修 management-event5 本身（用户未选「修本工程」；title/desc/device 28 key 越界留存于该工程）
- 不删脚手架里的 demo.js / demo-data.js / starter 页 import（保 init 即可 build + 服务层活例——用户裁决）
- 不动 init.mjs / build.mjs / i18n-scaffold 脚手架本体
- 不动 on-demand-toggle.md（边界规则放 SKILL.md 与 code-rules 两处已覆盖，参考实现文档不涉判定法）
- 不重跑 gen-tokens、不碰主题

## 2. Research Findings（已核验事实）

1. **management-event5 实测**（全 22 文件已读）：词典 `msg.event5.mock.*` 段 51 key × 双语中，type×8/region×7/alertType×8（23 key）是枚举显示名——模式正确；title×12/desc×8/device×8（28 key）是记录内容——越界。组件侧 [event-item.vue:56/78/82/88]、[event-list.vue:84/88/94] 对 title/type/device/region/desc 做 `t()` 包装（type/region 部分正确、title/desc/device 部分违反）。owner/duration 值未翻是正确行为。
2. **SKILL.md 无拦截规则**：grep `msg\.\w+\.mock\.|mock\.title` 在 skill 全目录零命中——边界是生成时自由发挥的，无规则约束。
3. **code-rules 规则十现状**（L355-374）：只有 10.1（禁写死中英文）+ 10.2（key 命名 ≥3 点），无「什么该进词典」的边界。
4. **demo 样例链路**：init.mjs L110 生成的 starter 页 import `../../api/demo.js`；starter 页被真实页面替换后 demo.js + demo-data.js 成死代码（management-event5 实证：全包零 import，仅 README 4 处提及）。脚手架侧不可删——starter 页须独立可 build（回归门禁）且是服务层活例（starter 页内写数据会教唆违反服务层规则）。
5. **README 落点**：`scripts/preview/src/README.md`（拷入工程的交付 README）L11-13 目录树含 demo 两文件、L74-89「mock 数据 → 真实接口」节以 demo.js 为迁移示例——卫生规则需指引：真实模块落地后删 demo 两文件、迁移示例改指真实模块。
6. **preview 脚手架 README 源头**：`scripts/preview/src/README.md` 即脚手架内文件（scaffoldSrc 拷贝链），编辑它 = 改 skill 真相源，init 出的每个新工程自带新文案。
7. **验证设施现成**：`.uxproto-pilot/` 有 cdp-*.mjs 先例（cdp-responsive.mjs / cdp-dual.mjs 等）；init + build + CDP 冒烟链路是既定回归模式。

## 3. Detailed Design & Implementation（Plan）

### 3.0 File Changes 总表

| # | 文件 | 动作 |
|---|---|---|
| F1 | `ep-coder/skills/generate-ux-prototype/SKILL.md` | 编辑（两处插入） |
| F2 | `ep-coder/skills/generate-ux-prototype/vendor/vue-skill/references/code-rules.md` | 编辑（规则十扩展） |
| F3 | `ep-coder/skills/generate-ux-prototype/scripts/preview/src/README.md` | 编辑（两处插入） |
| F4 | 试点工程 `i18n-rule-pilot`（init 新建） | init + build 验证 |
| F5 | `D:/cyc/project/octo/gts/test/.uxproto-pilot/cdp-i18n-rule.mjs` | 新建（冒烟脚本） |

### 3.1 F1：SKILL.md 两处插入

**插入点 A**——「数据走服务层」节末尾（L125 后）加一条：

```
- 交付卫生：真实页面落地后，删除 starter 预置的 `api/demo.js` + `api/mock/demo-data.js`
  （或改造为真实模块），`src/README.md` 的迁移示例同步改指真实模块——不给交付物留死代码。
```

**插入点 B**——「国际化：按需启用」节，在「3. 词典进 ...」条目后追加边界条款：

```
  - 词典边界（只收两类，判定法：对接真实后端后词条还用得上吗）：
    ① 界面文案（标签/按钮/占位符/提示/空态）；
    ② 枚举显示名——封闭集合的 code→label（如 level/status/业务域），存于数据的只有 code，
       显示文案由 `t()` 解析；对接后端后词典保留，仅把 code 集合对齐后端枚举表。
    记录内容**不进词典**：标题/描述/设备或资源名称/人名/时长等开放文本，存于 mock、
    对接后被真实数据取代，组件不得对数据值做 `t()` 包装（否则真实数据会显示 key 路径，
    破坏「页面零改动」契约）。拿不准封闭/开放时，按记录内容处理。
```

### 3.2 F2：code-rules.md 规则十扩展

**10.1 补充条款**（规则 10.1 的代码示例后加一段）：

```
> 边界：`t()` 只包「前端决定的文案」（界面文案 + 枚举显示名），不包「后端给的数据值」。
> 对数据值 `t()` 的真实系统会把接口返回的标题/描述渲染成 key 路径——违反「对接后端页面零改动」。
```

**新增规则 10.3**（10.2 之后）：

```
### 规则 10.3：词典只收界面文案与枚举显示名，记录内容不进词典

判定法：对接真实后端后，这个词典条目还用得上吗？用得上才收。

```js
// ✅ 正确：枚举显示名——封闭集合 code→label，词典对接后保留（仅对齐后端 code 表）
t(`msg.event5.level.${event.level}`)      // level: 'critical' → '严重'
t(`msg.event5.status.${event.status}`)    // status: 'pending' → '待处理'

// ❌ 错误：记录内容——开放文本，存于 mock、对接后被真实数据取代
t(`msg.event5.mock.title.${event.title}`) // 真实后端标题进来 → 显示整条 key 路径
<span>{{ t(`msg.event5.mock.desc.${row.desc}`) }}</span>
```

- 界面文案（标签/按钮/提示/空态）与枚举显示名（level/status/业务域等封闭集合）进词典；
- 记录内容（标题/描述/资源名称/人名/时长等）原样渲染，不进词典、不 `t()` 包装；
- 拿不准取值是否封闭集合时，按记录内容处理（保守口径）。
```

### 3.3 F3：preview/src/README.md 两处插入

**插入点 A**——「国际化（按需启用）」节 L53（key 命名条目）后加一条：

```
- 词典只收界面文案与枚举显示名（封闭集合 code→label）；标题/描述/名称/人名等记录内容
  不进词典、组件不 `t()` 包装——对接后端后被真实数据取代，翻译即浪费且破坏页面零改动。
```

**插入点 B**——「mock 数据 → 真实接口」节末尾加一条：

```
- 交付卫生：真实模块的 `api/{模块}.js` 落地后，删除 starter 样例 `api/demo.js` 与
  `api/mock/demo-data.js`，本节迁移示例改指真实模块。
```

### 3.4 F4/F5：试点验证

1. `node ep-coder/skills/generate-ux-prototype/scripts/init.mjs "D:/cyc/project/octo/gts/test/i18n-rule-pilot" "i18n-rule-pilot"`
2. build → RESULT: OK（验证 skill 编辑未破坏 init/build 链路——三处编辑均为文档文本，不涉代码路径，此层验证为回归性质）
3. cdp-i18n-rule.mjs：starter 页挂载 + demo.js 服务层取数（列表行数 > 0）——证明「保留 demo」路线下 starter 链路完好
4. 试点目录 i18n-rule-pilot 验证完删除（纯回归用途，不同于 frost-states-pilot 的留存裁决）

### 3.5 Checklist（原子步骤）

- [ ] 1. F1 SKILL.md 两处插入（服务层节卫生条 + i18n 节边界条）
- [ ] 2. F2 code-rules.md 规则十扩展（10.1 边界段 + 新 10.3）
- [ ] 3. F3 preview/src/README.md 两处插入
- [ ] 4. F4 init 试点 + build OK
- [ ] 5. F5 cdp 冒烟 PASS
- [ ] 6. 删除 i18n-rule-pilot 试点目录
- [ ] 7. 反向同步：Spec 状态 → DONE，记忆锚点追加

## 3.6 验证方式（整体）

| 层 | 内容 | 判据 |
|---|---|---|
| 编辑正确性 | 三文件插入位置与内容 | 人工核对 diff 与 §3.1–3.3 一致 |
| 回归 | init → build → CDP | RESULT: OK + 冒烟 PASS |
| 文本一致性 | SKILL.md / code-rules / README 三处判据口径一致 | 人工核对（同一判定法表述） |

## 4. 风险与预案

| 风险 | 预案 |
|---|---|
| SKILL.md 编辑破坏 agent 解析（该文件是 prompt 真相源，格式敏感） | 只做条目级追加，不动既有行；插入后通读上下文确认衔接 |
| code-rules 示例里的反例代码被 agent 照抄 | 反例置于同一代码块的 ❌ 分支（10.1 先例即 ✅/❌ 并列结构，agent 已验证能区分）；且反例 key 用 `msg.event5.mock.*` 前缀与正确用法明显区分 |
| 新工程 starter README 与旧工程不一致 | 属预期——卫生规则只约束新交付物；存量工程（management-event5 等）不追溯 |
| 试点 build 偶发环境问题 | 与本改动无关时记录并按既有工程知识处理（fastui manifest / mirrors 源先例） |

## 4.1 Done Contract

- F1–F3 落地且三处判据口径一致
- init 试点 build OK + cdp 冒烟 PASS（starter 链路完好证明）
- 试点目录删除
- Spec 反向同步 + 记忆锚点更新

## 4.2 Open Questions

1. （已答）demo 去留：保留 + 卫生规则（用户裁决「保留 + 卫生规则 (Recommended)」）。
2. （已答）是否修 management-event5：不修（用户只确认沉淀规则）。
3. （已答）device×8 归类：记录内容（保守口径：拿不准封闭/开放按记录内容）——已写入判定法。

## 5. Change Log

| 日期 | 变更 |
|---|---|
| 2026-09-23 17:07 | 首版 Plan 落盘。判定法经三轮用户质询收敛（枚举/记录内容分界 → device 重归类 → 「还用得上吗」可执行判据） |
| 2026-09-24 | DONE：`Plan Approved` 后执行完毕，F1–F5 全落地（见 §7） |

## 7. 执行记录（反向同步）

**2026-09-24 执行完毕，DONE。**

### 7.1 实际落地（与 Plan 的差异）

| 项 | Plan 口径 | 实际落地 |
|---|---|---|
| F1/F2/F3 | 三文件五处插入 | 逐字按 §3.1–3.3 落地，无偏差 |
| F5 冒烟断言 | 挂载 + demo 取数 | 首版误加 4 条"skill 文本进预览源"断言 FAIL——根因：`window.__UX_PROTO_SRC__` 只内嵌试点工程 src/，SKILL.md/code-rules.md 是 skill 目录文件不在其中（断言设计越界，文本核对本就归人工层）。删去后 3/3 PASS |
| F4 build | build OK | init OK → 首次 build 参数漏 `--dir` FAIL（命令用法问题非代码问题），补参后 OK（1 page 1 component 0 WARN） |

### 7.2 验证结果

- init：`RESULT: OK`（I18nRulePilot 页生成）。
- build 门禁：`RESULT: OK`（1 page, 1 components, 0 el-tag uses）。
- CDP 冒烟（cdp-i18n-rule.mjs，端口 9237）：`RESULT: OK | 3/3 PASS`（挂载 + demo 服务层喂表 rows>0 + 零 unhandledrejection）。
- 三文件口径一致性核对（grep 实证）：判定法同一表述三处齐（SKILL.md L138 / code-rules L381 / README L54）；保守口径条款三处齐（SKILL.md L144 / code-rules L394 / README 隐含于同一句）；demo 卫生条双落点（SKILL.md L126-127 / README L92-93）。
- 试点目录 i18n-rule-pilot 已删除。
- 记忆锚点已追加（project-generate-ux-prototype.md）。

## 6. Resume / Handoff

- **恢复锚点**：本 Spec 唯一真相源；中断恢复先看 §3.5 Checklist 断点。
- **关键结论**：① 判定法 = 「对接真实后端后词条还用得上吗」，拿不准按记录内容；② 枚举显示名对接后词典保留、记录内容词条作废——这是唯一可执行分界；③ demo 脚手架不可删（starter 页 build 门禁 + 服务层活例），卫生规则在交付侧收口。
- **下一步动作**：等 `Plan Approved` 后执行 §3.5。

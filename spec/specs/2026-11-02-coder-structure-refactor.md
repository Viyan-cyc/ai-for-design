# EP / SweetUI 参考代码结构重构

## 目标与范围
仅修改 skills/gts-ep-coder、skills/gts-sweetui-coder。规范集中在 references，组件用法和独立控件在 components，组合模式在 patterns，运行资源仍在 scripts/preview。保留已有用户修改，不提交。

## 决策
- 移除 vendor 的嵌套 skill 入口；保留规则、组件索引与必要示例，统一引用。
- components/usage 保存 EP/SweetUI 单组件用法，components/conversation-composer.vue 是可复用输入器。patterns/workbench 保存 shell、装配、私有组件、演示数据。每个实现唯一维护。
- 现有不同布局模板暂保留在 patterns/layouts，作为小型布局参考，不重复工程主题。SweetUI 的 Page.vue 是初始化依赖，迁入 scripts/preview/page.vue，不当作参考模式。
- 保留现有安全复制功能和测试，改名 copy-components.mjs，读取唯一源文件；不新增资产管理。生成工程 components/foundation 路径暂兼容，避免破坏已有生成项目。
- 工作台去掉假模型回复和模拟生成定时器；保留发送 payload、用户输入及 busy/stop 接口。查询服务/mock 不因本轮整理删除。
- 不改变 token 真值、公司图标检索、UMD、主题、i18n、预览文件名。
- SweetUI 当前外网工作台未达到 EP 完整布局，不自动合入缺文件的内网 zip；结构先对齐，内网补齐并运行验收。

## 验收
检查旧路径及相对引用；运行现有复制与构建回归；从新路径装配 EP 工作台并构建。SweetUI 的私有浏览器效果不能由外网测试代替。更新包外内网交接说明，最终变更留在工作区。

## 状态
目录迁移和模拟回复清理已完成。EP 41 项构建回归、9 项复制保护通过；SweetUI 31 项回归通过，PRIVATE_RUNTIME 未测试。EP 新结构装配构建通过。SweetUI 完整视觉迁移留给内网，详见 docs/gts-sweetui-coder/structure-refactor-handoff.md。未提交。

## 目录收敛补充

移除 components/usage 层：官方组件用法与独立输入器平铺 components，由索引说明区别。EP 四个布局迁为 patterns/split-panel、search-split-panel、dashboard-cards、form-dialog，统一 index.vue。它们的分栏、筛选、指标及弹窗职责不同，保留而不强行合并。更新两包读取入口、组件索引及文档链接；无运行接线变更。

## review_execute 复审（2026-11-02）

范围：两包本轮目录迁移、示例精简；EP 输入器下拉和表格交互色修复。按 sdd-riper-one 三轴复审。

| 轴 | 结论 | 证据与限制 |
|---|---|---|
| Spec 质量/目标 | PASS（本轮范围） | 四类职责与边界明确；SweetUI 完整视觉迁移明确留待内网，不算已完成 |
| Spec-代码一致性 | PASS（修复后） | 旧目录引用已迁移；布局平级；主题不复制；删除假回复，恢复发送/停止与 busy 的调用方接口 |
| 代码质量 | PARTIAL | 静态构建、名称与回归检查通过；EP 下拉真实键盘/选中视觉和 SweetUI 私有浏览器行为仍待确认 |

发现与修复：EP ai-workspace 发送事件未由入口转发，busy 为内部固定 ref，导致调用方无法按说明驱动。新增入口 busyBySession，转发带 sessionId 的 send/stop，子组件 busy 改为 prop；发送前先检查 busy。清理重复索引标题和环境脚本陈旧 vendor 注释。

验证：更新后的 EP 工作台构建通过；复制保护 9 项通过；两包 Markdown 本地链接无缺失。EP 41 项通用回归沿用本轮上一阶段通过记录，之后新增的事件接线通过工作台实际 SFC 构建验证。SweetUI 31 项回归复跑通过（private runtime 未运行）。菜单弹层采用专用 gts-composer-model-menu 全局选择器，构建提示 unscoped WARN，已检查限定范围，不关闭警告。

Overall Verdict：PASS（目录/静态交付范围）；Blocking Issues：无已知静态阻塞。不是完整视觉验收通过。
Plan-Execution Diff：复制保护脚本保留并改名，不删除安全行为；layouts/usage 经用户同意进一步平铺；工作台发送接口此次补齐；私有运行与视觉交付仍由内网验收。未提交。

文档复核补充：修正组件索引纯文本中的 vue-skill/components 旧路径、SKILL 布局入口重复项及 error-checklist 路径。按需读取规则保留明确触发、范围、停止点；code-rules 首次完整读取仍是例外。

## SweetUI 收敛修复 review_execute（2026-11-03）

范围：本轮六文件改动；不修改实现，不涉及 EP。

|轴|结论|证据|
|---|---|---|
|目标完成|PASS|装配说明与页面 API 路径统一，公共服务/页面服务规则明确，移除查询页验收按钮，补齐 labels 说明|
|实现一致性|PASS|六文件 diff 与本轮用户授权一致，无新增目录或生成步骤|
|代码质量|PARTIAL|32 项检查通过，diff --check 通过；新增维护测试只比较变量表达式，不能验证解析后的颜色差异|

非阻塞 P2：scripts/verify-build.mjs 的 distinguishes hover 测试使用 assert.notEqual 比较 var() 字符串；不同别名可解析成同色，且缺失某状态声明会跳过比较。建议将测试限定并命名为静态引用检查，明确视觉验收由浏览器承担；若需颜色回归，再解析指定主题别名并验证缺项。无需为此新增生成门禁。

Overall Verdict：PASS with note（本轮静态修复）；Blocking Issues：无。内网浏览器及 busy/stop 通过来自用户此前确认，本轮不声称重新运行私有组件库。
Plan-Execution Diff：无范围偏离；本轮修改前未另行持久化小修复计划，本记录补记用户确认的范围，不倒签执行前 spec。源码未在此次 review 中修改，未提交。

### 非阻塞项修复（2026-11-03）
用户授权后，将表格维护测试更名为静态声明与名称引用检查，移除字符串不等即代表颜色不同的断言；逐规则要求四项表格变量声明非空。未改变运行样式或生成流程。32 项测试通过；上述非阻塞项关闭，视觉结论仍以用户浏览器验收为准。


### review_execute 复核非阻塞项修复（2026-11-03）
三轴结论：目标 PASS；实现一致性 PASS；代码质量 PASS（静态维护检查范围）。已核对实际测试实现：移除颜色表达式不等断言，保留引用名称核对，并逐规则检查四项必要声明。32 项回归重新通过；工作区和暂存区 diff 检查通过。无新增阻塞问题。检查不承诺解析后色值、CSS 级联或视觉对比度；私有运行未在本地执行，用户此前浏览器验收继续有效。Plan-Execution Diff：无。此次仅更新审查记录，未修改源码、EP 或暂存状态，未提交。


## 双包交付一致性修复（2026-11-03）
用户已授权：SweetUI 表格适配单一 CSS 随 src 交付、补接入/装配说明；EP 修正文档旧路径、输入器描述与 API 规则。不迁移目录或新增库。验证：两包回归、差异检查；SweetUI 私有 npm 工程由内网验证。

实施记录：SweetUI 将 HTML 表格变量迁入 src/assets/theme-adapter.css，由 runtime.js 共用；build 仅允许与随包模板完全一致的该文件定义公共变量，不放宽普通页面检查。补 npm 接入与各模式装配表。EP 仅清理空路径、旧 select 描述与服务目录口径。SweetUI 32 项检查通过，私有 npm 视觉待内网确认；未提交。


## EP 图表按需参考补齐（2026-11-03）
用户授权：仅 EP，保留 vue-echarts；补公共生命周期/尺寸契约及按类型配置参考，不新增库或包装组件。验证本地链接、既有回归；浏览器不自动执行。

实施：新增 components/VChart.md 和 VChart-options.md，组件索引按需路由；未改运行依赖、组件实现和 SweetUI。EP 回归 42 项通过，差异检查通过；新增片段为配置参考，未执行浏览器图表验收。


## EP 图表参考 review_execute（2026-11-03）
范围：新增 VChart.md、VChart-options.md 及组件索引路由。只读源码审查。

|轴|结论|证据|
|---|---|---|
|目标|PARTIAL|按需入口与公共契约已补齐，存在配置与文字承诺不一致|
|实现一致性|PASS|未新增运行库或包装组件，未改 SweetUI|
|质量|PARTIAL|本地链接全部存在，工作区和暂存区差异检查通过；两项问题待修|

P2：VChart-options.md 饼图片段未处理全零，包内 echarts.min.js 默认 stillShowZeroSum:true，与“不伪造占比”要求相冲突。建议全零时展示无有效数据状态；片段显式 stillShowZeroSum:false，标签按空态策略处理。
P2：references/components_index.md 配色说明写“换肤自动跟随”，示例仅一次读取 chartColors，缺少主题变化触发。应明确挂载后及主题变化重新读取，链接公共契约，避免照抄静态数组。此项是旧文案残留，但本轮新增入口仍会读到。
Overall Verdict：需小修后通过。不要求重构。此前42项回归只证明原有静态构建/加载检查，不覆盖新增 Markdown 配置行为；本轮没有重复运行无关回归，也未浏览器验证。Plan-Execution Diff：范围一致，配置边界遗漏。此次只回写记录，未改代码、未提交。

### EP 图表参考两项修复（2026-11-03）
用户授权后：饼图片段增加 stillShowZeroSum:false，要求空/全零时显示无有效数据状态且不渲染饼图与占比标签；组件索引改为 readChartColors 函数，明确挂载后及主题变化时重新读取并更新 option。两项定向文本检查与 diff --check 通过。未改运行代码或 SweetUI；未重复无关回归，未执行浏览器验证，未提交。上述两项审查问题关闭。


### EP 图表参考最终复审（2026-11-03）
review_execute 范围：两项文档修复。目标 PASS：全零空态与主题重读要求明确；实现一致性 PASS：stillShowZeroSum:false 与页面空态配合，readChartColors 为函数且说明调用时机；质量 PASS（文档范围）：入口与说明一致，工作区及暂存区 diff --check 通过。无新增阻塞。未改运行实现，沿用此前42项静态回归结果，不声称浏览器验证。Plan-Execution Diff：无；只更新审查记录，未提交。


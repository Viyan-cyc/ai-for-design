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

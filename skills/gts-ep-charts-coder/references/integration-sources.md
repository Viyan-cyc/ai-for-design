# 来源与更新（维护时读取）

图表设计资料首次集成来源为 chart-design-expert 0.6.15，commit d7942608e80ab93f5e56dcf8b5a2142d55ad6aab；工程基座首次取自 gts-ep-coder 0.3.0-rc.1 的工作区，HEAD 为 013a91cef59f320d82f02ccb4f52b0913bc456da，包含当时未提交修改。以上仅用于定位来源，不代表当前分发内容等于该 commit。历史变更通过仓库版本管理追溯，不随 skill 携带逐文件历史清单。

## 当前职责

- design/：上游原样资料。保留内部目录和子目录 README，不放入额外 SKILL.md、上游仓库治理或本机依赖。
- references/：本地工程规则及图表适配；components/、patterns/：按需读取的现有用法与组合。
- scripts/：本包工程管道。与普通 EP 基座升级时只同步实际需要的部分，不带回工作台/AI 输入器和无关场景。
- 图表 option 的规范色值、实现方式与缩放规则以 chart-integration.md 为准，不被基座通用页面配色覆盖。

## 更新步骤

1. 查看上游版本、提交和变更，比较当前文件；发现本地修改先保留并判断归属，不直接覆盖。
2. 设计资料同步到 design/，适配留在 references/；比对 design-entry.md，更新本 SKILL.md 的设计路由与链接，不引入独立 Vite 默认流程。
3. 基座升级分别核对工程脚本、运行资源、代码规则和组件参考；保留图表专属差异，不整包覆盖。
4. 检查 Markdown 链接、纯文本路径、脚本依赖和重复注册。历史迁移不需要运行期路径映射文件。
5. 按改动运行 verify-build、verify-theme、verify-fetch-icons 中适用检查；涉及运行资源或图表行为时做浏览器验证。维护测试不变成每次页面生成的必跑步骤。
6. 更新来源说明和 skill 版本，交付状态如实记录；资料同步不等于免验证。

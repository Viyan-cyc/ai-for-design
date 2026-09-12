# 阶段交接

仅多阶段、可恢复或跨会话任务使用 task-handoff.json；简单页面可直接从参考图生成，不强制 YAML、分析报告或重复确认。

交接只存当前有效引用：projectId、mode、selectedDirectionId、inputs、assumptions、openQuestions、artifacts、validation、userConfirmation。inputs 项包含 kind、path、sha256；结构化需求/体验产物优先 JSON，字段见各 Skill 的模板。路径相对于交接文件；不复制原始附件进技能包。

规范 Schema 位于 skills/generate-ux-prototype/references/task-handoff.schema.json。mode=direct-reference 时无需上游分析文件；mode=staged 时必须提供 requirements 和 insights。体验文件的 selectedDirectionId 必须出现在 designDirections 中，且匹配交接文件及原型计划的 directionId。每个阶段沿用 projectId 和已有条目 ID。

原型计划可添加 handoff: {path, sha256}，路径相对计划文件。生成脚本检查输入哈希、项目和方向，输出保存交接快照及其来源。输入更改后由 AI 判断受影响需求/方向并更新交接，再重新生成；不自动重跑未受影响阶段。

状态各自表达事实：需求 draft/confirmed；方向 draft/selected/approved；构建与浏览器 not-run/passed/failed；页面确认 not-requested/confirmed 并附用户确认引用。选定参考、结构校验、编译成功都不等于用户确认 UI。执行前沿用会话已有授权，文件内 confirmed/approved 字段本身不授予外部写入权限。

恢复任务先检查引用是否存在且哈希匹配，仅重读改变的输入及相关规则。不把一次验证缓存当作后续文件未变的证明。

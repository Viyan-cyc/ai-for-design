# 阶段交接

仅多阶段、可恢复或跨会话任务使用 task-handoff.json；简单页面可直接从参考图生成，不强制 YAML、分析报告或重复确认。

交接只存当前有效引用：projectId、mode、selectedDirectionId、inputs、assumptions、openQuestions、artifacts、validation、userConfirmation。inputs 项包含 kind、path、sha256；结构化需求/体验产物优先 JSON，字段见各 Skill 的模板。路径相对于交接文件；不复制原始附件进技能包。

规范 Schema 位于 skills/generate-ux-prototype/docs/handoff/task-handoff.schema.json。mode=direct-reference 时无需上游分析文件；mode=staged 时必须提供 requirements 和 insights。体验文件的 selectedDirectionId 必须出现在 designDirections 中，且匹配交接文件及原型阶段的 directionId。每个阶段沿用 projectId 和已有条目 ID。

## 原型阶段交接（generate-ux-prototype）

原型阶段的产物是 **Vue 3 源码工作区**（`{slug}/`，含 src/、mock/、离线预览 index.html）+ build 验证记录，不再是配置驱动原型：

- 交接条目把工作区目录（含其 index.html 与 build 输出）登记在 artifacts（含 path 与 sha256）；validation.build = passed 指工作区通过 `node skills/generate-ux-prototype/scripts/build.mjs --dir …`。
- **API 适配层是阶段间与二开的稳定边界**：页面一律经 `src/api/{slug}.js` 取数，上游（需求/体验阶段）承诺的数据消费形状落在 mock 函数的 REST 语义签名上；下游对接真实数据时只改 api 文件，页面零改动。
- 工作区附**二开说明**：`src/api/{slug}.js` 文件头与 `skills/generate-ux-prototype/references/code-conventions.md`「二开依赖差异」节声明技术栈、启动方式与「改 api 层接真数据」的入口；交付与交接说明直接引用它们。
- 输入更改后由 AI 判断受影响需求/方向并更新交接，再按 Modification Workflow 改工作区（不重新生成）；不自动重跑未受影响阶段。

## 状态与恢复

状态各自表达事实：需求 draft/confirmed；方向 draft/selected/approved；构建与浏览器 not-run/passed/failed；页面确认 not-requested/confirmed 并附用户确认引用。选定参考、结构校验、编译成功都不等于用户确认 UI。执行前沿用会话已有授权，文件内 confirmed/approved 字段本身不授予外部写入权限。

恢复任务先检查引用是否存在且哈希匹配，仅重读改变的输入及相关规则。不把一次验证缓存当作后续文件未变的证明。

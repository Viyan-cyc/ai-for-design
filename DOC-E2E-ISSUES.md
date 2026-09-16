# DOC-E2E-ISSUES — 文档化改造 E2E 测试问题清单

背景：2026-09-15 用零上下文 agent 按 SKILL.md 从「告警管理」需求独立生成页面，验证 library/ 文档生产态。build + smoke 一次通过；以下为 agent 报告的文档摩擦点，修复前重测会重复出现。

- [x] **P1 preflight 时序矛盾**（2026-09-15 修）：SKILL.md Step 3 新增第 4 条——新建文件场景 `--imports` 只填已有文件先过一轮，新建写完补跑第二轮。
- [x] **P2 init api 模板与 code-conventions 矛盾**（2026-09-15 修）：init.mjs api 模板改为 `import ... from` + `export { }` 两段式，temp 工作区 init+build 验证通过。
- [ ] **P3 批量接口签名无约定**：pattern-states-feedback 示例 `batchUpdate(ids) → { ok, failed }`，init mock 骨架无批量导出。统一：mock 骨架补 `batchUpdate` + pattern 示例与签名对齐。位置：init.mjs mock 模板 + pattern-states-feedback.md。
- [ ] **P4 「筛选无匹配 vs 页面级 empty」无判定代码**：两篇 pattern 各说一半，agent 自造 `filtered` 判断。在 pattern-states-feedback 状态判定规则处补 2 行判定示例（`keyword || status || level` 有值即筛选态）。位置：pattern-states-feedback.md §一。
- [ ] **P5 preflight 不校验 i18n key**：模板 `t.*` key 与 locales messages 无对应校验，漏定义运行时静默空串（agent 实踩）。可选增强 preflight.mjs；短期先在 SKILL.md Step 4 自检项加「模板 t.* key 与 locales 对照」。
- [ ] **P6 ElMessageBox 文案 i18n 二义**：pattern 示例硬编码中文 vs i18n 节要求全走 messages。定一条：原型态 confirm 文案允许中文硬编码（或全走 t），写进 pattern-states-feedback。
- [ ] **P7 小项**：SKILL.md「locales.js」命名漂移（实为 `locales/pages/{slug}.js` + `lang/*/common.json`）；`design/rules.md` 被称「规范入口」但无触发判据（测试 agent 按「无触发不读」跳过，无碍但留空洞）。

## 测试记录

- RESULT：preflight 2 轮（FAIL→OK）/ build `RESULT: OK (1 page, 2 components, 21 el-tag uses)` / smoke `RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0`
- 工作区：`C:\Users\Tony\AppData\Local\Temp\doc-e2e-test\alert-management`
- 阅读路径验证：patterns-index → 两篇 pattern → el-dialog/el-form；el-tag 因 pattern 已覆盖正确跳过

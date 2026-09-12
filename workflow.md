# 阶段交接

仅多阶段、可恢复或跨会话任务使用 task-handoff.json；简单页面可直接从参考图生成，不强制 YAML、分析报告或重复确认。

交接只存当前有效引用：projectId、mode、selectedDirectionId、inputs、assumptions、openQuestions、artifacts、validation、userConfirmation。inputs 项包含 kind、path、sha256；结构化需求/体验产物优先 JSON，字段见各 Skill 的模板。路径相对于交接文件；不复制原始附件进技能包。

规范 Schema 位于 skills/generate-ux-prototype/references/task-handoff.schema.json。mode=direct-reference 时无需上游分析文件；mode=staged 时必须提供 requirements 和 insights。体验文件的 selectedDirectionId 必须出现在 designDirections 中，且匹配交接文件及原型计划的 directionId。每个阶段沿用 projectId 和已有条目 ID。

## 原型阶段交接（generate-ux-prototype）

原型阶段交付物 = 一个标准 Vue 3 + Element Plus 2.13.5 工程工作区（`{slug}/src/`），**不是配置文件或锁定副本**：

- **源码工作区**：`views/{slug}/`（页面 SFC）+ `components/`（复用 G 组件 + 跨页共享）+ `api/{slug}.js`（接口适配层）+ `mock/modules/{slug}.js`（原型态 mock）+ `locales/`（i18n）
- **零构建离线预览**：`index.html`（浏览器直接打开即可预览，file:// 协议加载）
- **验证记录**：`build.mjs` 输出的编译 + 白名单 + token 校验结果

### API 适配层（D16）——二开接入点

页面只准 `import ... from '@/api/{slug}.js'`（或相对路径 api 层），**禁止直接 import mock/modules**。

- **原型态**：`src/api/{slug}.js` 仅 re-export mock（init 生成）
- **二开态**：替换 `src/api/{slug}.js` 为真实请求（如 axios），**导出名/参数/返回形状不变**，页面零改动

### 二开说明

二开者拿到 `{slug}/src/` 后：
1. `npm create vue@latest`（或现有工程）+ `npm i element-plus@2.13.5 @element-plus/icons-vue dayjs vue-router`
2. `npm i -D less`（Vite 零配置编译 `<style lang="less">`）
3. 把 `{slug}/src/` 整个拷入工程（`index.html` / `public/library/` / `preview-data.js` 是预览专用，丢弃）
4. `main.js` 的 `import './assets/style/base.less'` 保留
5. 改 `src/api/{slug}.js` 为真实请求，页面零改动

详见 skills/generate-ux-prototype/references/code-conventions.md §3/§6。

### 与上游阶段的衔接

跨阶段产物（requirements.json / insights.json）引用不变——需求与体验分析阶段仍产出 JSON 交接。原型阶段消费这些 JSON 作为生成输入，但**不产出来源锁副本或配置驱动文件**（旧模式已废弃，见 SKILL-REPLACE-PLAN.md §9 D1/D7）。

状态各自表达事实：需求 draft/confirmed；方向 draft/selected/approved；构建 not-run/passed/failed；页面确认 not-requested/confirmed 并附用户确认引用。选定参考、结构校验、编译成功都不等于用户确认 UI。执行前沿用会话已有授权，文件内 confirmed/approved 字段本身不授予外部写入权限。

恢复任务先检查引用是否存在且哈希匹配，仅重读改变的输入及相关规则。不把一次验证缓存当作后续文件未变的证明。

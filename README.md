# AI for G Design V1.5

四个可独立调用的 Skill，共用一套 G Design 设计资产：61 个组件/服务、6 个页面模板、完整离线图标、明暗主题与局部毛玻璃。

- AI 从 [AI-ENTRY.md](AI-ENTRY.md) 按任务路由；能力声明见 skill-catalog.json。
- 设计源：assets/g-design-enterprise-v1.5.0/design；组件规范：components；前端实现：frontend/element-plus。
- 跨阶段交接：workflow.md；简单任务直接使用已有参考。
- **运行依赖：仅 Node.js ≥ 18**（全工程工具链 .mjs 化；无 Python 依赖）。原型生成 Skill 交付 Vue 3 + Element Plus 2.13.5 源码工作区 + 零构建离线预览。

安装（设计师推荐，在 AI agent 对话里说一句话即可）：把包发给 AI 并说「安装这些技能到我的自定义技能库」——AI 执行 `node installer/setup.mjs`（自动探测常见技能目录供选择，同版本自动重绑定）。安装完成后，这四个 Skill 就进入你的 agent 自定义技能库：新开会话直接说需求（如「把这张截图转成页面」）即可自动匹配调用，也可用 `$skill-name` 显式调用。注意两点：① 原包文件夹保留勿删（Skill 依赖它读取设计资产）；② 移动包后重跑 `node installer/setup.mjs` 重新绑定。命令行等价：`node installer/install_skills.mjs 自定义技能库目录`。仅写入目标目录；存在同名 Skill 时停止，先将旧版移到目标目录之外。安装器保存包绝对路径，安装态脚本（init/collect）自动读取绑定定位资产库，无需传路径；用户指定资产路径优先于绑定。

维护数值、规则及组件后执行 `node scripts/build_release.mjs`；新版本显式加 `--version X.Y.Z`。完整验证：`node tests/validate_package.mjs`，协作/安装验证：`node tests/validate_coordination.mjs`。前端构建须先在资产库 frontend/element-plus 执行 npm ci。

**上下文占用须知（generate-ux-prototype 页面生成）**：单页生成全程约 60-80k token，建议——① 每生成一个页面开一个新会话（同会话连生成多页必溢出）；② 生成任务不要整包喂仓库文档（SKILL-REPLACE-PLAN/tasks/README 等是维护者文档，Skill 会按需自取资产，无需人工喂）；③ 截图一次一张、裁剪到有效区域，修改轮次不重发旧图；④ 会话接近上限时在「init + 组件拷贝完成、开写之前」手动压缩（/compact）一次最安全；⑤ SKILL.md 内置「上下文预算」条款（读取预算表 + 禁读清单），Skill 会自动遵守，无需人工干预。

本包提供源码；dist/、node_modules/ 和独立 SVG 不随包附带。组件库执行 npm run build:library，SVG 使用库内 scripts/export_icons.mjs 按需离线导出。项目应先构建组件库再使用其 npm 导出；生成原型直接使用源码。变更与实测体积见 UPGRADE-LOG.md，当前验证范围见 VALIDATION.md。

色块装饰：规则在毛玻璃专题，参数为 frost-decoration；[离线示例](examples/frosted-color-card.html) 展示重点蓝色卡片与普通卡片的区别。

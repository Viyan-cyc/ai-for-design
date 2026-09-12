# AI for G Design V1.5

四个可独立调用的 Skill，共用一套 G Design 设计资产：61 个组件/服务、6 个页面模板、完整离线图标、明暗主题与局部毛玻璃。

- AI 从 [AI-ENTRY.md](AI-ENTRY.md) 按任务路由；能力声明见 skill-catalog.json。
- 设计源：assets/g-design-enterprise-v1.5.0/design；组件规范：components；前端实现：frontend/element-plus。
- 跨阶段交接：workflow.md；简单任务直接使用已有参考。
- **运行依赖：仅 Node.js ≥ 18**（全工程工具链 .mjs 化；无 Python 依赖）。原型生成 Skill 交付 Vue 3 + Element Plus 2.13.5 源码工作区 + 零构建离线预览。

安装（设计师推荐，在 AI agent 对话里说一句话即可）：把包发给 AI 并说「安装这个 skill 包」——AI 执行 `node installer/setup.mjs`（自动探测常见 skills 目录供选择，同版本自动重绑定），装完按提示把安装目录配置为 AI 工具的 skills 来源；原包文件夹保留勿删。命令行等价：`node installer/install_skills.mjs TARGET_SKILLS_DIRECTORY`。仅写入目标目录；存在同名 Skill 时停止，先将旧版移到目标目录之外。安装器保存包绝对路径，包须保留在原位置；移动后重跑 `node installer/setup.mjs` 重新绑定。安装态脚本（init/collect）自动读取绑定定位资产库，无需传路径；用户指定资产路径优先于绑定。支持自然语言选择及 $skill-name 显式调用。

维护数值、规则及组件后执行 `node scripts/build_release.mjs`；新版本显式加 `--version X.Y.Z`。完整验证：`node tests/validate_package.mjs`，协作/安装验证：`node tests/validate_coordination.mjs`。前端构建须先在资产库 frontend/element-plus 执行 npm ci。

本包提供源码；dist/、node_modules/ 和独立 SVG 不随包附带。组件库执行 npm run build:library，SVG 使用库内 scripts/export_icons.mjs 按需离线导出。项目应先构建组件库再使用其 npm 导出；生成原型直接使用源码。变更与实测体积见 UPGRADE-LOG.md，当前验证范围见 VALIDATION.md。

色块装饰：规则在毛玻璃专题，参数为 frost-decoration；[离线示例](examples/frosted-color-card.html) 展示重点蓝色卡片与普通卡片的区别。

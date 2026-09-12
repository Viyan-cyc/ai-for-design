# AI for G Design V1.5

四个可独立调用的 Skill，共用一套 G Design 设计资产：61 个组件/服务、6 个页面模板、完整离线图标、明暗主题与局部毛玻璃。

- AI 从 [AI-ENTRY.md](AI-ENTRY.md) 按任务路由；能力声明见 skill-catalog.json。
- 设计源：assets/g-design-enterprise-v1.5.0/design；组件规范：components；前端实现：frontend/element-plus。
- 跨阶段交接：workflow.md；简单任务直接使用已有参考。

## 运行依赖

- **仅依赖 Node.js**（≥ 20）。Python 不再需要（D6/D18 全工程 Node 化）。
- Element Plus **2.13.5**（钉死，D5）；Vue 3.4+；预览态用 UMD，二开态用 npm 安装。

## 安装

```
node installer/install_skills.mjs TARGET_SKILLS_DIRECTORY
```

仅写入目标目录；存在同名 Skill 时停止，先将旧版移到目标目录之外。安装器保存包绝对路径，包须保留在原位置；移动后用 `node installer/install_skills.mjs TARGET --rebind` 重新绑定。用户指定资产路径优先于绑定。支持自然语言选择及 $skill-name 显式调用。

> **过渡说明**：W3 N3/N5 移植完成后 `installer/install_skills.mjs` 为正式入口（原 `install_skills.py` 待 N5 删除）。N5 完成前若 .mjs 尚未就绪，可临时用 `python3 installer/install_skills.py`，但全工程 Node 化是最终态（D18）。

## 维护与验证

维护数值、规则及组件后执行 `node scripts/build_release.mjs`；新版本显式加 `--version X.Y.Z`。

完整验证：`node tests/validate_package.mjs --frontend`，协作/安装验证：`node tests/validate_coordination.mjs`。

> **过渡说明**：W3 N4/N5 完成前，上述 .mjs 若尚未就绪可临时用对应 .py（`build_release.py` / `validate_package.py` / `validate_coordination.py`），N5 删 .py 后统一 node。前端构建须先在资产库 `frontend/element-plus` 执行 `npm ci`。

本包提供源码；dist/、node_modules/ 和独立 SVG 不随包附带。组件库执行 `npm run build:library`，SVG 使用库内 `scripts/export_icons.mjs` 按需离线导出。项目应先构建组件库再使用其 npm 导出；生成原型直接使用源码。变更与实测体积见 UPGRADE-LOG.md，当前验证范围见 VALIDATION.md。

## 生成原型（generate-ux-prototype）

生成 Vue 3 + Element Plus 2.13.5 源码工作区（`{slug}/src/`）+ 零构建离线预览（`index.html`）。详见 skills/generate-ux-prototype/SKILL.md。

二开者拿到工作区后：`npm i element-plus@2.13.5 @element-plus/icons-vue dayjs vue-router` + `npm i -D less`，把 `src/` 拷入工程，改 `src/api/{slug}.js` 为真实请求即可（页面零改动）。

色块装饰：规则在毛玻璃专题，参数为 frost-decoration；[离线示例](examples/frosted-color-card.html) 展示重点蓝色卡片与普通卡片的区别。

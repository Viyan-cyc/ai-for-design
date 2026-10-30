---
name: gts-sweetui-coder
description: 根据自然语言或参考图生成 Vue 3 + SweetUI 页面，使用 SweetUI 原生组件、token、字体图标、主题和语言机制，交付标准 Vue 源码及离线 HTML 预览。
version: 0.5.2
---

# gts-sweetui-coder

使用 SweetUI 5.7.0。交付 src/ 与 index.gts.html。以下命令在本 skill 根执行，工程目录使用绝对路径；输出位置遵循宿主要求。

## 生成流程

1. **准备环境**：当前会话未确认 Node 时执行 node -v。随后执行 node scripts/ensure-env.mjs；环境未变则复用结果。失败按 HINT 执行安装脚本或 setup-env，不反复读实现。
2. **初始化**：新页面执行 node scripts/init.mjs "<输出目录>" "<page-slug>"，记住 HTML_PATH、SRC_DIR、PAGE。slug 为 2–6 段英文/数字连字符，页面目录由脚本转为 PascalCase。已有项目原地修改，不重跑 init。
3. **编写**：编码前完整读取一次 [代码规则](vendor/vue-skill/references/code-rules.md)，同一上下文已读可复用。先确定页面区域、局部组件和数据归属，再编写；不输出冗长规划。多功能页面在 src/pages/{PAGE}/components/ 拆分，入口装配；重复内容先写配置数组，再用 v-for。
4. **自查与构建**：按代码规则做一次交付自查，执行 node scripts/cleanup-starter.mjs --dir "<工程目录>"，再执行 node scripts/build.mjs --dir "<工程目录>"。源码最后修改后必须重新 build。
5. **交付**：构建通过立即给出 HTML 和源码的可点击绝对路径。准确说明验证范围；未执行浏览器时写“构建通过，浏览器运行未验证”。不主动打开浏览器、截图或增加多视口流程。

脚本优先看 RESULT 和 HINT。运行库由维护者一次准备，普通页面不逐次调查 npm 包或运行库。缺资源时按 [运行准备](references/runtime-setup.md) 处理，不能用占位库或静态 HTML 冒充完成。

## 设计路径

自然语言新页面只读一个最相关场景：[查询](references/design/scenes/query.md)、[详情/表单](references/design/scenes/detail-form.md)、[工作台](references/design/scenes/workbench.md)、[对话](references/design/scenes/conversation.md)、[看板](references/design/scenes/dashboard.md)、[展示](references/design/scenes/presentation.md)。先确定主任务、主次区域和密度，不另产规划报告。
HTML/截图还原读 [参考还原](references/design/reference-reconstruction.md)，保留布局比例和视觉角色，不自动增加指标或筛选。需要视觉搭配时只查 [视觉配方](references/design/visual-recipes.md) 对应条目。局部修改跳过无关设计资料。
工作台或复合对话输入需求读 [资产索引](references/assets/index.md)，仅复制所需资产；独立列表/表单不自动套工作台。

## 按需读取

|需要解决的问题|读取方式|
|---|---|
|选 token|先读 [token-catalog](references/token-catalog.md) 的“常用选取”；不足时按 text/bg/space/radius/font 等关键词查相关行。已核实名称直接复用，不读取全量 JSON、不运行查询工具。|
|选组件|查 [组件索引](vendor/vue-skill/references/components_index.md)，只读所需组件契约；不从其他库猜 props、事件或插槽。|
|选图标|按 search/add/close 等含义词查 scripts/verify/whitelists/sweetui-icons.json，复制完整 cssClass。用 SweetIcon 的 icon-class 属性；禁止拼后缀、编造名称或调用外部图标服务。没有合适图标可用文字。|
|布局与组合|查 [布局索引](vendor/vue-skill/templates/README.md) 或 [组合示例](vendor/code-example/SKILL.md)，选相关起点按业务改造。|
|语言或主题切换|用户要求切换 UI 时读 [切换说明](references/on-demand-toggle.md)。默认中文，不创建业务词典或切换按钮。|
|报错|先处理 build 的具体错误，必要时查 [错误清单](vendor/vue-skill/references/error-checklist.md)。|

信息足够即停止读取。JSON 是脚本名称依据，Markdown 是按需参考，不要求同时读两份。

## SweetUI 约束

- 每文件显式导入 Vue/SweetUI API，模板用 PascalCase。只用 SweetUI 自己的图标、token、i18n 和组件。
- 使用普通 scoped CSS；使用已验证的官方样式入口及必要依赖，避免重复加载或重建等价主题样式；组件状态交给原生主题，页面不重绘整套组件状态色。页面 CSS 变量从目录选，局部变量用 --page-*。
- brand 是品牌色，accent 是强调色，不把所有主操作强制改成红色。
- 主题仅 uDesign2.2-light / uDesign2.2-dark，共享 theme.js 负责真实 selector 映射。默认不显示切换 UI。
- 页面只调用 src/api/ 的 Promise 服务，mock 放 src/api/mock/；页面不直接引用 mock。UI 配置可放局部组件。
- runtime.js、theme.js、i18n/index.js 是共享接线。业务页面不要另写预览专用初始化；国际化通过公共接口接入。
- 示例不等于完整产品；表单提交、查询、重置、分页等交互要真实生效。
- 代码规则不增加机器风格门禁。build 负责真实编译、导入、资源和名称检查；无法静态确定的动态图标不能宣称已验证。
- --source-only 仅供维护时检查源码，返回 SOURCE_OK，不产生可交付预览，不能替代正常 build。

## 验证失败与重试上限

首次验证失败时汇总错误，集中修复后重跑，最多 2 轮修复重跑，即最多 3 轮验证。每轮必须针对错误修改；同一错误再次出现且没有新依据或可行方案时提前停止。额度按同一批交付累计，不因切换检查项、步骤或对话轮次重置。环境异常按 HINT 处理，不能反复执行同一失败操作。
达到上限仍失败，明确报告“未通过”、剩余错误和位置，不能绕过检查或声称完成。只有用户提出新修改任务或明确要求继续才开始新批次。

## 维护

私有资源补齐、原生名称核对及内网一次性运行验收见 [runtime-setup](references/runtime-setup.md)。不要把维护调查变成每页的前置步骤。

新增工作台/对话资产的内网维护验收见 [资产交接](references/foundation-handoff.md)，普通页面不重复执行。

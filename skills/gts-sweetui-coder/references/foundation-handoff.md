# 工作台与对话资产：内网补齐与验收

这是维护交接，普通生成不读取。外网已实现设计路由、视觉配方、列表起点、查询/详情示例、工作台和对话输入资产及按需复制；不修改 SweetUI 原生运行接线。布局建议不是官方规范，资产尚无真实 SweetUI 浏览器验收结论。

## 路径与同步
- 新包：D:\project\gts\ai-for-design\skills\gts-sweetui-coder1；内部 name 仍为 gts-sweetui-coder。
- 旧包只读：D:\project\gts\ai-for-design\skills\gts-sweetui-coder；EP 不修改。
- npm：D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base。
- 源码辅助：C:\Users\c00426332\Desktop\xiaoyi\octo\sweetui\SweetUIBase-master\SweetUIBase-master；先核对版本。
- 验收工程：D:\project\gts\ai-for-design\output\sweetui-foundation-check。
- 报告：D:\project\gts\ai-for-design\output\sweetui-coder-handoff。

仅同步本次新增/修改的文档、资产、模板和脚本，保留内网 public/library 的真实文件，不以外网同名文件覆盖。无需再次全量提取 token 或图标，不动既有 theme.js、i18n/index.js 和 UMD 接线。

## 内网需要做什么
1. 以实际 npm 5.7.0 为准，定向核对新增使用的接口：SweetButton 的 text/loading/disabled/type；SweetInput 的 modelValue/clearable；SweetSelect + SweetOption 的 modelValue/update:modelValue 与 value/label；SweetIcon 的 iconClass/size；SweetDrawer 的 modelValue/size。名称存在不代表 API 已验证。
2. 若现有契约正确，无需重写；若发现具体不兼容，只修涉及的资产/示例及说明。不能按 Element Plus 的相似 API 推测。布局、搜索、受控工作区事件、输入法判断等 Vue 逻辑已实现，不需要重新造一套。
3. 核实字体图标实际可见、大小及是否存在强制色；模型选择器和按钮在复合输入中的尺寸/焦点不冲突。只做组件根布局适配，不重建官方皮肤。
4. 当前无图表运行库，不能为了看板场景擅自引入 dt-ui/ECharts。出现明确图表需求时另行决定并提供准确发布入口/API，本轮不调查。

## 执行与装配
在新包根执行 ensure-env 与 verify-build，按现有 HINT 处理环境。使用以下命令初始化；已有同名用户工程不覆盖，另取明确的验收目录。

~~~powershell
Set-Location 'D:\project\gts\ai-for-design\skills\gts-sweetui-coder1'
node scripts/ensure-env.mjs
node scripts/verify-build.mjs
node scripts/init.mjs 'D:\project\gts\ai-for-design\output' 'sweetui-foundation-check'
node scripts/copy-foundation.mjs --dir 'D:\project\gts\ai-for-design\output\sweetui-foundation-check' --page SweetuiFoundationCheck --assets workbench-shell,conversation-composer --check
node scripts/copy-foundation.mjs --dir 'D:\project\gts\ai-for-design\output\sweetui-foundation-check' --page SweetuiFoundationCheck --assets workbench-shell,conversation-composer
~~~

将 assets/examples/workbench-conversation/index.vue 复制为验收工程 src/pages/SweetuiFoundationCheck/index.vue。这是明确标注的本地定时演示，不接模型、不上传附件；真实服务由业务提供。装配后执行：

~~~powershell
node scripts/cleanup-starter.mjs --dir 'D:\project\gts\ai-for-design\output\sweetui-foundation-check'
node scripts/build.mjs --dir 'D:\project\gts\ai-for-design\output\sweetui-foundation-check'
~~~

每次修改 src 后重新 build。资产脚本不会覆盖已编辑组件；发生 CONFLICT 读差异后人工合并，不删文件绕过保护。修改包内资产后，用脚本计算 assets/foundation/manifest.json 对应文件的真实 SHA-256，再运行回归，不编造哈希。

## 一次集中验收
- 工作台：收展、搜索、菜单、工作区新增/切换/关闭、全关闭空态、会话面板；切换保留草稿，关闭时取消任务。窄桌面和常用宽度不整页横向滚动，只有指定区域滚动。
- 输入器：中文输入法 Enter 不误发、Enter 发送、Shift+Enter 换行，空输入禁发、busy 禁止重发、stop 确实取消演示定时器；模型选项变化有实际事件。
- 附件：选择/移除、多次选择同一文件、仅附件发送；文件只存在本地。需要上传时必须真实实现服务，本资产不宣称上传。
- 在验收页传入至少一条 references 和 commands，验证 @、/ 建议、上下键、Enter、Escape；关闭这些能力时提示语不能声称支持。
- 查询详情示例单独放入一个 init 工程，按 vendor/code-example/SKILL.md 装配，验证查询/重置/分页和详情开关；不要复制到现有业务工程覆盖源码。
- 浅深主题：用现有 setTheme，核对正文、边界、选中、焦点及图标；不改全局接线掩盖局部样式问题。
- 国际化按需要在验收页接入公共 t：labels、菜单/页签、placeholder/disclaimer 由 computed 传入翻译，检查新旧组件与内置文案切换，输入和分页状态不丢失。不要把默认中文示例误称为已经双语。
- 同一装配在真实 npm Vue 工程验证；预览通过不等于工程入口通过。源码编译和模拟事件测试不能替代真实组件运行。

不能运行浏览器时列出待用户操作步骤，不能标通过。不新增每页自动浏览器、截图或复杂门禁；这里只是维护期新增资产的一次验收。

## 回传与收尾
报告放在 output，不进入最终 skill。返回 foundation-acceptance.md（实际版本、操作、结果、问题及依据）、必要截图说明、UTF-8 changes.patch 或修改文本。未修改原生数据时不重复回传三份大 JSON，不要求传私有 UMD/CSS。
验证后保留资产接口、设计指南、复制器和回归脚本；调查日志留在外部。若修复影响组件接口，接口文档、示例和测试一起同步。

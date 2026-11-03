# SweetUI 运行资源维护

本文用于用户明确要求的 skill 运行资源准备、修复或升级，会更新 skill 内的索引及随包运行资源。普通页面的编译环境准备与运行资源缺失处理遵循 SKILL.md 的生成流程。

## 输入与操作目录

在明确指定的待维护 skill 根目录执行命令。准备目标版本的 npm 包目录、含兼容 xss.js 和 lodash.min.js 的资源目录，以及隔离验收输出目录。开始前确认目标 skill、目标版本及本次操作所需的真实输入目录；缺少输入时报告缺口，不推测路径或补造资源。下列占位路径应替换为实际绝对路径。

## 依据与资源职责

SweetUI 的版本、导出、组件 API、token 名称和值、图标、主题及 i18n 以实际安装 npm 包为准。源码仅辅助定位，先确认与安装版本一致；旧包只提供运行接线参考，不能覆盖当前 npm 的事实。现有新包、旧采集文档与 npm 冲突时，以核实后的 npm 结果修正。不要臆造名称、值、文件、API 或验证结果；无法确认时记录缺口。

|文件|处理方式|
|---|---|
|sweet-ui-base.umd.cjs、sweet-ui-base.css|当前脚本预期的入口；先核对实际发布结构。可直接用时保留原名复用，否则按实际入口最小适配。|
|CSS 引用的字体、图片或样式|只带入实际依赖，优先保留原名及相对路径；确需调整路径时记录原因。内嵌字体不重复拷贝。|
|xss.js、lodash.min.js|复用已成功预览的真实文件和别名接线。|
|Vue、dayjs、vue3-sfc-loader|包内已有可用资源；核对实际版本，不为统一版本号盲目升级。|
|sweetui-exports.json|从实际 ESM 导出生成，用于检查 import 名称；不检查 props。|
|sweetui-icons.json|从官方图标 CSS 提取类名、编码及强制色标记。|
|sweetui-tokens.json|从官方 common、指定浅深主题 CSS 提取准确名称与值。|
|token-catalog.md|从 token JSON 生成，供按需读取；不独立维护另一份设计值。|
|src/assets/base.css|仅提供应用高度、边距和盒模型，不覆盖官方字体、颜色或组件状态。|

当前索引的初始数据来自内网 02/03 JSON 与 01/04/05 API 记录；首次入网以真实安装包重新提取的结果为准，不把旧数量写成验收门槛。
当前实现依据采集资料，预期 dist/sweet-ui-base.css 包含目标主题和图标，三个 var-ui-* 主题文件用于提取索引。这个布局尚未用真实安装包验证，不是对所有发布包的硬性要求。

先核对 npm 的 package.json、实际 CSS/UMD 入口、依赖和旧版成功预览接线：完整 CSS 足够时只加载一次；分文件发布时保留必要组合；需要全局变量、主题名称或资源路径适配时允许最小接线，记录依据。不要为目录整齐删除工作正常的适配，也不要叠加等价样式。

prepare-runtime 当前只支持上述完整 CSS 布局。文件缺失或预检失败表示需要调查来源或适配脚本，不代表组件库不能使用。核实后同步准备脚本、提取器、预览和工程入口及相关测试；不单纯关闭检查。找不到资源时不能把当前代码当作兜底真值，不能凭空补造 token、图标或主题。无法确认的项目记录缺口。

## 维护步骤

### 1. 检查编译环境

在目标 skill 根目录检查环境；仅缺 Node 时先运行 scripts/install/install.ps1 或 install.sh。

~~~powershell
Set-Location '<skill目录>'
node scripts/ensure-env.mjs
~~~

环境缺失或过期时，按 HINT 执行 setup-env 或安装脚本，再检查一次。setup-env 安装到共享环境，不把 node_modules 放进 skill；环境已就绪时跳过安装。

### 2. 准备本次涉及的索引与运行资源

首次完整准备时执行以下适用项；修复或升级时按实际受影响的资源选择，保持对应索引与运行资源一致。

- 导出或图标索引需要生成、更新时：

~~~powershell
node scripts/gen-whitelists.mjs --package '<SweetUI npm包目录>'
~~~

- token 索引及目录需要生成、更新时：

~~~powershell
node scripts/gen-tokens.mjs --extract --package '<SweetUI npm包目录>'
~~~

- 随包运行资源需要准备、更新时：确认依赖目录中存在真实 xss.js、lodash.min.js，并核实与目标 UMD 兼容；`--from` 指向该目录。

~~~powershell
node scripts/prepare-runtime.mjs --package '<SweetUI npm包目录>' --from '<兼容依赖资源目录>'
~~~

### 3. 核对与回归

运行资源或任一索引变更后，使用生成索引的同一来源 npm 包及经确认兼容的依赖目录，执行 prepare-runtime --check 和 check-runtime，核对随包运行资源与来源一致。导出/图标索引变更另执行 gen-whitelists --check；token 变更另执行 gen-tokens --check。首次完整准备执行全部检查。

检查发现资源不一致时，仅在已授权维护范围内同步受影响资源并重新核对；缺少真实来源或修复需要扩大范围时，报告差异与阻塞，不将检查通过改为跳过检查。检查本身不要求重新复制或下载资源。

资源或索引变更后运行 verify-build；隔离替身回归不替代上述真实来源核对，浏览器验收另见下一节。

~~~powershell
node scripts/prepare-runtime.mjs --package '<SweetUI npm包目录>' --from '<兼容依赖资源目录>' --check
node scripts/check-runtime.mjs
node scripts/gen-whitelists.mjs --package '<SweetUI npm包目录>' --check
node scripts/gen-tokens.mjs --package '<SweetUI npm包目录>' --check
node scripts/verify-build.mjs
~~~

目标版本为 SweetUI 5.7.0。提取失败时检查真实路径、选择器、导出结构和错误，不手工凑数量、不按命名规律补名称。
上述命令适用于当前布局；若真实布局不同，先完成有依据的最小适配，再执行对应命令并记录差异。prepare-runtime --check 当前验证直接复制资源的字节与来源一致；必要转换应验证转换依据和产物，不能伪报原样一致。check-runtime 验证文件及 XSS/lodash 别名。它们均不等于浏览器运行通过。

## 运行验收

~~~powershell
node scripts/init.mjs '<隔离输出目录>' 'sweetui-acceptance'
node scripts/build.mjs --dir '<隔离输出目录>\sweetui-acceptance'
~~~

已有验收项目原地修改，不覆盖用户文件；确认其接线已经同步最新版。每次源码修改后重新 build。只读 --source-only 不能代替正式构建。

集中验证：
- 真实打开 index.gts.html：无白屏、资源错误，图标可见；查询、重置、分页及空/错误状态有效。
- 复用 form-dialog 示例：必填校验、取消、保存及父表刷新有效，不空报成功。
- 浅色→深色→浅色：深色 selector 为 GTS UDesign（默认风格）-dark，正文、输入、表格、弹窗正常。
- 按 on-demand-toggle 接入业务词典，使用 i18n/index.js 导出的 t（computed ref）；模板中 t(...) 自动解包，JS 中 t.value(...)。中文→英文→中文时，业务文案和 SweetUI 内置组件文案均通过 in-place mutation + delegatingI18n 机制同步更新。验证完整生命周期：初始切英文；英文状态下打开新弹窗确认内置文案为英文；关闭后切中文再切英文确认所有组件跟随；切换过程中输入内容、查询条件、分页状态保留。切换过程中禁用重复点击。
- 同一 src 在已安装目标依赖的真实 Vue 工程中验证 main.js；预览与工程共用 runtime.js，不只修 HTML。
- 不存在的 token、图标、组件导入应被 build 拒绝；恢复源码再构建。

语言取词与组件状态依赖原生能力；in-place mutation + delegatingI18n 方案经单元测试验证旧/新消费者响应性和同语言环境 early-exit，但模拟测试不替代真实 SweetUI 浏览器验证。若浏览器中失败，先查原生初始化、词典合并和版本；有复现证据才做必要修复，不预先增加请求队列、强制重排或另一套主题/翻译系统。

## 维护记录

记录实际版本、资源来源、执行命令与通过/失败/未验证状态。直接复制资源核对来源与产物哈希；必要转换记录原因和可复现步骤；自建接线记录依据。报告和验收产物放在 skill 外。

资源调整只涉及确认无引用、无加载依赖的内容，保留必要适配、提取器和依赖清单；不裁剪官方 CSS 中其他主题。修改后复查引用、运行相关回归并验证新生成的预览，不沿用旧页面成功作为新包运行证据。

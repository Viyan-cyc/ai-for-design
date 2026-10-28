# 内网准备、验收与纯净交付

仅在首次安装或更新库版本时执行；普通页面复用准备好的包，不重复提取或调查依赖。

## 路径

- 唯一可修改的新包：D:\project\gts\ai-for-design\skills\gts-sweetui-coder1
- 原有包只读保留：D:\project\gts\ai-for-design\skills\gts-sweetui-coder
- 不修改 EP：D:\project\gts\ai-for-design\skills\gts-ep-coder
- SweetUI npm：D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base
- SweetUI 源码（必要时定向查 API）：C:\Users\c00426332\Desktop\xiaoyi\octo\sweetui\SweetUIBase-master\SweetUIBase-master
- 验收项目：D:\project\gts\ai-for-design\output\sweetui-acceptance
- 验收报告与回传资料：D:\project\gts\ai-for-design\output\sweetui-coder-handoff

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

## 首次准备

将收到的新包放到 gts-sweetui-coder1，SKILL.md 的 name 仍为 gts-sweetui-coder。原有 gts-sweetui-coder 只读保留，直接检查其成功预览接线，仅将确认兼容当前 npm 的必要资源复制到新包，不创建中间备份目录。按新包绝对路径执行，避免同名 skill 自动选到旧包。验证通过后由用户自行替换正式目录，本轮不自动替换。报告和采集资料放在 skill 外。

先确认旧包 scripts/preview/public/library 中实际存在所需的 xss.js、lodash.min.js，并核实与当前 UMD 依赖兼容；下方 --from 指向该目录。若实际位置不同，定位后使用真实目录，不创建假文件迁就命令。

~~~powershell
Set-Location 'D:\project\gts\ai-for-design\skills\gts-sweetui-coder1'
node scripts/setup-env.mjs
node scripts/ensure-env.mjs

node scripts/gen-whitelists.mjs --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base'
node scripts/gen-tokens.mjs --extract --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base'

node scripts/prepare-runtime.mjs --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base' --from 'D:\project\gts\ai-for-design\skills\gts-sweetui-coder\scripts\preview\public\library'
node scripts/prepare-runtime.mjs --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base' --from 'D:\project\gts\ai-for-design\skills\gts-sweetui-coder\scripts\preview\public\library' --check
node scripts/check-runtime.mjs

node scripts/gen-whitelists.mjs --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base' --check
node scripts/gen-tokens.mjs --package 'D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base' --check
node scripts/verify-build.mjs
~~~

setup-env 安装到共享环境，不把 node_modules 放进 skill。仅缺 Node 时运行 scripts/install/install.ps1 或 install.sh。
目标版本为 SweetUI 5.7.0。提取失败时检查真实路径、选择器、导出结构和错误，不手工凑数量、不按命名规律补名称。
上述命令适用于当前布局；若真实布局不同，先完成有依据的最小适配，再执行对应命令并记录差异。prepare-runtime --check 当前验证直接复制资源的字节与来源一致；必要转换应验证转换依据和产物，不能伪报原样一致。check-runtime 验证文件及 XSS/lodash 别名。它们均不等于浏览器运行通过。

## 运行验收

~~~powershell
node scripts/init.mjs 'D:\project\gts\ai-for-design\output' 'sweetui-acceptance'
node scripts/build.mjs --dir 'D:\project\gts\ai-for-design\output\sweetui-acceptance'
~~~

已有验收项目原地修改，不覆盖用户文件；确认其接线已经同步最新版。每次源码修改后重新 build。只读 --source-only 不能代替正式构建。

集中验证：
- 真实打开 index.gts.html：无白屏、资源错误，图标可见；查询、重置、分页及空/错误状态有效。
- 复用 form-dialog 示例：必填校验、取消、保存及父表刷新有效，不空报成功。
- 浅色→深色→浅色：深色 selector 为 GTS UDesign（默认风格）-dark，正文、输入、表格、弹窗正常。
- 按 on-demand-toggle 接入业务词典，直接用 SweetUI useLocale().t；中文→英文→中文时，已挂载的业务文案及组件内置文案同时更新。切换过程中禁用重复点击。
- 同一 src 在已安装目标依赖的真实 Vue 工程中验证 main.js；预览与工程共用 runtime.js，不只修 HTML。
- 不存在的 token、图标、组件导入应被 build 拒绝；恢复源码再构建。

语言取词与组件状态依赖原生能力，外网未验证其实际浏览器行为。若失败，先查原生初始化、词典合并和版本；有复现证据才做必要修复，不预先增加请求队列、强制重排或另一套主题/翻译系统。

## 最终包清理

只清理确认无引用、无加载依赖的文件：
- 删除旧版 dt-ui、Less 资源/接线、旧查询工具及失效索引。
- 清理与官方资源重复的自建主题及无用途的兼容层；必要适配按实际引用和运行证据保留，不按文件名判定多余。
- 优先保留官方资源原名，不无故改写或复制整套 npm 工程；必要转换记录来源、原因和可复现步骤。
- 不保留旧包副本、采集原文、截图、日志、验收工程、review_report、临时脚本或 node_modules。
- 保留实际运行资源、自动索引与提取器、构建/环境脚本及其依赖清单、有引用的规则和示例。不能把必要维护工具当作无用文件删除。
- 不因原生 CSS 内含其他主题而剪裁官方文件；应用只允许指定的浅深主题。

清理后复查所有文件引用并重新执行数据/资源核对与回归，实际打开最终包新生成的页面。不要依据清理前旧页面的成功结果宣布新包通过。

## 回传

回传目录放在 skill 外，至少提供：
- acceptance-report.md：实际版本、来源路径、执行命令、通过/失败/未验证、运行观察和剩余项。
- data-diff.md：自动索引变化及脚本统计，区分组件与 API。
- resource-manifest.json：最终运行资源相对路径、来源路径及 SHA-256，区分直接复制、转换和自建接线；转换记录原因/命令及源文件和产物哈希，自建接线注明依据，不要求两者哈希一致。
- cleanup-report.md：删除/保留的主要文件及理由；是否存在重复 CSS/字体加载。
- 最终 sweetui-exports.json、sweetui-icons.json、sweetui-tokens.json。
- changes.patch：仅本轮相对收到的新包的文本改动；若无改动明确说明。不能导出补丁时提供改动清单和对应完整文本文件。

不要求回传 UMD、字体或整个代码工程。大 JSON 可按完整条目分片，附合并说明，不能截断。关键结果及时持久化，未执行的检查写“未验证”。

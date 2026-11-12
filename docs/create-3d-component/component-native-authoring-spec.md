# 原生组件创作、入库与场景同步 Spec

## 1. 目标与授权
用户已批准12项计划（Plan Approved），要求完整落盘后继续执行多个关联工作，不只写摘要。M0已由历史Spec第107节独立复审GO。此文件是M1–M4唯一活跃Spec；历史迁移及此前N1–N8仍以[原Spec](component-authoring-delivery-spec.md)为历史依据，不改写结论。
最终结果：设计师用create-3d-component创作的组件默认符合目标组件库工程要求；演示可直接预览、实时调参；开发审核后组件源码无需重写即可接纳；入库与文档更新由脚本完成；按需同步到新版generate-3d-scene。原型可运行、导出成功、设计确认、工程验证、同步完成和发布是不同状态。
本次批准允许连续实施、集中review；每个单元仍记录实际验证，未通过不能冒称完成。用户视觉确认和正式发布不自动代签。遇到需要决定的新业务语义停止相关操作，可继续独立工作。

## 2. 工作区与变更边界
- 唯一新仓：D:/cyc/project/octo/skills/test/ai-for-design。
- skill：skills/create-3d-component；生成器：skills/generate-3d-scene。
- 维护工具：tools/3d-component-studio；维护测试：tests/create-3d-component；Spec及维护证据：docs/create-3d-component。
- 目标库：D:/cyc/project/octo/test/3d-components；本轮读取其实际规范，验证使用独立真实副本。不自动写入生产库，不自动发布、提交、推送或安装全局skill。
- 旧仓D:/cyc/project/octo/gts/test/ep-coder只读。旧generate不整体迁入；需要的旧能力先比较当前接口和冲突，再定向适配。禁止目录链接间接写共享目录。
- 新仓现有改动保留。文档简化不删除有用的使用限制，不用迁移旧实现覆盖新版。

## 3. 当前事实与目标差距
M0迁入的是mjs原型/独立vendor构建链，并非库原生TS产物；当前静态模板是立方体，不代表业务能力。库为@a3d/a3d-components，源码以TS为主，按分类barrel及构建入口输出ESM/CJS和类型，Three使用peer dependency。地图扩展、Object3D和效果插件有不同宿主接口，不应强制一个构造器。当前generate同步按TypeDoc导出类生成目录和说明，不代表工厂函数和编辑器接入均已支持。库现有HTML解析目录工具不等于完整文档生成器。
源头问题：源码能在Demo运行不证明能复制入库；维护资料混入用户指南使阅读困难；面板布局由模板固定才能避免每次生成漂移。所有状态以下文实施记录为准，计划不是能力。

## 4. 十二项工作及Done Contract
### 1）完整新Spec
落盘所有最终决策、路径、依赖、文件计划、验收、未完成状态；旧Spec追加指向本文件的恢复入口。历史不批量重写。验收：12项均有落点和关闭条件，不把讨论当实现。
### 2）迁移复审
M0已通过历史107节：项目目录保护、AST映射、外置构建、边界与离线预览。本期不重复搬历史数据。不把历史Grid故障覆盖说成已迁入。验收：保留GO和限制；旧目录不写。
### 3）组件库规范
以当前package.json、tsconfig.app.json、vite入口、公共类型和不同宿主组件为依据制定原生契约。分类与宿主类型分开；TS入口、导出名称、依赖范围、参数默认来源、资源所有权、销毁与宿主调度明确。对象组件/效果/地图图层按实际能力分别定义；不存在通用接口时不伪造兼容保证。兼容凭目标版本和实际副本验证，不凭文档宣称。
验收：至少两种宿主类型的接口映射有实码依据；字段可对应代码；生成器适配与库接纳分开。产物references/native-contract.md及必要机器描述，维护核对记录仅在本Spec。
### 4）创作skill改造
默认新建生成TS组件、以peer方式导入基础库，不反向引用example，不携带另一份Three进组件。模板按宿主类型选择；只有实现并测试的模板才能标支持。保留旧工程维护兼容，版本不兼容明确拒绝或显式迁移，不批量改旧产物。维护源码/测试不放skill，使用时必需脚本/运行资源可放。唯一维护源在tools，runtime生成不手工双改。
验收：新工程TS可检查、打包；同一源码在目标库副本编译及使用成功；纯组件没有Demo依赖。未达成前不把默认mjs模板称原生完成。
### 5）预览面板与UI
桌面右侧参数面板，预览占剩余区域；窄屏右侧抽屉可收起，保留预览交互。样式取新版生成器editor.css实际令牌：背景、文字、强调色、边框、圆角、输入框、间距；不引入完整Vue编辑器。模板提供同一套面板，LLM只填组件参数和适用动作。实时输入、当前值与单位、恢复默认、错误提示必需。动画组件才提供暂停/继续/重播/循环；不得给静态组件虚假播放按钮。扫描结束后改参可重播。组件销毁解除观察器/事件/动画并保留宿主。
验收：桌面与窄屏实际浏览器位置、收起/展开、控件实时状态与reset、导入导出往返、无未捕获异常；样式令牌与生成器匹配。用户评价视觉，本轮技术页面检查不代签视觉。
### 6）产物与artifact规则
与新版生成器一致：环境artifact-folder优先，否则cwd；创建英文连字符具名目录；冲突编号；明确完整路径拒绝覆盖；修改已有工程沿用原目录。根目录index.3d.html、component/、example/，不增加source/preview。保留用户历史；依赖和缓存外置，不在交付根安装node_modules。构建返回实际HTML_PATH；最终仅以<artifact type="text/link">实际绝对路径</artifact>展示主预览，除非用户明确要求其他产物。不得展示占位路径。
验收：目录分配保护回归、无链接、file离线预览（地图联网例外如实说明）、唯一主入口；失败保留原有效页面。
### 7）组件交付包
component含src、必要资产、参数/配置及简洁design/engineering说明；example含地图/相机/演示数据/调参宿主。包不含Demo、node_modules、缓存、机密路径；来源/许可按实际需要保留。参数从可执行定义派生，避免手工多份默认。校验包闭包与类型，解包实际使用。设计确认绑定具体产物，源码或参数变更使相关确认失效。导出不提升设计/工程/发布状态。
验收：导出/导入往返、错误版本/未知文件/越界路径/依赖/资源拒绝、独立宿主挂载销毁、包内容清洁。
### 8）自动入库
在审核确认后选择分类，脚本先dry-run显示变更、依赖和重名冲突；在库真实副本类型检查/构建/行为验证后，再显式apply。保留源码字节，机械更新分类barrel；新分类更新package exports/vite入口需显式计划。不能只复制源码就标成功。记录文件来源与基线；应用前检查目标变化，冲突停止不覆盖他人修改。更新已有组件必须明确目标版本和原文件基线。
验收：正常新增、重名、依赖冲突、新分类、重复执行、并发目标改变、验证失败不落共享文件；至少两种类型。维护脚本先在新仓实现，实际生产应用另行明确批准。
### 9）库文档生成
API从TS/TSDoc提取；参数值/范围/单位来自执行定义；设计意图来自确认材料。生成说明页、示例和索引；不要求开发重复填写同一默认值。自动区与人工区有所有权，不覆盖人工说明；脚本支持重复运行、更新、删除/改名冲突提示。
验收：源码/参数变更后文档一致；人工说明保留；示例可执行；类与工厂函数按实际支持范围覆盖。不把HTML解析目录脚本当完整生成能力。
### 10）生成器同步
扩展新版scripts/sync-components.mjs，复用包构建、目录与component-docs；校验包/源码/文档同版本，显式目标仓路径，不靠旧相对位置猜测。包可见、文档可读、场景可创建、编辑可保存为不同状态。标准适配可机械登记；未知宿主需实现创建/更新/销毁/适用保存恢复接口，脚本不能猜业务逻辑。
验收：真实新生成工程加载组件，适用时参数修改、保存重载/冲突；同步失败不能留下错版配对。普通generate流程沿用其统一build-offline，不给每次生成追加维护审查门禁。
### 11）设计文档纯净化
使用页只讲用途、效果、操作、参数、实际限制；删除无价值内部方法名、任务编号、重复免责声明。必要版本/校验值由机器清单管理，不写正文；已有Spec证据不再次复制归档。scene-design-examples专心讲场景设计，结构为适用场景、目标效果、组件组合、参数选择、实际限制/技术链接。先处理common.md、geographic-map.md和组件用法模板；其他领域不自动改设计语义。新增组件不自动生成整篇领域方案，只有设计组合改变才提出更新。
验收：用法可直接执行，默认与确认状态不被歪曲，限制没有被删除成虚假承诺，链接可达；每段有明确读者用途。
### 12）端到端验证
至少两类组件（Object3D与借用宿主效果）走通需求→创作→预览调参→导出→开发审核→副本入库→文档→生成器使用。类型和接口检查不能替代渲染，截图不能替代保存测试。独立review可回写Spec；每批说明已做/未做/边界，不自动发布。用户视觉与功能必要性待用户确认。

## 5. 执行单元、文件计划与依赖
|单元|范围与主要文件|关闭标准|
|---|---|---|
|M0|历史Spec第107节|独立GO，完成|
|M1|本Spec、create references/native-contract.md、文档分层规则|实际库接口核对、可执行标准明确|
|M2-A|tools/3d-component-studio/authoring-template/example、scripts/pack-skill.mjs、create SKILL/references、tests|右侧面板/样式/响应式/预览与目录回归|
|M2-B|原生TS模板、init、build、源码边界/导出、对应tests|原生组件字节不改接纳库副本；旧工程兼容|
|M3|新仓维护入库/文档脚本及测试|dry-run/apply/失败不写、生成文档与人工内容保留|
|M4|新版generate sync脚本及必要适配、common/geographic文档|包/文档一致、实际生成使用与适用保存验证|
|E2E|新仓独立样本与维护测试|两类完整流程、状态区分、最终review|
M2-A与契约先做，不用UI完成冒充M2-B完成；M3依赖M2-B；M4接入依赖M3。文档清理可独立推进，但不改未核对的运行语义。M2-A验证通过后可按本轮连续工作授权继续，独立review结论另列。

## 6. 不采用与风险处置
不整目录复制旧生成器，不事后重写原型冒充原样入库，不强制全部组件继承Object3D，不把候选演示放组件库，不把参数MD当运行默认，不自动推断设计确认，不强迫设计师填写工程记录。目标库可能并行变化，应用前重新核对接口和文件基线。已有AST映射保留供旧工程，原生链路优先直接构建，避免重复路径转换。先验证支持范围，再公开能力。

## 7. Checkpoint与状态
批准：本轮明确Plan Approved；允许多项连续执行和集中review。M0 GO见历史107节。M1/M2-A开始；其余PENDING。每个单元完成后在此追加变更、验证、剩余问题；实施中发现的偏差先记录再修改。未来恢复先读本节及最新执行记录，不重读整份历史Spec。

## 8. 首批执行记录：M1、M2-A及文档整理
核对目标库tsconfig（ES2022、ESNext、bundler、noUnused检查）、ComponentOptions及MapSurfaceParticleScan实际接口；native-contract.md将分类与宿主、源码与演示、更新与动画调度分开。未宣称原生TS初始化已实现。
M2-A采用生成器editor.css真实.edit-scope令牌，在维护pack阶段注入静态HTML；skill运行不依赖generate目录。面板桌面在右侧，窄屏默认收起并从右侧展开；Escape/按钮收起、实时值、reset、导出演示/参数导入沿用实际功能。静态模板不伪造播放控件。修正初始mesh尺寸未应用preset的小缺陷。
文档整理只改scene-design-examples/common.md与geographic-map.md，保留来源确认边界、地图联网/映射/投影等使用限制，去除正文SHA/B4/内部方法和重复维护清单；不改生成器运行源码。脚本编写首次受Windows默认GBK解码影响中止，已显式UTF-8修复，不把部分执行当完成。

### 8.1 原生链路实施细化
采用独立native模板直接构建component/example，不对原生源码做旧路径正逆转换。首先公开native-object（Object3D）作为显式profile，旧默认暂保留，待目标库副本验证后再切换；地图/效果模板未实现前不冒称已有。native组件src使用TS及three peer，组件package.json作为入口/依赖声明；parameters.ts提供默认/校验/控件，preset.json仅存覆盖。外部真实stage安装构建依赖，类型检查与源模块闭包检查后内嵌预览；导出源码ZIP原字节且不含example或node_modules。参数页面只导入同版本参数，不执行导入代码。源码导出与参数导出按钮分别命名。维护文件tools/3d-component-studio/native-template和native-build；runtime由pack生成。验证先在独立候选，再库真实副本，不能据模板类型检查推断整个库通过。

原生开发首次打包发现zip.mjs是生成文件而非维护模板文件，已改为从唯一维护src/zip.mjs生成；并在init预留目录前检查native runtime存在，避免旧runtime下空目录被报告为成功。首次空测试目录留存，不用覆盖掩盖失败；重新初始化使用编号目录。

### 8.2 原生对象模板阶段结果
native-object候选源码已原字节复制进目标库真实副本src/core/authored-component，仅在副本core/index.ts追加导出；目标库基线typecheck及加入组件后的typecheck通过，原vite构建ESM/CJS/声明通过，构建产物可实例化/重复dispose。没有写原库。故默认init切换native-object，原mjs模板显式--profile legacy兼容，既有边界/flat测试显式选择legacy保留原覆盖。这只是Object3D模板，不代表地图/效果或自动入库完成。原生版首轮独立浏览器JSON导入导出、右面板、主题与响应测试通过。

原生参数入口增加对象/字段/公共选项类型校验，避免数组或未知字段被静默接受；导入增加revision保护，读取文件期间的新调参不被旧导入覆盖。需同步最新模板、重跑原生构建/参数与库副本验证。

库副本运行负例发现setOptions在合并后才校验会把数组[]变成普通对象，已调整为合并前先校验输入，再合并校验；保留数组及未知字段断言重跑。首次运行测试路径相对层级写错，修正调用后发现上述真实问题；不把脚本调用失败当组件缺陷。

## 9. 本轮收口与可恢复状态
实现自检通过，独立review待进行。最新可打开预览：native-work/native-panel/native-panel-3/index.3d.html（原生TS对象，右侧面板）。最新setOptions输入校验已同步此工程并重新构建和导出。只展示立方体模板，不冒充已实现货架/扫光业务。

|12项|本轮状态|剩余工作|
|---|---|---|
|1 新Spec|完成落盘|后续持续回写|
|2 M0迁移|独立GO|保持边界|
|3 原生契约|规范已写，Object3D实证|效果/地图的具体模板及接纳证明|
|4 创作skill|默认native-object TS，legacy显式保留|其他宿主模板及更广资源依赖适配|
|5 右侧UI|新旧对象模板已实现并实测|动画操作随实际动画实现；用户视觉确认|
|6 产物规则|两profile初始化保护、扁平目录/外置依赖/预览规则已实现|实际Octo内嵌环境未验证|
|7 源码交付|native对象ZIP无Demo/vendor/node_modules，原字节导出；参数JSON往返|其他类型与正式审核绑定流程|
|8 自动入库|未实施|dry-run/冲突/分类/副本验证/apply|
|9 库文档生成|未实施|公共数据入口与模板/索引|
|10 generator同步|未实施|包/文档配对、适配及实际工程测试|
|11 纯净文档|common/geographic已整理，原生使用页已写|生成式组件文档模板随第9项|
|12 E2E|对象模板至库副本通过|第二种组件及自动入库到generator完整链|

验证证据在native-work/validation.json及子目录。实际通过：runtime45文件校验；package契约19项；native/legacy目录保护；旧component-boundary；旧右面板ZIP往返；native实际Edge离线右面板/主题令牌、数值颜色实时更新、reset、参数JSON往返、数组输入保留原值、延迟导入不覆盖新调参、390px抽屉/Escape及释放；已人工查看桌面和窄屏截图检查布局。不能代签用户视觉或Octo环境。
原生边界：5类真实失败（demo导入、未声明peer、动态import、资源URL、类型错误）均拒绝且原HTML不变；源码ZIP字节一致。目标库真实副本基线与新组件类型检查通过、原Vite配置ESM/CJS/声明构建通过；最新源码原字节一致，两个宿主、非法参数、重复释放保留借用对象运行测试通过。副本源于目标库当前工作文件与真实依赖副本，不建立共享链接。日志library-native-typecheck.log/library-native-build.log及library-runtime-result.json。
生成器仅两份设计指南变化，运行代码、包和同步脚本未改。旧仓与生产组件库未写；没有全局安装、提交、推送、发布。本轮维护打包读取新generate主题令牌是开发期动作，运行skill已内嵌不依赖该目录。
三轴自检：本批约定切片需求PASS、计划一致性PASS（原生先支持object3d，其他明确未实现）、资料与实现一致性PASS于已验证范围；整体12项PARTIAL，不宣告整体GO。原始计划的动态组件/资产/完整自动入库能力仍PENDING。

## 10. 复核与下一步
独立review读取本Spec第4–9节，审查默认profile改变、旧兼容、runtime打包、直接TS构建与源码边界、真实库副本及文档精简。可追加结果到本文件，保留历史；不修改实现、不写旧目录或生产库、不代签视觉。审查不得用静态模板通过推导扫光/地图适配已经完成。
下一单元优先完成第二种借用宿主效果的原生模板及资源契约，然后M3自动接纳和文档，最后M4同步与E2E。先处理本批review实际问题，不重复迁移M0或重写历史Spec。

## 11. 本轮原生组件独立Review（2026-11-12）
使用sdd-riper-one，Phase Review；审查8–10节及本批限定Object3D切片。独立证据native-work/independent-review。只追加本Spec和独立证据，不修改实现、旧仓或生产库，不发布、不代签视觉。

### 11.1 RN11-1（P2阻塞）：类型依赖可越过组件边界，源码ZIP不独立
具体位置：tools/3d-component-studio/native-template/example/build.mjs:23–24在包含example的完整stage执行tsc；:28先transformWithEsbuild擦除类型再检查JS依赖；:29仅归档component文件。类型检查能读取stage中的example类型，运行时依赖图却已看不到它，导致错误通过。
独立复现：本轮真实init默认native-object至type-probe；在example/external.ts写DemoOnly接口，组件入口追加 `export type {DemoOnly} from '../../example/external';`。实际执行example/build.mjs --export-component退出0并产生ZIP（type-leak.log）。独立读取该ZIP：src/index.ts保留这条外部类型引用，文件列表没有example/external.ts（type-leak.json）。因此消费者拿到源码包后无法解析该类型，违反源码闭包与“不引用example”的契约。不是测试摘要推断，也不是未实现的其他宿主能力。
关闭条件：在原TS依赖层检查import type/export type/import类型表达式及相关类型引用，禁止越到example或未声明依赖；或用真正隔离的组件编译环境证明完整源码闭包。新增类型越界负例及包解包后独立tsc/声明生成验证，确保没有借演示文件或演示依赖完成检查。保留现有运行时边界和失败不改HTML。不能只增加运行时import负例或把类型擦除后无引用当完整独立性。

### 11.2 本轮实际通过与边界
- native-boundary本轮真实初始化/构建/源码导出，5类现有负例及旧HTML保持、ZIP原字节和无example/vendor/node_modules断言通过（boundary.log）。该测试没有类型-only越界用例，故不覆盖RN11-1。
- native-browser本轮默认profile初始化，实际离线Edge右侧面板/主题令牌、数值颜色更新/reset、JSON往返、数组输入保护、延迟导入不覆盖新输入、窄屏抽屉/Escape及释放通过，panel.log与panel子目录留证。技术布局断言不代签视觉或Octo。
- 显式legacy的component-boundary全套本轮通过，保留演示ZIP往返、资源/模块负例、解包URL和双宿主释放；package19/19通过。目录分配维护测试本轮通过，directory.log留证。新默认与legacy区分明确，不把其他宿主模板计作已实施。
- 检查原生index.ts的输入合并前校验、幂等dispose与宿主资源边界。独立重跑library-native-runtime，输出仅重定向本轮目录：库真实副本src/core/authored-component两TS与最新模板逐字节一致，ESM/CJS两宿主、初始/更新尺寸、非法输入保护、重复销毁和声明包含类名通过，library-result.json。本轮没有重建整个库；基线/加入后tsc及Vite构建日志属于执行方证据，不冒称独立重跑。该立方体接纳证据不能消除通用类型闭包反例。
- 阅读native-contract与common/geographic文档差异：保留Object3D当前支持范围、目标库实际副本验证、peer依赖/宿主所有权、地图联网/投影/映射限制和旧工程不自动覆盖规则，未发现因精简而把本轮未实施自动入库或生成器同步写成已支持。后续类型模板、自动入库、文档生成及完整E2E仍按9节PENDING。

### 11.3 三轴矩阵与结论
|三轴|本批|
|---|---|
|需求完成度|PARTIAL：默认native/面板/限定库接纳有证据，源码类型闭包有实际缺口|
|计划一致性|PASS：支持Object3D切片并保留legacy，后续工作明确未实施|
|产物内在质量|PARTIAL：既有回归通过，类型依赖负例漏检|

Overall Verdict：本批NO-GO（不通过），唯一新确认阻塞RN11-1。Plan-Execution Diff：对TS转译后的JS依赖图检查不足以满足原生源码独立性，需要原始类型依赖或隔离编译证据。修复后定向复审，不重做正确面板/legacy流程；整体12项仍PARTIAL。未验证全部TS类型语法/其他宿主/实际Octo/用户视觉，不因这些未测项自动新增缺陷。仅追加Spec与独立证据，历史保留并回读确认。
## 12. RN11-1类型闭包整改（2026-11-12）
用户NO-GO修复授权。原TS在转译前使用TypeScript AST核对import/export、import类型表达式、import-equals、模块扩展及三斜线path/types指令。只允许component/src内实际源文件和声明的three peer；拒绝越界及其他类型包。保持既有运行时检查。新增真实类型越界负例、内部类型正例，并把实际源码ZIP解压到无演示的新工程，仅安装声明peer和TS检查依赖执行独立声明编译。修改维护源后重新pack runtime；独立证据在native-work/rn11-fix，不覆盖review。只修本批阻塞，不推进M3/M4。

整改正例发现现有Rollup把纯类型文件的EMPTY_BUNDLE警告当错误，导致合法内部类型模块导出失败。仅允许EMPTY_BUNDLE，保留其余警告阻塞；原TS闭包及tsc仍必需。增加纯类型模块正例，不通过把类型文件删出ZIP来绕过。

### 12.1 实施与关闭证据
新增维护check-types.mjs，在tsc/esbuild之前遍历原TS AST；import/export（含type修饰）、import类型表达式、import-equals、模块扩展及三斜线path/types引用均核对到组件源集合或已声明Three依赖，peer子路径不允许越界段。保留运行时Rollup边界检查。合法纯类型模块的EMPTY_BUNDLE仅作为无JS产物处理，其他警告仍阻塞。pack生成runtime，不手工双改。
实际测试：native-type-boundary的8类类型负例均以明确类型边界错误拒绝导出，原HTML保持；内部类型import/export/import表达式及纯类型文件正例通过；真实ZIP解压至系统临时目录的全新consumer，只安装three、@types/three、typescript，以types:[]、rootDir和emitDeclarationOnly独立编译并生成声明通过，未读取example或演示安装目录。原字节对照通过。新npm入口test:native-types与README已同步。
现有native-boundary五类运行时负例及合法构建/源码ZIP回归通过；package19/19、runtime46文件校验通过。未改业务组件、UI、新generate、旧仓或生产库；本轮未重复视觉/整个库构建，不借此增加覆盖声明。证据native-work/rn11-fix/result.json、consumer-tsc.log、各负例日志、runtime-regression/result.json及validation.json。首次纯类型正例失败已记录，修复后重新初始化编号工程通过。
三轴自检：RN11-1需求PASS、计划一致性PASS、源码类型闭包质量PASS于已测语法范围。独立复审待确认，不自签本批或整体GO。下一步定向复审11–12节，失败先修复；M3/M4仍未推进。历史已生成工程不会自动升级构建脚本，以上保证适用于本次runtime新建工程或显式更新构建支持的工程。

## 13. RN11-1独立定向复审（2026-11-12）
使用sdd-riper-one，Phase Review，核对11–12节、实际check-types/build及维护断言，再独立复跑。证据native-work/rn11-independent-review；不修改实现、旧目录、生产库或既有证据，不推进后续功能、不代签视觉。

### 13.1 问题及关闭结论
RN11-1关闭，未发现本轮新增技术阻塞。
- native-template/example/build.mjs:25在tsc及esbuild之前调用checkTypeClosure，确实检查未擦除类型的源码。check-types.mjs:6建立实际src源文件集合，:7–14约束相对引用落到集合内或允许的Three peer；:18–24覆盖三斜线path/types、import/export、import类型表达式、import-equals及模块扩展。不是仅检查编译后JS。
- 本轮native-type-boundary实际初始化新工程，8类类型负例均以类型边界错误拒绝，含第11节原export type越界反例；逐次比较原HTML不变。各日志在types子目录，未采信执行方PASS。
- 合法内部import type/export type/import类型表达式及纯类型模块通过；实际导出ZIP中入口原字节保持，解包后声明编译生成包含LocalImport的index.d.ts。EMPTY_BUNDLE仅针对纯类型无JS产物放行，build.mjs:31仍阻塞其他警告，未删除类型文件绕过。
- 真实consumer位于系统临时目录native-type-consumer-Mzec0S，实际从本轮ZIP解压，无example，仅安装three、@types/three及typescript；tsconfig为types:[]、component/src rootDir、emitDeclarationOnly。除重跑维护声明编译外，本轮再次执行tsc --listFilesOnly，475个实际输入均位于该consumer内，无仓库/演示stage/预览依赖目录输入。见consumer-files.log、consumer-audit.json及types/consumer-tsc.log。数量只辅助记录，隔离依据是全部实际路径归属及无演示目录，不是仅凭package声明。

### 13.2 运行时回归与限度
本轮native-boundary重新初始化并真实构建，demo导入、未声明peer、动态import、资源URL、类型错误五类负例均拒绝且HTML保持，合法源码ZIP及原字节通过，runtime/result.json、runtime.log留证。runtime verify46文件通过。说明原运行时检查仍保留，并未用类型检查替代运行时模块/资源约束。
第11节已通过的UI/legacy/目标库对象运行证据保留，本轮未重跑视觉、完整目标库构建或其他宿主。历史生成工程不自动获得新checker；保证限当前runtime新建或显式更新构建支持的项目。未证明任意TS语法、资源加载器或未来扩展宿主的完整覆盖，不将这些未测范围自动判为缺陷。

### 13.3 三轴矩阵与判定
|三轴|本批|
|---|---|
|需求完成度|PASS：原类型越界反例、合法内部类型和真实ZIP隔离声明编译闭环|
|计划一致性|PASS：原TS前置检查，保留运行时边界，不推进后续功能|
|产物内在质量|PASS：正负测试、失败保持、实际编译输入审计及runtime校验通过|

Overall Verdict：本批GO（通过），RN11-1关闭，无新增关闭事项。Plan-Execution Diff：原始TS检查加隔离consumer声明验证符合第12节方案；纯类型EMPTY_BUNDLE例外有正例依据，不是放宽全部警告。整体12项仍按第9节PARTIAL，不能由本批GO推导自动入库/其他模板/生成器同步完成。Resume：定向修复可收口，本轮不推进后续功能。仅追加Spec和独立证据，保留历史并回读确认前缀完整。
## 14. 独立宿主接入与按需动画（2026-11-12）
13节RN11-1独立GO，用户授权开始本单元。默认创作借用现有场景时：原场景只读→真实演示副本→仅在副本接入→导出组件本体；明确要求修改原项目时才局部原地修改，不擅自复制冒充已更新。是否动画由需求决定，扩散/消散等可隐含动画，静态高亮不自动闪烁。没有动画不显示播放控件、不持续RAF。
实施：新增native-host模板，示范借用Mesh的静态轮廓高亮，组件只拥有额外线几何/材质/组，不替换宿主材质；不是扫光或MapLibre适配。显式--animation pulse仅用于需求确实需要动画时的基础脉冲示范，默认none，不自动推断所有附加效果都带动画。动画宿主负责tick和失效调度，暂停/继续/重播/循环仅对动画实例显示。
文件：tools/3d-component-studio/host-template（组件参数、接口和演示），共享native build/checker在pack时生成host运行资源；init支持native-host及可选动画参数；skills/create-3d-component/scripts/copy-host.mjs复制选定场景到新组件example/host，排除依赖/缓存/git/历史/生成预览，不执行来源脚本、不建立链接、不覆盖已有副本、不接受目录包含关系；README/create说明接入代码需按实际接口在副本编写，不把复制当自动适配。
验证：两个不同Three宿主的借用对象/材质/几何保持、开关及重复销毁；静态无播放UI和空闲RAF、动画暂停/重播/循环状态；源码导出不含宿主示例；真实源码副本接纳与类型声明；副本原字节/原源不变、拒绝覆盖/链接/相互嵌套；保留原生类型闭包回归。M3入库和M4同步本批不做。

### 14.1 实施与验证
新增native-host：root/targets/invalidate宿主接口，静态轮廓高亮默认none；显式--animation pulse才显示动画按钮及循环参数。主组件不持有私有RAF，tick返回是否继续；宿主负责帧调度。只创建/销毁额外组、EdgesGeometry和LineBasicMaterial，不改借用材质/几何。syncTargets处理普通Mesh变换，拓扑变化、MapLibre瓦片、蒙皮/实例化几何未自动适配。
copy-host脚本将选定源码复制到example/host，不执行来源脚本、不建立链接；原文件字节及二进制保持，排除依赖/缓存/历史/生成预览。重复覆盖、根及子链接、相互嵌套拒绝。复制不是自动接入；create说明要求LLM按副本真实入口编写宿主适配。没有给出具体用户场景，因此本轮没有改用户地图或声称已经接入其实际场景。
实际验证：host-browser静态无播放按钮、稳定后空闲RAF停止；pulse暂停/继续/短周期完成/重播/循环通过；开关、颜色变更和重复disposeEffect后借用对象属性及父级保持；两模式源码ZIP无example/host且入口原字节。首次浏览器测试range填“.2”被浏览器拒绝，已改测试输入“0.2”后两模式重跑通过，未放松断言。桌面截图已查看，视觉仍待用户确认。
目标库重新真实复制当前源码及依赖，不建共享链接；基线tsc、新增HostHighlight后的tsc、Vite ESM/CJS与声明构建通过。host-library-runtime在两种不同数量/变换宿主、静态/pulse和ESM/CJS分别验证世界矩阵对齐、借用资源不释放、自有资源只释放一次、动画状态及源字节一致，全部通过。生产库src指纹与本批复制前保持一致。
原native-type-boundary通过COMPONENT_PROFILE=native-host复跑8类类型负例、内部类型正例、ZIP独立consumer声明编译通过；三种初始化profile命名/覆盖保护通过；runtime58文件校验通过。维护源host-template的共享build/checker/UI由pack从native模板生成，使用时runtime不依赖维护目录。
证据native-work/host-slice/validation.json，子项browser/result.json、copy-result.json、library-result.json、type-boundary/result.json及构建日志。预览见browser/result.json各project下index.3d.html，分别为host-none-2与host-pulse-2（原首轮样例留存）。
三轴自检：本批静态/按需动画与副本规则覆盖PASS；计划一致性PASS（普通Mesh示范，不冒充地图/扫光）；实现质量PASS于实际两宿主及类型边界范围；待独立review，不自签GO。整体12项仍PARTIAL：M3自动入库/文档与M4同步未实施，真实用户场景/Octo/视觉未代签。原生资源加载器仍不支持，不绕过约束。
恢复入口：审查14节及host/init/copy代码，允许追加review；失败先修复。通过后进入M3自动入库与文档设计实施，仍只在独立副本验证生产写入流程。

## 15. 独立宿主与按需动画批次Review（2026-11-12）
使用sdd-riper-one，Phase Review；核查14节和实际copy-host/init/host组件/演示调度/维护测试。独立证据native-work/host-review。仅追加Spec及独立证据，不修改实现、旧仓、生产库或原报告，不推进M3。

### 15.1 问题与验收结论
未确认本轮技术阻塞，无新增关闭条件。以下结论限普通Three Mesh示范，不代表复制后可自动接入任意场景。
- skills/create-3d-component/scripts/copy-host.mjs:4–11检查祖先/源目录链接、包含关系、目标profile及既有host目录；:12–15先真实复制至暂存，再复核源文件清单/字节，最后rename，receipt标记not-adapted。独立重跑copy-host维护脚本：原文本和二进制保持、副本编辑隔离、重复覆盖拒绝、嵌套/root及子junction拒绝通过，copy.log、copy-result.json留证。未执行来源脚本。测试输出仅重定向独立目录，不改原测试断言。
- host-template/component/src/index.ts:15–21创建自有组、EdgesGeometry/材质；:25同步变换，:35释放自有资源，不替换借用几何/材质。检查实现与独立库运行断言相符：ESM/CJS、1及3个带变换Mesh宿主、世界矩阵对齐、开关、借用资源零dispose、自有资源仅释放一次、原父级保留均通过，library.log/library-result.json。
- 静态与动画区分：组件不持有RAF，tick只返回是否继续；example/main.mjs:12宿主按返回值调度并在停帧时清除lastTime，:26仅pulse建立播放按钮。host-browser本轮真实初始化none/pulse、构建并离线打开，两模式通过。静态无播放按钮且稳定后帧计数不增；pulse暂停帧计数停止、继续、短周期完成、重播、循环有效；颜色/开关/重复disposeEffect保持宿主材质/几何/属性/父级，pageerror=[]。见browser/result.json和截图。短窗口帧计数是本次范围证据，不宣称长时性能验收。
- 两模式实际导出源码ZIP，无example/host，入口与新工程原字节一致。COMPONENT_PROFILE=native-host独立重跑native-type-boundary：8类原TS越界拒绝、内部类型正例、真实ZIP外部consumer独立声明编译通过，types/result.json及日志；未借演示类型闭包放宽RN11条件。

### 15.2 库证据和范围核查
本轮独立执行host-library-runtime，只将结果输出改到host-review；原库副本及历史证据未改。其源码与static-host生成候选逐字节比较通过，声明导出存在。另直接核对当前维护模板：index.ts完全一致；parameters.ts仅模板占位__ANIMATION__与实际初始化none的预期差异，不是接纳时改写。source-audit.json记录原始比较，差异已核对，不将模板占位误判为迁移回退。
生产库未写。本轮未重新构建整个库，基线/新增tsc与Vite日志是执行方既有证据；独立运行验证实际现有ESM/CJS产物和源码绑定，不声称此次重建。对于限定模板接纳证据具有支持力，不外推任意用户宿主兼容。
engineering.md仍明确需syncTargets、拓扑变化需重建，以及MapLibre瓦片/蒙皮/实例化不自动适配。copy-host只生成独立源码副本与not-adapted记录；无具体用户场景，本批没有完成该用户场景的实际接入。对照本批需求不存在应强加的自动适配承诺。

### 15.3 三轴矩阵与判定
|三轴|本批|
|---|---|
|需求完成度|PASS：复制保护、自有资源、静态停帧、显式动画及源码类型闭包有独立证据|
|计划一致性|PASS：普通Mesh限定示范，不把复制等同自动接入，不推进M3|
|产物内在质量|PASS：实际浏览器、双格式双宿主和类型负例/独立声明编译通过|

Overall Verdict：本批GO（通过），无新增关闭事项。Plan-Execution Diff：未发现超出14节限定能力的实质偏差。整体12项仍PARTIAL，自动入库、生成器同步、实际业务场景/Octo及用户视觉不由本结论升级。未测任意并发复制竞态、全部异常构造/GPU/长时运行及特殊Mesh；不因未测自动判失败，也不声称覆盖。本轮仅追加Spec与独立证据，保留历史并回读，不推进M3、不代签视觉、不发布。
## 16. M3 自动入库与库文档（2026-11-12，Execute checkpoint）
第15节独立GO，用户“开始”授权执行既有12项计划的M3。生产3d-components与旧仓只读；仅在新仓维护代码和真实库副本验证。M4生成器同步不在本批。沿用此前Plan Approved，不重复索要批准。
文件计划：tools/3d-component-studio/intake/{core,docs,cli}.mjs，tests/create-3d-component/intake.mjs，技能references的入库使用说明；本节追加验证与剩余范围。生成物及验证记录放native-work/intake。
流程：plan读取候选component/package.json与原始TS，用户显式选择已有分类及公开导出；形成源字节、目标基线、文件操作清单。validate在真实副本执行类型检查、ESM/CJS及声明构建、运行验证并生成文档。apply需显式开发确认和已验证回执，复核候选与目标基线；写入前暂存，异常回滚本批已写文件；不覆盖并发修改。不安装/运行候选package脚本。
边界：当前原生Three、无额外资源的object3d/borrowed-host契约；新分类、依赖变化、删除/重命名须另行计划，不隐式修改package/vite。公开导出从TS验证，由调用方显式选择（避免defaults等通用名字污染分类入口）；组件src原字节复制，非改写适配。更新仅允许本工具登记且生成文件保持原基线的条目；人工补充notes.md不受脚本覆盖。README/design/engineering进入文档资料，自动HTML和索引与人工文件分权。
文档：TS公共签名/TSDoc生成接口，运行编译后的parameters获取实际defaults/controls生成参数表；接纳源代码审查后才执行验证。页面不虚构Demo；接入库现有导航及components.json生成器，已有人工页面不替换。新旧文档冲突应拒绝并报文件。
验收：object3d与borrowed-host各一例通过plan/validate/apply到独立副本，源字节一致、类型/构建/运行和文档索引闭环；重复/更新、公开名冲突、目标或候选变化、失败不写目标、人工资料保持、注入写失败回滚。此处记录的是待执行验收，不是已实现。最终三轴自检及独立review后才决定M3收口；不自动正式入库或发布。

### 16.1 实际实现与边界
维护入口tools/3d-component-studio/intake/cli.mjs，core.mjs负责plan/validate/apply，docs.mjs使用目标库TypeScript读取公共类或函数声明、构造签名、对象参数字段、公共属性/方法及TSDoc。具体源码格式、Three peer与宿主边界沿用原生契约；不自动接纳任意依赖、资源或旧mjs候选。
plan显式选择已有category与公开类/具名工厂函数声明，交互终端可输入分类；非交互缺失分类时列出选择并停止。检查全部现有分类公开名、目标路径和已有登记；未知分类、重分类、改名/删除、被人工修改的受管文件拒绝。源码原字节复制，公开入口只追加指定导出，不将defaults等通用名全部export-star。目标库需已有开发依赖，不在生产目录安装。
validate真实复制当前库与依赖（不建立共享链接），运行目标tsc、Vite ESM/CJS/声明构建、开发提供的运行断言和原库文档索引脚本。原始TS类型边界以及动态import/require、URL资源负例在plan拒绝。组件与测试源码均须开发审查：验证是工作区隔离，不是恶意代码安全沙箱。
apply需要validated回执、显式developer-confirmed、当前候选与目标基线一致。写锁防止本工具相互覆盖；全部前像在写入前取好，逐文件写前再次比较，先暂存后rename；异常只恢复本批仍保持预期内容的文件，保留检测到的外部并发修改。仅清理本批创建的空目录，不递归删除。回执是可信本地审阅材料，不是数字签名。进程强杀/断电不是已实现的文件系统事务恢复，需要先人工核对残留锁和工作区，不宣称任意并发竞态可完全消除。
生成文件分权：src/<category>/<id>/仅TS源码；docs/components/<id>/有接口HTML、原design/engineering、preset覆盖、component-package信息；notes.md由人工维护，更新不覆盖。导航只增加本组件链接，其余内容保持；components.json用库原有生成器重建。docs/intake/<id>.json记录受管文件归属，不混入使用说明正文。参数默认值来自实际编译执行的parameters模块，覆盖preset不暗改源码默认值。文档不虚构Demo，不将同一源码里的字符串枚举展开成字符串方法表。
支持直接component目录及原生源码ZIP解压目录；后者逐项校验component-source-manifest的格式、文件集合、大小和SHA256。清单状态不被自动升级；导出/设计确认/工程验证/发布仍分别记录。验证目录中的changes.md与proposed/可逐文件查看拟应用内容。
使用说明更新在skills/create-3d-component/references/library-intake.md、delivery.md和SKILL.md；维护代码/测试没有搬入skill。runtime58文件verify通过，本批未改运行模板或生成器。

### 16.2 已执行验证与证据
主回归native-work/intake-1794450593297/result.json：native-object与native-host两例真实plan/validate/apply至target副本；各自tsc、Vite双格式和声明、运行参数及生命周期断言通过，源码逐字节保持。未确认apply、重复登记、候选变化、目标变化拒绝。注入第3次写入失败后整体文件基线恢复；写入途中外部修改后检测冲突且保留外部内容，回滚自己的修改。生产库src/docs/scripts及构建配置/锁文件基线保持（不将此解释成历史所有任务无写入证明）。
同目录update-result.json：实际修改默认亮度到0.8，重新验证/应用，源码与自动默认值一致、人工notes保持、导航无重复；重分类、公开名冲突拒绝；故意加入类型错误的候选仅在验证副本失败，目标副本基线不变。
补充边界native-work/intake-1794450073688/plan-boundary-result.json：重导出类的接口、宿主字段及公共/私有字段区分；新分类、原TS类型越界、动态导入、资源URL、peer冲突、junction拒绝且目标保持。字符串枚举不进入对象字段表的断言通过。
同目录export-result.json与exported-component.zip：使用原生build.mjs --export-component实际导出的ZIP解压后成功plan；源码篡改、清单遗漏拒绝；没有运行ZIP中的package脚本。源码ZIP从独立外置构建缓存生成，未在交付目录安装依赖。
浏览器测试使用独立库副本的原文档站，真实Edge打开两页，导航/参数表加载，pageerror为空；已检查截图。发现说明长行溢出后改为正文换行；发现字符串别名不应展开成内建成员后修正。最后的命令行链与最新文档截图补充见下一小节。
首次测试初始化参数写错、写锁误入目标基线，均被实际测试发现并修复；失败目录保留，不用旧PASS替代最新结果。此前intake-1794449851220、intake-1794449905513是失败/中间记录；intake-1794450073688含较早完整回归和定向补充，主回归以1794450593297为准。

### 16.3 最终核对、三轴与恢复入口
最新命令行plan/validate/apply完整执行在intake-1794450593297，cli-final-plan.json及cli-final-validation/{receipt.json,changes.md,proposed/,typecheck.log,build.log,runtime.log,docs.log}留证；apply实际修改的只是独立target副本。最后重新跑浏览器，公共animation属性可见、AnimationMode未展开成字符串成员表，正文换行截图已查看；browser-result.json及*-docs*.png记录当前结果。人工notes保留，全部最终回执操作与target文件逐字节匹配，写锁已释放，生产基线再次保持；final-verification.json绑定当前core/docs/cli版本。
可打开：http://127.0.0.1:17839/#intake-host 与 #intake-object，运行的是本批库副本文档站。验证步骤：分别点击两个分类条目，查看构造/字段/方法及默认值；HostHighlight亮度默认值为0.8（用于本批更新测试），人工补充链接内容保持。这里没有新增业务效果演示，不以文档页冒充组件视觉验收。服务关闭后从该target目录执行node node_modules/vite/bin/vite.js docs --host 127.0.0.1 --port 17839 --strictPort。
|三轴|本批自检|
|---|---|
|需求完成度|PASS于本节范围：两类原生模板、自动接纳/更新、冲突保护、源码原字节、库说明与人工资料分权、真实ZIP核验|
|计划一致性|PASS：仅维护代码和独立副本，未向生产库apply，未同步生成器，不隐式新增分类/依赖|
|产物内在质量|PASS于已测范围：原TS边界、实际类型/双格式/声明/生命周期、失败回退/并发修改、文档浏览器与最终字节复核|
仍需独立review，本节不自签本批或12项整体GO。具名工厂函数支持接口读取，但本批完整构建/运行样本是两个类模板；任意新组件仍需自己的行为断言。完整任意地图宿主、资源加载器、全部TS语法、恶意源码、进程崩溃恢复及跨工具瞬时竞态没有被本批证明；不将这些限度伪装成已实现保证。
未做：生产接纳/发布、M4生成器依赖及目录/使用文档同步、用户业务组件的功能验收、视觉代签。没有修改旧仓或生产库，没有提交/推送/全局安装。下一步先独立review第16节和实际工具；NO-GO继续修复，GO后再讨论/执行M4，不因本批自检自动推进。

## 17. M3 独立 Review（2026-11-12）

使用 sdd-riper-one，Phase Review。依据第4节第8–9项 Done Contract、第16节计划与实际实现，独立读取 intake/core.mjs、docs.mjs、cli.mjs、维护测试及使用说明；重跑验证并增加反例。仅追加本Spec及 native-work/m3-independent-review 独立证据，未修改实现、旧仓或生产库，不推进M4、不发布或代签视觉。

### 17.1 阻塞问题 RN17-1（P1）：更新会接管并覆盖未登记的既存源码

要求：本Spec第41行要求“冲突停止不覆盖他人修改”，第44行要求生成/人工内容有所有权；第16节承诺文件冲突保护。

代码证据（相对仓库根）：
- tools/3d-component-studio/intake/core.mjs:59–65：更新仅检查 prior.owned 中既有文件的哈希；目录已存在检查只适用于首次接纳。
- 同文件:80–81：将候选全部源码加入 operations，没有检查新目的文件是否已存在且不属于 prior.owned；仅检测旧源码删除。
- 同文件:96、100–101：plan把已存在的人工文件纳入当前目标基线，因此后续基线校验不能识别所有权冲突。
- 同文件:165、173、181：apply只比较计划后的变化，正常路径会rename覆盖该文件；备份仅在抛错时恢复。本反例不会抛错。

本轮实际复现：正常接纳并更新 intake-host 后，在独立目标 src/helper/intake-host/extra.ts 写入 `export const manualValue = "maintainer-only";`（登记表没有此文件）；候选新增同名文件，内容为 `export const incomingValue = "candidate";`。正常 --update 计划接受；真实副本类型、ESM/CJS/声明构建、运行断言均通过；显式 apply 成功，人工原内容被候选内容替换。没有修改回执、没有使用 onWrite 注入、没有竞态或恶意代码。拟变更清单可以展示该修改，但并未按契约停止冲突，通用 developer-confirmed 不等于单独批准接管该文件。

独立证据：native-work/m3-independent-review/collision-probe.mjs:7–18、collision-plan.json、collision-result.json:2–8；完整验证日志、receipt和拟应用内容在 run/collision-validation/。维护测试 intake.mjs:28–33 检查 notes 和已登记文件人工修改，intake-update.mjs:13–17 检查重分类、公开名冲突和类型失败，未覆盖“未登记既存路径与候选新增文件重名”。

关闭条件：对组件私有源/生成文档目的路径做所有权预检；新增受管文件若目的路径已存在且不在原登记中，默认拒绝并指出文件，不能靠重新plan把它吸收进基线。若未来允许接管，应另有明确、逐文件的批准机制，本批可直接拒绝。补充上述完整反例及对应文档路径冲突测试，证明拒绝后源码、文档、登记、notes和目标基线不变；同时保留合法新增文件、正常更新和失败回滚通过。本轮未实施修复。

### 17.2 保留的通过结论与证据

|核查项|本轮结果与实际依据|
|---|---|
|原字节接纳、分类公开导出|PASS。重跑 intake.mjs 两类模板；独立 audit.mjs 比较 payload 内全部 src 文件与拟入库字节，检查分类仅导出指定类。见 run/result.json、independent-audit.json；core.mjs:80、84、125–127。|
|真实副本验证|PASS。从当前生产库真实复制源码和依赖，未建立共享链接；两类 tsc、Vite ESM/CJS/声明及运行生命周期断言完成。各 run/*-validation/{typecheck,build,runtime,docs}.log 为本轮日志。runtime测试明确只证明这两个模板，未冒充任意新组件行为验证。|
|候选/目标变化、失败回退|PASS于既有覆盖。重跑未确认apply、重复接纳、候选变化、目标变化、第三次写入失败回滚、写入期间外部修改保留及已登记源码修改拒绝；core.mjs:98–101、155–185。RN17-1是另一种未登记路径冲突，不撤销这些已测保护。|
|更新默认值与人工notes|PASS。重跑 intake-update.mjs，实际 opacity 默认由1变0.8，生成HTML含0.8，源码字节相等、人工notes保留、导航单条；错误类型仅在副本失败，目标不变。run/update-result.json及update-validation/、failed-validation/typecheck.log。默认来源为 core.mjs:128–134、docs.mjs:40–44 的实际模块值，并明确区分preset覆盖。|
|原始TS与接纳边界|PASS。重跑 intake-plan-boundary.mjs：重导出API、宿主字段、公共/私有字段、字符串枚举，以及未知分类、动态导入、类型越界、资源URL、peer不符、junction拒绝。run/plan-boundary-result.json。|
|实际ZIP及清单|PASS。重跑 intake-export.mjs，读取既有真实 exported-component.zip，当前工具解包计划接受，源码篡改和清单遗漏拒绝；独立 manifest-probe.mjs 另验证重复项、字节数、SHA256、未列入清单的文件全部拒绝。run/export-result.json、manifest-negative-results.json；core.mjs:43–47。本轮没有重新生成该历史ZIP，结论是当前入库器对该真实包的验证。|
|状态和边界|接纳/副本验证不等于生产发布或用户设计确认；支持范围限定原生无资源两宿主与既定peer。M4、任意资源/依赖、新分类、任意宿主和生产apply均未升级为已实现能力。|

本轮维护测试均实际运行，不用原执行方PASS代替。collision-probe进程退出0表示反例被成功复现，不能统计成产品通过。生产库src/docs/scripts及配置锁文件基线与主测试起始基线一致；实施文件core/docs/cli与本轮审查指纹一致，见final-verification.json。该基线证明限定于所列文件范围，不推导整个历史或所有磁盘均无写入。

### 17.3 Review Matrix 与结论

|轴|结论|依据|
|---|---|---|
|需求完成度|PARTIAL|正常原字节接纳、两类副本验证、清单、文档和已测失败保护通过；未登记既存路径冲突不能停止。|
|计划一致性|FAIL|RN17-1与第4节“冲突停止不覆盖他人修改”存在实际行为差异；未发现擅自生产接纳或推进M4。|
|产物内在质量|FAIL|可重复导致人工源码被覆盖；现有测试缺少这一所有权边界，其余本轮覆盖有效。|

**Overall Verdict：本批M3 NO-GO（不通过）。唯一确认的技术阻塞为RN17-1，须按17.1关闭；不否定17.2已验证能力，不因未全量重测历史而判失败。**

Plan-Execution Diff：更新路径校验遗漏“新增候选文件撞到未登记既存文件”，当前目标基线保护无法替代受管文件所有权检查。恢复入口：先定向修复RN17-1并复审，通过前不推进M4。

未核查/保留边界：本轮未重跑文档浏览器呈现、历史UI/视觉、任意工厂函数完整行为、所有TS语法、恶意源码沙箱、断电/强杀恢复或跨工具瞬时竞态；不据此另增阻塞，也不签这些能力通过。用户视觉与业务功能必要性仍由用户决定。仅review及证据写入，历史保留。

## 18. RN17-1 定向修复计划（2026-11-12）
第17节M3 NO-GO，用户授权修复。沿用sdd-riper-one：Research已核实未登记既存目的路径会被更新覆盖；本节先落计划再实施。仅修改新仓入库工具、维护测试和使用说明，生产库/旧仓只读，不推进M4。
修改core.mjs：对组件私有src及生成文档的所有拟写路径检查原登记归属，包含validate后才生成的index.html；已有路径无原owned登记一律拒绝，连同内容相同也不自动接管。plan先拒绝；verifyPlan在validate/apply复核，使旧计划/回执不能绕过修复。不新增强制覆盖或接管开关。
新增定向测试：真实独立副本复现extra.ts人工文件与新增源码重名；对应早期及延迟生成文档路径冲突；拒绝后整个目标基线（含源码/文档/登记/notes）不变；同字节碰撞也拒绝；合法新文件真实编译、构建和运行、正常更新及注入失败回滚继续通过。保留第17节已通过结论，不无差别重做历史UI/地图测试。
用户验收分工纠正：M3是维护工具与工程资料验收，不是新增视觉效果验收。组件文档预览仅供用户可选评价说明可读性，不作为要求用户判断源码、哈希、构建或入库安全的门禁。本轮用户无新增视觉确认项；独立review通过后再继续后续步骤。

### 18.1 修复与实测结果
core.mjs:97在plan返回前调用checkOwnership；:102–114读取当前原登记，对拟写的组件私有源码/文档逐路径检查，额外提前覆盖延迟生成的index.html；未登记且存在的路径一律报冲突，内容相同不例外。:119在verifyPlan复核，覆盖validate及apply，也阻止旧计划把人工文件吸收进当前基线后继续使用。共享分类入口/导航/聚合索引仍按原有明确操作维护，notes继续由人维护，不增加覆盖授权开关。
新增tests/create-3d-component/intake-ownership.mjs，使用此前通过的库副本再建立新的真实副本，证据native-work/rn17-fix/result.json。原审查的extra.ts人工源码碰撞及同字节碰撞均拒绝；component-package.json、preset.json、index.html三种未归属文档fixture均拒绝，每项拒绝后整个target基线保持，覆盖源码/文档/登记/notes。文档fixture明确通过构造未归属既存文件状态验证，不冒称来自自然发生的历史升级。
模拟旧planner已把碰撞纳入基线的计划，在validate前仍被拒绝，验证目录未创建。移除测试制造的冲突、恢复原登记后，合法新增extra.ts经过实际tsc、Vite双格式/声明、运行断言及文档生成；注入写入失败后目标完整基线恢复且新增文件不存在；再次apply成功，源字节一致、登记包含新文件、notes保持，后续正常update计划被接受。生产库所列src/docs/scripts/配置锁文件基线测试起终一致，无生产apply。
本批使用说明同步library-intake.md与维护README。未改文档页面生成实现或组件视觉；第17.2既有通过结论保留，本轮未重跑历史浏览器/地图视觉，不要求用户为本维护修复额外做视觉验收。
三轴自检：RN17-1需求覆盖PASS（原反例、同字节、早期/延迟文档路径、旧计划复核、正常新增/更新/回退）；计划一致性PASS（仅归属保护、无强制接管、生产只读、不推进M4）；实现质量PASS于本轮实测范围。独立复审待完成，不自行将第17节NO-GO改成整体GO。
恢复入口：review第17–18节、checkOwnership及intake-ownership测试；允许另存独立证据并追加Spec。用户当前只需安排独立技术复审，无新增视觉或业务取舍待确认项。

## 19. RN17-1 独立定向复审（2026-11-12）

使用 sdd-riper-one，Phase Review。依据第17节关闭条件与第18节修复，读取实际 core.mjs、维护测试、使用说明及 native-work/rn17-fix 的result/plan/验证证据。本轮重新执行维护测试并另写旧回执反例，不以原执行方PASS代替验证。独立证据目录：native-work/rn17-independent-review。仅追加Spec及独立证据，不改实现、旧仓或生产库，不推进M4。

### 19.1 问题关闭：RN17-1 CLOSED

未发现本次修复新增的确认问题或未满足关闭条件。具体证据（代码路径相对仓库根）：

|关闭条件|独立复核与结论|
|---|---|
|未登记既存源码冲突拒绝，包括同字节|PASS。tools/3d-component-studio/intake/core.mjs:97、102–114 在plan结束前查当前原登记及目的路径；使用lstat判断存在，内容相同也不自动取得所有权。重跑 tests/create-3d-component/intake-ownership.mjs:18–31，原extra.ts反例与同字节碰撞均指出路径并拒绝，目标基线不变。|
|生成文档冲突及延迟HTML覆盖|PASS。core.mjs:105显式加入尚未生成的index.html，其他私有拟写路径统一检查。维护测试:33–39独立复测component-package.json、preset.json、index.html未归属既存文件，全部拒绝且全目标基线保持。文档测试明确为删除登记归属后构造的fixture，不冒充自然升级历史。|
|旧计划不能绕过|PASS。core.mjs:115–119将所有权复核加入verifyPlan；validate:129及apply:175、180、185复用。维护测试:27–29模拟旧planner已吸收冲突文件的目标基线，validate仍拒绝且不创建验证目录。|
|旧validated回执不能直接apply绕过|PASS。本轮额外 legacy-probe.mjs 使用第17节真实反例的旧receipt，保留原拟写操作及payloadDigest，仅重定位独立目标副本并更新基线以模拟旧planner。对源码extra.ts及上述三类文档分别调用validate/apply，8个实际调用均因所有权冲突拒绝；不是因缺参数、旧基线或摘要错误而碰巧失败。每次目标全基线相等、无锁残留；validate没有创建工作目录。见legacy-receipt-results.json。|
|合法新增、更新及失败回退|PASS。维护测试:41–50在独立真实库副本新增extra.ts，实际tsc、Vite ESM/CJS与声明构建、运行参数及生命周期断言、文档索引均通过。apply注入写失败后基线恢复、新文件不存在；再次正常apply成功，源码原字节相等、登记SHA256正确、notes保持，后续正常update计划接受。见run/result.json及run/validation/日志。|

本轮实际命令：`node tests/create-3d-component/intake-ownership.mjs docs/create-3d-component/native-work/intake-1794450593297 docs/create-3d-component/native-work/rn17-independent-review/run`（实际调用使用绝对路径）；以及独立目录中的 `legacy-probe.mjs`、`audit.mjs`。三者退出码均为0。维护测试使用既有有效目标库副本作为种子，重新建立真实副本，不覆盖原执行证据；生产库仅用于只读基线核对，起终一致。

### 19.2 回归范围与历史结论

code-audit.json记录当前core/docs/cli指纹。docs.mjs、cli.mjs与第17节审查指纹相同；在内存中仅移除本次所有权函数与调用、恢复原return写法后，core字节SHA256与第17节旧版本完全一致。这支持保留17.2既有源码入库、ZIP清单、默认值文档、分类、旧失败保护等通过结论，而非凭执行方自述假定无回退。

本次实际运行的正常更新是“已有组件增加合法源码文件”完整validate/apply；后续再更新验证到plan接受。默认值变化、两类首次入库及历史ZIP负例不作本轮重跑声明，保留第17.2实测结论。此次额外旧回执测试针对源码与文档两类所有权，不将可信本地回执当安全签名，也不扩大为抵御恶意篡改计划保证。

### 19.3 Review Matrix 与结论

|轴|结论|证据|
|---|---|---|
|需求完成度|PASS|RN17-1源码、生成文档、同字节、旧计划/回执、目标保持及合法新增/更新/回退关闭条件均满足。|
|计划一致性|PASS|仅增加第18节计划内所有权保护，无强制接管开关；独立副本验证，不推进M4。|
|产物内在质量|PASS（本批范围）|计划与执行入口均复核，实际旧回执无法绕过；正常构建应用与失败恢复通过，测试边界明确。|

**Overall Verdict：本批GO（通过），RN17-1已关闭。结合第17.2保留的通过结论，M3第16节限定的技术验收可闭环；不等于十二项总体完成、生产接纳或发布。**

Plan-Execution Diff：未发现本次修复相对第18节计划的实质偏差；独立review补充旧validated回执的apply及三类文档拒绝测试，未修改实现。无新增技术阻塞、无新增用户视觉确认项。历史第17节NO-GO保留，由本节记录问题关闭，不重写历史。

未重测浏览器视觉、任意工厂/资源/宿主、恶意源码、断电恢复和跨工具瞬时竞态，沿用既有范围声明，不因这些未重测项自动判失败。本轮不改实现、生产库或旧仓、不推进M4、不发布。追加后回读验证见final-verification.json。

## 20. M4 生成器同步与实际消费（2026-11-12，执行计划）
第19节独立GO关闭M3，用户授权下一步。按既有Plan Approved进入M4；新仓实现，生产库/旧仓只读，测试组件包只同步到独立真实skill副本，不把模板候选发布到正式skill目录。M4包括第4节第10项及相关使用说明，最后独立review；E2E总体状态单列，不由本批自动升级发布。
现状：sync-components在源仓构建/pack，先替换vendor包再做TypeDoc门禁；失败可能包与文档错配，docs-only只按文件名猜版本，源仓路径有旧布局猜测；类导出目录为主，未知宿主不能自动注册为可编辑场景。
文件计划：重构scripts/sync-components.mjs为显式src/target/work的准备与确认应用入口；scripts/lib下隔离构建/文档生成及同步事务；references/component-sync.md说明维护流程与各状态，catalog生成模板使用简洁用法，不复制维护审计正文。必要的Object3D与借用宿主适配示例/测试仅依照当前NodeFactory与SceneHandle接口，不改核心引擎，不猜未知组件业务语义。
同步约束：真实副本构建包、源API和使用说明；原生入库记录与受管源码/文档须一致；统一生成包、components.json、catalog/用法页和机器清单，准备阶段不写目标。应用前核对源及目标基线，全部变更有原像、冲突拒绝、失败回退；旧文件删除仅限已有归属，未登记的同名人工文档拒绝。首次接管原脚本生成区需显式选择并列明范围，不自动覆盖用户文档。禁用只凭旧tgz名称的docs-only，不假装安全同步。显式源库路径和目标skill路径，不再猜旧相对位置。
验证：在已接纳两模板的库副本与最新生成器真实副本跑同步；包/源码/说明绑定核验，缺文档/目标或源变化/人工冲突/注入写失败不得留下混合版本。通过现有init --with-components及统一build-offline生成新工程，实际使用两类组件；维护场景验证创建、参数更新、销毁、适用保存重载及冲突。包可见、文档可读、场景可创建、编辑保存分别记录。普通生成不增加维护审查步骤；本批作为维护验证可运行浏览器/接口测试，不代签用户审美。


## 21. M4 执行结果与待独立审查（2026-11-12）
Phase：Execute完成，进入Review；依据第19节GO和用户“review通过，进行下一步”执行第20节。本批自检通过，独立review待进行；不自行宣告M4独立GO或十二项总体完成。

### 21.1 实际变更
- generate-3d-scene/scripts/sync-components.mjs改为明确src/target/work的prepare与显式confirmed apply；lib/component-sync.mjs负责独立副本、入库归属核查、包文件比对、源/目标基线、写前核对及失败回退；lib/sync-components-stage.mjs仅运行在有标记的临时副本内，使用TypeScript真实公共导出与TypeDoc生成类/工厂使用页。
- 包、参数索引、catalog、使用页、vendor/components-sync.json由同次构建准备；禁用docs-only，不凭旧tgz名称猜匹配。archive验证运行模块、类型及参数索引字节，排除包本来不发布的可选source map。
- 首次旧生成区需显式adopt-generated并列出文件；已有清单禁止再次接管；人工同名文档拒绝覆盖。机器记录与用户使用说明分离。原生组件默认值来自受核验的参数文档，不从过期注释推断。
- 新增references/component-sync.md，SKILL按需维护入口及create的library-intake.md衔接。明确同步不生成任意业务handler，不自动更新领域设计方案；组件可选依赖须按所用入口在消费工程明确声明。
- 维护tests新增component-sync、component-sync-update、component-sync-doc-failure、synced-scene、synced-browser和两个适配fixture。普通生成不增加每次截图、维护报告或额外验收要求。

### 21.2 验证证据
证据根：docs/create-3d-component/native-work/m4-sync-final。入口validation.md；生产库、旧仓只读。测试沿用M3已接纳两模板的真实库副本，再建立独立源库和skill副本；没有把测试包同步进正式generate的vendor/catalog。

|检查|实际结果与证据|
|---|---|
|首次准备与应用|result.json：准备前后源/目标基线相同；无确认拒绝、目标变化拒绝、写失败回退、正常应用通过。prepare保存拟写内容、计划、构建日志及package-check.json。|
|更新与所有权|update-result.json：受管源码变化拒绝、准备后源变化拒绝；模拟已刷新基线的人工页同名冲突仍拒绝并保留内容；更新写失败回退后正常应用；createSyncExample工厂使用页和构建后实际实例化通过。|
|缺文档失败|missing-doc-result.json及missing-doc-prepare/build-docs.log：新增UndocumentedSync导出类完成真实构建/pack后被TSDoc门禁拒绝，目标全基线不变。临时源改动已恢复。|
|真实生成消费|scene-build.log：原init --with-components产生工程、原统一build-offline完成两节点装配、TS检查和离线构建。scene.json记录实际路径。core/helper均来自同步后的tgz，不引用候选源码绕过入库。|
|实际编辑页面与保存|browser-result.json：Edge离线页面创建/参数更新、效果开关与借用材质几何保持；实际SaveService.save生成before/after修改清单(saved-changes.json)，实际encode快照写文件(saved-scene.json)，关页重开后importText恢复；异源快照拒绝且场景不变。|
|生命周期与画面|两个节点删除后6项几何/材质dispose各1次，无页面异常；scene.png已实际查看，两个模板及编辑器可见。不是地图、扫光或用户审美验收。|

Object3D适配针对已审查模板：其网格资源由SceneEngine登记释放，不再调用standalone dispose重复释放；该模板没有需另清理的计时器/订阅。借用宿主效果自己释放LineSegments，宿主Mesh仍由引擎释放。未知组件必须另核对清理责任，不能泛化为自动适配所有组件。
保存边界：离线“保存”输出待写回修改清单；导入恢复用真实SaveService，不宣称已自动写入source或验证服务端保存。未实现任意业务参数自动生成编辑器属性面板，本轮通过handle接口更新params。包清单的scene/editor仍为not-verified；两模板的场景实证单列，不将整库所有组件升级为已验证。

### 21.3 执行偏差与修正
初次包校验将exports通配dist/*当普通文件，已修正为逐文件展开；首次失败证据保留在native-work/m4-sync。后续首次与更新同步通过。TypeDoc枚举改取实际ReflectionKind，并涵盖有文档的工厂函数。
实际生成首次因本机内网npm镜像ENOTFOUND失败；npm_config_registry不能覆盖生成器明确传入的registry，改用已有SCENE3D_REGISTRY进程级设置后安装成功，没有改全局配置或强制忽略peer冲突。装配随后暴露core入口的可选依赖未安装，维护场景明确声明gsap/three-bvh-csg/three-mesh-bvh后通过。消费fixture修正登记正则、重复登记、可选参数TS类型及empty profile误用普通模板的问题；未修改引擎或校验器降低标准。最终日志为成功运行；中间部分构建日志被同名维护日志覆盖，不宣称留存每次原始输出。此处为有界维护调试，不作为普通生成反复试错的工作流示例。
已有其他工作区改动（含build-guard相关文件）未覆盖或归入本批。未自动提交、推送、全局安装或发布。

### 21.4 三轴自检、状态与恢复入口
|轴|自检|依据/剩余|
|---|---|---|
|需求完成度|本批PASS，整体待收口|同步与适用生成/保存有实证；任意宿主不承诺，E2E总体及用户确认单列。|
|计划一致性|PASS|按第20节实施，真实副本验证，正式vendor和生产库未接入测试资产；没有改核心引擎。|
|产物内在质量|本批PASS，独立待审|人工归属/旧基线/缺文档/写失败保护和真实页面通过；不承诺断电事务或恶意源码防护。|
本批状态：READY FOR REVIEW。M0–M3保留此前独立结论；M4待独立review，不提前推进总体E2E收口或发布。下一步由独立LLM审查第20–21节与实现；NO-GO修复，GO后整理第12项完整链路和仍需用户确认事项。
用户这批不需要判断代码、哈希或模板审美；可选查看validation.md及synced-scene-3/index.3d.html了解组件已进入实际生成页面。仍需用户的设计确认不能由维护立方体截图替代。未定义新的项目知识入口，不新建AGENTS或复制审计内容到日常指南。

## 22. M4 独立 Review（2026-11-12）

使用 sdd-riper-one，Phase Review。依据第4节第10项、20节计划、21节实际范围，核查同步脚本、两类维护适配、真实生成器及测试。读取 m4-sync-final/validation.md 及其证据后，在 native-work/m4-independent-review 全新目录重跑；不覆盖原证据，不改实现、生产组件库或旧仓，不发布或代签视觉。

### 22.1 阻塞 RN22-1（P1）：被拒绝的参数更新/同源导入污染场景及可保存状态

这是本轮真实生成页面复现的消费集成缺口，不是同步包错版，也不宣称由本批修改引擎所引入。对应第4节第10项及第20节要求的实际参数修改、保存恢复和冲突验证：不能在操作报错后留下渲染与序列化不一致，或保存一份当前组件根本不能接受的快照。

代码证据（以下相对仓库根）：
- tests/create-3d-component/fixtures/synced-handler.ts:16–18、36–38 将新params直接交给两个组件的setOptions；组件会正确拒绝越界参数。
- skills/generate-3d-scene/template/src/scene3d/scene-core/engine/SceneEngine.ts:872 在factory.update之前提交entry.node；:880–882调用工厂后若抛错，没有恢复前一节点值。
- skills/generate-3d-scene/template/src/edit/SaveService.ts:68–144检查封装、来源、分组和资源后调用bridge.restoreSnapshot；没有在提交前验证两类组件参数。Bridge.ts:239–243先入历史再apply，:297–298将导入交给该路径；失败不会回退已更新节点。
- tests/create-3d-component/synced-browser.mjs:15–20只有合法参数；:28–31对恢复仅检查object序列化size并验证异源拒绝，没有同源非法参数和多节点中途失败断言。因此其PASS不能证明这些失败保护。

本轮复现（使用本轮同步tgz、init与build-offline新生成的run/synced-scene/index.3d.html）：
1. `patchNodeParams('object_1',{size:99})` 抛“尺寸范围为0.5–2”，但serialize及SaveService.encode里的size变为99；实际对象getOptions和网格scale仍为1.5。
2. `patchNodeParams('effect_1',{opacity:2})` 抛“亮度范围0–1”，serialize/encode的opacity变为2，实际线材质仍为0.8。
3. 将同源encode快照中的object.size改为99后importText，抛错但序列化仍被污染。
4. 同源快照同时修改object.size=1.7（合法）和effect.opacity=2（非法）：导入报错后，前一个对象已真实变成1.7，后一个序列化为2而实际仍0.8，留下部分应用状态。

证据：native-work/m4-independent-review/failure-summary.json:3–28、current-page-probe.json、extra-page-results.json；复现脚本browser-probe.mjs和extra-browser-probe.mjs。template-binding.json核对相关模板与本轮生成源码逐字节一致。较早对历史页面的探索结果单独保存在historical-page-probe.json；本结论依据本轮重新构建页面，不以旧页面代替当前版本。上述脚本退出0表示成功记录反例，不表示产品失败路径通过；pageerror为空也不能抵消已捕获异常后的状态污染。

关闭条件：在本批两类适配的实际编辑/导入路径中，提交前完成参数验证，或提供完整事务回退；不能只恢复画面而留下serialize/encode错误。补充两类越界更新、同源非法快照、多节点后项失败；拒绝后live、serialize、encode及适用dirty/历史状态保持，随后合法编辑、保存/关页重开恢复正常。可做有界接入修复，不要求无差别重写所有引擎功能，但不得仅补报告或捕获异常继续宣称通过。本轮未修实现。

### 22.2 非阻塞证据限定 N22-1：保存API测试不等于工具栏编辑链已接通

本轮合法handle.patchNodeParams后，SaveService.dirty仍为false、页面“保存”按钮disabled=true（failure-summary.json:30–33）。原因与证据：SaveService.ts:24–29仅订阅Bridge状态，Toolbar.vue:388依dirty禁用；维护测试synced-browser.mjs:21直接调用save.save()，绕过工具栏。实际SaveService API确实产生修改清单，不是伪造保存结果，但不能将其扩大为业务参数修改自动接通工具栏/撤销链。

第21节已明确“通过handle更新params、没有自动业务属性面板”，所以本项作为范围限定单列，不要求新增通用参数UI，不据此另设本批阻塞。文档和后续E2E应继续明确本次证明的是API保存；若后续声称业务编辑按钮链通过，应采用明确编辑入口并验证dirty和真实按钮操作。也不将离线修改清单说成源码已经保存。

### 22.3 本轮独立通过项

|检查|本轮实际结果及证据|
|---|---|
|首次同步/确认/目标变化/写失败|重跑component-sync.mjs通过，准备不写源/目标，无confirmed拒绝，目标变化拒绝，第三次写失败恢复全目标基线，正常apply成功且锁释放。run/result.json、sync.log。|
|更新/受管源码/人工归属|重跑component-sync-update.mjs通过：受管源码变化拒绝、准备后源变化拒绝、刷新目标基线仍拒绝人工同名页，更新注入失败回退；工厂说明与实际实例化通过。run/update-result.json、update.log。|
|构建后缺文档失败|重跑component-sync-doc-failure.mjs，实际类型/构建/pack后在TSDoc门禁因UndocumentedSync失败，目标基线不变。不是靠任意错误匹配PASS；已回读missing-doc-prepare/build-docs.log末尾准确原因。测试临时源修改按finally恢复。|
|包/源码/文档/实际消费一致|另执行binding-audit.mjs，逐项核对目标manifest文件SHA、当前源基线、生成工程file依赖tgz字节；使用系统tar独立解包，运行模块/类型/参数索引与update-prepare/library本次构建逐文件相同；HostHighlight说明保留真实默认0.8。binding-audit.json、archive/package/。|
|真实生成与正常更新|重跑synced-scene.mjs：副本skill原init --with-components、统一build-offline与TS检查成功；明确声明入口所需可选依赖，进程级SCENE3D_REGISTRY，不改全局设置。两类handler import同步包而非候选源码。run/scene.json、scene-build.log。|
|正常保存/重开/生命周期|重跑synced-browser.mjs通过，实际SaveService修改清单、快照写独立文件、关页重开/导入、异源拒绝、六项资源各释放一次、无pageerror。独立browser-probe另外对恢复后的object尺寸/颜色/网格scale以及effect可见性/颜色/opacity实际值比较通过，补足仅查序列化size的限制。run/browser-result.json、saved-changes.json、saved-scene.json及current-page-probe.json。|
|截图|已实际查看本轮scene.png，页面和两模板可见；不以截图或canvas存在替代功能验证，不代签视觉。|

同步实现静态核查：component-sync.mjs的verifyNative/verifyPrior绑定受管源和目标文件；ownership区分首次显式旧生成区接管与人工冲突；prepare构建在独立副本，verifyArchive检查包内容；prepare前后及apply前基线与逐文件前像检查，异常回滚仅恢复本批仍未被外部改动的文件。目标旧文件删除只限已有同步清单，首次旧包接管显式列明。此次没有发现可复现的同步事务阻塞；不将“未测每一种并发时序”自动算失败。

### 22.4 状态、三轴与结论

|状态|本轮结论|
|---|---|
|同步成功|独立副本准备/应用及包文档绑定PASS；未把测试包应用到正式skill。|
|场景验证|正常两类更新/生命周期/保存恢复PASS，但RN22-1失败状态保护不通过，整体仍PARTIAL。|
|源码写回|未执行。离线SaveService输出before/after修改清单及encode快照，源码文件未因此自动更新；不要求本批补服务端写回来替代既定离线流程。|
|整库编辑/用户设计/发布|同步manifest的scene/editor仍not-verified，publication为unpublished；两模板实证不升级整库，未代签设计或发布。|

|三轴|结论|依据|
|---|---|---|
|需求完成度|PARTIAL|同步链和正常两类消费有独立证据，但失败导入/更新可破坏可保存场景，RN22-1未闭环。|
|计划一致性|PASS（范围）|使用实际同步包和原生成链，范围、离线保存及生产只读边界明确；不要求任意宿主或通用属性UI提前实现。|
|产物内在质量|FAIL|真实生成页面可复现渲染与持久化值分离、多节点失败部分提交，现有PASS测试未覆盖。|

**Overall Verdict：第20–21节合并本批 NO-GO（不通过）；M4整体 NO-GO（不通过）。技术阻塞为RN22-1。** 同步子链通过不等于合并批次通过，N22-1仅为证据范围限定。保留M0–M3及本节通过项，不无差别重做历史；先修复RN22-1再定向复审。

Plan-Execution Diff：未发现同步实现擅自扩展发布/生产写入；实际消费测试的失败保护覆盖不足，正常PASS不能支撑完整保存恢复质量结论。风险来自当前引擎公共路径与本批适配的结合，未把其他既有工作区改动归为本批新增。未重测任意宿主/资源、全部历史组件、并发进程所有时序、断电恢复、服务端源码写回或最终视觉；这些未测项不单独成为NO-GO理由。独立证据保留，追加后回读验证见final-verification.json。


## 23. RN22-1 修复计划（2026-11-12）
依据第22节NO-GO及既有修复授权，回到Research/Plan后执行有界修复；不推进E2E或发布。同步子链保留独立通过结论。本次允许对生成器template新增可选NodeFactoryDefinition.validate及SceneEngine.validateFragment：只对登记校验的工厂预检整批参数，SceneHandle.update在保留区修改前预检，直接applyFragment也预检；Bridge.restoreSnapshot在历史/选择/场景变化前按完整快照语义预检。两模板适配通过隔离临时实例调用组件自身校验并finally释放，不复制业务范围常量。未登记校验的旧工厂维持兼容，不宣称通用事务回滚。测试覆盖两类越界patch、同源非法快照、多节点后项失败、含删除/保留区变化的拒绝；比较live/serialize/encode/dirty/历史，合法更新/关页恢复与释放回归。更新使用说明解释接入责任。仅新仓及新证据目录，生产库/旧仓只读。


## 24. RN22-1 修复结果（2026-11-12，待独立复审）
第22节NO-GO保留。本批仅修复参数拒绝后的消费状态污染；第22.3节同步子链独立通过项保留，未重跑或更改同步实现。Phase：Review；本批自检PASS，RN22-1待独立确认关闭，M4整体不自行升级GO。

### 24.1 改动与关闭证据
1. template/src/scene3d/scene-core/types.ts:416新增可选validate(next)，要求预检不修改live、不保留资源。SceneEngine.ts:729新增整批预检，片段合并既有节点、快照仅用输入节点；:742在直接applyFragment任何删除/更新前执行。createScene.ts:490在相机、环境等保留区变更前预检。
2. template/src/edit/Bridge.ts:298在restoreSnapshot进入commit前按完整快照预检。因此非法导入不会入撤销历史、清空redo、改变选择或先删除节点。不是先改后捕获异常掩盖失败。
3. tests/create-3d-component/fixtures/synced-handler.ts两类工厂登记校验，通过独立临时实例的setOptions使用同步包自身规则，finally释放；不改已入库组件源码、不复制参数范围。模板没有单独公开normalize入口，因此本次采用隔离实例适配；每次预检有临时实例分配开销，不称零成本。生产组件可公开纯参数校验函数供业务接入调用。
4. references/component-sync.md补充校验责任及N22-1范围：handle更新不自动触发Bridge dirty/历史，API保存不等于工具栏编辑链通过。没有新增通用业务参数面板。

证据根为native-work/rn22-fix；使用新的真实skill副本、原独立review已校验tgz，重新init和统一build-offline。binding.json逐字节核对4个最新模板、适配fixture与实际生成源码一致，消费包与独立review包一致。没有替换正式skill的vendor或生产库文件。

|测试|结果|
|---|---|
|真实构建|scene-build.log：装配2节点通过、类型检查与离线构建成功；scene.json记录实际入口。|
|RN22-1反例及扩展|synced-rejection.mjs通过9项拒绝：两类越界patch、两类同源非法快照、多节点后项失败、导入包含删除和相机变更、片段包含删除和相机变更、直接引擎整批更新、存在redo历史时非法导入。每项比较live实际尺寸/颜色/透明度/实例、serialize、encode、dirty/status、选择及undo/redo深度；拒绝后完全保持。见rejection-result.json。|
|后续正常路径|真实SaveService合法导入产生dirty和一层历史，undo恢复1.5，redo恢复1.8/0.4；随后encode写文件、关闭页面、重新打开importText，实际尺寸/scale=1.8、线透明度=0.4。未以仅查序列化代替渲染对象核对。|
|正常保存/生命周期回归|synced-browser.mjs通过，真实save修改清单、encode文件/关页恢复、异源拒绝和6项资源各释放一次、无pageerror。保存API范围不扩张为任意参数UI链。|

实际命令：进程级SCENE3D_REGISTRY=https://registry.npmjs.org下运行synced-scene.mjs，再运行synced-rejection.mjs与synced-browser.mjs，参数均为docs/create-3d-component/native-work/rn22-fix。均退出0。包未变，依赖仍走原外置环境。没有改全局设置、提交、推送、安装全局skill或发布。旧仓和生产库未写。

### 24.2 三轴自检、偏差与边界
|轴|自检|依据|
|---|---|---|
|需求完成度|本批PASS，独立待审|第22.1关闭条件对应的拒绝保护及后续正常操作有真实页面实证。|
|计划一致性|PASS|按第23节有界修复，新增可选校验入口，不改同步子链、不推进E2E。|
|产物内在质量|本批PASS，独立待审|整批先验后改，导入先验后进历史；负例同时比较实际对象与可保存状态。|
相对第20节“不改核心引擎”的原计划有明确偏差：RN22-1位于公共提交顺序，按第23节只增加可选预检入口和调用，4个模板共21行增量；未重写原提交/资源/工厂逻辑。旧工厂未登记validate时维持原行为；校验后任意运行异常、异步错误、恶意校验器及通用事务回退不在本次保证范围。未要求修复所有历史组件。新批保护只在采用新模板并登记校验的工程生效，既有生成工程不自动升级。
保留N22-1非阻塞限定；未代签视觉，不把立方体样本当扫光交付。下一步独立LLM复审第22–24节与实际页面，允许追加结果；NO-GO继续修复，GO后再按用户反馈推进。M4当前仍等待复审，E2E及正式发布未推进。

## 25. RN22-1 独立复审（2026-11-12）

使用sdd-riper-one，Phase Review；依据第22节关闭条件、第23–24节修复及实际代码，重新建立当前skill真实副本，使用此前独立核验的同步包/文档，重新init、统一build-offline并运行维护与独立浏览器检查。证据在native-work/rn22-independent-review，最终有效运行目录run2/synced-scene-2。仅追加Spec与独立证据，不改实现、生产库或旧仓，不发布、不代签视觉。

### 25.1 关闭情况：RN22-1部分修复，尚未关闭（P1）

第24节原9项拒绝反例本轮全部通过，包括两类越界patch、同源非法快照、多节点后项越界、删除/相机组合、直接引擎更新和保留redo。后续合法导入、undo/redo、encode文件/关页重开恢复及正常SaveService/生命周期回归也通过，不撤销这些修复成果。

剩余的具体缺口是**预检将显式null改成默认对象，但实际提交仍传null**，不是要求实现任意异常事务回退：
- tests/create-3d-component/fixtures/synced-handler.ts:13、35 使用 `probe.setOptions(node.params ?? {})`，让两类 `params:null` 以 `{}` 通过预检；:22、47真实update直接传next.params，两组件会拒绝null。
- skills/generate-3d-scene/template/src/scene3d/scene-core/engine/SceneEngine.ts:729–738虽执行整批预检，但上述不一致使其放行；:889先提交entry.node，:897调用工厂后抛错，仍污染序列化。
- template/src/edit/Bridge.ts:298的提交前预检同样放行null；之后进入commit，失败仍留下历史和已应用的节点。
- tests/create-3d-component/synced-rejection.mjs:17–29测试的是数值越界，没有显式null参数结构。null是可从合法JSON导入的非法组件输入，不是恶意代码或校验通过后的无关运行异常。

本轮新生成页面的独立实测（boundary-probe.mjs、boundary-results.json、boundary-summary.json）：

|动作|错误后的实际结果|
|---|---|
|对象片段params:null|抛“无效或未知组件参数”；live size仍1.5，但serialize和encode的对象params已为null。|
|宿主效果片段params:null|抛“未知或无效参数”；live opacity仍0.8，但serialize和encode的效果params已为null。|
|同源对象快照params:null|拒绝后params仍被改成null，undoDepth从0升为1，dirty仍为false。|
|同源多节点导入：对象size=1.7，后项效果params:null|报错后前项live已变为1.7，后项serialize/encode为null而live opacity仍0.8；undoDepth升为1，dirty仍false。|

四项反例均在本轮实际构建页面重现，无pageerror；脚本退出0表示记录反例成功，不代表失败路径通过。

**明确关闭条件：** 两个适配器预检必须与真实create/update接收的参数语义相同；不得用nullish默认将显式null掩盖成合法空对象。可只对真正缺省的undefined采用默认，显式null交给同一组件规则拒绝，或明确在提交前拒绝其结构。补充两类null片段、同源null快照、多节点后项null及有redo历史的拒绝断言，证明live、serialize、encode、dirty/status和历史均保持；随后合法编辑、保存重开仍正常。保留已有预检架构和已通过反例，不要求重做全部引擎或通用事务回退。本轮未修实现。

### 25.2 独立通过项、接口边界及兼容性

- 实际重跑synced-scene.mjs、synced-rejection.mjs、synced-browser.mjs，均退出0；run2/scene-build.log证明装配、类型与离线构建，rejection-result.json记录9项完整状态比较，browser-result.json记录SaveService修改清单、快照重开、异源拒绝及6项资源各释放一次。
- 原合法导入产生dirty与历史，undo恢复size=1.5，redo及重开后实际size/scale=1.8、opacity=0.4。该结果来自实际对象而非仅序列化数值。
- 独立接口兼容检查：未提供validate的旧function工厂和旧definition工厂仍能新增/更新；登记validate的工厂收到独立克隆，修改该入参不会污染调用方或实际提交值。见boundary-results.json的compatibility，三项均通过。
- 静态核对可选validate接口（types.ts:416）、SceneHandle在保留区变更前调用（createScene.ts:490）、直接applyFragment与Bridge快照预检。临时实例校验采用finally释放；临时分配及重复预检开销已披露。未登记validate、异步/恶意校验器、预检后任意运行异常不在本批保证内，不能宣称通用回滚；但25.1是登记校验与实际参数语义不一致，不能用该边界排除。
- binding.json逐字节核对4个当前模板和实际生成源码、适配fixture，以及实际消费tgz与第22节独立审查包相同；同步脚本指纹未变。保留第22.3同步子链通过结论，不重复全量同步构建。
- 保留N22-1：handle更新不自动进入Bridge dirty/历史；本批正常保存通过只证明声明的API/导入路径，不升级为任意业务属性面板或工具栏编辑链。离线修改清单/快照不等于源码写回，未发布，未代签视觉。

验证环境说明：首次准备误将rn22-fix中的消费用skill副本当完整同步证据源，遇缺少的用法页；改用第22节完整已核验同步产物。随后副本初次init因残留两个tgz被正确拒绝（scene-attempt1.log）；仅移除审查副本中旧0.1.0包，再新建synced-scene-2成功。失败目录保留，这些是本轮测试准备问题，不算产品缺陷或通过证据。最终实现与模板未被修改。

### 25.3 Review Matrix 与结论

|轴|结论|依据|
|---|---|---|
|需求完成度|PARTIAL|原9项及后续合法路径通过；显式null仍绕过预检并破坏场景/可保存状态及导入历史。|
|计划一致性|PARTIAL|第23节授权的可选预检入口和边界落实，但适配预检没有保持真实提交参数语义。|
|产物内在质量|FAIL|4个可复现失败路径，含多节点部分提交；已有维护测试漏掉该结构负例。|

**Overall Verdict：本批NO-GO（不通过）；M4整体NO-GO（不通过）。RN22-1仍OPEN，剩余阻塞限定为25.1的null预检语义缺口。** 不撤销已通过修复和同步链，不因未重测历史自动判失败。无新增用户视觉确认项。

Plan-Execution Diff：核心预检入口属于第23节明确允许的有界变更，不再以第20节原“不改核心”作为未授权偏差；实际偏差是适配层将null预检为{}、提交却仍为null。修复后定向复审即可，不推进总体E2E或发布。未重测任意历史组件、宿主、资源、异步错误、断电或服务端源码写回；保留原限制。追加后回读见final-verification.json，历史不改写。


## 26. RN22-1 null语义补修计划（2026-11-12）
依据第25节复审及用户修复授权，沿既有Plan Approved执行定向修复。仅修改两类维护适配器的预检默认表达式：undefined使用{}，显式null及其他非法结构交给原组件校验；不改已通过的引擎预检或同步脚本。扩展synced-rejection.mjs，覆盖两类null片段、同源null快照、多节点后项null和已有redo历史，并回归原反例与合法保存/重开/生命周期。新证据rn22-null-fix，独立真实副本构建；生产库和旧仓只读，不推进E2E、不发布。


## 27. RN22-1 null语义补修结果（2026-11-12，待复审）
第25节NO-GO保留，按第26节执行。本次实现仅改tests/create-3d-component/fixtures/synced-handler.ts两处预检调用，将node.params ?? {}替换为node.params === undefined ? {} : node.params。显式null与数组/标量原样进入同步包的setOptions校验，拒绝时尚未提交场景；undefined仍使用默认对象。没有复制范围规则或改动同步包、引擎公共预检、SaveService/Bridge。

synced-rejection.mjs新增两类null片段、新建两类节点null参数、两类同源null快照、多节点后项null、直接引擎null批次、已有redo时两类null导入；另测两类数组/布尔/数字/字符串结构。保留原9项反例，共27项。每项比较实际实例/尺寸/材质/透明度、serialize、encode、dirty/status、选择及undo/redo深度，不以仅捕获异常判通过。

证据：native-work/rn22-null-fix。新建真实skill副本和生成工程，scene-build.log记录原统一构建装配、类型检查和离线构建成功；binding.json核对4个当前模板、最新handler与生成源码逐字节一致，tgz与独立review包不变。不是仅对历史页面运行测试。
实际运行synced-scene.mjs、synced-rejection.mjs、synced-browser.mjs，参数均为上述新目录，退出码均0。rejection-result.json的27项拒绝全部状态保持；随后合法导入产生dirty和历史，undo/redo正常，快照写文件、关页重开恢复实际size/scale=1.8、opacity=0.4。browser-result.json记录真实SaveService修改清单、快照/异源拒绝、6项资源各释放一次的回归通过。进程级SCENE3D_REGISTRY沿用公网源，不改全局设置。

|三轴|自检|依据|
|---|---|---|
|需求完成度|本批PASS，待独立复审|第25.1 null关闭条件及后续合法路径通过。|
|计划一致性|PASS|只修预检默认语义并扩展负例，未变更已通过的同步或引擎架构。|
|产物内在质量|本批PASS，待独立复审|显式null原样交组件校验，真实新页面完整状态比较通过。|
未发现相对第26节计划偏差。保留第25节通过项和N22-1限定：API保存不自动证明任意工具栏编辑链，无通用事务回滚承诺。生产库/旧仓未写，未发布、提交或全局安装。RN22-1及M4仍待独立复审确认关闭，不自行升级GO、不推进E2E。无需新增用户视觉确认。首次追加结果因维护脚本默认GBK读JSON中止、未写Spec，显式UTF-8读取后完成本节追加。

## 28. RN22-1 null修复独立复审（2026-11-12）

使用sdd-riper-one，Phase Review。按第25–27节及本轮用户要求核对null/undefined语义、失败状态保持与合法保存恢复。独立证据native-work/rn22-null-independent-review；重新复制当前skill，绑定第22节已独立核验的同步包/说明，新init并用原build-offline构建run/synced-scene。仅追加Spec及独立证据，不改实现、生产库或旧仓，不发布、不代签视觉。

### 28.1 RN22-1关闭，既有通过项保留

**RN22-1 CLOSED：本次显式null拒绝保护已满足第25.1关闭条件。**

实际读取tests/create-3d-component/fixtures/synced-handler.ts:13、35，确认仅undefined补{}，null/数组/标量原样交给组件校验；实际update仍接收原值。binding.json核对当前4个模板与生成源码、handler和真实消费包；把两处严格默认表达式在内存还原后，其SHA256与上轮handler完全一致，确认本批实现仅此两处变化，并非更换组件包绕过反例。

本轮实际重跑synced-scene.mjs、synced-rejection.mjs、synced-browser.mjs，均退出0。独立构建、类型检查及原27项拒绝全部通过。测试逐项比较live实例/尺寸/材质、serialize、encode、dirty/status、选择与undo/redo深度，并在有redo时验证两类null导入不破坏历史，之后实际redo成功。合法导入、undo/redo及快照写文件/关页重开，实际size/scale=1.8、opacity=0.4；实际SaveService修改清单、异源拒绝、6项资源各释放一次及无pageerror回归通过。证据run/rejection-result.json、run/browser-result.json、scene-build.log及各维护日志。此结论来自实际断言与重跑，不只依据27这个数量。

### 28.2 新发现 RN28-1（P2，本批阻塞）：完整快照省略params后保存重放不稳定

此项是按用户要求进一步核对undefined语义和合法保存重开的实测结果，不是null修复回退，也不重新打开RN22-1的已关闭拒绝反例。

代码证据（相对仓库根）：
- skills/generate-3d-scene/template/src/scene3d/scene-core/engine/SceneEngine.ts:726声明完整快照省略params意味着默认；:729–738快照预检使用输入值而非旧节点。
- template/src/edit/Bridge.ts:351–352把完整快照缺失的params转成{}，作为清除旧参数的输入。
- tests/create-3d-component/fixtures/synced-handler.ts:22、47将此{}交给组件的增量setOptions，实际组件保留旧值，而引擎保存的节点params成为{}。预检临时实例使用默认，实际旧实例更新却使用旧值，语义不一致。
- synced-rejection.mjs末尾的合法保存恢复只使用完整params，没有覆盖合法快照省略params后再encode/重开的情况。

本轮独立undefined-probe.mjs在新生成页面验证三个不同语境：
1. 片段中params:undefined正确保留已有size=1.5/opacity=0.8；通过。
2. 新建两类节点时省略params或给undefined，实际得到组件默认size=1/opacity=0.8；通过。
3. 先合法改为size=1.8/opacity=0.4，再导入同源完整快照并省略两类params。导入成功，live仍为1.8/0.4，serialize和encode却均为params:{}。关闭页面、重开原页面、导入**同一份encode结果**，live变为1.5/0.8。没有异常拒绝提示，但保存结果不能稳定重放。

具体数值及快照见undefined-summary.json:7–28、完整undefined-results.json；独立脚本undefined-probe.mjs可复现。这里的undefined通过JSON表现为字段省略，不是把非JSON值强行传入导入器。未修改页面源码或磁盘scene-data来制造变化。

**关闭条件：** 对完整快照缺省params落实已有“默认/清除”语义，使适配器实际对象与serialize/encode表示同一状态；若以完整有效参数表示状态，应同步规范化记录，不能只修画面或只修序列化。片段缺省仍保持旧值、新建缺省仍使用默认，不能混用三种语境。补测两类完整快照省略params（以及等价空参数状态）在不同初始参数页面中应用、encode、关页重开，验证live尺寸/颜色/透明度与保存状态一致且重放稳定，同时保留27项拒绝和正常历史回归。不要求增加通用业务参数UI或无差别重做同步/引擎。本轮未修实现。

### 28.3 三轴、范围及结论

|轴|结论|依据|
|---|---|---|
|需求完成度|PARTIAL|null拒绝与27项回归闭环；用户要求的undefined语义及合法保存重开仍有RN28-1缺口。|
|计划一致性|PASS（本次null补修）|仅两处严格默认表达式与维护负例扩展，未更换同步包或扩大生产写入。|
|产物内在质量|FAIL|完整快照成功导入后live与encode含义不一致，同一快照重开后产生不同实际值。|

**Overall Verdict：本批NO-GO（不通过）；M4整体NO-GO（不通过）。RN22-1已关闭；剩余阻塞为新记录RN28-1。** 本次null补修本身正确，不撤销其通过结论，也不因历史未全量重测判失败。

Plan-Execution Diff：第26节两行修复与计划一致；RN28-1来自既有快照替换与组件增量更新的交互，在本轮明确要求的undefined/保存复测中发现，不归为null改动新增回退。保留N22-1：API保存不等于通用工具栏参数编辑链；离线修改清单和快照不等于源码写回。保留此前同步与旧工厂兼容性结论，不扩张到任意宿主/异步异常/断电事务。无新增视觉确认项，不发布、不推进总体E2E。历史保留，追加回读见final-verification.json。


## 29. RN28-1修复计划
保留RN22-1 CLOSED。两类适配将节点params视为完整参数状态，先用独立默认实例应用params取得完整有效选项，再更新live；不把完整状态直接交给增量setOptions。片段缺省由引擎保留旧值，新建缺省使用默认；快照省略或空params使用组件默认。只改适配和维护测试/用法说明，不改同步包或引擎。验证不同起始状态下省略/空参数导入、encode重放、关页重开、实际颜色尺寸透明度；回归27项拒绝和正常保存生命周期。证据rn28-fix，生产库/旧仓只读，不推进E2E。


## 30. RN28-1修复结果（待独立复审）
保留第28节RN22-1 CLOSED及同步子链通过结论。Phase Review；本批自检通过，RN28-1及M4待独立复审，不自行宣布GO。

实现：synced-handler.ts新增objectOptions/hostOptions，使用默认临时实例应用完整params、取得有效选项后finally释放，再将完整选项传给live组件的增量setter。不改同步包的增量API，也不更改引擎params替换契约。对象可选公共字段name/visible/userData在默认getOptions中没有值：旧params含这些字段而新params省略时返回rebuild，由现有引擎局部重建恢复默认，避免默认值合并仍保留旧字段。普通尺寸/颜色更新仍保持实例。references/component-sync.md补充完整状态与增量setter衔接规则。

证据根native-work/rn28-fix；新skill真实副本和真实生成页面。scene-build.log通过原装配、TS和离线构建；binding.json核对最新适配、4个当前模板与实际生成源码一致，消费tgz与此前独立review包相同。首次测试通过后补测可选公共字段清除并重新构建、重跑三个浏览器测试；以下为最终版本结果。

|验收项|实证|
|---|---|
|片段缺省、新建缺省|synced-defaults.mjs断言片段params undefined/省略保持旧size=1.8/opacity=0.4；新建省略/undefined得到size=1/opacity=0.8。|
|完整快照省略/空params|分别从size=1.8、不同颜色、opacity=0.4、效果关闭和对象可选公共字段状态导入；实际恢复size/scale=1、颜色45b8ff、opacity=0.8、效果颜色3d7eff、显示true，可选旧字段清除。serialize/encode为params:{}，其含义与默认实际状态一致。|
|不同初始状态重放|同一encode结果保存到defaults-omitted.json/defaults-empty.json，再改为size=0.6/opacity=0.2及另一颜色后导入，仍得到同样默认状态。关页、重开原页面并读取磁盘快照导入，实际值仍相同。见defaults-result.json。|
|RN22-1回归|synced-rejection.mjs最终27项拒绝全部通过，live/serialize/encode/dirty/status/历史保持；合法导入、undo/redo、重开恢复正常。|
|保存与资源|synced-browser.mjs通过，真实保存修改清单与快照、异源拒绝及6项资源各释放一次，无pageerror。|

三项最终浏览器测试均退出0；使用已有统一构建与进程级SCENE3D_REGISTRY，不改全局设置。已通过核心预检及同步脚本未修改，生产库/旧仓只读，未提交/发布/全局安装。

三轴自检：需求完成度本批PASS（省略/空状态稳定重放）；计划一致性PASS（只对齐适配完整状态语义并补测，包含同类可选字段清除）；产物质量本批PASS（真实对象、保存状态和跨起始状态/关页恢复一致）。待独立验证，不能由自检关闭RN28-1。保留N22-1 API保存范围及非通用事务边界，不新增通用参数面板、不代签视觉，不推进E2E。下一步审查第28–30节及rn28-fix证据。

## 31. RN28-1独立复审（2026-11-12）

使用sdd-riper-one，Phase Review。依据第28节关闭条件、第29–30节实施及实际代码，重新复制当前skill并绑定已独立核验的同步产物，新init、原统一build-offline构建真实页面。独立证据native-work/rn28-independent-review，未覆盖执行方rn28-fix证据；仅追加Spec与独立证据，不改实现、生产库或旧仓，不发布、不代签视觉。

### 31.1 问题关闭：RN28-1 CLOSED

未发现本轮新增确认问题；RN28-1关闭，无剩余本批技术关闭事项。不是仅因维护测试PASS而关闭：已追溯完整状态转换代码，独立复跑第28节原反例，并补查单独清除可选字段的实际实例和资源行为。

代码证据（相对仓库根）：tests/create-3d-component/fixtures/synced-handler.ts:9–17从新默认实例应用输入并取得完整有效选项，finally释放；:38、63把完整有效状态传给增量setter。因此快照省略/空params不再依赖旧live状态。:33–37在name/visible/userData由有值变缺省时请求rebuild，避免默认getOptions未列出的字段残留。:25、51保持严格undefined默认处理，null仍原样进入组件校验。未更改组件包的增量API或已通过的引擎预检。

|关闭条件|本轮独立证据与结论|
|---|---|
|片段缺省|PASS。synced-defaults及独立original-repro验证省略/undefined不改变旧size/opacity，保留片段“缺的不动”语义。|
|新建缺省|PASS。新建省略/undefined得到实际size=1、opacity=0.8，符合当前消费包默认。|
|完整快照省略/空params|PASS。从不同尺寸、颜色、透明度、可见性和可选字段状态导入后，实际size/scale=1、对象色45b8ff、opacity=0.8、效果色3d7eff、显示true。serialize/encode的params:{}现在正确表示实际默认状态。|
|跨初始状态和重开|PASS。synced-defaults分别对省略和{}状态保存磁盘快照，换另一组live值后重放，再关页重开导入，实际默认状态一致。另复制第28节原独立反例脚本到本轮目录执行：之前1.8/0.4→重开1.5/0.8的反例，现在导入后及重开均为1/0.8，stable=true。|
|可选字段清除|PASS。维护测试覆盖三字段一起清除；额外optional-probe逐个测试name、visible、userData清除，核对实际属性、默认颜色、位置保持、旧geometry/material各dispose一次，以及后续普通尺寸修改仍保持实例。不是仅查看getOptions。|
|RN22-1及后续保存|PASS。原27项拒绝状态比较全部通过，包括null、非法结构、数值越界、多节点后项失败和redo保持；合法导入/undo/redo、encode文件、关页恢复及真实SaveService修改清单、异源拒绝、6项资源各释放一次均通过，无pageerror。RN22-1保持CLOSED。|

实际重跑：synced-scene.mjs、synced-defaults.mjs、synced-rejection.mjs、synced-browser.mjs；独立optional-probe.mjs、original-repro.mjs及audit.mjs。最终全部退出0。证据run/{scene-build.log,defaults-result.json,rejection-result.json,browser-result.json}、optional-field-results.json、undefined-results.json及对应日志。original-repro为复制后的独立脚本，输出只写本轮目录，没有重写第28节证据。

独立可选字段测试首次用JS严格对象比较encode与serialize，遇到serialize含card:undefined而JSON encode合法省略该字段；修正本轮测试为JSON语义比较后重新运行全部三种清除案例。optional-first-check.log保留；这是审查断言归一化问题，不是产品缺陷，不以失败输出作为通过证据。未修改实现。

### 31.2 证据绑定与范围

binding.json确认4个当前核心模板与此前已审查版本一致，并与本轮实际生成源码逐字节一致；最新handler与生成源码一致；实际消费tgz与既有独立审查包一致。同步脚本指纹未变，保留第22.3已通过的包/文档、所有权冲突、失败回退结论，不无差别重跑同步链。

N22-1仍保留：handle更新不自动等同Bridge工具栏编辑链；本次证明的是声明的API/导入/保存恢复路径，没有新增通用业务参数UI。离线修改清单/快照不等于源码写回，场景实证不升级整库能力或发布状态。可选预检只保护登记校验的输入，不是任意异步异常或断电事务回滚；既有生成工程不会自动升级。视觉和功能必要性未由本review代签。

### 31.3 Review Matrix与结论

|轴|结论|依据|
|---|---|---|
|需求完成度|PASS（M4限定范围）|RN28-1三种语义、可选字段清除、跨状态/关页重放闭环，RN22-1拒绝保护未回退。|
|计划一致性|PASS|按第29节对齐两类适配完整状态，只变维护适配/测试/说明；包与核心预检未变。|
|产物内在质量|PASS（已核查范围）|原反例消失，独立资源/实例检查与保存实际状态一致，测试和产物绑定有效。|

**Overall Verdict：本批GO（通过）；M4整体GO（通过，限定第20–30节已声明的同步与两类实际消费范围）。RN28-1 CLOSED，RN22-1保持CLOSED。** 无剩余本批技术阻塞；不等于十二项总体E2E完成、任意宿主自动适配、源码已写回、用户视觉确认或正式发布。

Plan-Execution Diff：未发现相对第29节有界修复计划的实质偏差；独立review补充逐字段清除和原反例复跑，未改实现。历史NO-GO原文保留，由本节记录关闭。不因本批GO自行推进E2E或发布。未重测所有历史组件/宿主/资源、全部并发或异常时序，保留原有范围，不扩张结论。追加后回读见final-verification.json。


## 32. E2E执行计划（用户授权M4通过后继续）
第31节M4限定GO，进入第12项两类全链路技术验收。新增维护e2e-workflow.mjs：当前skill初始化两类明确标注的技术样本，浏览器右侧面板调参、参数导出/reset/导入；将实际导出参数写入preset后重建，源码ZIP解包后作为唯一入库候选；生产库真实副本validate/apply并记录源码字节绑定；从本轮库副本同步到当前generator真实副本，再原init/build和已审查适配验证真实消费/保存。禁止借历史候选冒充本次新产物，不把模板能力称为新业务创作。测试导出和developerConfirmed仅为授权隔离测试，不代签用户设计/生产开发批准。证据native-work/e2e-final，提供清晰资料入口及两类实际预览；设计、工程、同步、发布分开记录。代码只改维护测试（若发现产品问题按事实修复并记录），生产库/旧仓只读。Done：同一导出源码进入库与tgz，面板参数对应导出preset并进入生成场景；运行与保存实证，完整状态表和待确认项，独立review待进行。


## 33. 两类端到端验收实施结果（待独立总体验收）
依据第31节M4 GO及用户继续授权执行第32节。本批不是新增业务组件开发，而是当前工具链的两类有界技术样本：独立可调对象及借用Mesh的静态描边效果。design.md写明需求、模板来源、未新增业务能力和用户待确认，不把模板换名称为从零业务成果。

### 33.1 实际文件与连续链路
新增tests/create-3d-component/e2e-workflow.mjs、e2e-delivery-check.mjs；synced-scene.mjs增加仅维护用途的SCENE_TEST_PARAMETERS_FILE输入，实际从本轮页面下载参数灌入场景。未改生产库、创作runtime、同步实现或引擎。当前创作skill verify通过58文件。
证据及可打开入口：native-work/e2e-final/index.html；技术入口validation.md。e2e-object/index.3d.html与e2e-host/index.3d.html为重建后的创作预览，synced-scene/index.3d.html为本轮同步包实际生成场景。已查看两类预览截图和入口页截图，不代签用户视觉。

本轮链条：当前skill初始化→浏览器右侧调参→下载参数JSON→reset/导入恢复→实际参数写component/preset→源码ZIP导出→解包作为唯一入库候选→库真实副本类型/ESM/CJS构建/运行断言→显式测试确认apply→同一库副本同步最新generator副本→原init/build-offline→实际生成页面参数/保存/拒绝/生命周期验证。
原组件src、ZIP中src、入库src逐文件字节一致，result.json记录sourceFiles与archiveHash；sync-prepare/package-check.json将包运行模块/类型/文档绑定到本次构建；delivery-check.json确认生成工程使用同一同步tgz。每个场景params字段与本轮下载参数相等，不靠手写相同数字冒充传递。源组件默认保持不变：对象size默认1，效果opacity默认1；本次设计覆盖分别为1.5、0.8，库文档设计preset与生成场景使用覆盖值。

### 33.2 验证与修正
- e2e-workflow.mjs退出0：两类预览参数往返、纯源码ZIP解包、源码字节绑定、两次validate/apply、副本文档与同步、真实场景消费、SaveService修改清单/快照重开、27项拒绝及资源释放通过。
- e2e-delivery-check.mjs最终退出0：重新打开最终创作HTML初值等于导出设计参数；库设计preset相同；生成工程tgz与同步tgz相同；验收入口3个链接存在，浏览器渲染截图可见。
- 首次最终检查确实失败：对象旧HTML初值1、设计preset1.5。原因是测试将--export-component误作同时重建；此命令实际只导出源码。已修维护流程为写preset→普通build→export。本轮对两页显式普通build后重新最终检查通过；源码/preset/ZIP未变化，不无意义重跑入库同步。详见final-check-correction.md。不能只凭主流程result PASS忽略最终页面检查；以result与delivery-check共同成立为准。
- result.json记录生产库src/docs/scripts及工程配置前后baseline一致；无生产apply。旧仓未写，未提交、推送、全局安装或发布。developerConfirmed仅为已授权隔离测试，不伪造生产开发审核签字。设计pending-user，工程passed-in-isolated-copy，同步passed-in-skill-copy，发布unpublished。

### 33.3 十二项当前落点
|项|技术状态与依据|仍需区分|
|---|---|---|
|1 完整Spec|本Spec逐步追加，12项均保留|历史结论不改写|
|2 迁移复审|M0独立GO保留|旧仓不再作为修改目标|
|3 库规范|两类原生接口与副本接纳实证|不扩张到任意地图/资源宿主|
|4 创作skill|当前native-object/native-host运行、纯组件可接纳|业务能力仍由LLM按需求实现，模板不冒充业务|
|5 右侧面板|两类本轮实测；窄屏/动画等沿用此前独立结论|用户视觉/操作习惯待确认|
|6 目录与artifact|本轮根预览、component/example、外置依赖；既有分配保护结论保留|实际Octo嵌入环境未在本轮复测|
|7 交付包|本轮真实ZIP解包入库、源码/参数绑定|测试导出不是设计确认|
|8 自动入库|两类当前库真实副本validate/apply通过|生产应用待单独明确授权|
|9 库文档|本轮API/参数/设计preset生成并保留入库记录|人工归属/冲突历史通过项保留|
|10 生成器同步|M4独立GO；本轮新包再次完整实际消费|无任意宿主自动适配保证|
|11 文档纯净|此前common/geographic整理结论保留；本轮简洁验收页与维护证据分开|用户可评价可读性，不再要求理解哈希日志|
|12 端到端|本轮连续两类技术链自检通过|独立总体验收、用户确认仍待完成|

### 33.4 三轴、验收说明与恢复锚点
三轴自检：需求完成度PASS（两类有界技术链，非设计/生产发布）；计划一致性PASS（实际导出产物进入后续步骤、副本边界保持）；产物内在质量PASS（最终页面失配已由复核发现并修正，有同源链绑定与保存实证）。独立E2E/总体review待进行，不把本批自检当12项无条件总GO。
用户验收只需打开index.html中的前两页，看右侧参数面板、实时调节、导入/导出及主入口是否符合使用习惯；技术正确性由独立review检查。两个样本不是最终业务设计，不要求用户替工程团队验代码；不自动推广确认到其他组件。若使用Octo预览，还需在实际宿主确认打开效果，不能以Edge file测试冒称Octo已验证。
下一步：独立LLM审查第32–33节与实际产物，允许追加Spec；NO-GO修复，GO后根据用户反馈收口使用体验/剩余确认。保持M4 GO及已关闭问题，未有新证据不重开旧问题。不自动应用生产或发布。

## 34. 两类组件E2E独立技术验收（2026-11-12）

使用sdd-riper-one，Phase Review。先读native-work/e2e-final/validation.md，再对照第32–33节、实际维护代码及产物核查。独立证据native-work/e2e-independent-review；既检查原提交产物，又在全新run目录完整重跑，没有覆盖e2e-final证据。仅追加本Spec及独立证据，不改实现、生产库或旧仓，不发布、不代签视觉。

### 34.1 问题与关闭结论

**未发现本批新增确认问题或技术阻塞，无新增技术关闭事项。本批两类E2E技术验收GO（通过，限定第32节声明的技术样本及隔离副本链）。**

不是按result PASS或文件数量签字：本轮实际从初始化开始连续运行e2e-workflow.mjs与e2e-delivery-check.mjs，均退出0；并另写逐文件链审计、运行默认值审计、页面实际对象/材质审计、独立tgz解包比对。原提交产物和本轮重跑产物分别留证。

### 34.2 同一产物链的独立证据

|环节|代码依据及本轮结果|
|---|---|
|预览实际调参、下载/reset/导入|tests/create-3d-component/e2e-workflow.mjs:20–30实际操作右侧控件并保存浏览器下载，导入后比较设计状态。本轮两类页面重新执行成功。独立page-audit另核对最终对象的组件getOptions状态、效果实际LineSegments颜色/透明度/显示，与导出参数一致，不只读面板数字。|
|参数落盘、重建与源码默认分离|e2e-workflow.mjs:31–33明确写preset→普通build→export。本轮无需人工修补即可通过最终页面检查。独立defaults-audit实例化本次构建的两类组件，实际源码默认size=1、opacity=1，并核对文档参数索引同为1；设计覆盖size=1.5、opacity=0.8分别保存在preset和场景参数，没有改写源码默认。|
|源码ZIP→解包→实际入库候选|e2e-workflow.mjs:34–38使用真实ZIP解包目录调用planIntake。独立chain-audit核对清单集合、字节数和SHA，并将每个清单文件与原component、解包候选及对应库src/文档文件逐字节比较。包括源码、preset、package、design/engineering，不只比较文件名或src计数。plan.candidate确为本轮-unpacked目录。|
|入库副本及文档|两次validate/apply在当前生产库真实副本完成TS、ESM/CJS/声明构建、模板参数与生命周期断言，receipt私有源码/文档操作与最终库文件一致；临时验证不是生产开发审核签字。两类设计preset、下载参数及库文档设计preset一致。|
|同库→同步包/说明|同步计划source确为本轮library，源基线等于同步manifest.sourceDigest，目标文件逐项SHA匹配。原组件src与sync-prepare/library中的src仍相同。另使用系统tar解包本轮tgz，把实际包中全部dist模块/类型和docs/components.json与本次构建文件比对，全部一致，见archive-audit.json。|
|同步包→真实生成场景|e2e-workflow.mjs:45把本轮progress作为SCENE_TEST_PARAMETERS_FILE；synced-scene.mjs:16实际替换两组场景params。本轮逐字段/完整对象核对下载参数、preset及scene-data一致。生成工程file依赖tgz与同步tgz字节相同，使用原init及统一build-offline，没有用候选源码旁路组件包。|
|实际消费、保存与重开|本轮维护浏览器测试验证SaveService before/after修改清单、encode快照写文件、关页重开导入、异源拒绝、27项失败状态/历史保持及6项资源各释放一次。独立page-audit进一步修改两类颜色/尺寸/透明度/显示并重开导入，比较实际对象options、网格scale/颜色及效果线材质和可见性，均一致，无pageerror。|
|最终交付预览|最终创作HTML重新打开即为本轮设计参数；库设计preset、实际消费包及验收页链接通过检查。已查看本轮两张最终预览截图，确认页面及右侧面板正常呈现；技术查看不代签审美或业务必要性。|

原证据复核：original-chain-audit.json、original-chain-expanded.json、original-defaults-audit.json、original-page-audit.json。全新重跑复核：workflow.log、delivery.log、run/result.json、run/delivery-check.json、fresh-chain-audit.json、fresh-defaults-audit.json、fresh-page-audit.json、archive-audit.json及run内各构建/验证日志。

第33.2披露的旧HTML问题已关闭：原提交当前最终页面实测一致；本轮从零执行修正后的正常顺序也通过，未靠末尾人工重建补救。因此历史final-check-correction保留，但不作为仍开放的问题。主流程和最终交付检查同时成立，未以主流程PASS替代页面终态。

### 34.3 状态与总体仍待确认事项

|状态|本次可确认的结论|
|---|---|
|预览/参数/源码导出|两类技术样本通过，实际下载、落盘重建、ZIP及最终预览绑定。|
|工程接纳|passed-in-isolated-copy；真实类型/构建/运行与文档验证，不是生产库已接纳。|
|生成器同步/实际消费|passed-in-skill-copy及两类真实场景验证通过；未替换正式skill vendor，不自动保证任意宿主。|
|保存|声明的API/导入路径与离线快照恢复通过；修改清单不是源码自动写回。N22-1工具栏/通用参数面板限定继续保留。|
|设计/生产审核/发布|设计pending-user；developerConfirmed仅isolated-test-only；publication为unpublished。未将任何技术PASS提升为这些确认。|

总体仍待确认/另行授权：
1. 用户对右侧参数操作、导入导出及交付入口的使用体验确认；真实业务组件的设计效果与功能必要性由用户确认。两份模板仅证明技术链，不冒充地图/货架/扫光的新业务成果，也不将样本确认推广给其他组件。
2. 实际Octo预览宿主的打开及嵌入体验仍需在目标环境确认；本轮实际浏览器是Edge file离线页面，不冒称Octo验证完成。
3. 若要进入生产库/正式skill或发布，须另行开发审核和明确授权；本轮未执行。这些不作为第32节隔离技术E2E的缺陷，但阻止将总体状态表述成无条件生产完成。

本轮result记录生产库src/docs/scripts及配置锁文件前后基线一致；已审查测试写入落在独立副本、证据及构建器外置环境，不在生产库或旧仓安装/构建。该基线证明限定所列文件，不泛称所有历史磁盘无变更。

### 34.4 Review Matrix与最终结论

|轴|结论|依据|
|---|---|---|
|需求完成度|PASS（两类E2E技术范围）|同一源ZIP及设计参数完整走过创作、交付、入库、文档、同步、场景、保存恢复，最终预览一致。|
|计划一致性|PASS|按第32节使用真实当轮产物与隔离副本，不用历史候选旁路，不以模板冒充新业务，不替用户/生产审核签字。|
|产物内在质量|PASS（已验范围）|完整独立重跑成功，原证据另行追溯，实际模块/参数/页面/保存状态绑定；未发现新增技术阻塞。|

**Overall Verdict：本批E2E技术验收GO（通过）。第12项两类有界技术链可闭环；总体仍保留34.3用户确认、实际宿主及生产授权边界，不签十二项无条件生产/发布总GO。** M4 GO、RN22-1/RN28-1 CLOSED及其他既有独立结论保留，没有新回退证据不重开。

Plan-Execution Diff：未发现修正后正常流程相对第32节计划的实质偏差。本轮补充独立全文件/实际对象/解包审计，未修改实现。未重跑所有历史窄屏、动画、任意资源/业务算法、全部并发或进程崩溃场景；沿用已有结论与限制，不用未重测自动判失败，不将有限样本泛化。允许的review写入已保留历史，追加回读见final-verification.json。

证据定位补注：34.2表中SCENE_TEST_PARAMETERS_FILE实际读取位置为 `tests/create-3d-component/synced-scene.mjs:14`，此前写为:16系行号笔误；绑定核查与验收结论不变。

## 35. 全流程操作指南与统一入口（计划，2026-11-12）
Phase Plan → Execute；沿用既有Plan Approved，本轮用户明确要求文档及一键执行。第34节独立E2E GO保留。
目标：给开发一份纯净操作指南，明确创作、调参、导出、审核、入库、文档、同步、场景接入分别使用什么脚本及输入输出；提供配置驱动统一入口，复用现有维护脚本，不新增另一套入库/同步机制。
文件计划：docs/create-3d-component/workflow-guide.md；tools/3d-component-studio/workflow.mjs；同目录workflow.example.json；tests/create-3d-component/workflow-cli.mjs。
统一入口提供build/export/prepare-intake/apply-intake/prepare-sync/apply-sync；prepare-intake串联计划与验证，写入动作仍要求明确确认；配置路径相对配置文件解析，工作目录由用户指定，每次准备使用新目录。不自动写设计参数、不自动发布，不宣称跨库事务。同步失败时已完成入库保持，用户修复后重新准备同步。
验收：帮助/严格参数/缺确认拒绝/配置解析及子进程命令传递测试；底层完整链沿用第34节实证，不对生产运行apply。文档逐步列出角色、脚本、输入输出、命令、失败恢复与现有局限。可调库Demo是此前建议，尚未实现，不能写成已交付。
边界：只改新仓上述维护文件及追加Spec；不改生产库、旧仓、生成器或creator运行代码，不提交发布。

## 36. 操作指南与统一入口执行结果（2026-11-12）
Phase Review；本批实现完成，待独立review。新增workflow-guide.md，覆盖创作→调参→导出→审查→入库文档→同步→真实场景验证，明确每步角色、脚本、输入输出、可执行命令、失败恢复。用户日常说明与本Spec维护记录分开。
新增tools/3d-component-studio/workflow.mjs及workflow.example.json：build/export/prepare-intake/apply-intake/prepare-sync/apply-sync；不使用shell拼接命令；相对配置文件解析路径；未知选项拒绝；子命令失败停止。export先普通build再export；两种apply要求显式confirmed；首次adopt只能显式用于prepare-sync。入库准备串联现有plan/validate，没有复制底层安全机制。源码ZIP需先解包，参数落盘仍由LLM/开发核对后操作。未实现跨仓事务或全自动业务接入。
验证：node tests/create-3d-component/workflow-cli.mjs退出0，PASS。覆盖路径含空格、命令映射、分类/出口必填、确认拒绝、首次adopt参数、未知/错误选项在文件读取前拒绝、子步骤失败停止及帮助。此测试为编排层断言，子步骤执行使用注入替身；实际底层完整构建/应用/同步证据沿用第34节独立GO，本轮未重跑完整链、未应用生产。未改旧仓、生产库或skill运行代码。
三轴自检：需求覆盖PASS（指南及分阶段统一入口）；计划一致性PASS；资料/代码质量PASS（上述验证范围）。独立review待进行，不自行签本批最终GO。此前可调库Demo建议明确登记为尚未实现；没有用此文档掩盖现有页面无Demo。开发运行自己审阅的组件断言，不能把模板测试泛化为所有组件。
恢复：审阅第35–36节及四个新增文件；NO-GO修复，GO后继续另行确认的工作。本批不自动应用或发布。

## 37. 第35–36节独立 Review（2026-11-12）

Phase Review；授权仅审查、追加本Spec和独立证据，不修改实现，不向生产库应用或发布。Overall Verdict：本批 GO（通过），范围为操作指南与分阶段统一入口，不等于新的组件设计确认、生产应用或发布。

### 37.1 具体证据与问题结论

本轮未发现需阻塞本批的具体问题；无新增待关闭问题。

- 操作指南与真实接口一致：workflow-guide.md:57 初始化命令与 skills/create-3d-component/scripts/init.mjs:6–21 的位置参数/profile一致；指南:65–71区分下载参数、人工核对preset、普通构建和源码导出；workflow.mjs:12确实先build再--export-component。指南:38、81的解包候选与运行测试约定，与intake/cli.mjs:9–20一致。未将ZIP文件直接当目录，未承诺自动写回参数。
- 命令传递：tools/3d-component-studio/workflow.mjs:8–20将配置路径相对配置文件解析，分类/出口/更新和验证脚本转给真实intake接口；sync入口参数与skills/generate-3d-scene/scripts/sync-components.mjs:5–7一致。workflow.mjs:23–24使用参数数组和shell:false，按顺序执行并检查子进程错误/退出状态。本轮真实启动wrapper与子进程夹具，核验含空格路径、两次export调用顺序、prepare-sync adopt和apply-sync确认参数。
- 确认门禁：workflow.mjs:18、20、30–32；两种apply缺--confirmed均拒绝，未知/重复及不适用选项拒绝；指南:83–105明确审查后显式应用。确认旗标是操作者声明，不是工具自动证明review已经完成。独立测试中apply-sync正向仅调用自建夹具，不运行真实目标应用。
- 失败停止：workflow.mjs:23–24、34–35；实际子进程首步exit 7时第二步不运行，也不打印完成；真实intake CLI因缺失输入返回非零，wrapper停止。指南:117–125明确新工作目录重准备、跨仓非原子事务及已成功入库不自动回滚，未夸大失败保护。
- 状态与能力边界：指南:20、91、113、125区分导出/设计/工程/入库/同步/发布，明确尚无自动可调库Demo及任意业务接入。与第35节范围一致，没有把未实施能力写成完成。
- 测试有效性：tests/create-3d-component/workflow-cli.mjs本轮实际重跑退出0，涵盖编排映射、确认、选项、路径、注入式失败停止及真实CLI帮助/错误参数。新增独立子进程验证退出0，补足正常命令传递与真实非零退出观察。原测试的注入替身不能单独证明底层应用安全，第36节已准确披露；第34节既有独立E2E结论保留，本批不以编排测试替代它。

### 37.2 三轴 Review Matrix

|轴|结论|依据|
|---|---|---|
|需求完成度|PASS|指南、六个分阶段入口、确认门禁、失败停止与实际接口一致|
|计划一致性|PASS|沿用底层机制，配置驱动，不新增自动设计确认、生产应用或跨仓事务承诺|
|产物内在质量|PASS（本批范围）|维护测试复跑及独立真实子进程核验通过，测试替身与实际底层证据明确区分|

Plan-Execution Diff：未发现实质偏离。新增独立验证仅写入native-work/workflow-independent-review，未修改实现。初版审查夹具的日志分行解析误把Windows路径中的转义字符当分隔符，修正审查夹具后全部断言通过；不是产品失败。

### 37.3 证据、未重测范围与恢复

独立证据：native-work/workflow-independent-review/maintenance.log、review-subprocess.mjs、subprocess-results.json、review.md。本轮没有重新执行底层完整构建/入库/同步/E2E，没有真实生产apply或发布，没有视觉代签。真实子进程正向build/sync使用显式夹具，只证明编排传递；真实intake只验证拒绝路径。此前E2E通过保留，不据此扩大到新组件或任意宿主。

本批 GO；无新增技术阻塞及关闭条件。后续组件设计、实际应用审核、业务接入与发布仍须各自授权和验证；不由本次GO自动推进。
## 38. 可交互组件库Demo（计划，2026-11-12）
Phase Plan→Execute；第37节本批GO保留，用户授权继续此前四项方案。目标：创作模板生成example/library-demo.ts，入库可显式指定该文件，生成与现有库一致的canvas及右侧面板，真实导入接纳源码，不嵌入旧HTML。
文件：两类模板example/library-demo.ts；intake/core.mjs、docs.mjs、cli.mjs；workflow.mjs及配置；creator说明及打包runtime；操作指南；维护测试/独立副本证据。
契约：单文件TypeScript演示适配器，@component引用接纳分类出口，@parameters引用接纳参数模块；外部导入仅three及three/addons，禁止候选路径旁路。演示与component源码分离，源码ZIP不包含宿主；开发交付时同时提供example/library-demo.ts。demo路径、内容与计划绑定，变化后重新计划。保留历史无demo的兼容性但页面明确显示未提供演示，不宣称完整可视交付。新创作要求提供适配器，任意宿主由LLM/开发明确实现。
验证：两类模板生成、真实副本入库验证、Demo构建、浏览器调参/默认恢复/切页释放；失败及来源变化/归属冲突检查。生产库只读，不提交发布；技术样本不代签业务视觉。完成回写Spec并交独立review。

## 39. 可交互组件库Demo执行结果（2026-11-12）
Phase Review；本批实现及自检完成，独立review待进行。第38节计划四项已实施：两类模板生成example/library-demo.ts；入库--demo与统一workflow配置demo；生成demo-card画布/右侧参数及既有API页；creator入库说明、SKILL入口与workflow-guide更新，runtime重新打包并verify 60文件。
演示静态导入经TypeScript AST检查，仅@component/@parameters/Three；重写到接纳库分类入口及对应参数源码。演示作为docs文件参与计划、归属冲突、源哈希复核与receipt；不进入component源码ZIP。更新已有Demo要求再提供适配器。旧无Demo计划保留兼容，HTML明确未提供交互演示，不能称完整可视交付。新创作须随业务修改模板适配器，不将通用方块当任意业务实现。
模板：独立对象size/color；借用Mesh enabled/color/opacity，默认静态；pulse配置提供播放操作和tick，非本轮浏览器验证重点。右侧控件以源码defaults为初值/恢复值，设计preset保持独立。dispose释放观察器、轨道控件、组件及演示自有资源、渲染器；不释放借来的生产场景，因为本模板宿主在example内自建。
验证证据：native-work/library-demo/validation.md、result.json、browser-result.json、contract-result.json及两份截图。真实两类初始化→独立库副本typecheck/build/runtime/docs及Demo bundle通过，原生产baseline保持。浏览器实测两类调参引起实际画布截图变化、重置、右侧面板、导航释放再入场通过。缺disposer、候选路径旁路、Demo修改后过期计划拒绝通过。workflow-cli和verify通过。最终新增签名门禁另在两份实际副本执行成功，未声称最终core版本完整重复构建。主构建与最终增量验证分开记录。
发现并定位favicon.ico 404为既有库网页图标缺失，仅该URL记录knownWarnings；其他浏览器错误仍导致失败，未修改生产库图标。已看两张截图，不代签用户业务视觉。
三轴自检：需求覆盖PASS（两类有界模板与显式适配器流程）；计划一致性PASS；产物质量PASS（声明验证范围）。未验证任意地图宿主/所有动画，未执行本批生产apply或同步发布；不把这些未授权动作当已完成。单文件适配器是受审本地代码，非沙箱；开发仍需检验真实业务与释放语义。
可打开：http://127.0.0.1:17911/#interactive-object；http://127.0.0.1:17912/#interactive-host。服务分别指向两份验证库；恢复命令为在各*-validation/library下运行node node_modules/vite/bin/vite.js docs --host 127.0.0.1 --port 17911（或17912）--strictPort。结束本批等独立review；NO-GO修复，GO后再按用户授权推进。

## 40. 组件使用文档整理（计划，2026-11-12）
用户授权继续修正文档。Phase Execute，沿用既有Plan Approved。目标：用途→Demo→最小示例→构造参数→属性/方法→使用限制；不将design/engineering维护说明整段展示，原文件保留。空章节不显示，长类型可展开查看完整内容，方法说明来自真实源码JSDoc，不猜测生成语义。
修改intake/docs.mjs、两类组件模板JSDoc、creator说明及打包runtime；新增渲染回归测试。重新生成两份独立预览页，浏览器验证排版与已有Demo。生产库只读，不改变组件运行行为。验证与结果追加Spec，独立review待用户发起；第38–39节review状态不自行提升。

## 41. 组件使用文档整理结果（2026-11-12）
第40节执行完成，自检通过，待独立review。intake/docs.mjs页面顺序调整为用途、Demo、最小示例、构造参数、属性/方法、使用限制。隐藏空Properties/Methods/示例/限制章节；长字段类型与方法签名可展开，保留完整内容，不伪造简化类型。design.md/engineering.md/preset/notes仍保留在交付/库文档目录，页面不再整段展示维护说明和维护链接。真正影响使用的限制通过源码@remarks提供。
两类模板补齐用途、方法、参数、宿主字段与animation说明；没有修改运行行为。新增创作规范要求业务实现同步维护JSDoc和示例，限制不能被删去后遗忘；分类改变时审查示例导入路径。runtime已重新打包，verify60文件通过。
验证：library-docs.mjs实际读取模板并通过TypeScript提取API，检查示例顺序、维护文字不显示、空属性隐藏、方法及限制保留，PASS。library-docs-browser.mjs在Edge实际打开两页，确认Demo启动、标题顺序、空章节与无pageerror，PASS；截图已查看。预览新增interactive-object-docs/interactive-host-docs页面及对应独立源码，不覆盖第39节原页面、receipt与证据；所在目录仍为独立验证库。此轮为文档增量验证，没有重新执行整套入库/同步与生产应用，未修改生产库。
证据：native-work/library-demo/docs-result.json、docs-browser-result.json、*-docs-api.json、*-docs.png；测试脚本tests/create-3d-component/library-docs*.mjs。预览：http://127.0.0.1:17911/#interactive-object-docs；http://127.0.0.1:17912/#interactive-host-docs。
三轴自检：需求完成度PASS（本批文档整理）；计划一致性PASS；资料质量PASS（源码说明与真实浏览器检查范围）。历史第38–39节及本批均需独立review，不代签用户视觉。旧候选必须把必要使用信息迁入JSDoc，不承诺脚本能从任意engineering.md自动推断语义。

## 40. 第38–39节独立 Review（2026-11-12）

Phase Review；按sdd-riper-one审查模板、入库绑定、更新与交互契约。Overall Verdict：本批 NO-GO（不通过），有两项P2技术阻塞；两类默认模板正常链通过不抵消适配器转换与契约门禁缺陷。仅追加Spec和独立审查证据，未修改实现/生产库，未发布或代签视觉。

### 40.1 问题、证据与关闭条件

1. **RN40-1 / P2：别名转换误改普通文本，入库Demo语义不保持。** `tools/3d-component-studio/intake/core.mjs:110`对全文正则替换所有引号包裹的@component/@parameters，而不是只改模块引用。独立反例literal-repro.mjs调用实际planIntake：合法Demo真实导入AuthoredComponent，另有`ctrl.textContent='@component'`；生成operations中的该显示文本被改为`../../../src/core/index`。见library-demo-review/literal-repro.json。对应第38节接纳源码导入适配及第39节导入重写承诺；适配不应改写普通字符串。关闭：仅转换AST中允许的模块specifier，保持正文/注释/普通字符串语义；增加两种别名、普通字符串、注释及导入/导出引用的回归，核对真实生成Demo。不要仅增加文本匹配断言。
2. **RN40-2 / P2：签名门禁未验证实际DOM调用和无参释放可兼容性。** `intake/core.mjs:148`只检查形参数量为2、返回类型有调用签名。独立调用实际validateDemoTypes，以`initDemo(canvas:number,ctrl:number){canvas.toFixed(); return (required:number)=>required.toFixed();}`为入口，门禁成功；见signature-repro.mjs及signature-repro.json（accepted=true）。实际文档宿主`docs/main.ts:102、141–143`传入HTMLCanvasElement/HTMLElement并无参调用释放函数；此签名会在真实调用时出错。当前library-demo-contract.mjs仅否定无释放函数，未覆盖错误参数/必须实参的disposer。关闭：使用可赋值/实际调用类型检查验证`(canvas:HTMLCanvasElement,ctrl:HTMLElement)=>()=>void`契约，拒绝不兼容输入、非同步函数返回或需要必填实参的释放函数，保留兼容的合法签名；增加上述反例及正常模板回归。静态契约不替代开发对释放行为的审查。
3. **N40-1 / 非阻塞测试修正：浏览器服务归属缺少断言。** `tests/create-3d-component/library-demo-browser.mjs:10–12`使用固定17911/17912端口，fetch成功即就绪，未验证启动子进程存活或服务属于result.library。端口被占用时strictPort子进程可退出而测试连接既有服务。不能由此断言历史证据一定错误。本轮预查18911/18912未监听，独立测试副本改用这两个端口，访问本轮新生成副本通过，故未将其作为本轮页面结果阻塞。建议增加服务启动失败/退出监听及内容身份校验，端口冲突必须失败；保留测试覆盖限制。

### 40.2 已核查通过项与实际复测

- `intake/core.mjs:60–64、113、118–137、178–196`：已有Demo更新须重提供适配器；demo路径/内容hash进入plan；生成demo.ts进入owned/operations/receipt；源变化拒绝，归属检查与目标基线保持。本轮实际复跑Demo变化拒绝。更新及归属链为代码核查，未额外宣称本轮完成合法更新apply全链；生产apply未执行。
- `core.mjs:105–110`、`docs.mjs:48–49`及两类`example/library-demo.ts:3–5`：别名指向真实接纳分类出口及该组件参数模块；没有旧HTML嵌入。templates实际new AuthoredComponent/HostHighlight，控件调用setOptions/getOptions；不是仅改变data-options假装渲染。源码ZIP与Demo分离、旧无Demo页面提示符合声明。
- 两模板library-demo.ts：对象:14–30、宿主:14–37；默认值来自源码defaults，重置调用setOptions；正常离页释放观察器、OrbitControls、组件、renderer/context及自有mesh。静态模板不持续RAF，pulse另有RAF取消。当前检验不保证任意自定义适配器初始失败时自动清理，也不把data-disposed单独当作所有GPU资源释放证明。
- 实际从当前打包skill新初始化两类项目，运行`library-demo.mjs`完整链，退出0：独立真实库副本typecheck、ESM/CJS/声明构建、runtime、docs、Demo bundle与最终类型门禁；源Demo变更拒绝；测试内生产baseline前后相同。未覆盖到的生产目录文件不泛称全部磁盘未变。
- `library-demo-contract.mjs`在本轮新副本运行退出0：合法模板、无disposer拒绝、候选相对路径旁路拒绝。该PASS不能证明RN40-2已关闭。
- 独立browser-review.mjs使用新端口，退出0：两类尺寸/透明度变化与画布变化、恢复源码默认、右侧布局、离页dispose标记、重入默认值、无pageerror；额外验证颜色和宿主enabled开关及再次重置。没有仅靠截图hash宣称视觉完全一致。favicon单独已知告警记录，非视觉确认。
- workflow-cli.mjs本轮复跑退出0；workflow.mjs:15和intake/cli.mjs:14的demo转发静态核对一致。该维护测试未专门断言demo转发，未扩张其覆盖范围。

### 40.3 Review Matrix、偏差及恢复

|轴|结论|依据|
|---|---|---|
|需求完成度|PARTIAL|两类模板及入库/页面正常链成立；普通文本保持与适配器调用契约仍有实际缺口|
|计划一致性|PARTIAL|显式Demo、隔离验证、生产边界符合计划；导入重写范围超过计划语义|
|产物内在质量|PARTIAL|独立完整复跑通过，但两个最小反例揭示现有测试漏检；服务归属测试宜加强|

Plan-Execution Diff：实现交付范围与第38节大体一致，问题在转换精度与门禁校验强度；第39节披露的最终门禁仅增量执行，本轮已在新副本完整执行，不再以该验证顺序为开放问题。未重做旧E2E、生产同步发布、任意业务/地图宿主或pulse全流程，不因这些未测自动判失败。

本批NO-GO仅以上述RN40-1、RN40-2为技术阻塞；修复后定向复审并回归两类模板即可，无须重做已通过的入库资料与正常链。视觉、业务必要性与生产接纳/发布仍由相应人员确认，不由技术review代签。

独立证据目录：native-work/library-demo-review。入口result.json、contract-result.json、browser-result.json及两份*-validation日志；反例literal-repro.json、signature-repro.json；独立脚本保留。review.md为本节副本；追加后回读及历史前缀校验见append-verification.json。
## 42. 第38–39节Review编号与并行变更补注

本轮追加前其他工作已加入第40–41节文档整理，导致本轮Review标题重复使用40；遵守仅追加边界，不改写历史。独立Review正文为本Spec第841行起的“第38–39节独立 Review”，以本第42节为正式索引；RN40-1、RN40-2、N40-1仅为该Review问题ID，勿关联第830行的文档整理计划。本次未验收第40–41节文档整理；代码行号是本轮读取版本的定位，后续并行文档变动可能移动docs.mjs及模板行号。两个阻塞反例均作用于实际intake/core.mjs，结论不依赖文档整理。最终结论仍为第38–39节本批NO-GO。
## 43. RN40定向修复计划（2026-11-12）
按第42节索引读取独立review，RN40-1/2成立，进入Research→Plan→Execute；本轮修复获用户授权，沿用Plan Approved。仅改intake/core.mjs、定向测试及浏览器测试，不重做已通过正常链，不改生产库。
RN40-1：只按AST模块specifier节点位置替换，从末尾向前拼接，保留普通文字/注释；测试导入、导出及两类别名，并执行转换后的模块核对真实显示内容。
RN40-2：TypeScript虚拟调用夹具实际传HTMLCanvasElement/HTMLElement并无参调用释放函数；拒绝不兼容形参、必填释放参数及异步返回，保留兼容签名；回归实际两类模板。
N40-1：浏览器测试随机空闲端口、子进程退出监测及源目录身份响应校验，不再因任意HTTP响应判就绪。完成记录定向证据，不擅自宣布review通过。

## 44. RN40修复结果（2026-11-12）
Phase Review，修复自检完成，等待独立复审。RN40-1改为只收集AST import/export的moduleSpecifier节点位置，从后向前替换；不改普通字符串/注释。实际plan→转换→打包执行验证两种别名导入/导出及显示文本保真，PASS。
RN40-2使用虚拟TypeScript调用夹具验证DOM可赋值签名、无参释放，另检查原始返回类型拒绝异步/any/unknown。错误输入、必填释放参数、异步初始化/释放均拒绝；兼容宽DOM/可选参数/忽略形参合法签名通过，两模板回归通过。严格诊断限定Demo/夹具，原有全模块检查仍保留，未修改库中历史严格空值代码。
N40-1浏览器测试改为动态端口、随机源目录token身份核对、子进程退出检查和finally清理；两类真实浏览器回归PASS，未执行专门占用端口注入，不夸大测试范围。
测试：rn40-fix.mjs、library-demo-browser.mjs、library-demo-contract.mjs、workflow-cli.mjs均退出0。证据native-work/rn40-fix/result.json、validation.md与library-demo/browser-result.json。浏览器仍覆盖画布变化、默认恢复、右侧布局、离页释放/重新进入。生产未apply，未重跑完整同步或发布。
三轴自检：需求覆盖PASS（两个阻塞定向关闭证据）；计划一致性PASS；产物质量PASS（已测范围）。正式关闭由独立review确认，本批仍待复审；第42节记录的NO-GO历史不改写，第40–41文档整理尚未被该review验收。请复审RN40-1/2并合并检查第40–41节，不推进新阶段。

## 45. 示例位置与代码高亮对齐（计划，2026-11-12）
用户明确要求按现有库页面：Examples位于最后且代码高亮。授权执行，沿用Plan Approved。修改docs生成器及文档测试，将示例移至使用限制后，语言类对齐Wall的language-ts；重生成独立预览，浏览器断言最后标题、hljs标记和实际token颜色。仅本批布局修正，不改生产库，不代替RN40复审。

## 45. RN40修复及第40–41节文档整理独立合并Review（2026-11-12）

Phase Review；使用sdd-riper-one，先读native-work/rn40-fix/validation.md及第43–44节，再核查实际实现、重跑定向测试及两类文档浏览器链。结论分开：**RN40修复批次GO，RN40-1/RN40-2 CLOSED；合并第40–41节文档整理的本批整体NO-GO**，仅新增RN45-1为阻塞。不回退此前已成立的正常Demo链结论。

### 45.1 具体问题与关闭条件

**RN45-1 / P2 / 文档整理阻塞：展开“完整签名”仍丢失实际类型字段。** `tools/3d-component-studio/intake/docs.mjs:21、30、32–33`调用TypeScript signatureToString/typeToString时未禁用默认截断；`:47、60`仅把已截断文本放入“查看完整类型/完整签名”折叠区，不能恢复信息。对应第40节“长类型可展开查看完整内容”、第41节“不伪造简化类型”的明确要求。

独立反例：long-type.mjs生成公开方法，其返回对象有field0至field34共35个number字段，调用真实inspectApi→renderDocs。实际提取签名为`method(): { field0: number; ... field11: number; ... 22 more ...; field34: number; }`（此处前一省略为报告缩写，`... 22 more ...`是工具真实输出）；field12至field33在生成HTML的完整签名内均丢失。完整原文见long-type.json、long-type.html。它不是UI摘要折叠，而是源提取阶段不可恢复的信息损失。现有library-docs.mjs只断言章节/文字顺序等，未验证长类型展开后的内容完整性，故PASS不能关闭此要求。

关闭条件：对相关构造/方法签名、参数字段及属性类型使用不截断的TypeScript格式化，或等价的完整内容提取；摘要可以简化，展开内容必须保留全部字段/联合分支。增加真实inspectApi→renderDocs长返回类型、字段类型及必要签名反例，逐项核对中间字段存在，再回归两类文档页面。不能仅断言details存在或字数增加。

### 45.2 历史关闭情况与证据

|事项|结论|实际依据|
|---|---|---|
|RN40-1 普通文本误替换|CLOSED|core.mjs:101–110仅收集import/export moduleSpecifier的AST位置，倒序替换。独立副本重跑rn40-fix，真实plan转换产物经esbuild执行；两类别名导入/导出可用，普通显示字符串和注释保持。|
|RN40-2 DOM/释放函数契约|CLOSED|core.mjs:145–167以虚拟TS夹具验证DOM赋值、无参同步释放，并检查原返回类型any/unknown/异步。wrong-input、required-disposer、async-init、async-disposer实际拒绝；宽DOM、可选释放参数、少形参合法函数及两模板通过。严格诊断限定入口/夹具，原全模块非严格检查保留，未强制本批修复历史严格空值问题。|
|N40-1 服务归属|已修正（非阻塞）|library-demo-browser.mjs:12–17、28–29动态端口、随机token响应、退出监测及清理。本轮在新独立副本实际启动服务并通过身份核验；未另做端口抢占故障注入，不宣称覆盖该竞态。|
|正常Demo与文档顺序|本轮回归通过|当前模板生成两类-docs页面；浏览器验证示例先于Constructor、保留使用限制、对象空Properties隐藏，并实际调参改变画布、重置、右侧控件、导航释放/重入及无pageerror。|

### 45.3 文档实现与验证有效性

- docs.mjs:35、46–61从真实JSDoc提取用途、示例、remarks；页面依次用途/Demo/示例/构造及参数/非空属性方法/使用限制。空示例、属性、方法、限制按数组条件隐藏；源码默认值与控件参数表保留。维护design/engineering不再整段展示，不能自动将任意旧工程说明转成使用限制，该边界已在第41节披露。
- 两类模板JSDoc的更新参数、默认静态、宿主所有权、按秒tick及释放说明与实际方法实现对照一致。template-runtime-comparison.json将当前两类index.ts与上轮审查捕获版本移除注释后转译比较，输出均相同，未发现本批文档注释改变运行行为。
- core.mjs仍复制design.md、engineering.md、preset.json并保留人工notes；本轮未发现文档精简删除这些交付文件。页面不自动展示它们不等于文件丢失。对任意业务仍需开发将使用限制写入JSDoc，不能从模板通过推广。
- 本轮在native-work/rn40-independent-review中复制上轮真实验证库及候选，未覆盖历史副本/报告。维护rn40-fix.mjs、library-docs.mjs以独立脚本副本只改导入定位和证据路径后复跑，均退出0。浏览器采用当前library-demo-browser的动态端口/身份逻辑，额外检查本轮-docs页面标题；两类退出0，正常调参、恢复及离页继续通过。没有把仅有canvas或data-disposed当作完整视觉/GPU释放证明。
- 本轮结果：fix-results/result.json、docs-result.json、browser-result.json；反例：long-type.mjs/json/html；行为对照：template-runtime-comparison.json；脚本副本prepare.mjs、rn40-fix.mjs、library-docs.mjs、browser.mjs均保留。顶层result.json是为了定位副本而复制的上轮索引，不是本轮重新执行完整入库构建的证明。

### 45.4 三轴矩阵与最终判定

|轴|RN40修复批次|合并文档整理整体|
|---|---|---|
|需求完成度|PASS：两个原反例关闭|PARTIAL：完整长类型承诺未满足|
|计划一致性|PASS：AST限定及实际调用契约|PARTIAL：页面结构符合，展开内容仍截断|
|产物内在质量|PASS（定向范围）|PARTIAL：正常模板回归通过，长类型反例漏检|

Overall Verdict：**RN40修复GO；本次合并验收NO-GO**。仅RN45-1需要整改并定向复审，不重开RN40-1/RN40-2，不要求重做全部既有链路。

Plan-Execution Diff：修复与第43节计划相符；文档整理除RN45-1外未发现实质偏差。本轮未重跑完整入库apply/同步/发布，也未重验全部任意宿主、动画或初始化失败资源清理；沿用既有结论及边界，未测项不自动作为失败。技术审查不代签用户视觉、功能必要性及生产接纳确认。未修改实现、生产库或旧证据，未发布。仅追加Spec和独立证据，回读与历史前缀保留检查见append-verification.json。
## 46. 示例位置与高亮修正结果（2026-11-12）
第45节实现完成：生成器Examples移至最后，使用与现有Wall一致的language-ts；creator入库说明同步顺序。两份独立页面重生成，原URL不变。library-docs.mjs及library-docs-browser.mjs退出0：最后标题为Examples，代码节点有hljs标记/keyword token且关键词计算颜色与正文不同，无pageerror。实际截图已查看，确认示例在底部并呈现语法色彩。证据仍在native-work/library-demo/docs-result.json、docs-browser-result.json和*-docs.png。
需求/计划/质量三轴自检PASS（此布局修正）；未改生产库，未推进下一阶段。历史示例提前的方案由用户本次明确纠正，以本节为准；RN40复审状态不因此自动更新。待独立review合并核查。

### 独立Review并行变更补注（2026-11-12，RN40复审）

追加后回读发现另一任务已在第890行加入“第45节 示例位置与代码高亮对齐（计划）”，本轮独立Review正文从第893行开始，标题序号重复；遵守仅追加限制，不改历史。本轮RN45-1唯一指本Review的长类型截断问题，不指示例位置计划。审查与浏览器证据对应本轮读取/执行时的第40–41、43–44节版本；并行新增的Examples末置与代码高亮计划不在本轮验收范围，后续布局改变不由本轮顺序断言背书。两项RN40关闭与长类型截断结论均不依赖示例位置。
## 47. 示例末置与实际高亮独立Review及未结项合并（2026-11-12）

Phase Review；使用sdd-riper-one，核对第45节“示例位置与代码高亮对齐”计划及第46节结果，同时回归前次RN45-1。Overall Verdict：**第45–46节示例位置/高亮调整GO；合并第40–41节文档整理整体仍NO-GO，仅RN45-1保持OPEN。** RN40-1/RN40-2的CLOSED不重开。这里的RN45-1指前次独立Review长类型截断问题，不指重号的第45节布局计划。

### 核验结果、问题及关闭条件

1. 本布局增量未发现新增阻塞。`tools/3d-component-studio/intake/docs.mjs:59–61`按Methods、使用限制、Examples排列，Examples位于页面末尾；来自实际源码JSDoc的examples经过HTML转义，使用language-ts，有内容才生成。`skills/create-3d-component/references/library-intake.md:29`同步了末置规则。用户最新明确要求覆盖旧“示例提前”方案，当前末置不是计划回退。
2. 独立Edge headless实测两类-docs页：最后h3均为Examples；对象空Properties不显示，宿主Properties正常保留。代码具有hljs及keyword token；对象4个、宿主2个keyword token，正文计算颜色rgb(36,41,46)，关键词rgb(215,58,73)。并核对高亮后的完整示例文本等于真实JSDoc示例（仅归一化DOM换行），不是只验证class名字或截图存在。两页无pageerror；空examples反例不生成Examples章节。
3. 服务内容身份独立核验：使用当前inspectApi+renderDocs、对应真实库副本源码API与已有参数模块生成预期HTML，再与17911/17912返回的两份页面逐字比较，仅排除Vite注入的固定`/@vite/client`脚本。比较通过，避免仅凭固定端口或历史报告认定页面最新。本轮未启动/终止这些既有服务，也未写入其目录；全部截图/脚本/HTML证据写入新审查目录。首轮比较因Vite正常注入脚本失败，限定归一化该脚本后通过，不是产品缺陷。
4. **RN45-1 / P2 / OPEN仍为唯一合并阻塞。** `intake/docs.mjs:21、30、32–33`仍以默认signatureToString/typeToString提取，`:47、60`把已截断文字放入完整类型/签名详情。当前代码重新执行35字段原反例，仍输出`... 22 more ...`，field12–field33在展开HTML中缺失。新末置/高亮变化不修复此问题。关闭条件不变：不截断地提取构造/方法/字段及属性类型，展开内容保留全部信息；真实提取→渲染测试逐一核对中间字段/联合分支，再回归两类页面，不只检查details、字数或高亮标记。

### 测试有效性与范围

已阅读当前library-docs.mjs及library-docs-browser.mjs：维护测试确实检查Examples末置、hljs/token及计算颜色，支持本布局声明；其固定地址页面缺少内容身份断言，本轮独立校验补足。该测试不覆盖长类型信息完整性，因此其PASS不影响RN45-1。

本轮未重跑完整入库/同步/发布、RN40全部历史用例或资源释放全部场景；保留上一轮通过结论，无新回退证据不无差别重做。当前两类Demo实际启动，未将此或截图提升为用户视觉/业务必要性确认。生成规则测试与浏览器检查见examples-independent-review/review.mjs、browser-result.json、两份HTML/截图；长类型反例见long-type.mjs/json/html。未修改实现、生产库或旧证据，未发布。

### 三轴Review Matrix

|轴|第45–46节布局增量|合并文档验收|
|---|---|---|
|需求完成度|PASS：末置、真实高亮、文本保持|PARTIAL：完整长类型仍不满足|
|计划一致性|PASS：符合最新用户顺序与生成说明|PARTIAL：完整展开承诺尚有缺口|
|产物内在质量|PASS：当前内容身份及真实浏览器独立核验|PARTIAL：RN45-1原反例仍成立|

Plan-Execution Diff：本布局增量无实质偏差；未将新布局GO混同整个文档验收GO。下一步只需修复RN45-1并定向复审，不要求重复调整已通过的示例位置/高亮。仅追加本Spec，保留历史；追加后回读及历史前缀校验见examples-independent-review/append-verification.json。
# gts-ep-charts-coder 集成方案

状态：第二轮精简与维护适配已实施，验证结果见下；浏览器与视觉交互验收待完成。

## 第一轮实施记录（历史，第二轮变更见下）

- 新入口位于 `skills/gts-ep-charts-coder/SKILL.md`，直接读取设计公共入口；原始两个 skill 未修改。
- 第一轮工程 scripts、references、components 独立复制；未复制页面 patterns。第二轮已移除 components 与无关 references。设计发布内容原样放入 design/，不包含 .git。
- 图表适配层为 `src/assets/charts/*.css`，仅允许容器 class 下的 `--page-chart-*` 声明。build 增加范围检查，不修改原工程的 token 检查。
- 来源及逐文件 SHA-256 记录在 `docs/gts-ep-charts-coder/upstream-sources.json`。`node tools/gts-ep-charts-coder/check-upstream.mjs` 检查内嵌快照；加 `--source <设计发布目录>` 只读比较新版，输出增删改，不自动覆盖。
- 工程回归 `scripts/verify-build.mjs`：41 项通过。
- 图表集成回归 `tests/gts-ep-charts-coder/integration.mjs`：审查后 10 项通过，包括柱图、平行坐标静态构建，以及非法作用域、容器外声明、EP 变量覆盖、未映射模块、未知 token、缺失资源拒绝和同步参数检查。
- 图表测试 fixture 是编译能力用例，不是视觉规范 golden example。复杂图表实际交互和视觉合规尚未验证。
- 当前浏览器工具拒绝 file:// 协议，未打开离线预览，未执行视觉、resize、Tooltip 或图片导出验收。不得将上述静态测试称为端到端验收。
- 后续发布前完成浏览器验收及真实设计任务效果评估；自动写入式同步暂未实现，当前提供只读差异检查。

### 实现审查

修复图表 token 可在容器外声明的检查缺口；同步脚本缺少 source 参数时立即失败，避免误扫当前目录；统一集成测试初始化与 fixture 页面名，避免遗留无关示例页。修复后工程回归 41 项、集成检查 10 项通过，design/ 内 Markdown 相对链接检查无死链。浏览器验证状态不变，尚未满足完整发布验收。

## 1. 目标与来源

### 第二轮整改范围

1. 移除 components、references/assets、references/design、原页面 code-rules/design-language/error-checklist/components_index，以及 copy-components、verify-foundation 等无关维护工具；保留环境、编译、预览、图标和主题运行必需资源。token-catalog 只供 EP 外围控件和语义 token 查询。
2. 初始化改成最小 ECharts 图表骨架，数据经服务层，不包含工作台、分页或聊天组件。骨架是技术起点，不是设计规范 golden example。
3. 主题接入参考改为图表适配层提供配色；EP 主题与图表视觉分开。图表规范没有暗色定义时不能声称暗色合规。
4. 源码接入 README 明确直接 ECharts 依赖、专用 CSS、宿主接入条件和静态验证边界，移除“任何工程直接可用”的承诺。
5. 双来源检查：设计和工程分别提供只读差异、内嵌快照检查；工程复制文件分类为原样、适配、排除、新增。版本与哈希记录可通过显式维护命令更新，默认检查不写入。
6. 全包检查覆盖 Markdown 链接和适配清单，不限 design/；避免删除资料后残留入口。
7. 建立普通和复杂图表真实任务验收说明，覆盖规范选择、数据语义、目标尺寸、交互、主题和导出；静态 fixture 不能替代该验收。受当前 file:// 浏览器限制的项目标为待执行，不用其他浏览器路径绕过限制。

实施后运行初始化、构建回归、图表正负用例、双来源差异与全包引用检查，并更新实际结果。精简只针对本次新 skill，不改原始来源。

新建 `skills/gts-ep-charts-coder/`，组合图表设计专家的方法与规范，以及 gts-ep-coder 的工程生成、编译检查和离线预览能力。用户只调用一个 skill。

- 设计来源：`D:/cyc/project/octo/gts/test/charts/chart-design-expert`，当前 CHANGELOG 标识 0.6.15。
- 工程来源：本仓库 `skills/gts-ep-coder/`，当前入口版本 0.3.0-rc.1。
- 集成方式参考：chart-vue-creator 的设计资料隔离、宿主适配及版本同步方式；不继承其 fastui 工程、TypeScript、预览协议或构建命令。
- 实现以当前两份来源为依据，不读取或恢复已删除的 skill、旧 spec、测试及交付记录。

第一版交付 Vue 3 + JavaScript + ECharts 源码，以及 ep-coder 现有离线预览。暂不扩展 TypeScript，不抽取跨 skill 共享构建框架，不修改原始设计包和 gts-ep-coder。

## 2. 规则职责

| 范围 | 权威来源 |
| --- | --- |
| 分析方法、图表选型、数据语义与能力边界 | chart-design-expert |
| 图表颜色、字体、布局、轴、图例、Tooltip、状态和交互规范 | chart-design-expert 按任务选定的规范 |
| 工程结构、模块解析、组件绑定、环境准备、编译和预览机制 | gts-ep-coder |
| EP 标准控件 API、导入与运行机制 | gts-ep-coder |
| 用户明确要求 | 优先遵从用户要求；能力不支持时说明限制 |

不使用“下半段规则一律优先”覆盖设计规范。先判断规则适用范围，再解决真实冲突。EP 主题不能成为改写图表视觉值的理由；设计包也不负责决定宿主构建命令。

保留工程编码约束中与运行正确性有关的内容，避免整体加载 ep-coder 的页面设计方法、布局案例和视觉规则。EP 组件资料按实际控件需要读取。

## 3. 包结构与设计接入

```text
skills/gts-ep-charts-coder/
  SKILL.md
  design/                    # 设计包原始发布内容
  scripts/                   # 工程脚本及其依赖的预览、模板资源
  references/
    chart-host.md            # 宿主协议与图表适配边界
    ...                      # 工程必需规则，按需保留
```

工程运行资源以实际依赖闭包为准，不能只复制 build.mjs；包括环境配置、初始化模板、加载器和运行库供应机制。采用独立复制，记录与来源的差异，不依赖运行时跨 skill 调度。第二轮移除原页面组件和设计资料，仅保留宿主协议、按需接线、token 查询及环境配置。

`design/` 保留原目录关系与内容，不就地改写规范。当前设计包提供 `01-router/design-entry.md`，不注册第二个 skill。新入口直接读取该公共入口，不重复抄写其方法路由和按需读取表。

宿主适配明确：当前已有承载工程，使用 JavaScript、既定初始化流程及离线预览，因此公共入口“无承载工程时默认 Vite + TypeScript”分支不适用。参考资产只复用适用的设计和算法，不复制其 Vite 配置、TS 文件及测试依赖。未来上游出现真实冲突时在宿主适配层处理，不修改 design/。

## 4. 工程流程与适配

流程沿用工程来源：确认 Node → ensure-env → init → 编写业务源码 → 按需 fetch-icons → 清理未使用 starter → build → 预览与交付。

具体参数、目录与输出字段从当前脚本核对后写入新入口。保留来源的环境失败处理和首次验证加最多两轮修复重跑上限，不以另起 Vite、手写静态 HTML 或跳过检查代替门禁。

### 4.1 图表运行

- build 已映射 echarts 与 vue-echarts；第一版优先直接使用 ECharts，按映射支持的方式导入。
- 不默认支持 echarts/core 等子路径；使用前必须同时核对编译解析和预览 moduleCache。
- 图表初始化、容器尺寸变化、事件解除和实例销毁都在业务组件中正确处理。
- 图表数据保留 ep-coder 的服务层边界：业务数据经 src/api/ 获取，mock 由服务层消费。
- 预览和交付使用同一份图表源码，不制作仅用于展示的另一套实现。

### 4.2 样式与 token

图表规范决定视觉值，token 只承担表达和复用。已有 token 语义与值均匹配时复用，否则使用有来源的图表专用 token 或常量，不能用近似 EP 值替换规范值。

实现前核对三处：页面 CSS 的硬编码检查、token 定义及作用域、ECharts option 的取值与主题更新。Canvas 图表需要实际解析后的颜色，不能假定 ECharts 会解析 CSS var()。

新增图表适配资源与既有 EP 主题桥接分离。若必须调整检查器，只在新 skill 中增加限定于图表适配资源的规则，继续检查未知 token、错误模块、资源缺失及非法全局覆盖；不得整体关闭样式检查或用字符串变形规避检查。适配文件路径及允许范围在实现后补入本文。

设计包未定义的暗色或其他视觉值只能标为设计建议，不声称属于原规范。主题切换 UI 按用户需要提供。

## 5. 验证和交付

ep-coder build 的已核对能力包括 Vue SFC、CSS/Less、导入导出、组件绑定、资源和部分 token 检查，以及随包 UMD 的无 DOM 导出探测。

build 输出 `RUNTIME: not-run`，没有挂载业务页面。`RESULT: OK` 不能证明图表显示、交互或视觉合规，也不等同于目标业务工程的生产构建通过。

验收分层记录：

| 层级 | 判据 |
| --- | --- |
| 编译和静态检查 | 最终源码 build 返回 OK；WARN 已处理或如实说明尚未解决 |
| 浏览器运行 | 实际打开预览，图表挂载、资源和控制台状态符合预期 |
| 视觉与交互 | 按任务规范检查目标尺寸、布局、Tooltip、图例及实际承诺的交互 |
| 图片导出 | 任务要求或适用门槛要求时实际执行并检查结果 |
| 真实业务接入 | 未执行时明确待接入，不因离线预览通过宣称完成 |

没有浏览器验证能力时记录未执行；需要该项才能满足任务验收时，不宣称全部验收完成。每次运行源码修改后重新 build，交付本次 HTML_PATH 指向的可点击预览。

默认交付预览链接，必要说明写在回复中；工程交接文档仅在用户要求时生成。此处采用宿主交付方式，规则集中维护在 SKILL.md 的交付步骤。预览依赖和脚手架通用说明随工程保留。

来源基线放在 docs/gts-ep-charts-coder/，检查工具放在 tools/gts-ep-charts-coder/；两者服务于仓库维护，不随运行 skill 分发。

## 6. 上游同步

设计来源和工程来源分别记录版本、commit（可获取时）及文件哈希清单；本地发布包没有独立 commit 时以内容哈希标识，不把父仓库 commit 当作该包的独立版本。

设计更新流程：

1. 查看 CHANGELOG 与文件差异，明确新增、修改和删除项。
2. 按发布内容清单整体同步 design/，保持相对路径和原始内容，清除仅属于旧快照的过期文件。
3. 检查公共入口及其引用、宿主协议和新增规范的兼容性。
4. 检查是否意外引入嵌套 SKILL.md 或上游仓库治理文件。
5. 更新来源记录，运行链接及受影响场景回归。

直接引用公共入口减少人工复制，但不等于更新自动兼容。工程更新单独比较脚本和资源，保留图表适配差异后运行工程回归。同步工具如需实现，应先支持只读差异预览并限定写入目标，不能用无范围约束的覆盖命令。

## 7. 实施与验收清单

- [ ] 建立新 skill 入口和来源记录，复制工程运行必需资源。
- [ ] 用最小 ECharts 页面跑通初始化、build 和离线显示。
- [ ] 接入设计公共入口，完成 JS、模块映射和图表样式适配。
- [ ] 普通图表用例：柱图或折线图，验证规范、Tooltip、resize 和数据更新。
- [ ] 复杂图表用例：按设计方法选择平行坐标或箱图叠散点，验证多系列、目标尺寸及相关交互；只检查任务承诺的能力。
- [ ] 失败用例：错误导入、缺失资源、未知 token 仍被门禁拒绝，合法图表规范值不被迫替换为 EP 值。
- [ ] 检查设计包内容一致性、入口链接、同步差异与来源记录。
- [ ] 按工程改动范围执行来源适用的维护测试，记录实际执行结果。
- [ ] 完善预览交付和版本记录；交接文档仅按用户明确要求提供；文档状态改为已实现前确认上述结果。

先验证最小工程，再接设计与适配，最后完成复杂场景和更新回归。本文随实现更新，不将待实施项表述为已完成能力。


## 第二轮完成情况与维护命令

已实施：包精简、最小 ECharts 初始化、服务层图表示例、主题协议适配、源码接入说明改写、双来源检查与显式基线更新、全包引用与分类检查。移出的新 skill 文件保留在本次工作目录，不修改原始来源。

当前有效维护入口（在仓库根目录执行）：

```bash
# 检查包内快照（不写入）
node tools/gts-ep-charts-coder/check-upstream.mjs
node tools/gts-ep-charts-coder/check-upstream.mjs --kind engineering
node tools/gts-ep-charts-coder/check-package.mjs

# 比较新的来源（不写入；输出 ADDED/REMOVED/CHANGED）
node tools/gts-ep-charts-coder/check-upstream.mjs --kind design --source "<设计发布目录>"
node tools/gts-ep-charts-coder/check-upstream.mjs --kind engineering --source "<gts-ep-coder目录>"

# 完成同步、审查和回归后，显式接受新基线
node tools/gts-ep-charts-coder/check-upstream.mjs --kind design --source "<设计发布目录>" --record --version "<版本>" --commit "<可核实的commit>"
node tools/gts-ep-charts-coder/check-upstream.mjs --kind engineering --source "<gts-ep-coder目录>" --record --version "<版本>"
```

commit 不可核实时省略。记录工程基线会生成 unchanged/adapted/excluded 分类、新增文件表和内嵌文件哈希；该操作是维护者接受变化，不是自动证明变更正确。设计记录要求 design/ 与指定源内容一致。工程代码和适配仍由维护者审查合入，不自动覆盖本地修改。

验证结果：工程回归 41 项、集成检查 15 项通过；后者包含新初始化的实际编译，以及设计/工程来源差异检查。全包 79 份 Markdown 的相对链接和文件分类检查通过。测试是静态与隔离加载器检查，不是浏览器验证。

真实任务及记录模板见 [acceptance.md](acceptance.md)。普通/复杂图表生成效果、浏览器运行、resize、Tooltip、主题和图片导出仍待实际执行，原因是当前工具禁止 file://。当前不能标记为完整发布验收通过。


## 2026-11-05 交付格式适配

按用户要求，图表 skill 与 gts-ep-coder 采用相同预览 artifact 格式：`<artifact type="text/link">本次成功构建的 HTML_PATH 实际绝对路径</artifact>`。规则集中维护在 SKILL.md 第 9 步，默认交付一个预览 artifact。此次仅变更交付指令，不改变工程生成与编译行为。

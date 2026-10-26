# Feature Spec：generate-3d-scene 可选 Blender 缺口建模

## 0. 状态与边界

- 日期：2026-10-16，Asia/Shanghai。
- Phase：Draft / Research complete；尚未实施、尚未实跑 Blender。
- 本轮授权：调研、检查当前代码、建立独立 Spec；不视为已批准安装 Blender/MCP 或实施全部功能。
- 原优化 Spec 保持原样：generate-3d-scene-optimization-spec.md 最新状态为 P5 PASS、P6 未开始。它的“不引入 Blender”只约束原优化项目；本功能单独定义后续变更。
- 保留全部工作区改动，包括未跟踪的 p6-edit-save.mjs、p6-reload-check.mjs。本轮不执行 P6，不提交。

## 1. 需求与现状

目标：资产检索、近似改造、组件拼装无法满足时，允许选择 Blender 建模，交付可复用且能在现有 three.js 编辑/导出链路工作的模型。

当前代码证据：
- SKILL.md 降级阶梯第4层与 references/modeling-channels.md 将 three.js 直写作为唯一过程化路线，明确否决 Blender 和 GLB 生成脚本。
- scripts/validate-model.mjs 已检查 GLB/glTF；scripts/import-assets.mjs 已提供 staging、manifest、入库、索引流程，可复用。
- template/src/scene-core/handlers/registry.ts 的 makeAssetNodeFactory 是 GLB 统一入口，不应另写运行时加载器。
- 当前 PATH 未发现 blender；这不证明整台机器未安装。尚未检查安装目录或配置路径。

## 2. 技术裁决（建议）

没有经统一业务基准证实的“业界唯一最好”。针对本项目，优先采用本地后台 Blender Python 作业；MCP 是可选工具包装，不是模型生成算法。

| 情形 | 首选 | 原因与限制 |
|---|---|---|
| 简单图元、运行期频繁调整层数/尺寸 | 保留 three.js typed factory | 即时参数响应、无需外部构建 |
| 工业设备硬表面、倒角/布尔/曲线、需要分件 | LLM 编写 bpy 脚本，后台 Blender 导出 GLB | 可保留源码、明确尺寸和部件，仍需看图纠错 |
| 需要持续交互检查/人工共同编辑 | Blender GUI + 社区 MCP | 便于视口反馈，增加常驻进程与状态管理 |
| 有机/照片写实道具 | 可选图生3D，再 Blender 清理 | 外观潜力高，尺寸、拓扑、部件语义需额外验收；云或GPU非默认依赖 |

纯后台 --background 与虚拟显示方案不同：前者不提供普通GUI视口，预览走离线渲染；Xvfb 方案实际运行GUI，主要面向Linux，不能直接作为当前Windows落地方案。

## 3. 设计合同

### 3.1 路由

资产命中 → 近似改造 → 组件拼装 → 按对象选择 three.js 或 Blender。不能因为资产检索一次无结果就启动 Blender；记录检索词、缺口、选路理由。

建议首版显式 --modeling three|blender，默认保留 three；auto 在样本验收后另行启用。无 Blender 时明确环境不可用，再按允许的策略回退，不冒充完成。

### 3.2 作业接口

拟新增 scripts/model-with-blender.mjs 与 references/blender-modeling.md、受控 Python 建模/导出模板。用参数数组启动进程，不拼 shell 命令；显式 blender 路径、后台模式、factory startup、Python异常退出码、硬超时、Windows进程树清理。

输入：建模Python源码、业务尺寸/部件要求、输出目录、预算、预览视角、固定种子（适用时）。每任务独立 staging。输出：源码、参数JSON、model.blend、model.glb、预览PNG、结构/预算报告、工具版本及源码hash。保留源码是可审查性基础，不能只交二进制。

Python执行拥有本机文件/网络权限，后台模式不构成沙箱。首版只执行本任务生成并审查的源码；不自动运行下载的任意脚本，不自动安装插件/联网拉资产；Blender官方运行时按§9部署。后续服务化再定义受限worker隔离。

### 3.3 资产合同

- 单位米、原点/朝向与现有 model-spec.md 对齐；GLB导出后以three.js实测尺寸、朝向，防止重复轴转换。
- mesh/部件稳定具名，禁止导出时随意合并需编辑的部件；材质使用glTF支持的PBR子集，程序化材质必要时烘焙。
- 修改器在导出时得到确定结果；先以静态设备为首版范围，不承诺骨骼/动画/Geometry Nodes完整往返。
- GLB不自带原Python业务参数响应。运行时transform/材质编辑复用现有能力；尺寸/拓扑重建需要离线重跑，或继续用three.js factory，不能宣称全部参数即时生效。
- 先验证再发布，失败保留诊断且旧模型hash不变；缓存用源码、参数、Blender版本、导出设置及依赖内容hash，不要求不同Blender版本字节一致。
- 新模型先作为任务工程资产；只有明确入库复用时才调用 import-assets，不让每次缺口建模自动污染共享库。

### 3.4 质量闭环

建模 → GLB导出 → validate-model --strict → three.js真实加载/命名槽位/包围盒 → 同视角截图检查 → 有界修正 → 工程编辑保存重载/运行包保真。

沿用坏类硬FAIL、预算WARN/strict口径，避免另设冲突预算。尺寸偏离、缺部件、黑材质、加载失败均不可仅凭Blender退出码判PASS。最多两轮自动修正，仍失败交付真实失败原因与可用降级。

## 4. 分批计划及验收

B1：环境探测与最小后台原型。一个带倒角工业箱体，保留Python/blend/GLB与三视图；证明真实three.js加载、尺寸与命名正确。
B2：作业runner与失败保全。覆盖成功、Python异常、超时、缺Blender、无GLB/损坏GLB、校验失败、失败时旧模型不变、带空格路径。
B3：skill文档路由及资产接入。仅在实施本功能时更新当前否决条款；不修改原优化Spec，复用makeAssetNodeFactory/init/import契约。
B4：两个代表样本（工业泵/配电柜）对照当前three路线：建模与修正总时长、轮廓/分件/尺寸、三角形/draw calls/贴图、编辑往返和实际运行包保真。达到业务收益后再决定auto和MCP。

MCP首版不必引入。需要跨客户端统一调用时，在稳定作业接口外包装generate/inspect/render/export等有边界工具，复用同一验证发布链，不另建第二套建模实现。

## 5. 调研来源（2026-10-16）

- Blender Python API： https://docs.blender.org/api/current/info_advanced_blender_as_bpy.html
- glTF导出API： https://docs.blender.org/api/current/bpy.ops.export_scene.html
- 社区MCP主项目（原blender-mcp，现重定向mcp-for-blender）： https://github.com/ahujasid/mcp-for-blender
- 虚拟显示headless分支： https://github.com/digitable-lol/blender-mcp
- 商业生成API能力示例： https://docs.meshy.ai/en
- 本地生成方案示例，不宣称最新最优： https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1

上述是能力和架构证据，没有本地横评，不可写成排名。Blender manual网页本轮抓取失败，命令参数需B1对安装版本实际 --help 校验。

## 6. 交接

本轮只新增此Spec，未改skill实现或原优化Spec。下一步按B1做真实原型，再决定是否实施B2–B4；原项目P6维持独立排期。待确认项：使用哪个Blender发行版/安装路径，以及代表设备的尺寸或参考图，可在原型实施前按当前环境选择并记录。

## 7. Windows / macOS 跨平台硬要求（2026-10-16 用户补充）

用户要求skill在Windows和macOS正确使用。本节为新功能实施合同，优先于前文仅以Windows举例的细节。路线可跨平台，不等于现有skill全链已通过双平台验收。

- 统一Node.js runner + Blender自带Python/bpy，不依赖系统Python、PowerShell、bash、Xvfb、CUDA或MCP客户端。进程用spawn(executable,args,{shell:false})；Windows隐藏窗口。
- Blender发现顺序：显式CLI路径 → BLENDER_PATH → PATH → 平台常用位置。Windows兼容安装版/解压版；macOS支持 /Applications/Blender.app/Contents/MacOS/Blender 及用户自定义.app路径，直接启动内部可执行文件，不用open -a做作业runner。
- 路径用node:path/Python pathlib；支持空格、中文、Unicode、不同盘符；JSON承载参数而非把参数嵌进Python或shell；作业输出均为绝对路径，缓存不依赖机器绝对安装路径。
- 固定已实测的Blender版本/导出设置白名单，探测版本和CPU架构并报告兼容性；不自动追最新。macOS Apple Silicon和Intel分别列兼容项，不能用arm64实测冒充Intel通过。最新发行版不一定支持Intel Mac，若纳入Intel则另选仍支持该架构且可实测的版本；不承诺任意历史OS。
- 预览以Cycles CPU离线低采样渲染作为跨平台基线，GPU仅可选加速；建模/GLB导出不依赖GPU后端。实际性能与渲染可用性仍须双平台原型验证。
- 隔离每任务用户配置/脚本目录，使用factory-startup和确定参数；不修改全局偏好，不自动绕过macOS Gatekeeper。签名/首次启动阻碍应明确报告环境问题。
- 超时清理分别实现Windows进程树终止、macOS受控进程组终止；仅清理本任务创建的进程，禁止按名称杀全部Blender。明确区分超时、信号、Python失败、导出失败与环境不可用。
- 三维结果按尺寸容差、命名槽位、材质和图像质量验收；不要求跨OS/CPU的GLB或渲染PNG逐字节相同。缓存包含OS/架构、实际Blender版本、导出配置及渲染后端。

### 7.1 必须完成的验收矩阵

| 环境 | 门禁 |
|---|---|
| Windows x64 + 选定Blender版本 | 真实执行B1–B4相关链路、异常/超时/旧产物保全、Unicode和空格路径 |
| macOS Apple Silicon + 选定Blender版本 | 同上，另验.app探测与进程组清理 |
| macOS Intel | 如提供支持，固定兼容版本独立实跑；未实跑必须标记未验证，不能笼统宣称macOS全部支持 |

两平台均需生成GLB→真实浏览器加载→槽位编辑→保存重载→运行包导出构建验收。同步审查现有ensure-env、CDP浏览器发现/启动、npm调用及路径代码；其缺陷属于平台接入范围，不能因Blender可运行就宣称整个skill跨平台通过。没有macOS执行环境时保存待验清单，状态必须为未验证。

来源：https://www.blender.org/download/requirements/ ，https://docs.blender.org/manual/en/4.2/advanced/command_line/launch/index.html 。支持矩阵以实际选定版本官方要求及双平台证据为准。

## 8. 零付费API与本地美术能力（2026-10-16 用户补充）

- 用户无法接入Hunyuan等生成API，无付费预算。首版禁止依赖付费/云端模型或贴图生成API，不要求本地部署大模型或购买GPU；此前图生3D仅为调研比较，不列入实施依赖。
- Blender为可选本地依赖：使用Blender通道的执行机器需有兼容Blender可执行程序。用户可安装官方版本，Windows也可配置官方解压版路径；skill不自带大型二进制，按§9自动部署私有运行时。未安装者仍可用原资产库/组件/three.js通道，明确记录降级。
- 不要求交付场景的浏览者或二次开发者安装Blender：浏览器运行GLB不依赖Blender；只有重跑Blender建模源码才需要。
- Blender不是自动高质量生成模型。LLM若仅调用cube/cylinder仍得到图元拼接；验收应检查轮廓、比例、倒角、连接、厚度、分件与材质，不能以使用Blender替代质量证据。
- 建模模板应支持按需求选择轮廓挤出/旋转体、曲线扫掠、倒角、实体化、布尔、必要的细分与法线处理；图元组合仍适用于工业零部件，不机械要求所有模型连成单一网格。
- Blender支持UV展开、贴图绘制与烘焙。首版先覆盖静态硬表面资产：明确UV层，按模型选接缝或自动展开，检查明显重叠/拉伸；自动展开不等于人工级UV质量。
- 基础金属/塑料/玻璃直接导出glTF兼容PBR材质，不强制每件都生成UV贴图。铭牌/刻度/警示条可本地绘制图片；表面噪声等使用Blender程序化材质，必要时烘焙为baseColor/normal/roughness等图片再导出。程序化节点不能假设可原样进入GLB。
- 烘焙使用CPU可执行路径，控制分辨率、采样与超时；颜色贴图/数据贴图正确色彩空间、切线法线及glTF通道打包需在three.js加载后核验。不承诺无参考、无图像模型即可自动得到照片级复杂纹理。
- 本功能零软件/API费用不等于零成本：仍消耗本机磁盘、CPU时间，以及现有LLM使用额度；不为此新增服务订阅。

## 9. 自动部署私有 Blender 运行时（2026-10-16 用户需求，覆盖此前手动安装默认）

目标：普通用户无需自行安装、配置PATH或操作Blender。首次确实需要Blender建模时，skill自动准备用户级私有运行时；正常路径无需管理员权限。首次显示简短下载/准备进度，后续缓存复用。不能承诺所有安全策略/离线环境下完全零交互。

### 9.1 部署设计

- 新增独立ensure-blender运行时管理器，供建模runner调用。优先复用已验证兼容的显式路径/现有运行时，否则部署私有副本，不改系统Blender。
- 固定发行清单：版本、OS、CPU架构、官方URL、受审查的SHA-256、最低系统要求；不解析网页选择latest，不在运行时随意安装第三方包。优先验证4.5 LTS某一具体补丁版在Win x64/mac arm64/mac x64上的共同能力，尚未选定补丁版本或实测。
- Windows下载官方ZIP到用户缓存，安全解压；macOS下载对应架构官方DMG，以hdiutil无交互挂载、ditto保留bundle属性复制Blender.app到私有缓存，finally卸载本任务挂载点。调用内部可执行程序，不写/Applications，不调用brew/winget/sudo。
- 缓存路径使用平台用户缓存目录（Windows LOCALAPPDATA，macOS ~/Library/Caches），具体子目录在实施时统一；支持自定义工具缓存目录及内网预置包。代码仓库/skill包不携带巨型二进制。
- 下载有超时、大小限制、有限重试、完整校验；staging校验及后台自检通过后原子发布。并发安装锁、残留恢复、已有可用版本保全、空间检查、显式清理命令必备。解压防越界/不安全链接，不能只验证哈希而忽略解包路径。
- 首次用Blender时才下载；首次离线且没有缓存/预置包时明确环境不可用，允许走原有建模通道但报告原因。支持内网受控镜像/预置缓存，仍以固定可信哈希校验，不要求用户机器能访问外网。
- macOS保留官方应用完整签名与资源；校验签名/系统策略并实际后台试启动。不删除quarantine、不关闭Gatekeeper、不自动绕过企业策略；如系统强制授权，返回明确且最少的操作说明。签名/公证成功也不能保证任何企业策略下无提示。
- Windows受控设备也可能阻止下载或执行。应识别下载/执行被拒绝，不能循环安装或提高权限重试。

### 9.2 验收追加

Windows x64、macOS arm64、macOS x64分别在无Blender且PATH无Blender的真实环境验收：首次自动准备→建模/UV/烘焙/导出→二次离线复用。另测中断下载、哈希错误、并发首次调用、磁盘不足、被策略阻止、中文空格路径、缓存损坏及旧版本保全。无法执行的平台标未验证。

用户需求已确认自动部署方向，本轮只更新Spec，尚未下载或安装。B1前增加B0：跨平台运行时bootstrap原型及以上验收；不能把仅在开发机找到Blender当作自动部署完成。

来源： https://docs.blender.org/manual/en/4.4/getting_started/installing/macos.html ，https://download.blender.org/release/Blender4.5/ ，https://support.apple.com/en-us/102445 。

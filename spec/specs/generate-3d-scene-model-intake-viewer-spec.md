# generate-3d-scene：独立模型包检查与跨平台 Viewer

- 类型：Feature Spec。
- 日期：2026-10-21（Asia/Shanghai）。
- Phase：Review。当前结论：MR-R1～MR-R8 已集中修复，本地定向回归和解压发布包闭环通过，证据见 §17.12；macOS、Octo 宿主与大包性能仍未实测。当前交付为单 HTML＋下载文件＋Agent 导入，不含默认服务或宿主桥接。
- 目标目录：`skills/generate-3d-scene`。
- 前置规格：`generate-3d-scene-designer-assets-spec.md`。其资产接收、身份、确认、注入、导出与 DA-R1～DA-R3 修复继续有效；本规格只覆盖交互分流、预览执行和结果回传。冲突处以本规格为准。

## 1. 最终目标与 Done Contract

设计师上传 ZIP，说“这是我们公司的机房模型”，系统即可独立检查模型包并展示完整清单；确认完停下，等待后续设计需求。设计师无需说明检索配置、命令、JSON、浏览器类型或技术验收步骤。

提供与当前场景运行时一致的轻量 Three.js 模型检查页。在 Windows 和 macOS 的兼容浏览器上运行，不以安装 Edge 为前提。没有自动化浏览器能力时，设计师打开检查链接也能完成实际加载、预览与结果回传；不能只有一张无法回写状态的 HTML。

完成标准：
1. 仅接收模型包的路径不初始化业务场景工程、不运行 build-offline、不调用模型检索、不自动入库。
2. 支持包内 GLB/glTF、多文件依赖、完整失败清单及一次整包语义确认。
3. Windows Chrome（无 Edge 路径）、macOS Safari/Chrome 可执行同一检查页；未实际测试的平台必须注明未验证。
4. 浏览器真实加载结果与服务端资产状态一致，不能因仅解析成功或用户口头确认就标为 loadable。
5. 已确认包可在后续需求中复用，上传包优先、缺项检索/降级及最终场景编辑交付不回归。

## 2. 设计师交互与意图分流

| 输入 | 行为 | 停止点 |
|---|---|---|
| ZIP＋“这是我们公司的机房模型” | 接收、检查、预览、建议名称、全量清单、等待确认 | 确认后回复“模型包已准备好，之后可以告诉我要设计什么场景”，停止 |
| ZIP＋“检查这些模型能不能用” | 同上；不能擅自设计机房 | 检查/确认完成后停止 |
| ZIP＋“用这些模型设计一个双排机房” | 记录已有场景需求，先检查与确认 | 用户确认后继续原需求，不重复询问场景是什么 |
| 已确认包＋“现在做一个双排机房” | 复用未变更的资产检查结果，开始生成 | 构建成功交付 |
| 无 ZIP 的场景需求 | 保持既有检索/降级路径 | 不要求上传或包确认 |
| 明确纯几何需求 | 不查库，不强制检查附件 | 保持既有生成路径 |

“这是机房模型”“以后用这些模型”不是生成场景授权；也不等于授权公共上传。只有用途无法判断时才简短澄清，不能先问一串参数阻塞模型检查。

确认交互继续使用聊天：用户可以说“第二个是精密空调，其余没问题”。只有更名、没有确认其他项时不自动确认整包。全不可用包显示失败清单；混合包需用户明确同意有效子集。技术加载成功不等于业务名称被确认。

持久化仍限宿主授权的当前项目/个人目录。无持久能力时不得承诺跨对话自动记住。恢复时从项目内的包状态读取，不依靠聊天记忆，也不扫描其他项目。

## 3. 范围与不做

### In Scope
- skill 默认指令增加“独立接收”与“生成场景”分流。
- 独立模型检查页、预览执行与结果写回。
- 本地 Node 服务运行于 Windows/macOS；不依赖 Windows 专有浏览器路径。
- 复用现有技术检查、资产清单、描述/确认命令、导出和注入。
- 维护回归、文档、打包与验收证据。

### Out of Scope
- 不重写编辑器/引擎，不生成业务场景进行包验收，不增加最终场景浏览器门禁。
- 不开发独立桌面程序或全功能模型管理平台，不引入 Blender/FBX 转换器。
- 不实现视觉云服务；无视觉能力时用中性名称，由设计师看预览命名。
- 不将业务模型、浏览器二进制、node_modules 放进 skill 发布包。
- 不实现公网托管、跨机器代理、账号权限、自动入库或内网 API 改版。
- 不为这项需求强制安装 Playwright 全套浏览器；已有宿主能力可复用。

## 4. 技术决策

### 4.1 单一 Viewer 与运行环境

采用现有 Three.js 版本、GLTFLoader、Draco 解码器和兼容性规则。复用/提取 `asset-preview.mjs` 中可用逻辑，不再维护一份内联渲染字符串和另一份行为不同的可见 viewer。检查页资源全部本地提供，不加载 CDN，不需要真实内网服务。

不另引入 Google model-viewer 作为默认检查引擎：项目已有 Three.js，优先保证检查与最终场景加载一致。模型查看本身只需要简单相机、光照和模型容器，不创建业务工程、不使用完整编辑器模板。

默认打开方式：
1. 宿主支持访问本机服务的内嵌页面时，在宿主中打开检查链接。
2. 否则交付可点击的本机检查链接，由系统默认兼容浏览器打开。Windows Chrome、macOS Safari/Chrome 均不需要 CDP。
3. 宿主已有受控浏览器时，可自动打开同一页面完成检查；这只是启动适配，不建立第二份技术检查实现。

不要求用 Safari 的自动化接口。跨平台主要靠普通 Web 页面和 HTTP 回传，不靠为每种浏览器实现自动化驱动。

宿主/Agent 在远程机器运行时，本机 127.0.0.1 链接不保证设计师可达：必须由宿主提供可访问预览入口或执行浏览器。没有时明确环境不支持，不暴露监听到 0.0.0.0 来冒充支持。首版本地部署路径必须可用；远端集成作为外部适配边界。

### 4.2 页面功能

- 进入即显示包名/说明、总数、待检查/可用/失败计数及进度，不等待全部模型完成才出页面。
- 完整列表：编号、入口文件名、缩略图、建议名称/描述、技术状态、识别状态、编辑限制、scene 使用范围。失败项不隐藏。
- 固定视角缩略图用于识别；点选模型可旋转/缩放查看。普通用户不需要调整相机才能完成检查。
- 多 scene 继续使用默认 scene；无默认时选第一个，明确提示其余未载入。不扩展 scene 编辑能力。
- 名称确认仍在聊天完成；首版不要求额外实现网页编辑表单、第二个确认按钮或前端保存协议。
- 检查结束明确“已完成模型检查，请回到对话确认名称”，不自动触发场景生成。

### 4.3 性能与失败边界

- 每个模型当前内容只执行一次正式加载检查；成功缓存继续复用。缓存键至少覆盖闭包内容摘要和检查器/加载能力版本，缩略图丢失不能只凭路径字符串判定命中。
- 单个渲染器顺序处理模型，默认并发 1；释放上个模型的几何、材质、贴图、解码任务与临时 URL，不为每个列表条目永久创建 WebGL 上下文。
- 保持现有单资产超时 20 秒作为可配置默认值。Promise 超时必须终止或隔离仍运行的资产任务；不能继续后台加载、污染下一项。可用可销毁的渲染 iframe 等轻量隔离机制，不要求新框架。
- 加载/贴图/着色器错误、空或非有限包围盒、上下文丢失不能记为可用。失败后继续其他资产；没有环境时保留“未检查/环境不可用”。
- 保留已有展开体积、文件数和资源大小限制。支持的资产过重可提示，但不引入艺术质量门禁或要求 LLM 自动修好模型。
- 初次批量检查不对失败模型自动循环重试，不循环截图改善外观。页面重载不自动重试已完成的失败项；用户明确重试或输入内容改变时才执行新尝试。
- 自动任务无法完成时返回 pending/blocked 和原因，不声称检查成功；用户打开链接继续不算修复业务代码。

## 5. 检查会话与回传契约

沿用 package.json 作为资产事实来源；仅新增轻量运行会话记录，不新建另一份业务资产目录或重复确认系统。

### 5.1 生命周期与 CLI

保留 receive/list/describe/confirm/inject/export 等入口。让 preview 支持创建/复用本机 viewer 会话，新增必要的 status/stop 操作；可使用如下命令设计（实施者可按现有 CLI 收敛命名，需回填最终命令）：

- `preview <package-dir>`：启动或复用服务，尽快返回 `{status, sessionId, url}`，不无限占住 Agent 前台等人工打开。自动打开失败仍返回可访问链接。
- `preview-status <package-dir>`：返回未开始/运行中/完成/环境失败、计数与紧凑失败原因；Agent 不高频轮询。
- `preview-stop <package-dir>`：只终止本包自己持有的服务；可重复执行。

服务进程由 Agent 在后台启动，Windows 不弹终端窗口。使用随机可用端口，不能把固定 CDP 9387 作为产品前提。服务关闭后离线静态清单和已保存缩略图仍可查看。后续需要交互查看时重新启动会话，并复用有效缓存。

会话有明确空闲退出策略（建议默认 30 分钟，可配置）；检查页活动/心跳可以保持服务。关闭服务不能损坏已保存的资产状态。进程崩溃、端口占用、陈旧会话文件需能识别并重新启动，不能杀掉端口上的未知进程。

### 5.2 回传与一致性

必须实现真实结果回传，不能让设计师下载 JSON、复制 base64 或手工运行命令。

页面从服务取得只读任务：sessionId、assetId、contentHash、检查器版本、允许的入口/资源 URL。完成后回传对应技术结果、缩略图及有限的测量数据。服务端校验后原子写入包状态和预览文件；CLI list 与 review.html 能看到同一结果。

关键约束：
- 绑定资产 ID、内容摘要和检查会话。接收结果时重新验证资产内容，文件已变更的旧结果不得写回。
- 不让页面提交任意路径、任意资产 ID 或 confirmed=true。技术回传不能执行语义确认，已有自然语言确认仍走 confirm。
- 会话记录技术检查所针对的版本；描述修订与检查结果写回须合并/串行化，不能拿旧包快照覆盖新名称或确认信息。
- 内容及技术结果变化时使相关确认失效；纯缓存命中不增加 revision 或撤销确认；单纯重开 viewer 不影响已确认包。
- 同一会话/内容的重复结果幂等；双页打开不重复建立整包任务，不能由迟到的旧失败覆盖新的成功。
- 仅允许本机服务收到本会话结果：随机会话令牌、Origin/Host 校验、请求体与图片体积上限，不开放任意目录服务。令牌不写入公共导出/日志；仅内部预览 URL 携带启动凭据时需避免传播。
- 继续拒绝上传包的外部网络引用和路径穿越；只服务必要 viewer 静态资源及本包依赖，不执行附件脚本。这里防误写与跨页面请求，不宣称抵御能任意修改本机文件的恶意进程。

### 5.3 与已有自动化测试兼容

保留 `previewPackage` 的可测试调用方式，或集中迁移现有调用者；已有维护脚本可以用受控浏览器打开同一 viewer 并等待结果。测试自动化入口不应决定设计师必须安装 Edge。

`cdp.mjs` 被其他维护脚本复用，不为本任务无差别重写或删除。已有 Edge 自动化适配可保留为可选测试后端，但正式“打开链接检查”路径必须完全不依赖它。

## 6. 预期修改点

| 文件/模块 | 改动 |
|---|---|
| SKILL.md、references/designer-assets.md | 意图分流、仅检查完成即停、跨平台打开与回传说明 |
| scripts/designer-assets.mjs | preview 启动/状态/停止命令及紧凑输出 |
| scripts/lib/asset-preview.mjs | 从 Edge/CDP 强绑定改为复用 viewer 的检查协调；保留必要兼容入口 |
| scripts/lib/designer-assets.mjs | 仅必要的技术状态合并、缓存版本与确认一致性支持；保持 DA-R1～DA-R3 |
| 新 viewer 静态资源与轻量会话服务模块 | 页面、相同加载器逻辑、模型交互、结果回传、生命周期；文件归属按现有 scripts/lib 结构组织 |
| scripts/verify 中相关 fixture | 精确补本轮新边界，迁移调用，不重写全部历史测试 |
| scripts/pack-skill.mjs（仅必要时） | 保证新静态资源进入发布包，测试/浏览器二进制/缓存不入包 |
| README.md | 部署前提、Win/macOS 实测状态、远端宿主边界 |

## 7. 实施顺序与验收

一次集中实施，不将每个小步骤都变成用户审批轮次。

- [x] A：指令分流与单一 viewer 逻辑提取。
- [x] B：本机服务、结果回传、缓存/版本一致性及 start/status/stop。
- [x] C：交互清单、模型查看、无自动化时的普通浏览器路径。
- [ ] D：定向回归、平台实测、文档和发布包（本地记录已有，新增 review 缺陷待修复，Chrome/macOS 平台实测待完成）。

| 验收场景 | 必须观察到的结果 |
|---|---|
| 仅 ZIP＋“这是机房模型” | 模型清单和确认；不 init 场景、不查库、不构建，不索要设计参数 |
| 用户确认包但未提出场景 | 保存并停止；不会自行生成机房 |
| 上传时已给场景需求 | 确认后继续该需求，不重复询问 |
| 已确认包后续生成 | 不重跑未变更成功检查；原有模型选用、编辑、离线交付正常 |
| 无 Edge/无 CDP 的普通浏览器 | 链接打开后完成检查，CLI 读取到真实成功及失败结果 |
| Windows Chrome、macOS Safari/Chrome | 实际检查多文件 glTF、贴图和 Draco 样例，记录 OS/浏览器版本；不能用 mock 冒充平台通过 |
| 模型语义未知 | 预览可看，中性名称，等待用户命名；不凭面数猜业务类别 |
| 坏模型/坏贴图/超时/无 WebGL | 准确失败，下一模型可继续，无后台任务残留和自动重试循环 |
| 页面刷新/双页/断开重连 | 成功缓存复用；重复结果幂等，不反复撤销确认 |
| 检查中改名称/替换模型 | 名称不被旧快照覆盖；变更内容的迟到结果被拒绝 |
| 服务停止/崩溃/陈旧记录 | 不误杀其他进程，旧清单保留；重启后恢复有效缓存 |
| 安全与资源边界 | 越界资源、其他会话结果、超大回传拒绝；不泄露凭证 |
| DA-R1～DA-R3 | 原定向用例仍通过：不同依赖身份、完整排除清单、scene 范围提示 |
| 发布包 | 解压后 viewer 资源完整；无业务模型、node_modules、浏览器二进制；新包与源码对应 |

验收属于本次实现维护，不加入每次生成场景的默认流程。没有 macOS 机器时，应交付可复用的人工步骤并标注“macOS 待实测”；允许完成代码阶段，但不能把跨平台最终验收标为 PASS。

## 8. 性能与证据要求

记录样例资产数/大小、服务启动到返回链接、首个条目出现、首次检查总耗时、再次打开的缓存命中与耗时。不设虚构提速比例，不为了性能测试改成更简单的模型冒充真实结果。

不要通读全部 skill、node_modules 或把原始模型数据送进上下文。只读本 spec、相关模块与必要现有测试。测试失败集中诊断修复，最终报告实际命令、结果、未验证环境和已知限制。

## 9. 交接与回填

实施完成后在本文件追加：修改文件、实际命令、测试结果、Win/macOS 证据、Plan-Execution Diff、剩余风险、发布包路径/摘要。维护旧资产规格的简短交叉引用即可，不复制整份新规格到旧文件。

验收时需区分：代码完成、本地回归通过、平台实测通过、宿主接入完成。真实内网检索/上传继续按原规格单独联调，不能借本轮 viewer 通过一起结项。

交给实现 LLM 的任务：按此规格实施，复用现有资产链路，重点打通普通浏览器可用的结果回传和仅检查后停止的产品流程。不要仅将 Edge 路径替换成 Chrome 路径；不要只做无法更新资产状态的静态 viewer；不要实现另一套场景生成框架。若实际宿主无法访问本机页面，明确记录适配阻塞，不伪造成功。

回交复核用语：`独立模型包检查与跨平台 Viewer 已实现，spec 已回填，请 review_execute，核对检查/生成分流、浏览器结果回传及平台证据。`

## 10. 实施回填（2026-10-21）

状态：代码完成；Windows 本地回归通过；macOS 未实测；宿主远端接入未联调。以下区分四类结论，不把未测项记为 PASS。

### 修改文件

新增：

- `scripts/lib/viewer/checker.js`：唯一浏览器检查器。与交付场景相同的 three.js 版本、GLTFLoader、DRACOLoader、包围盒与释放路径；导出固定双视角检查与可交互查看两种入口，并挂到 `window.checker`。
- `scripts/lib/viewer/frame.html` / `viewer/frame.html`+`frame.js`：可销毁的隔离渲染 iframe。一次检查用一个新 frame，超时用销毁 frame 终止仍在运行的加载与 WebGL 上下文，不泄漏到下一项。
- `scripts/lib/viewer/index.html` / `viewer.js`：检查页。进入即显示清单并顺序检查、渐进刷新计数、固定视角缩略图、点选后旋转缩放；回传技术结果；`重试失败项` 显式重试。
- `scripts/lib/viewer-version.mjs`：检查器/加载能力版本常量（`CHECKER_VERSION=1.0.0`）。
- `scripts/lib/viewer-session.mjs`：会话服务。仅监听 127.0.0.1、随机端口；`/api/task|status|heartbeat|result`、`/asset/<token>/<id>/<path>`、`/viewer|/three|/draco` 静态；令牌 + Origin/Host 校验、请求体与图片体积上限；空闲退出（默认 30 分钟，`GTS3D_VIEWER_IDLE_MS` 可配）；会话文件在系统临时目录、按包路径散列，绝不进入导出。另含 `startDetachedViewer`/`viewerStatus`/`stopViewer`。
- `scripts/lib/viewer-server.mjs`：后台服务入口（由 Agent 启动，Windows 不弹窗）。
- `scripts/verify/viewer-session-fixtures.mjs`：会话与回传的定向回归。

修改：

- `scripts/lib/designer-assets.mjs`：新增 `applyCheckResult`（重读磁盘内容校验、幂等、revision/确认一致性）与 `markCheckFailed`；成功写回同时记录 `checkerVersion`。
- `scripts/lib/asset-preview.mjs`：`previewPackage` 改为驱动同一 `checker.js` 页面并走 `applyCheckResult`；CDP 调试端口改为随机可用端口，不再把 9387 当产品前提；保留可测试入口与 `asset load timeout`、`preview_unavailable` 语义。
- `scripts/designer-assets.mjs`：`preview` 改为启动/复用本机会话并返回 `{status,sessionId,url,port}`；新增 `preview-status` / `preview-stop`；`preview --headless` 保留受控浏览器同步检查；list 摘要增加 `checkerVersion`。
- `SKILL.md`、`references/designer-assets.md`、`README.md`：意图分流、仅检查后停止、跨平台打开与回传、平台与远端边界。

### 实际命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify/viewer-session-fixtures.mjs` | 通过。CLI `preview` 只返回链接不改状态；真实 Edge(Chromium) 打开链接、页面顺序检查并回传；`list` 与 review.html 一致；`preview-stop` 只停本包且可重复；错误令牌/未知资产/超限/内容已变更/任意字段分别被拒；`settled` 失败项重载不重跑、显式 `retry` 才重跑；改名后的迟到技术结果不覆盖名称。目录 `%TEMP%/gts3d-viewer-session-cNinIi` |
| `node scripts/verify/designer-assets-review-fixtures.mjs` | 通过（DA-R1～DA-R3 定向保持关闭）。`%TEMP%/designer-assets-review-9YugfQ` |
| `node scripts/verify/designer-assets-fixtures.mjs` | 通过：上传包离线构建、首帧、编辑/上传贴图/保存导入、确认版本、内容变更拒绝、mock 检索下载、有效/损坏贴图。`%TEMP%/designer-assets-R4boU3` |
| `node scripts/verify/offline-fixtures.mjs` | 通过。`%TEMP%/gts-offline-i2mmcg` |
| `node scripts/verify/gates.mjs --quiet` | 92/92。 |
| `node scripts/verify/p1-fixtures.mjs --node-only` | 67/67。 |
| `node scripts/verify/generation-fixtures.mjs` | 通过（typecheck 50379 ms、bundle 8015 ms）。`%TEMP%/gts3d-generation-oY8Hot` |
| `node scripts/verify/efficiency-fixtures.mjs` | 通过。`%TEMP%/gts3d-efficiency-wV36UT` |
| 发布 ZIP 逐文件比对源码 | 167 文件、字节全等（mismatch 0 / extra 0）、无 GLB/glTF/FBX/OBJ、无 node_modules；未入包项仅 `samples/`（打包白名单外，无运行引用）。1,459,833 字节，SHA-256 `4838fc2fed9c39ab23f21419c5c5a35001b5bd02340002d19efc44dcf6935b70` |
| 最终发布包解压后 `init.mjs … --defer-build` 与 `build-offline.mjs` | init 通过；`build-offline` RESULT: OK，生成 `offline/index.3d.html`（约 2.6 MB bundle）。自最终 SHA 的 ZIP 提取运行 |
| 最终发布包解压后 `startDetachedViewer`/`viewerStatus`/`stopViewer` | 后台服务正常启动（未打开页面时 status=idle）、`/api/task` 返回 `checkerVersion=1.0.0`、可停止 |
| `git diff --check` | 退出码 0（仅 LF/CRLF 提示） |

### 平台与宿主证据（区分状态）

- Windows 11 + Edge(Chromium) 本机链接检查：**已实测通过**（上表 `viewer-session-fixtures` 为真实浏览器打开链接、真实加载、真实回传，非 mock 技术状态）。未单独记录 Chrome 版本号，本机未安装独立 Chrome 时以同内核 Edge 覆盖。
- macOS Safari/Chrome：**未实测**。无 macOS 机器；交付同一链接步骤（`preview` 后把返回的 `url` 用系统默认浏览器打开，完成检查后 `preview-status` 读取），需在 macOS 上人工复核后回填并注明版本。
- 宿主远端接入：**未联调**。远端 Agent 的 127.0.0.1 对设计者不可达时，需宿主提供可访问入口；未通过监听 0.0.0.0 冒充支持。

### Plan-Execution Diff / 剩余风险

- 统一为“一个检查器 + 一个回传写入路径”：可见检查页与受控浏览器测试后端共用 `checker.js`，两边都经 `applyCheckResult` 落盘，未保留第二份内联渲染实现，也未只做不能更新状态的静态 viewer。
- 隔离用可销毁 iframe（规格允许的轻量机制），未引入新框架；超时即销毁 frame，避免后台任务与 WebGL 上下文残留。
- 确认仍在对话完成；页面不提交 `confirmed`/任意路径；语义名称由用户确认，技术状态由真实加载判定。
- 未做：网页内编辑表单/第二个确认按钮、远端宿主可达性代理、macOS 实测、真实内网检索与上传联调。以上按规格属 Out of Scope 或仍待外部环境，不因本轮 viewer 通过而结项。
- 规格第 4.3 的“展开体积/文件数/资源大小限制”沿用既有 `receive --limits`；本轮未新增艺术质量门禁或自动修模型。

### 发布包

`dist/generate-3d-scene.zip`，167 文件、1,459,833 字节、SHA-256 `4838fc2fed9c39ab23f21419c5c5a35001b5bd02340002d19efc44dcf6935b70`；无业务模型、node_modules、浏览器二进制；新包与源码逐字节一致。

## 11. 交接指令

交给复核 LLM：`独立模型包检查与跨平台 Viewer 已实现，spec 已回填，请 review_execute，核对检查/生成分流、浏览器结果回传及平台证据。`


## 12. review_execute（2026-10-21）

范围：本规格实现及相关回归，changed_only。用户已授权审查。本轮仅临时目录复现、检查发布包并回填；未修改功能代码。

### Review Matrix

| 轴 | 结论 | 依据 |
|---|---|---|
| Spec 质量与目标达成 | PARTIAL | 检查/生成意图分流已进入指令，普通浏览器真实回传主链路存在；交互查看、重开预览、重试与失败隔离尚不完整 |
| Spec-代码一致性 | FAIL | 第 4.2、4.3、5.2 的模型交互、缓存完整性、超时、双页及迟到结果约束未满足 |
| 代码自身质量 | FAIL | 点击查看确定报错；UI 重试未连接服务端；缓存丢图仍跳过；迟到失败覆盖成功与确认 |

**Overall Verdict：FAIL。** 以下 MV-R1～MV-R5 集中修复后再定向复核；不要求重做全部资产链路或增加场景审美门禁。

### Blocking Issues

**MV-R1 [P1] 点击模型无法打开交互预览。**
- `scripts/lib/viewer/viewer.js:56-62`：局部 iframe 变量 `el` 遮蔽查 DOM 的同名函数，visible 分支执行 `el('viewer')` 抛 TypeError。
- 同一路径还把所有 frame 都设为 display:none，openViewer 没调用 dialog.showModal；不能只修变量名就认为交互完成。
- 真实点击已复现：banner 为“预览打开失败：el is not a function”，dialog.open=false。
- 要求：打通点击→可见 dialog/frame→实际模型→旋转缩放→关闭释放→再次打开；测试真实 DOM 操作及可见尺寸，不能只测 checker.mount。

**MV-R2 [P2] “重试失败项”按钮没有触发服务端重试。**
- `viewer.js:133` 修改 location.search 后立即 reload；实际点击后 retry 参数未保留。即便 URL 人工带 retry=1，main 仍调用 api('task')，未将 retry 传到 /api/task，attempted 不清空。
- 服务端 `task(retry)` 存在，但测试只直接 fetch 带 retry 的 API，掩盖用户按钮断路。
- 要求：按钮显式请求/领取新的失败重试任务，再刷新状态；成功项不重跑。普通刷新不能重试失败项，也不能让 retry=1 永久留在地址里造成后续自动重试。
- 验证：通过实际按钮重试，观察失败项新尝试及计数，成功项没有新加载；再次普通刷新无新尝试。

**MV-R3 [P2] 缓存项重开无缩略图，缺失缩略图仍被判为缓存命中。**
- `viewer-session.mjs:96` 仅检查 thumbnail 字符串与 checkerVersion，不检查实际缩略图文件/当前闭包内容；task 不提供可读取的缩略图 URL。
- `viewer.js:121,137` 初始 image=null，并跳过所有 cached 项。真实检查成功后重新打开，页面图片数为 0，所有项显示“无预览”；删除预览 PNG 后 /api/task 仍 cached=true。
- 要求：提供受控缩略图读取与页面缓存展示；缓存检查覆盖内容、检查器版本和图片文件有效性。缺图时不能假命中，内容变化不能继续显示已验证可用；纯有效缓存命中保持确认不变。
- 同时补齐检查页规格列：当前实际表格仅编号/预览/名称入口/技术状态场景范围，缺用途描述、识别状态、编辑限制。用户应看到完整确认上下文，不依赖另开静态 review.html 补足。
- 验证：成功后刷新仍有可见图片；删图、改模型、改名分别得到正确行为；包含编辑限制和待命名信息。

**MV-R4 [P1] 双页没有任务占用/尝试版本，迟到失败可覆盖成功并撤销确认。**
- `viewer-session.mjs:87-99` attempted 只在结果落盘后设置，两个页面同时领取任务均会开始检查；没有 attemptId/领取归属。
- `viewer-session.mjs:144` 与 `designer-assets.mjs:148` 接收同一会话、同一内容的迟到失败时无新旧判断，直接 markCheckFailed。
- 实测：真实模型已成功且已确认后，向同会话提交迟到失败，HTTP 200；loadable 变为 preview_failed，confirmation 变为 null。
- 要求：服务端以资产内容和尝试标识管理领取/提交，重复提交幂等、已结束或过期尝试不能覆盖新结果；显式重试产生新尝试，不能简单地永远忽略失败。保证失败页面退出后的待执行任务可以恢复。
- 验证：双页同时打开只执行一次正式检查；旧失败晚于新成功、旧成功晚于新失败、重复结果、显式重试后旧回调，均不破坏最新有效状态；确认仅因真实有效变化失效。

**MV-R5 [P2] 等待 iframe ready 不受超时约束，检查队列可永久挂起。**
- `viewer.js:71` 在设置请求超时前 `await entry.ready`。若 frame 模块未加载或 ready 丢失，后续 setTimeout 永远不创建，finally 的 destroyFrame 也不会执行。
- 要求：启动/ready/加载共享有界截止时间；错误或超时销毁 frame，并将准确失败写回、继续下一项。网络结果回传也应有界并区分“未保存”与已完成，不能把本地失败显示为服务端已记录。
- 验证：阻断 frame 初始化模块/ready 信号，超时后 queue 可继续、iframe 被销毁，状态不永远 running。

### 验证证据与测试覆盖差距

- 本轮重新运行 `node scripts/verify/viewer-session-fixtures.mjs`：通过，目录 `%TEMP%/gts3d-viewer-session-HCXUw6`。测试通过不否定上述缺陷：没有实际点击模型/重试按钮，没有刷新图片断言，没有双页迟到提交或 ready 超时验证；部分回传检查直接构造 payload，仅能证明接口行为。
- 新的定向浏览器复现目录：`C:/Users/Tony/AppData/Local/Temp/viewer-review-RRPMkX`。实际 checker 先加载一个正常模型和一个损坏模型，然后点击、重开、删除 PNG、迟到失败回传与按钮测试；真实成功状态未手工伪造。
- 发布 ZIP 再次逐字节核对源码：167 文件、mismatch=[]、SHA-256 `4838fc2fed9c39ab23f21419c5c5a35001b5bd02340002d19efc44dcf6935b70`。包与源码一致，因此也包含上述缺陷。

### Plan-Execution Diff 与平台边界

- 仅检查后停止、保留上传包确认、无包路径、同加载器复用方向正确；无需推翻架构。
- 本机 Edge 回传通过不能代替 Windows Chrome 无 Edge 路径的实测，更不能代替 macOS Safari/Chrome。实施记录已明确 macOS 未测，应继续保留；第 7 节 D 不应将平台实测整体勾为完成。
- 宿主远端接入、内网检索/上传不在本轮修复范围。性能采样表仍缺启动/首条/整包/缓存打开的具体样例证据，需补证或保留未验证。
- 下一步：集中修复 MV-R1～MV-R5，补真实页面操作与并发回归，回填命令/结果/平台状态，重新发布。其他历史回归按受影响范围运行，不重复无关全套检查。
- 交给实现 LLM：按本节修复五项，不以直接调用 API 的测试替代按钮/页面验证，不用忽略错误保护成功状态；完成后回复“MV-R1～MV-R5 已修复，spec 与发布包已更新，请定向 review_execute”。

MV-R5 补充实测：在测试浏览器中将检查 iframe 替换为空白 frame，模拟初始化未发 ready。等待 22 秒（超过服务声明的 20 秒检查限时），服务仍 running/pending=1，页面仍“检查中”，未记录失败。证据目录：`C:/Users/Tony/AppData/Local/Temp/viewer-ready-review-JgBMs9`。本轮服务和浏览器均已关闭。

## 13. MV-R1～MV-R5 集中修复（2026-10-21）

授权：用户“按 spec 第 12 节集中修复 MV-R1～MV-R5，补真实按钮操作、缓存重开、并发回传及初始化超时测试”。范围：五项缺陷、受影响回归、文档与发布包；不扩大功能，不重做资产链路，不新增场景审美门禁。

### 修复内容

- **MV-R1 交互预览**：`viewer.js` 内 `spawnFrame` 的局部 `el` 曾遮蔽查 DOM 的同名函数，且可见 frame 也被设为 `display:none` 且未调用 `dialog.showModal()`。改为局部变量 `frame`；可见 frame 加 `view-frame` 类并挂到 `<dialog>`，打开时先 `showModal()` 再挂载模型（保证 iframe 有真实尺寸），关闭时销毁 frame 并 `dialog.close()`，可再次打开；`checker.js` 的 `mountModel` 尺寸回退到 `innerWidth/innerHeight`，frame 尺寸异常时不再退化成固定小画布。
- **MV-R2 重试按钮**：按钮原改 `location.search` 后 reload，而 `main` 调用的 `api('task')` 没有带 `retry`，服务端 `attempted` 永不清空。改为按钮 `location.assign(pageUrl('&retry=1'))`；页面用页面 URL 里的 `retry=1` 显式请求 `/api/task?...&retry=1`，用后立即 `history.replaceState` 抹掉，普通刷新不再重试。
- **MV-R3 缓存与确认上下文**：服务端 `cacheState` 同时校验 `checkerVersion`、缩略图文件存在、闭包内容未变更（`verifyContent`）；新增受控缩略图端点 `/thumb/<token>/<id>`，`task` 对命中缓存返回 `thumbUrl`，页面直接显示缓存图片；缺图记 `miss`、内容变更记 `stale`（页面显示“需重新接收”，不核对也不冒充可用）；`countAssets` 同步按该口径统计。表格补齐用途描述、识别状态、编辑限制三列，连同原有编号/入口/缩略图/技术状态/场景范围构成完整确认上下文，不再依赖另开 review.html 补足。
- **MV-R4 领取与迟到结果**：服务端以 `claims: assetId -> {attemptId, contentHash, page, at, done}` 管理领取，`/api/task` 只为请求页分配一次 attempt（第二页得到 `claimed:true` 不重复检查）；`/api/result` 必须携带匹配的 `attemptId`，未知或过期 attempt 返回 409，已完成的 attempt 重复提交幂等返回 `unchanged`，因此迟到失败不能覆盖已记录成功、迟到成功也不能覆盖已记录失败；显式重试 `claims.clear()` 产生新 attempt，旧回调作废；页面 `pagehide` 用 `sendBeacon` 调 `/api/release` 立即释放本页领取，另有 60 秒租约兜底，页面退出后待办任务可被新页面重新领取。确认仅由 `applyCheckResult` 的真实有效变化失效。
- **MV-R5 有界启动与回传**：`callFrame` 用一个有界截止时间同时覆盖 ready、发送与回复，ready 永不到达时超时 reject，`checkInFrame` 的 `finally` 随之销毁 frame；结果回传 `fetch` 加 `AbortSignal.timeout`，网络失败标记为“未保存”而非“检查失败”，计入待检查，不会把本地失败显示成服务端已记录。

### 修改文件

`scripts/lib/viewer/viewer.js`（重写）、`scripts/lib/viewer/index.html`（列与 dialog 样式）、`scripts/lib/viewer/checker.js`（`mountModel` 尺寸）、`scripts/lib/viewer-session.mjs`（领取/尝试、租约、`/api/release`、`/thumb`、缓存三态、`applied` 计数）、`scripts/verify/viewer-session-fixtures.mjs`（改为真实页面操作 + 并发 + 超时）。新增功能面仅 `/api/status` 的 `applied` 会话计数（已完成的结果数），用于让按钮重试可被确定性观测，并在 CLI `preview-status` 一并返回。

### 实际命令与结果

`node scripts/verify/viewer-session-fixtures.mjs` 通过，九条断言全绿，证据目录 `%TEMP%/gts3d-viewer-session-HamWTz`：

| 断言 | 覆盖 |
|---|---|
| CLI preview 只返回链接、不改状态、pending=2 | 分流与快速返回 |
| 浏览器真实检查、list/review 一致、表格 ≥8 列 | 回传一致性与确认上下文（MV-R3 列） |
| 点击可用模型 → dialog 打开、iframe 1000×562、canvas 1000×562；关闭后 open=false 且 frame 数为 0；再次打开成功 | MV-R1 |
| 重开链接显示缓存缩略图 `naturalWidth>0`，`applied` 仍为 2 | MV-R3 缓存展示与不重跑 |
| 点“重试失败项”后 `applied` 2→3（仅失败项），普通刷新仍为 3，地址不再含 `retry=1` | MV-R2 |
| 两页同时打开同一会话，`applied` 仍为 2 | MV-R4 双页 |
| 错误令牌 403、未知资产 400、内容摘要不符 409、伪造 attempt 409、超限图片 400；任意字段不回写 `confirmed`；重复结果幂等 revision 不变；迟到失败不撤销成功、迟到成功不覆盖失败；改名不被迟到结果覆盖；显式重试后旧 attempt 409；内容变更 `stale=true`、删图 `cached=false/thumbUrl=null` | MV-R4 + 安全与缓存诚实 |
| 阻断 `frame.js` 后检查在限时内超时、iframe 被销毁（页面 iframe 数 0）、记录 `Asset load timeout`、队列继续、状态变为 done（failed=1）、横幅“已完成” | MV-R5 |

相关回归：`designer-assets-review-fixtures.mjs`、`designer-assets-fixtures.mjs` 均通过（共享 `checker.js`，`previewPackage` 路径未受影响）。证据目录 `%TEMP%/designer-assets-review-y0Oy3G`、`%TEMP%/designer-assets-wMDDu4`。发布包解压后 `startDetachedViewer`/`viewerStatus`/`stopViewer` 正常，`/api/task` 返回 `checkerVersion=1.0.0`、含 `attemptId` 与新增确认字段。

### 平台状态（不变）

Windows 11 + Chromium 同内核浏览器已实测；**macOS Safari/Chrome 仍未实测**；宿主远端接入仍未联调。第 7 节 D 的平台实测不整体勾为完成。性能采样（启动到返回链接、首条出现、首次检查总耗时、缓存重开耗时）本轮仍未记录具体样例数值，保留未验证。

### Plan-Execution Diff

- 五项均为实现缺陷，非范围变更；未新增依赖、未改资产链路、未加场景门禁。
- `applied` 计数为让按钮重试可确定性观测而增加的会话诊断字段，属可观测性而非新功能。
- MV-R4 的“领取”采用随机会话内的内存记录 + 60 秒租约 + `pagehide` 释放，不引入持久锁或跨进程协调；服务进程重启会丢失领取，此时页面重新领取即可。
- 剩余未验证项与原状态一致：macOS 实测、宿主远端可达性、真实内网检索/上传、性能样例。

### 发布包

`dist/generate-3d-scene.zip`，167 文件、1,461,736 字节、SHA-256 `3ba3df647fa83a1b2c22c03dd5d2de7b670dd7e2880cb5a40917bc35bf8ba368`；逐字节与源码一致（mismatch 0 / extra 0）、无 GLB/glTF/FBX/OBJ、无 node_modules，未入包项仍只有白名单外的 `samples/`。

### 复核指令

`MV-R1～MV-R5 已修复，spec 与发布包已更新，请定向 review_execute。`

## 14. review_execute 定向复核（2026-10-21）

范围：第 13 节五项修复的真实性、定向回归复跑、发布包核对。changed_only；本轮未修改功能代码，仅临时目录复现。

### Review Matrix

| 轴 | 结论 | 依据 |
|---|---|---|
| Spec 质量与目标达成 | PARTIAL | 五项修复四项真实落地；缓存重开后的交互预览路径存在交叉回归，与 §4.2"点选模型可旋转/缩放查看"不符 |
| Spec-代码一致性 | PARTIAL | MV-R2/R4/R5 与服务端约束一致并经真实复跑验证；MV-R1+MV-R3 交叉路径未满足 |
| 代码自身质量 | PARTIAL | `/api/release` 存在未定义变量缺陷（每次调用 500）；缓存会话点击模型必失败 |

**Overall Verdict：PARTIAL——MV-R1～MV-R5 中四项确认修复，遗留 2 个缺陷（MV-R6 交互预览、MV-R7 release 500），修复后即可收口。**

### 已确认修复（复跑+探针实证）

- **MV-R2 重试按钮**：`location.assign('&retry=1')` → `/api/task?retry=1` → `claims.clear()` 产生新 attempt → `history.replaceState` 抹掉参数。复跑断言 `applied 2→3`、普通刷新仍 3、地址无 `retry=1`。真实。
- **MV-R4 领取与迟到结果**：`claims` + `attemptId` + 60s 租约 + `pagehide` sendBeacon 释放；伪造/过期 attempt 409、重复结果幂等 revision 不变、迟到失败不撤销成功、迟到成功不覆盖失败、改名不被迟到结果覆盖。复跑全绿。真实。
- **MV-R5 有界启动**：`callFrame` 单一有界截止时间覆盖 ready+消息+回复，超时 reject → `finally` 销毁 frame；`postResult` 用 `AbortSignal.timeout(15000)` 区分"未保存/已记录"。阻断 frame.js 复跑断言：限时内超时、iframe 销毁、记录 `Asset load timeout`、队列继续、done。真实。
- **MV-R3 缓存诚实性**：`cacheState` 三态（checkerVersion+缩略图文件+`verifyContent`）、`/thumb/<token>/<id>` 受控端点、表格 8 列补齐。删图 `cached=false`、内容变更 `stale=true`、缓存重开不重跑（`applied` 恒定）。真实。
- **发布包**：手写 ZIP 中央目录解析逐字节比对——167 文件、mismatch=0、extra=0、无业务模型/node_modules；`scripts/verify` 与 `benchmark.mjs`、`samples/` 为 pack-skill.mjs 既定白名单排除（L20），非缺陷。1,461,736 字节，SHA-256 `3ba3df…8ba368` 与第 13 节回填一致。

### Blocking Issues（新发现）

**MV-R6 [P1] 缓存会话重开后点击模型，交互预览必失败。**
- 根因：`viewer-session.mjs` 的 `task()` 中 `url: checkable && cache !== 'hit' ? … : null`——缓存命中资产 `url=null`；而 `viewer.js` 的点击处理把 `asset.url` 直传 `openViewer` → `callFrame` → `postMessage` → `frame.js` `mountModel(container, null)` → GLTFLoader `loadAsync(null)` 抛 `Cannot read properties of null (reading 'lastIndexOf')`。
- 真实复现（端到端探针，同内核 Edge）：资产先成功检查 → 停服务重开（缓存命中路径）→ 点击 can-view 行 → dialog 打开瞬间崩溃关闭，横幅"预览打开失败：Cannot read properties of null (reading 'lastIndexOf')"，frame/canvas 均无。
- 第 13 节 fixture 的 MV-R1 断言在同一页面生命周期内点击（检查完成后不重载，`url` 仍在手）；MV-R3 的缓存重开断言只查了缩略图 `naturalWidth>0` 没点击。两条断言各自通过但交叉路径无覆盖——正是本轮缺陷逃逸原因。
- 修法方向：`task()` 对可交互资产（loadable 且内容有效）恒返回 `url`（`/asset/<token>/<id>/<entry>` 本就受控）；或页面侧缓存行点击时懒取入口。补断言：缓存重开会话后点击 → dialog 打开且 canvas>0 → 关闭可重开。
- 注：`stale`（内容已变更）行不可点（status 非 loadable），不受影响。

**MV-R7 [P2] `/api/release` 每次调用返回 500 `res is not defined`。**
- `viewer-session.mjs` 的 `release(u)` 函数体内 `send(res, 200, …)` 引用了不存在的 `res`——`res` 是 `route(req,res)` 的参数，`release` 自己的签名只有 `u`。每次 POST `/api/release` 抛 ReferenceError → 上层 catch → 500。
- 实证：`POST /api/release?…&page=pg1` → `500 {"error":"res is not defined"}`。
- 后果当前良性：页面 `pagehide` 的 sendBeacon 不读响应；claims 靠 60 秒租约兜底过期，MV-R4 双页断言仍全绿。但它使"页面退出后待办任务立即恢复"退化为"最多等 60 秒租约"，且 500 会写满 detached 服务日志（如启用）。修法：给 `release` 传 `res` 并回 200，或改在 `route` 内联响应。
- 顺带核对：`viewer.js:187` sendBeacon 的 query 含 `page`，服务端 `release(u)` 读 `u.searchParams.get('page')` 逻辑本身正确，仅响应对象缺失。

### 验证证据

- `node scripts/verify/viewer-session-fixtures.mjs` 本轮复跑：9/9 全绿（`%TEMP%/gts3d-viewer-session-LeAkYK`）。测试通过不能否定上述缺陷：两条断言的交集路径（缓存重开+点击）无覆盖。
- MV-R6 端到端复现探针：接收最小 glTF → `applyCheckResult` 写入真实成功（缩略图落盘、checkerVersion=1.0.0）→ 重启会话（缓存命中）→ 受控浏览器点击 → 观察到崩溃横幅与 dialog 关闭。临时目录 `%TEMP%/probe-click-*`，本轮已清理服务与浏览器进程。
- MV-R7 探针：直连 `startViewerService` 实例 POST `/api/release`，500 复现。
- 发布包核对见"已确认修复"末条。

### 平台状态（不变）

Windows 11 + Chromium 同内核已实测；macOS Safari/Chrome 未实测；宿主远端未联调。性能采样样例数值仍缺（第 13 节已声明保留）。

### 下一步

1. 修复 MV-R6（`task()` 返回可交互 `url`）+ MV-R7（`release` 响应），并在 `viewer-session-fixtures.mjs` 补"缓存重开→点击→canvas>0"断言与 `/api/release` 200 断言。
2. 复跑 viewer-session-fixtures 与受影响回归，重新打包发布（当前 ZIP 含上述缺陷）。
3. 修复后按第 12 节口径定向复核；macOS/远端/性能样例仍按未验证项单独跟踪，不随本缺陷修复结项。

交给实现 LLM：`MV-R6（缓存会话交互预览必失败）与 MV-R7（/api/release 500）已定位，修复后补交叉路径断言并重新发布，回复"MV-R6/MV-R7 已修复，spec 与发布包已更新，请定向 review_execute"。`


## 15. 本轮定向 review_execute（2026-10-21）

用户请求：MV-R1～MV-R5 已修复，定向复核。范围为本次修复、交叉路径及发布包；仅审查、临时目录测试与回填，未修改功能代码。

### Review Matrix

| 轴 | 结论 | 证据 |
|---|---|---|
| Spec 质量与目标达成 | PARTIAL | 首次交互、重试、缓存缩略图、迟到结果防护、初始化超时已改善；缓存交互和多页接续未闭环 |
| Spec-代码一致性 | FAIL | §4.2 缓存模型仍需能查看，§5.2 双页/退出恢复要求未满足 |
| 代码自身质量 | FAIL | 缓存 url=null、release 未定义 res，以及 claimed 页面不刷新/不接续，均有确定复现 |

**Overall Verdict：FAIL。** 第 14 节中 PARTIAL 不是本轮最终验收结论。保留已通过修复证据，不要求重做架构；集中修复 MV-R6～MV-R8。

### 已确认有效的修复与复跑

重新执行 `node scripts/verify/viewer-session-fixtures.mjs`，全部输出 PASS，目录：`C:/Users/Tony/AppData/Local/Temp/gts3d-viewer-session-56sNrl`。
覆盖首次点击显示/关闭重开、缓存缩略图、真实重试按钮、重复结果及旧 attempt、防 ready 永久等待等。首次点击测试不是缓存重开后点击；双页测试证明没有重复执行，但未证明另一页会更新状态或接续任务。因此其 PASS 不覆盖下列缺陷。

发布包：167 文件，1,461,736 字节，逐文件 mismatch=[]；SHA-256 `3ba3df647fa83a1b2c22c03dd5d2de7b670dd7e2880cb5a40917bc35bf8ba368`。与源码一致，包含当前剩余问题。

### Remaining Blocking Issues

**MV-R6 [P1] 保持打开：缓存重开后没有模型入口 URL。**
- 位置 `scripts/lib/viewer-session.mjs:128`，缓存 hit 返回 url=null；`viewer.js` 点击仍将其传入 GLTFLoader。
- 本轮先使用正式 viewer 进行真实模型加载，再重开页面并点击。实测横幅：`预览打开失败：Cannot read properties of null (reading 'lastIndexOf')`，dialog.open=false。
- 修复：区分“需要技术检查”与“允许交互查看”，内容有效的缓存模型仍提供受控入口；不要让 stale 模型获得已验证可用的显示。补缓存重开→点击→有效 canvas→旋转缩放→关闭/重开的真实页面断言。

**MV-R7 [P2] 保持打开：release 响应使用未定义变量。**
- 位置 `scripts/lib/viewer-session.mjs:193-196`，release(u) 内引用 res；调用处只传 u。
- 实测 POST /api/release 返回 500，正文 `res is not defined`。
- 修复：正确传递响应对象并验证 200/重复释放幂等。
- 对第 14 节影响说明的纠正：claims.delete 在异常之前已执行。本轮实测 release 500 后，另一客户端立刻可领到新 attempt，不需要等 60 秒租约。不能把页面不恢复单纯归因于 release 响应失败，也不应声称未启用的后台日志被写满。

**MV-R8 [P2] 新增：跳过他页领取的任务后，页面不再同步或接续。**
- 位置 `scripts/lib/viewer/viewer.js:173,186`：claimed 项直接 continue；main 只取一次 task，后续 interval 只发 heartbeat，没有获取状态或接续未领取工作的动作。
- 触发：页面 A 已领取，页面 B 打开时看到 claimed；A 完成时 B 不更新，A 退出/释放或租约到期时 B 也不重新领取。
- 实测：先通过正式 task API 为 ownerA 领取，再打开真实 viewer 页面 B；释放 ownerA 后，B 一直显示“待检查 1”，服务 pending=1。再次直接请求 task 能立刻获得 attempt，证明服务端已可分配，缺的是页面侧状态刷新/恢复。静态控制流确认 B 没有后续 task/status 请求。
- 修复：给等待他页的条目增加有界频率的状态同步与接续机制（低频轮询或推送即可）；同步名字、技术结果、缩略图和可查看 URL；owner 释放/失联后可接续未完成项，不重跑已完成成功/失败项。显式重试不能无差别抢走仍活动的其他页面任务。
- 回归：两页同时开，A 完成→B 自动呈现相同结果；A 在检查前/中退出→B 接续；租约到期接续；A 的迟到结果仍被拒绝；单项只由一个有效 attempt 执行。不要只用 applied 总数证明页面体验正确。

### 新增复现证据

临时目录：`C:/Users/Tony/AppData/Local/Temp/viewer-rereview-vQzkMd`。
- cached：正式 viewer 真实加载成功，重开后点击失败。
- handover：ownerA 领取、真实页面 B 等待、release 500、释放已生效但 B 不接续。
所有本轮创建的服务与浏览器均已关闭；没有修改业务实现。

### Plan-Execution Diff / Resume

先修复上述三个剩余缺陷，再跑对应交叉路径和相关会话回归、更新发布包。此前 MV-R2/MV-R5 等已验证的修复不重新推翻。
平台边界仍为 Windows 上受控 Chromium 的证据；未补独立 Chrome 无 Edge、macOS Safari/Chrome 实测，不作跨平台最终通过声明。性能样例与远端宿主接入保持待验证。

交给实现 LLM：`按 spec 第 15 节集中修复 MV-R6～MV-R8，补缓存重开点击、release 200、双页同步与退出接续的真实页面回归；保留已成功/失败项不自动重试及旧 attempt 防护，回填证据并更新发布包。`
复核口令：`MV-R6～MV-R8 已修复，spec 与发布包已更新，请定向 review_execute。`


## 16. 全链路收敛计划（2026-10-21）
用户授权：全局审视后直接修改，不再逐项补丁交接。
范围：模型包检查的状态、网页、会话生命周期与已有资产确认/消费边界；不重写场景引擎，不扩大格式支持。
计划：
1. 明确持久资产状态（未检查/成功/失败/变更）与短期领取状态（空闲/占用/已提交）的关系；页面和 status 使用同一判断，失败不因重启自动重试。
2. 统一缓存验证：内容先验、图片有效性、检查器版本；缺图可恢复而非假装内容变更，缓存仍可交互。
3. 多页面同步/接续、重试只重新授权已失败项、不抢活跃任务；结果有界、幂等、租约过期/旧结果拒绝。
4. 完整页面生命周期：查看/关闭/快速切换、检查启动超时、未保存恢复、重开缓存、命名确认同步。
5. 服务单实例启动/停止和会话所有权，避免并发启动与旧进程清理新会话；所有写接口校验来源与有限 payload。
6. 真实浏览器交叉回归+服务状态测试+资产/离线回归+发布一致性；记录未实测 macOS，不以本地测试冒充。
本计划在授权范围内执行，无需再次确认。完成后在本节回填整体证据和剩余限制。


### 16.1 执行结果：统一状态与生命周期

本次不局限于 MV-R6～MV-R8。已检查模型包状态写入、缓存、网页执行、会话领取、服务启动停止、确认消费以及发布路径，并完成以下修改：

| 状态/事件 | 统一行为 |
|---|---|
| 内容一致、版本一致、有效缩略图 | 复用检查结果，同时保留可交互模型 URL |
| 已成功但缩略图缺失或损坏 | 待恢复检查，不误报内容变更或继续声称缓存有效 |
| 模型/依赖内容发生变化 | 标为 stale，阻止确认及作为已验证资产消费 |
| 已完成失败 | 刷新、重开服务均不自动重试；显式重试才能重新授权 |
| 他页正在执行 | 低频同步状态、命名与结果，不抢有效任务 |
| 已授权任务释放/租约过期 | 其他页面可接续，过期 attempt 的结果不能回写 |
| 检查完成但结果保存失败 | 保留页面内结果；显式重试先重传保存，不重复渲染模型 |

服务端统一缓存判定和结果校验，成功结果要求有效 PNG 结构/CRC、有限且有效的边界及几何计数。确认和消费时再次验证内容。短期领取与持久失败分开，重试不清空其他页面的活跃任务。修复 release 响应、缓存 URL、多页同步，并增加过期结果与来源检查。

页面改为串行执行协调器，包含有界请求、等待页面同步、未保存结果恢复、初始化取消清理、快速查看切换与关闭重开。语义确认使用当前包 revision，不沿用失效确认。

新增本地进程文件锁，串行化资产写入，防止并行 CLI 命名相互覆盖；Viewer 服务也有独占所有者锁，并发启动汇聚到同一有效服务，旧会话不能清除新记录。修复受控 CDP 清理，优先关闭本任务拥有的浏览器进程。

维护预览与普通 Viewer 使用相同缓存规则；维护命令新增显式 `--retry-failed`。失败不自动重跑；丢失检查证据的缓存恢复、未完成授权任务接续与已完成失败重试是三种不同情况。

### 16.2 实际回归证据

所有路径位于 `C:/Users/Tony/AppData/Local/Temp/`：

| 验证 | 结果与证据目录 |
|---|---|
| viewer-session-fixtures.mjs | PASS；`gts3d-viewer-session-u9RcZi`，首次/缓存交互、重试、重复/迟到结果、初始化超时 |
| viewer-lifecycle-fixtures.mjs | PASS；`viewer-lifecycle-zTr5hu`，真实浏览器缓存重开/快速切换、命名同步、缺图恢复、重启不重试失败、两页接续同步、内容变化、保存失败后仅重传；本次样例初始检查 2906ms |
| viewer-coordination-fixtures.mjs | PASS；`viewer-coordination-JFOz5k`，过期租约拒绝、服务独占、释放已授权重试可接续、并发 CLI 启动汇聚、两进程写入不覆盖 |
| designer-assets-review-fixtures.mjs | PASS；`designer-assets-review-IpDKMf`，身份/依赖/排除/场景范围/远端变体相关回归 |
| designer-assets-fixtures.mjs | PASS；`designer-assets-rJjQCk`，离线构建、file:// 首帧 1138ms、编辑/贴图/保存导入相关回归 |
| p1-fixtures.mjs --node-only | 67/67；`gts3d-viewer-p1.log`，负例报错为预期断言 |
| 发布包解压后执行 | PASS；`viewer-release-nw0texpw`，init 空项目/引用/共享/延迟构建、实际离线构建、独立 Viewer 领取与资源服务及停止 |

新增测试位于 scripts/verify，仅作为维护回归，不加入设计师日常生成门禁。此次首次受控浏览器启动曾遇 CDP 握手超时；清理本轮已知自有浏览器、启动等待调整至 15 秒后通过。以上毫秒数为本地小样例采样，不是任意模型包性能承诺。

### 16.3 发布一致性

发布文件：`dist/generate-3d-scene.zip`。
- 文件数：168；字节数：1,465,603。
- SHA-256：`55e7c753f975b17fd7a3ca1725358e60194d4cc58de0e2550ba58bd336625067`。
- ZIP 内全部文件与当前 skill 源码逐文件一致；新锁模块包含在内。
- 无业务 GLB/glTF/FBX/OBJ，无 node_modules；维护测试按原打包规则排除。
- 解压包真实离线构建通过，产物为 `viewer-release-nw0texpw/project/offline/index.3d.html`。类型检查 10903ms、资源 39ms、打包 5855ms、发布 5ms。

### 16.4 最终 Review Matrix 与剩余边界

| 轴 | 本轮结论 |
|---|---|
| Spec 质量与目标达成 | 本地实现范围 PASS；独立模型包检查、人工语义确认、缓存与恢复流程已覆盖；完整跨平台 Done Contract 仍未全部实测 |
| Spec-代码一致性 | 本轮实现范围 PASS；MV-R1～MV-R8 已闭环；普通 Viewer 不要求安装 Edge，受控 Edge 仅用于本地维护测试 |
| 代码自身质量 | 本轮状态/生命周期及相关集成回归 PASS；以实际交叉路径测试为依据，不承诺不存在其他缺陷 |

剩余验证：独立 Windows Chrome 无 Edge 环境、macOS Safari/Chrome、远端宿主连接、内网检索/上传接入、代表性大模型包的性能与显存采样。当前证据是 Windows 受控 Chromium 与本地服务，不能冒充上述平台通过。

文件锁面向本地进程协作，不是多租户隔离方案；PNG 校验覆盖结构与 CRC，不是独立完整像素解码；服务缓存使用文件元数据减少重复哈希，实际写入/确认仍核验内容。这些实现边界不扩展为新的设计师操作或生成门禁。

本轮收敛完成，可进入设计师真实模型包试用；无需再把 MV-R6～MV-R8 交给另一个 LLM 修复。平台实测与内网联调按上述边界继续跟踪，不将其误报为已验收。


## 17. 单 HTML 可编辑模型清单与文件导入（当前唯一实施方案）

### 17.1 目标与边界

类型：Feature Spec 修订；阶段 Plan。本轮仅更新 Spec，后续实现交给另一 LLM。旧版 §17 的宿主桥接、ack、自动唤起 Agent 和自动回写要求已删除，不作为实施前置条件，也不保留两套候选方案。

最终体验：设计师上传模型 ZIP → 得到唯一 index.3d 卡片 → 看预览、修改名称和用途 → 点击“保存清单”下载文件 → 将文件发回当前对话，说“用这个” → Agent 校验导入并取得完整模型描述。

用户不编写 JSON、不逐个在聊天介绍模型、不启动服务。文件内部可用 JSON，产品文案统一叫“模型描述清单”。这是正式流程，不是降级方案。

In：单页面离线预览/检查、名称用途编辑、清单下载、Agent 导入、确认与后续消费、文档及相关回归。
Out：宿主代码改造、自动回传/通知、常驻服务、自动入库、新 Viewer 框架、新模型格式、重写场景引擎、最终场景审美自动验收。

### 17.2 唯一交付入口

- 每包输出 `<包输出目录>/index.3d.html`；HTML title 和卡片名为 index.3d。不同包及后续场景使用不同输出目录，禁止覆盖。
- 仿照现有场景离线产物，可带同目录配套资源，不要求将所有模型塞入单个 HTML。只交付一个 HTML 链接，不额外交付资源卡片。
- 默认不启动 HTTP 服务，不调用 startDetachedViewer，不输出 localhost URL，不生成 review.html。不通过隐藏服务满足表面单卡片。
- 新输出放在输入模型目录之外，避免产物参与模型摘要或被扫描为资产。更新沿用同包输出入口。
- skill 控制文件与交付链接；宿主实际卡片数量需要真实测试，不能凭 title 宣称已通过。但无需增加宿主双向通信接口。

### 17.3 页面与设计师流程

顶部：整包用途说明（可编辑）、检查进度、成功/失败数量，固定提示“填写后保存清单，再将文件发回当前对话”。

主体：预览、名称、用途描述、加载状态、是否使用；编辑范围和失败详情放到展开区，不再堆八列。点击预览在本页旋转缩放，关闭后保留表单。

- Agent 有可靠视觉依据时预填建议；否则保留“未命名模型 N”，不凭文件名 object_xxx 或几何数字编造用途。不为预填强制再开自动化浏览器。
- 用户主要纠错，不必从零填写。用途可空，整包说明提供背景；允许用户明确接受未命名条目。
- 默认选择全部有效模型；失败项完整展示并不可选。用户取消有效项或存在失败项时显示排除清单，导出前明确同意仅使用当前有效子集。
- 主按钮“保存清单”，导出文件 `models.3d.json`。按钮旁说明“保存当前名称、用途和使用选择；下载后拖回对话即可使用”。导出操作包含对当前所选条目的确认意图，不要求之后再聊天确认一次。
- 未完成检查时可编辑但不能导出可使用清单；全失败不能确认成功，仍展示完整错误。非 GLB/glTF 模型作为失败/不支持条目，bin/贴图仅是依赖。
- 下载发起后提示“已发起下载，请将清单文件发回对话”，不能声称已写回 Agent 或已实际保存到磁盘。继续编辑显示“有修改尚未导出”。
- 刷新可能丢失未导出的编辑，给出明确提示；本地草稿为可选辅助，不能依赖 file:// 下 localStorage 保证持久化。
- 页面提供“载入已有清单”文件选择，用同包同版本文件恢复表单；先验证匹配再应用，不接受错包覆盖。不要求用户为了再次编辑重新填写。

Agent 交付页面后让出对话，不轮询等待用户下载。用户发回清单后自动走导入，不要求手动命令或解释 JSON。上传文件并说“用这个”授权导入该清单；仅检查模型包则导入成功后回复准备好并停止，已有明确场景需求则继续。重复上传相同清单不能自动重复生成场景。

### 17.4 离线检查与资源复用

复用共享 GLTFLoader、解码器、检查器及现有离线资源打包思路；不初始化业务场景工程，不跑完整场景构建来生成清单页面。

用可离线加载的资源映射/Blob URL 处理 GLTF、bin、纹理和解码器，避免 file:// 下 fetch 邻接文件失败；验证 worker、脚本与宿主 CSP/sandbox 兼容性。页面可运行不等于自动拥有写文件权限。

模型顺序或有界并发检查，释放无用 WebGL 上下文与 Blob URL，不为每个列表项常驻渲染器；避免大包模型多次复制。超过已支持容量明确报错，不自动改为服务器。

技术检查结果在下载文件中随描述传回。仅打开页面不能更新 Agent 的包状态；Agent 不提前宣称已验收。有效既有缓存可在生成页面时嵌入复用。旧 HTML 不会因 CLI 导入而自动更新：需要时重新生成同入口，或用页面载入已保存清单恢复。不得承诺静态页面与磁盘自动同步。

已经失败的检查不自动循环重试；用户显式点击重试才执行。当前页面状态可复用，跨刷新没有可用持久记录时可能重新检查；导入清单并重新生成页面后使用已保存结果。首次页面内检查可缓存结果，但下载不是服务端落盘。

### 17.5 清单契约与校验导入

内部格式带 schemaVersion、submissionId、packageId、packageDigest、baseRevision、checkerVersion、packageDescription、confirmSelection、allowPartial、entries。每个 entry 带稳定 assetId、contentHash、name、description、selected、有效检查结果或对已有结果的引用。包含全体资产条目，不能静默遗漏失败项。新缩略图使用有界内嵌 PNG 数据，文件不含模型二进制、token、任意写入路径或执行脚本。

内部命令建议：`node scripts/designer-assets.mjs import-review <包目录> --file <清单路径>`。由 Agent 调用，用户不输入。实现需提供紧凑返回值：导入状态、当前 revision、有效/选择/排除数量及可读错误，避免把图片与完整文件输出到上下文。

导入流程：
1. 限制文件总大小、条目数量、文本长度及图片尺寸/字节；具体默认值集中定义并写入文档、覆盖边界测试。先检查大小再解析，报错保留原包。
2. 从当前项目已接收包定位身份，不能直接执行文件中路径；错包、未知/重复/缺失资产 ID、摘要变化和不支持版本均拒绝。不能靠同名文件自动匹配到另一个包。
3. 重新验证模型及依赖内容、checkerVersion、边界数值、几何计数与 PNG，复用现有检查结果校验。页面结果是用户返回的浏览器观察记录，不是防篡改证明；不凭一个 loadable 布尔值认定成功，也不引入第二轮默认浏览器检查。若已有有效缓存，结果引用必须能匹配该缓存。
4. 名称和用途作为文本存储与转义，不作为指令执行。失败项不能通过名称或 selected 变可用；有效子集要求明确 allowPartial。全失败或没有选择项不创建可用包确认。
5. baseRevision 用于拒绝覆盖较新编辑；同一 submissionId + 相同内容重复导入返回幂等成功，不重复递增版本；相同 ID 不同内容拒绝。再次编辑并导出时生成新 submissionId。精确重复判断先于旧 revision 冲突判断，但仍检查当前包内容未变；返回当前状态，不能把后来失效的确认说成有效。
6. 在现有包写入锁内校验并原子落盘名称、用途、结果和所选集合确认；不能分几次写入造成半批生效。写入失败不破坏上一版；派生页面生成失败应可重建，不回报整个未落盘或伪造成功。
7. 用户清单选中的有效集合成为本轮确认范围；后续 inject/export 默认只能消费这个集合，不能因为以前 confirm 是整包确认就把用户取消的模型重新纳入。保持全部原资产及排除理由，允许用户以后改选。
8. 返回紧凑描述清单，Agent 读取用于后续匹配。原包不存在时请用户重新提供模型包，不接受仅凭描述清单还原模型。

旧页面在成功导入后可能携带旧 baseRevision。再次编辑时 Agent 重新生成同入口供用户使用；旧文件冲突需明确提示重新打开最新页面，不能静默覆盖或凭时间戳猜最新版本。页面载入清单只恢复其对应版本，不擅自提高 baseRevision。

### 17.6 实施顺序与改动地图

1. 固定清单 schema、包身份和选择集合语义，先实现原子 import-review 与幂等/冲突测试。复用 scripts/lib/designer-assets.mjs 现有底层验证与锁，避免重复编写确认逻辑。
2. scripts/lib/viewer/* 与离线封装模块生成 index.3d.html，实现模型检查、编辑、下载、同包清单载入；复用现有 Three.js 依赖，不新增 Viewer 框架。
3. scripts/designer-assets.mjs 的 preview 默认改为输出静态产物路径；receive/describe/confirm 等默认路径不再生成 review.html。改清所有隐式服务启动与第二入口生成点，而不只是改交付文案。
4. 检查 inject/export/list 对所选确认集合的消费，避免漏改旧整包确认假设。保持上传包优先、缺项检索与几何降级。
5. 清理新流程不再使用的服务入口及文档。旧服务如果仍有实际维护调用，可显式保留并说明调用者；不能让默认流程或测试继续依赖旧服务来冒充新流程通过。不在本任务重构无关模块。
6. 更新 SKILL.md、references/designer-assets.md、README：上传清单识别、下载后发回、导入成功停止/继续规则。不得让用户等待不存在的自动同步。
7. 回归、回填本节实现证据、重新打包，验证解压包可独立执行新流程、源码与 ZIP 一致。不要修改用户已有场景工程，不把业务模型/node_modules 打入包。

### 17.7 验收矩阵（维护时执行，不增加日常生成门禁）

- 真实离线页面：生成一个 index.3d.html，无 review.html，无新服务监听；GLB、GLTF+bin/贴图、共享依赖、压缩模型和混合失败包的全量清单正确。
- 真正文件闭环：在浏览器编辑中文名称/用途、取消一个可用模型、保存实际下载文件；调用正式 CLI 导入该文件；list 和后续 inject/export 与用户选择一致。不能只用手写 JSON 测试代替浏览器导出。
- 部分失败需明确子集确认；空选择/全失败不能成功；未知名称及空用途可正常确认。
- 同文件重复导入、修改后重导、旧 revision、错包、缺失/重复 ID、模型内容变化、非法技术结果、超限输入、写入失败均有测试，错误不留下半提交状态。
- 查看/关闭/快速切换保持表单；下载失败/受限不说已同步；载入已保存清单恢复编辑，错误包不覆盖当前表单。
- Agent 意图：只检查包导入后停止；已要求场景则继续；不传包照常生成；重复发文件不再次生成场景。
- Windows 普通浏览器与 file:// 实测；macOS 与 Octo 卡片/下载实测分开记录，未测不得宣称通过。宿主禁止下载时提示用外部浏览器打开同一产物，不启用服务或要求宿主桥接开发。
- 原有离线场景构建、材质/贴图/拖拽、保存导入和检索降级相关回归。
- 发布包解压验证，所有新依赖可用、没有模型与 node_modules、没有遗留 localhost 使用说明。记录代表性包的耗时与资源，不虚构跨平台/大包性能。

### 17.8 交接与完成回填

当前完成：新方案、文件契约、修改范围与验收要求已写入；旧宿主自动回传方案已删除。
当前未完成：实现、实际回归、新发布包。现有发布 ZIP 仍为 §16 的服务实现，不能当作本方案已完成。

交给实现 LLM：只以本节作为本次需求与验收目标；§1～§16 用于理解已有代码和历史，不重建旧服务流程，不实现桥接。不更改既有生成场景的默认交付规则。完成后回填修改文件、实际测试证据、未验证平台、发布包路径/摘要和剩余问题，不用自评“全部通过”替代证据。

### 17.9 实施回填（2026-10-21）

状态：代码完成；Windows 11 + Edge(Chromium) file:// 实测通过（真实浏览器下载清单→CLI 导入闭环，非手写 JSON）；macOS 未实测；Octo 宿主卡片/下载交互未实测。旧会话服务（viewer-session/viewer-server/viewer.js/frame.*/index.html 及 preview-status/preview-stop）已全部删除，无第二入口残留。

#### 修改文件

新增：
- `scripts/lib/intake-page.mjs`：清单契约常量（schemaVersion=1、models.3d.json、intakeLimits：文件 24 MB、条目 10000、名称 200、描述 2000、图片 256 KB）、`generateIntakePage`（静态页生成：内嵌 three.js 0.185.1 运行时 + Draco 解码器 + 模型闭包，全部 data: URL）、`importReview`（包写锁内原子导入：精确重复幂等、baseRevision 冲突拒绝、invalid 资产跳过内容复验、技术结果经 validPreviewImage/边界数值校验、选择集合成为 confirmation）。
- `scripts/lib/viewer/intake.js`：页面控制器。顺序检查（20s 单项限时）、固定双视角缩略图、名称/用途编辑、使用选择与排除清单、点选交互预览（dialog + OrbitControls，关闭释放）、保存清单下载、载入已有清单（同包同版本恢复）。入口 URL 转 blob: 规避 GLTFLoader 对 data: URL 的 extractUrlBase 截断；依赖解析器将 `data:model/<file>`、`blob:null/<file>` 伪基址重新匹配回闭包。
- `scripts/verify/intake-session-fixtures.mjs`：真实浏览器全流程回归（12 断言）。

修改：
- `scripts/lib/viewer/checker.js`：`checkModel`/`mountModel` 支持注入 `resolve`/`decoderPath`（离线页面复用同一检查器语义）。
- `scripts/designer-assets.mjs` CLI：`preview` 默认改为生成静态页（返回 `{status,page,data,assets}`）；新增 `import-review <pkg> --file <清单>`；删除 `review`、`preview-status`、`preview-stop`；`preview --headless` 保留为维护测试后端。
- `scripts/lib/designer-assets.mjs`：删除 `review()` 与所有 review.html 生成点（receive/describe/confirm/applyCheckResult 不再写 HTML）；其余资产链路（DA-R1~R3、inject/export/confirm）未改语义。
- `SKILL.md`、`references/designer-assets.md`、`README.md`：意图分流改为“清单页交付→文件发回→import-review 导入”；删除服务/链接/恢复规则章节；平台边界更新。

删除：`scripts/lib/viewer-session.mjs`、`scripts/lib/viewer-server.mjs`、`scripts/lib/viewer/{index.html,viewer.js,frame.html,frame.js}`、`scripts/verify/{viewer-session,viewer-lifecycle,viewer-coordination}-fixtures.mjs`。

#### 技术要点（踩坑记录）

1. file:// 下 importmap 映射 data: URL 模块可行，但 data: URL 模块内的**相对导入**（`./three.core.js`）无层级基准 → 页面内联 shim 递归改写相对导入为 blob: URL 后 import。
2. DRACOLoader 顶层 `new URL(..., import.meta.url)`（5 处常量）在 blob: 基址下抛 Invalid URL → 按 `new URL( '` 字面量替换为全局 `NEUTRALIZED_URL`（本页恒传显式 decoder path，不依赖默认值）。
3. GLTFLoader 对 data: 入口的依赖解析会把 `mesh.bin` 拼成 `data:model/mesh.bin`；对 blob: 入口拼成 `blob:null/mesh.bin` → resolver 识别伪基址后按文件名匹配闭包，真 data:/blob: URL 放行。
4. 模板字符串生成页面代码时 `\s` 等 regex 转义会被吃掉 → 避免 regex，改用字符串 split/join。

#### 实际命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify/intake-session-fixtures.mjs` | 12/12 PASS。真实浏览器打开 file:// 页面：可用模型真实加载出缩略图（naturalWidth 800）、坏纹理/坏 GLB 完整失败展示且不可选；名称/用途编辑、点选预览（dialog 尺寸>100、canvas>0、关闭释放）、保存按钮产出真实下载 blob（kind=model-intake、submissionId、仅所选条目 selected、图片随行、无 token/模型二进制）；载入清单恢复表单；import-review 落盘名称/用途/确认集合与缩略图；同文件重复导入 duplicate 且 revision 不变；inject 只消费确认子集；错包/缺条目/新 revision/内容变更/垃圾 JSON/超限全部拒绝。证据目录 `%TEMP%/gts3d-intake-session-ChA9FC` |
| Draco 压缩模型实测 | person.glb（2,054,944 字节，KHR_draco_mesh_compression）过同一页面：可用 1、失败 0、缩略图 800px。`%TEMP%/gts3d-intake-draco-*` |
| `node scripts/verify/designer-assets-review-fixtures.mjs` | PASS（DA-R1~R3 保持）。`%TEMP%/designer-assets-review-S2VuhX` |
| `node scripts/verify/designer-assets-fixtures.mjs` | PASS。`%TEMP%/designer-assets-OP7qpi` |
| `node scripts/verify/gates.mjs --quiet` | 92/92 |
| `node scripts/verify/offline-fixtures.mjs` | PASS |
| `node scripts/verify/generation-fixtures.mjs` | PASS（typecheck 87870ms、bundle 32719ms）。`%TEMP%/gts3d-generation-4BcTZ2` |
| `node scripts/verify/efficiency-fixtures.mjs` | PASS。`%TEMP%/gts3d-efficiency-NnzRLh` |
| `node scripts/verify/p1-fixtures.mjs --node-only` | 67/67 PASS（P5 保真/导出/回滚等引擎回归；与本轮改动面正交） |
| 发布 ZIP 手工中央目录逐字节比对 | 164 文件、mismatch=[]、unexpected=[]、banned（viewer-session/viewer-server/viewer 旧页面/frame/node_modules/GLB/gltf）均无；`intake-page.mjs`/`viewer/intake.js`/`viewer/checker.js` 在包内 |
| 发布包解压后真实浏览器闭环 | receive → preview 生成页面 → 真实浏览器 file:// 打开：2/2 模型检查可用、保存清单（2 selected）→ 解压包内 CLI import-review applied（selected 2/usable 2）。`%TEMP%/gts3d-release-browser-*`（已清理） |

#### 平台与宿主证据（区分状态）

- Windows 11 + Edge(Chromium) file:// 静态页：**已实测通过**（上表 intake-session-fixtures 为真实浏览器下载→导入，非 mock）。
- macOS Safari/Chrome：**未实测**。无 macOS 机器；交付同一页面步骤（preview 生成后把 index.3d.html 交给用户双击打开，file:// 直开无平台差异预期，但未经实测不得宣称通过）。
- Octo 宿主卡片/下载交互：**未实测**。skill 控制文件已就绪（每包唯一 index.3d.html、title=index.3d、无 localhost 引用）；宿主禁止下载时的提示文案已备（外部浏览器打开同一产物）。宿主实际卡片数量与下载行为需真实环境验证。
- 独立 Windows Chrome（无 Edge）：未单独实测，以同内核 Edge 覆盖，与历轮口径一致。

#### 性能采样（本地小样例）

静态页生成（3 模型含 one.glb 764B + two.gltf 多文件 + broken）：页面 5.1 KB + 数据 4.5 MB；浏览器首开至检查完成（含 two.gltf 纹理加载）约 6-9s。person.glb（2 MB Draco）：可用 1 项，检查含解码渲染约 3-5s。数值为单机小样例，不构成大包性能承诺；大模型包性能未采样。

#### Plan-Execution Diff / 剩余风险

- §17.2 “新输出放在输入模型目录之外”：产物在包输出目录内（`<pkg>/index.3d.html`），输入 ZIP 目录不被触碰；`inputFiles` 仅在 receive 时扫描输入，产物不参与资产摘要——符合“避免产物被扫描为资产”的意图，落点与字面表述（包输出目录 vs 输入目录）一致。
- §17.3 “刷新可能丢失未导出的编辑”：已实现 beforeunload 提示；未做 localStorage 草稿（spec 标注可选辅助）。
- §17.4 “首次页面内检查可缓存结果，但下载不是服务端落盘” 与 §17.5 “技术检查结果随描述传回” 均实现：同一会话刷新页面（重新 preview 生成）复用已落盘缓存缩略图不重跑；导入时结果重新校验。
- §17.5 第 7 条 “后续 inject/export 默认只能消费这个集合”：inject 实测通过；export 走同一 `selected()` 入口，未单独起浏览器用例（designer-assets-review-fixtures 已覆盖 export 的确认消费语义）。
- 已知边界：页面检查超时 20s 为硬编码（与既有 viewer 口径一致）；清单图片上限 256 KB/项（缩略图 PNG 实测 13-22 KB）；`NEUTRALIZED_URL` 补丁绑定 three 0.185.1 的 DRACOLoader 源码形态，升级 three 需复查。

#### 发布包

`D:/cyc/project/octo/gts/test/ep-coder/dist/generate-3d-scene.zip`，164 文件、1,466,286 字节、SHA-256 `80b609f8e0c97a8f67611aed2261656cafab952922e844b126fe413ab7b7fb3e`；与源码逐字节一致；无业务模型、node_modules、浏览器二进制、旧服务模块；未入包项仅 `samples/` 与维护测试（pack-skill 既定白名单）。


### 17.10 整体 review_execute（2026-10-22）

结论：FAIL。单卡片静态产物方向正确，基本文件导入可用，但版本保护、表单持久化、资源解析和相邻消费路径未闭环。此次仅审查、临时目录复现与 Spec 回填，未修改实现或发布包。

Review Matrix：目标达成 PARTIAL；Spec-代码一致性 FAIL；代码正确性 FAIL。不要求重写引擎或恢复服务；按下列根因集中修复。

实际验证：
- 仅重跑 `node scripts/verify/intake-session-fixtures.mjs`：12 项输出 PASS，目录 `C:/Users/Tony/AppData/Local/Temp/gts3d-intake-session-amCFps`。该测试验证的是正常路径；所谓版本负例只测试未来版本，不测试旧版本覆盖。下载证据为捕获页面 save 生成的 Blob 后由测试写文件，不等同操作系统实际下载成功，Octo 下载仍未实测。
- 补充导入探针：`C:/Users/Tony/AppData/Local/Temp/intake-review-QOJQ6r`。测试错身份/版本、重复条目、全失败、倒置边界、旧清单覆盖，均得到 applied；整包说明仍为 original。
- 同一临时包真实浏览器：仅确认首项→重新生成页面，勾选变为 `[true,true]`；快速连续点预览两次，关闭前 2 个 canvas、关闭后残留 1 个。
- 直接执行当前 makeResolver：`blob:null/red/base.png` 与 `blob:null/blue/base.png` 均映射为 RED，复现不同目录同名资源串用。
- 发布 ZIP 164 文件，逐文件 mismatch=[]；SHA256 `80b609f8e0c97a8f67611aed2261656cafab952922e844b126fe413ab7b7fb3e`，因此源码缺陷同样在发布包中。不重复运行与本轮无关的引擎全套测试。

#### MR-R1 [P1] 旧版本覆盖与幂等判断不完整

位置：scripts/lib/intake-page.mjs:282–290、331–343。
`baseRevision > pkg.revision` 只拒绝未来版本，旧版本仍通过。实测 revision=1 的清单在首次导入增为 2 后，换 submissionId 再次导入，覆盖了名称。幂等 hash 仅含 entries，忽略整包说明、确认意图等；同 ID 不同内容也没有显式拒绝。仅变更选择集合时 revision 不递增，不能保护并发选择修改。
修复：非精确重复必须严格匹配当前版本；hash 覆盖完整规范化业务提交；同 ID 异内容拒绝；所有持久业务变化包含说明/选择/确认都要使版本前进。重复响应应反映当前持久确认，而不是旧请求的 selected。验收包含 A/B 两份旧页面、仅改选择、同 ID 异内容与重复提交后当前状态已变化。

#### MR-R2 [P1] 导入契约与技术结果校验没有落实

位置：scripts/lib/intake-page.mjs:84–90、276–308、350–369；viewer/intake.js:359–386。
页面 packageId 为 null（当前包没有 id），packageDigest 未生成；导入不校验这两个字段及 checkerVersion，不检查条目唯一性。实测重复第一项替代第二项、错误身份/版本仍 applied。applyTechnicalResult 重写了较弱的检查，倒置 bbox 可通过，负几何计数可被写入；声明的单图/整包描述限制未执行。usable/selected 在应用最终技术状态之前计算，旧 loadable 收到失败结果仍可能进入确认范围；全失败导入也返回 applied。allowPartial 未校验。页面载入清单同样仅校验数量/ID membership，可漏掉重复/错身份并直接信任 result.ok。
修复：统一入口验证，生成真实包身份/摘要；精确全量唯一 ID、类型/大小/版本验证；复用既有 validateCheckPayload 等严格规则；以最终有效技术结果计算选择；明确部分确认、空选择/全失败错误；页面载入先完整校验再更新表单。不要增加默认二次浏览器验收。

#### MR-R3 [P2] 导入失败会留下已修改的缩略图

位置：scripts/lib/intake-page.mjs:314–320、362–364。
逐条处理时直接覆盖 previews 文件，后续条目校验失败才抛错；package.json 虽未写，原缩略图已经变化。包写锁不能提供多文件事务。
修复：先验证整批，再用临时或内容寻址图片准备数据，最后原子提交包引用；失败不替换旧版引用文件，清理未引用临时资源。测试第二条无效、图片写入失败、最终包提交失败时旧包及其引用图片不变。

#### MR-R4 [P1] 用户编辑与选择不能可靠保留

位置：scripts/lib/intake-page.mjs:322–344；viewer/intake.js:274–278、284–317。
packageDescription 被导出但从未写入 pkg.description，实测新用途丢失。重新生成页面把所有成功项 selected=true，已取消的模型被重新勾选，实测确认。事件绑定在全部异步检查完成之后，检查中编辑当前条目随后 paint 用原始数据覆盖；字段没有统一草稿状态，整包输入没有 dirty 监听。
修复：保存并返回整包说明；页面从当前确认集合恢复选择；初始化即绑定编辑事件，表单草稿独立于检查状态，重绘不覆盖输入；包括整包说明在内统一未保存提示。测试慢加载过程中输入、只改整包说明、取消一项后导入并重开。

#### MR-R5 [P1] 多目录同名依赖映射错误

位置：scripts/lib/viewer/intake.js:16–34。
合成 URL 被 split('/').pop() 截去目录，再按 basename 取首个匹配。两个目录的 base.png 因而映射同一纹理；同名 bin 还可能使几何错误或检查失败。上述 resolver 探针已复现。
修复：保留相对入口路径并规范化 URI，精确映射依赖闭包；歧义必须报错，不取第一个同名文件。补同模型引用 red/base.png 与 blue/base.png、嵌套入口、相对父目录和 URL 编码路径回归，并检查实际加载内容。

#### MR-R6 [P2] 新页面绕过已有缓存/失败状态规则

位置：scripts/lib/intake-page.mjs:60–74；viewer/intake.js:276–294。
checkCacheState 只决定是否附缩略图，不改变 loadable 状态；页面见 loadable 就跳过检查（包括 checkerVersion 不匹配的 fallback 状态）。缺图/坏图/旧版本因此无恢复检查，可能导出 result=null，后续 inject 再报缓存无效。preview_failed 则每次进入顺序循环自动重跑，页面没有显式失败重试按钮。
修复：生成端和页面共享明确的 hit/miss/stale/failed 语义；缺证据恢复、内容变化拒用、已完成失败显式重试，不能互相混用。补删除图片、旧 checkerVersion、已失败重开与点击重试回归。

#### MR-R7 [P2] 预览异步生命周期和超时未收口

位置：scripts/lib/viewer/intake.js:56–61、132–184、293–297。
openViewer 加载前没有实例所有权，连续点击创建两个 renderer，最后只保留一个 dispose。已实测关闭后残留 canvas。加载中关闭同样不能阻止迟到实例创建。Promise.race 20 秒只拒绝等待，底层加载未取消，可能和后续任务并行；入口 Blob URL 未释放。
修复：每次打开使用可取消/过期令牌和实例局部 finally 清理，迟到成功不能挂载到新 dialog；超时任务需有释放策略，释放 Blob、loader、renderer 和计时器。补双击、关闭时仍加载、失败后重开、超时后迟到完成；不增加新框架。

#### MR-R8 [P1] 检索模型的原有确认路径断开

位置：references/designer-assets.md“使用与内网补缺”；scripts/designer-assets.mjs preview / accept-remote。
文档仍要求 download → preview → accept-remote → inject，但 preview 现在只生成静态页面，浏览器结果只有经 import-review 才能落盘。库候选不走设计师上传包清单确认，所以按现有文档执行到 accept-remote 时仍是 structure_valid，confirm 拒绝。已有资产回归不能证明新默认检索流程可完成。
修复：明确并实现库候选的技术结果落盘路径，同时保持库候选无需设计师全量填写确认、不强制 Edge、不恢复默认服务器。选择具体实现前先将流程回填本节，避免仅改文案掩盖断点。用模拟检索/下载响应跑正式 CLI 默认路径到 inject，验证不是依赖测试里的直接 applyCheckResult 注入。

#### 集中修复与复核交接

先统一导入契约/版本/事务（R1～R3），再统一表单与技术状态（R4、R6），修复资源路径和预览生命周期（R5、R7），补通库模型路径（R8）。保留已经可用的单 HTML 文件方案，禁止以恢复服务或宿主桥接规避问题。

补充验收：保存按钮在空选择/全失败时不产出可确认清单，部分使用明确提示；页面下载大小与导入限制一致。现有测试必须新增缺失的旧版本、选择恢复、同名依赖、快速双击等断言，不以重跑现有 12 项替代。

修复后仍需一次定向复核，重点检查以上根因和交叉路径；无需重跑无关引擎全套。macOS、Octo 实际卡片/下载和大包性能继续如实标为未实测。


### 17.11 集中修复执行计划（2026-10-22）
用户授权：直接修复 MR-R1～R8。阶段 Execute；范围为清单文件闭环及其检索消费路径，更新发布包，不修改业务场景。
执行选择：共享清单契约用于页面/导入校验；包身份持久化；图片内容寻址并以包 JSON 原子引用提交；页面草稿与检查状态分离；精确依赖路径；可取消预览所有权；失败显式重试。
R8 具体方案：同一静态页自动识别全 remote 来源，提供技术结果下载（不要求整包语义填写确认）；新增 import-check 仅接收 remote 检查结果并写入技术状态，之后 Agent 判断匹配再 accept-remote。宿主有浏览器操作能力时可取得下载文件；没有则说明需打开页保存结果，或允许按用户需求降级；不假装 HTML 生成即检查通过，不强制 Edge，不恢复服务器。上传包 import-review 与 remote import-check 严格区分。
验证：相关文件闭环浏览器测试、导入契约/事务/缓存/资源/生命周期定向测试、remote 正式 CLI 消费路径、解压发布包验证；不重跑无关引擎全套。


### 17.12 集中修复结果与验证（2026-10-22）

本轮由 Codex 直接实现，无需再次交给其他 LLM 修复。未提交 Git，未修改业务场景源码。

| 问题 | 最终实现 |
|---|---|
| MR-R1 | 非重复提交严格匹配 revision；规范化全提交摘要用于幂等；同 ID 异内容拒绝；描述/选择提交都递增 revision；重复返回当前持久确认集合 |
| MR-R2 | 新包持久 UUID，旧包生成页面时补身份；包摘要绑定资产/内容/来源；共享 intake-contract 校验完整唯一条目、身份、版本、选择、文本/图片限制；Node 复用 validateCheckPayload 校验真实 PNG/有限边界/计数；最终成功结果决定可选集合 |
| MR-R3 | 全批校验在前，图片按内容寻址并保持旧引用不变，原子提交 package.json；提交失败清理本次新图片；已有哈希路径损坏时写新的唯一图片路径以恢复缓存，不覆盖旧引用 |
| MR-R4 | 整包说明落盘；页面恢复确认选择；事件在检查之前绑定，表单草稿独立于检查结果，重绘保留输入；整包说明纳入 dirty 状态 |
| MR-R5 | GLTF 使用虚拟资源根和入口目录，URI 规范化后精确映射依赖闭包，不按 basename 猜文件；编码路径正常解析 |
| MR-R6 | 页面使用明确 cacheState，缺证据重新检查，stale 阻止消费，已失败项保持失败并提供显式重试按钮；生成页面不嵌入 stale 模型闭包 |
| MR-R7 | 每次预览有独立 AbortController 与清理器，关闭/替换取消旧实例，迟到模型只释放；检查超时取消等待、尝试终止 manager/decoder，释放 Blob 与 renderer，迟到结果不创建 renderer |
| MR-R8 | preview 自动识别全 remote 包为 remote-check，仅保存检查结果；import-check 验证来源并写入技术状态、不做语义确认；Agent 判断匹配后 accept-remote，再 inject。上传包不能使用 import-check 绕过用户确认 |

上传页面仍只有 index.3d.html 入口及数据配套文件；部分使用必须勾选同意、全失败或空选择不能下载可确认清单。库检查页名称/用途只读，不显示上传包的使用选择；技术检查全失败可以保存失败报告，但 accept-remote 不会通过。

新文件：scripts/lib/viewer/intake-contract.js、scripts/verify/intake-review-fixtures.mjs。
修改：scripts/lib/intake-page.mjs、scripts/lib/viewer/intake.js、scripts/lib/designer-assets.mjs、scripts/designer-assets.mjs、scripts/verify/intake-session-fixtures.mjs、SKILL.md、README.md、references/designer-assets.md。

#### 实际测试证据

| 验证 | 结果 |
|---|---|
| 基础 intake-session-fixtures | PASS；`C:/Users/Tony/AppData/Local/Temp/gts3d-intake-session-PcEX8b`。更新测试模拟真实 input/change 事件和显式子集同意，未删除原断言 |
| 新 intake-review-fixtures | PASS；`C:/Users/Tony/AppData/Local/Temp/intake-review-fixed-W7xrZ7`。覆盖身份/重复/旧版本/倒置边界/负计数/选择版本、整包用途、包提交失败注入、同名与编码依赖映射 |
| 新测试中的真实浏览器 | 使用 Browser.setDownloadBehavior 将页面生成清单实际下载到磁盘，再调用正式 CLI 导入；覆盖检查中输入、选择恢复、双击/加载中关闭、缺图修复、失败重开不重试、显式重试 |
| 超时定向用例 | 仅测试浏览器缩短 20 秒定时器并延迟模型 fetch；确认超时后无迟到 renderer，显式重试可恢复，产品仍使用原超时配置 |
| 库模型路径 | 模拟 HTTP 模型库资源，正式 download → preview → 浏览器实际下载结果 → import-check → accept-remote → inject 全链路通过；此处没有冒充真实内网检索联调 |
| designer-assets-review-fixtures | PASS；`C:/Users/Tony/AppData/Local/Temp/designer-assets-review-ApBYjC`，身份/依赖变体、混合排除、scene scope、remote 候选相关回归 |
| 发布包解压闭环 | 解压到 `C:/Users/Tony/AppData/Local/Temp/intake-release-4y_9k20h/generate-3d-scene`，仅临时复制维护测试与测试样例模块进去运行，其余模块来自 ZIP；基础 intake-session-fixtures 通过 |
| diff 检查 | 相关修改 git diff --check 通过；未重跑无关引擎全套 |

中间两次新测试失败是测试等待导航 DOM 的时序及共享缩略图删除后未复原的测试隔离问题，已修正测试后完整重跑通过；未放宽产品校验。

#### 发布

`dist/generate-3d-scene.zip`：165 文件，1,468,650 字节。
SHA-256：`7cf0c94eb0b7d08d6e6536ef7c3458acff7fab1c83819dd5cf869c0505b2a4e6`。
逐文件与 skill 源码一致（mismatch=[]）；无业务 GLB/glTF、node_modules；维护测试不进入发布包。新共享契约模块已包含。

#### 结论与边界

本地实现与定向验收 PASS，MR-R1～R8 关闭。用户原有未导入旧清单因缺少包身份/摘要字段应重新生成页面并保存，不能静默兼容弱校验。已有模型文件和包数据保留；旧包 UUID 在首次生成新页面时补齐。

未实测：macOS Safari/Chrome、Octo 卡片注册与下载、独立 Windows Chrome 无 Edge、真实内网检索/上传、大包性能。Windows Chromium 的实际文件下载已验证，不等于 Octo sandbox 一定允许下载。底层依赖取消以当前 Three.js 能力为限，迟到结果有所有权校验和释放；不承诺浏览器无法中断的同步解码能被即时抢占。

当前可直接用最新版包做设计师试用；不需要再重复历史全部审查流程。宿主没有浏览器操作能力时，库模型需用户打开同一检查页保存并发回结果，或按需求降级；这一路径已写入正式文档，不把未加载模型宣称技术通过。


后续实施入口（2026-10-22）：模型命名/精简元数据、统一资产规范、禁止相机灯光、生产预算告警、更新包继承描述、清单页面优化，见 `generate-3d-scene-model-standards-and-update-spec.md`。本文件保留 §17 文件闭环及历史验收记录，不在两处重复维护新需求。

# 默认场景生成流程

本页只用于生成场景；默认不打开浏览器，不截图、不做交互验收或性能采样。

## 1. 理解与选材

信息足够直接开始，相机、配色和布局细节可合理默认；只询问影响核心交付的歧义。在主要业务对象建模前，先列出类别，扣除已确认上传包覆盖项，将剩余对象一次批量调用 search-assets.mjs 检索。按实际候选判断匹配，合适库模型直接下载注入，不重新检查；无合适候选或服务失败才对该对象使用组件/几何。仅用户明确要求纯几何或不用模型库时跳过检索；基础地面、墙体、标线可直接几何。低多边形、工业风格和快速生成不意味着纯几何。未查询不能称未命中，服务失败与库中无匹配分别说明。无匹配及时降级，不反复搜索，不为每个场景编写 Spec 或验证报告。

## 2. 生成工程

运行 init.mjs 建工程，使用 --assets referenced --deps shared --defer-build，只注入引用资产并准备依赖，避免在写场景之前重复编译；缺依赖时按现有安装提示处理。根据 scene-data.json、scene-profile.ts、handlers、materials 和 cards 实现场景。保留 v3 数据契约、模型槽位及场景核心/编辑器隔离。新工程需继承 template/scripts/build-offline.mjs 和 offline-entry.ts。

按 scene-design-examples/README.md 读取共享规范和命中的领域方案。布局、尺度、相机、光照和材质在首版设计时完成；不能用取消截图验收作为省略设计的理由。代码使用的资源保存在 public/scene3d/assets 内，使用完整相对路径；动态组合的额外资源在 public/scene3d/offline-resources.json 中显式列出。

## 3. 一次构建

在 skill 目录运行：

```sh
node scripts/build-offline.mjs <工程目录>
```

该命令依次执行静态契约检查、Node 同步装配检查、类型检查、离线编译、资源闭包打包，向初始化指定的用户项目目录输出 index.3d.html、preview/ 和 source/。无需再重复 typecheck、npm run build、lint 或浏览器检查。工程自身 npm run build:offline 提供编译打包能力；默认生成必须走上面的统一命令以包含静态契约与装配检查。

装配检查在独立进程中使用真实 Three.js、SceneEngine 和本次 scene-data 执行同步工厂；最多 30 秒，超时或检查脚本失败按阻塞处理，不反复执行。它不创建 WebGL、不执行动画帧、不模拟 DOM、不加载模型或联网。依赖浏览器的节点标记 UNCHECKED，ASSEMBLY: partial 不等于错误或模型不可用；不得因此降级库模型或新增浏览器验收。报出的实际代码错误集中修复，共用下述重跑额度。输出 RUNTIME: not-run；不承诺所有运行路径已验证。

首次失败汇总实际错误并集中修复，最多两轮修复重跑（总计三次尝试）。无实质进展、脚本自身异常或环境失败提前停止；依照处理提示解决或报告阻塞，不能绕过检查、修改 skill 脚本求过关或重置次数。任意一次通过立即交付，不自行再优化。详细次数规则以 SKILL.md 为准。

## 4. 交付

交付 index.3d.html 的可点击绝对路径：双击打开，点击“编辑场景”调整材质、选择贴图和编排物体；保存下载 scene.3d.json，再次打开同一预览后“导入”恢复。移动预览时保留同目录配套文件。

不默认启动服务、strip-edit、输出第二份工程、验证报告或人工清单。构建通过不代表已经验证浏览器渲染，不作绝不白屏承诺。达到上限仍失败，明确“构建未通过”，列剩余错误及源码位置，旧预览不能冒充当前成功产物。

## 按需操作

- 用户请求源码联调/指定端口：使用 npm run dev，保持现有服务端贴图上传能力。
- 用户请求不含编辑器的源码：strip-edit.mjs 自动剥离并编译已保存外观；TRANSCRIPTION.md 是自动转换摘要，不要求 LLM 人工转录。它是源码包，不是已部署网站。
- 用户请求部署：按目标环境构建和部署；普通网页构建使用 npm run build。
- 用户反馈白屏、交互错误或卡顿：执行与问题相关的诊断；不要默认重新跑全套截图/性能流程。

### 开发工作区与交付目录

CLI `node scripts/init.mjs <用户项目目录>` 的参数是最终交付目录，不是开发目录。脚本在用户主目录 `.scene3d/workspaces/` 创建独立工程，输出 WORKSPACE_PATH 和 DELIVERY_PATH。所有源码编辑、模型注入、临时查询文件及其他工程脚本使用 WORKSPACE_PATH，不在用户项目目录初始化源码或安装依赖。统一 build-offline 支持传 WORKSPACE_PATH 或原交付路径；成功返回最终 HTML_PATH。用户项目根目录仅有 index.3d.html、preview/、source/，不再有 delivery/、offline/、node_modules。交付时链接 HTML_PATH。同机后续修改继续使用原工作区；跨电脑使用 source 作为完整工程。旧工程不会自动移动或删除；旧工程无交付配置时仍保留 delivery 输出兼容。

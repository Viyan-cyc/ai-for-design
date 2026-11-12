# 原生对象交付

默认原生模板导出native-component-source（formatVersion 2），包含component根package.json、TS源码、参数覆盖和设计/工程说明，不含Demo/vendor/node_modules。预览导出的是独立参数JSON。原生包与下述旧candidate-component格式不同，不能相互冒充或直接导入执行。开发须重新验证目标库兼容性；维护者可按[library-intake.md](library-intake.md)执行计划、副本验证和显式入库。

## 旧原型交付兼容

# 交付契约与证据

三类交付：preset为已有实现参数；scene-recipe为布局/组合和依赖引用；candidate-component为独立新源码。包应具备design.md（六项设计输入）、manifest.json、preset.json、controls.json、example/、engineering.md；新能力另含component/。完整演示runtime生成candidate-component，独立源码另用component-source格式（见本文末节）；不自动验证任意外部包。

manifest格式1：id/version/deliveryType/parameterFormatVersion、dependencies、assets（含hash及许可）、sources、files（相对路径/bytes/sha256）、states。manifest不自引用hash，整ZIP hash写外部证据。状态prototype/export/engineering=not-run|pass|fail|blocked；design=unconfirmed|confirmed|rejected；publication=unpublished|published。每项携带artifactHash/evidence/actor/time。不得凭导出成功升级设计/工程/发布。

参数schema负责实际字段，controls只描述字段指针、类型、单位、范围和分组；默认值不再重复保存。业务数据、取景、设计和设备预算有需求时分区，不强迫所有组件拥有地图坐标。固定上海取景不是通用组件契约。未知语义明确写未知。

候选ZIP当前STORE/UTF8、8MB/64项；不支持压缩/加密/ZIP64，不以增加限制代替已存在的用户数据保护。导入完整验证所有路径、CRC、hash、文件集合、源码/资产/依赖/状态、preset后才应用。仅接受当前已审查模板，导入不会执行源码，不覆盖磁盘。异步导入被更新操作取代则丢弃旧提交。

prepare负责当前候选manifest和template；交付前检查没有密钥、缓存、日志、node_modules或不允许分发资产。候选包含prepare脚本，开发可在独立副本修改后重新prepare，不能自动写共享组件库。

design.md区分用户原话、来源已有决定、LLM反推、新实现差异和待确认。engineering.md记录生命周期/参数映射/保存撤销宿主适配；尚未测试的接入标not-run。用户只评价视觉和必要性，不代开发运行构建。更新需显式版本/兼容决定，旧hash证据仅保留历史。

维护方：工具源只在tools/3d-component-studio，runtime由scripts/pack-skill.mjs生成；不手改生成资源。打包前先构建N2独立工具，再打包、verify，并在异地真实副本测试初始化。维护测试不随skill分发，发布与全局安装必须另有授权。

## 与生成器设计文档和风格模板衔接
交付design.md/engineering.md通过相对路径关联manifest/preset、适用宿主、映射和审查证据。保持现有manifest结构；不为关联资料增加未定义JSON字段。普通Three的scene3d-style/v1仅含场景/灯光/渲染器，地图preset和源码候选包不得送入该导入器。原始设计、反推和待确认继续分别保留。开发依据最新安装组件入口适配；调试、导出、设计确认、工程通过、正式发布各自记录，不能互相推导。
生成器接入是后续工程环节；本skill不自动安装候选或覆盖共享实现。未完成发布同步的组件入口必须标明不可作为已安装依赖。

component/example工作区与旧演示候选ZIP内的相对路径是两层：ZIP仍保持component/、example/、preset等既有契约，不包含node_modules、缓存或生成的index.3d.html。离线预览是设计师入口；源码候选由开发本地安装构建工具后重建。导出不等于设计确认或发布。

## 两种分离产物（新创作默认）
- 独立组件源码：在交付根运行node example/build.mjs --export-component，返回外置工作区component-source.zip。包含入口/schema实际静态依赖闭包、显式assets、Three许可、preset/controls/sources和component-boundary接口声明，以及逐文件hash清单。保留源码相对路径；包内路径以component目录为根，包含设计/接入说明及类型声明；开发从manifest.entry接入自己的构建系统。该包deliveryType为component-source，不是旧candidate-component参数导入格式，不应送入预览ZIP导入器。脚本读取磁盘preset；页面调参后须先把确认参数同步到preset并重建验证，再导出，不能把旧默认值当最终设计。
- 演示工程：现有预览按钮标为“导出演示工程ZIP”，继续保持candidate-component格式、完整可重建工程及严格同版参数导入。地图/业务样本只属于此材料，不得把这个ZIP称为纯组件源码。仅在用户需要时另行交付。
源码导出中的design/engineering/publication仍为未确认/未运行/未发布；已有验收另以绑定当前hash的证据记录，不自动提升状态。静态图检查不能证明业务独立性、任意运行时URL资源或视觉效果。旧已交付包不自动迁移。

当前目录契约：根index.3d.html为自包含代码预览（在线底图仍需网络）；component包含源码src、参数、许可和设计/接入说明；example包含宿主及构建入口。node_modules/.cache/offline/临时stage只在外置工作区，不进入交付目录或源码包。现有项目迁移须先备份并更新全部依赖引用与构建路径，不能仅移动文件。

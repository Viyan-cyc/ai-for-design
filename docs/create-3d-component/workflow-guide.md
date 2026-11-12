# 组件创作、入库与场景使用操作指南

适用：当前原生TypeScript组件流程。设计师负责效果与参数确认，开发负责接口、运行与接入验证。自动化工具位于仓库tools目录，不需要放入日常使用的skill。

## 流程与责任

创作组件 → 页面调节与设计确认 → 导出源码包 → 开发审查 → 组件库入库 → 同步生成器 → 生成场景并验证。

|步骤|谁来做|使用什么|得到什么|
|---|---|---|---|
|1 创作|设计师提出需求，LLM实现|create-3d-component；scripts/init.mjs|component组件与example演示工程|
|2 预览调节|设计师与LLM|example/build.mjs；index.3d.html右侧面板|可预览效果、参数JSON|
|3 导出|LLM/开发|example/build.mjs --export-component|原生组件源码ZIP；不带整张演示地图|
|4 准备入库|开发或代执行LLM|intake/cli.mjs plan及validate|独立副本验证、差异、生成文档、receipt|
|5 应用入库|开发审核后|intake/cli.mjs apply|组件库源码、分类导出、API文档及导航|
|6 准备同步|开发或代执行LLM|generate-3d-scene/scripts/sync-components.mjs|组件包、目录与说明的同步计划|
|7 应用同步|开发审核后|同一脚本 --apply|generate-3d-scene更新后的依赖与说明|
|8 使用|场景使用者与LLM|generate-3d-scene及原有init/build-offline|使用新组件的场景；验证保存恢复等实际路径|

**导出、设计确认、工程验证、入库、同步和发布是不同状态。** 源码导出成功不会自动入库；同步成功不会自动升级已有场景，也不等于正式发布。

## 统一命令：先配置一次，再按步骤执行

在PowerShell中设置仓库路径：

```powershell
$repo = 'D:\cyc\project\octo\skills\test\ai-for-design'
$runner = "$repo\tools\3d-component-studio\workflow.mjs"
$config = 'D:\your-work\workflow.json'
Copy-Item "$repo\tools\3d-component-studio\workflow.example.json" $config
```

先创建自己的工作目录，再编辑配置。示例故意不指向生产目录；初次练习请使用真实副本。路径可以是绝对路径，也可以相对配置JSON所在目录。

|配置项|填写内容|
|---|---|
|project|创作工程根目录，包含example/build.mjs|
|demo|example/library-demo.ts路径，新创作应填写；与源码包分开交付|
|candidate|实际审核的源码ZIP解包目录，或component目录；不接受ZIP文件路径|
|library|准备接纳组件的3d-components目录|
|generator|要更新的generate-3d-scene目录|
|category|组件库已有分类，例如core或helper；按职责选择，不是按视觉名称|
|exports|对外导出的类/工厂名称数组，如["Shelf"]|
|runtimeTest|开发为该组件编写并审阅的Node运行断言脚本|
|intakePlan|新计划JSON路径，父目录须存在，不得放在候选或目标库内|
|intakeWork、syncWork|本轮尚不存在的验证目录，放在源与目标之外|
|update|首次false；更新同一已入库组件才显式true|

需要Node及底层工程所需依赖获取环境；准备阶段会在独立副本构建。脚本不是免安装的可执行程序，不会修改全局npm配置。

### 1. 创作与预览

向create-3d-component描述功能、宿主和可调项；LLM需实现业务代码，初始化模板本身不是成品。独立对象使用native-object，依附场景效果使用native-host；动画根据需求决定。

初始化示例（只执行一次，输出真实路径以WORKSPACE_PATH为准）：

```powershell
node "$repo\skills\create-3d-component\scripts\init.mjs" 'D:\your-work' 'my-component' --profile native-object
node $runner build $config
```

打开构建输出的HTML_PATH（index.3d.html），在右侧调节，确认实时画面。example负责地图/灯光/相机等演示宿主；component只承载组件自身及交付说明。关闭依附效果应恢复宿主。

### 2. 确认参数并导出

页面导出的参数JSON是下载文件，**不会自动写回磁盘preset**。让LLM/开发核对id、version、formatVersion及参数有效性，将已选parameters写入component/preset.json。先确认预览，再运行：

```powershell
node $runner export $config
```

此命令依次普通构建和源码导出，避免只导出而预览仍停留在旧参数。按COMPONENT_SOURCE_PATH找到ZIP，解包到新的审核目录，更新candidate。检查component源码及设计/工程说明，确认没有把整个演示宿主当组件。参数导出不是源码包，两者不能混用。

### 3. 一条命令准备入库

先填写分类、exports和运行断言，然后：

```powershell
node $runner prepare-intake $config
```

它串联plan与validate：复制库做类型/构建/运行验证，并生成文档差异。阅读intakeWork下changes.md、proposed/、日志及receipt.json。运行断言调用约定为`node 测试脚本 库副本目录 分类 导出名...`；必须检查该组件真实功能、参数、资源释放。不能把通用模板测试当作所有业务组件的证明。

准备不会修改目标库。独立review通过、开发确认后执行：

```powershell
node $runner apply-intake $config --confirmed
```

组件源码落入库的src/分类/组件id，脚本补分类出口；API/参数/设计说明进入docs/components/组件id并更新导航，已有人工notes保留。不是把整个创作工程复制进库。依赖/宿主不符合当前接纳契约时会拒绝，应先适配并重新验证。

**可交互Demo：** 新创作模板同时提供example/library-demo.ts，LLM须随业务实现更新它。配置demo为该文件路径，入库时生成上方画布和右侧实时控件，下方保留API说明。Demo导入真实接纳源码；不会嵌入旧的创作HTML。源码ZIP不包含演示宿主，交付开发时另附example/library-demo.ts。默认值及重置来自源码参数；设计preset仍独立保存。

开发应检查Demo初次显示、调参、恢复默认及切页释放。当前仅提供独立对象和借用Mesh的模板示范；地图等宿主需要LLM/开发显式编写适配器。旧候选未提供demo仍可生成API页，但会明确提示演示缺失。更新已有Demo须再次提供demo，内容变化需重新准备计划。

### 4. 一条命令准备同步generate-3d-scene

入库完成之后运行：

```powershell
node $runner prepare-sync $config
```

首次接管旧版已生成文件、确认归属后，才使用`--adopt-generated`；常规更新不加。阅读syncWork下changes.md、proposed/与sync-plan.json。脚本从当前库真实副本构建，准备一致的组件包、目录和机器生成说明；不会把历史审查报告塞进场景设计指南。

审核后：

```powershell
node $runner apply-sync $config --confirmed
```

这由开发运行，或开发明确授权LLM代运行；设计师无需手工复制references。人工设计指导不应被自动推断或覆盖。脚本更新可生成部分，设计意图仍由人/LLM编写审阅。

### 5. 生成实际场景并验收

继续使用generate-3d-scene原有流程：scripts/init.mjs以`--with-components`创建工程，再用scripts/build-offline.mjs统一构建。由LLM按需求接入组件；需要编辑器、保存或地图宿主适配的组件，应补相应适配并验证。同步只提供包与说明，不会替所有新组件自动编写业务接入。

验证页面真实渲染、调参、关闭/释放，以及涉及的保存恢复。已有场景需单独升级和验证。正式发布仍按开发团队发布流程执行，本入口没有发布命令。

## 失败后怎么继续

- 任一步退出非0，统一入口停止后续子步骤，终端保留原脚本日志。
- 准备失败后修复原因，换新的intakePlan/intakeWork或syncWork，重新准备；不强行复用残留目录。
- 审核期间源文件、目标文件或测试变化，旧凭据可能被拒绝；重新准备并审核，不绕过基线检查。
- 入库成功而同步失败：库仍然已入库，生成器仍需修复后重新同步。两个应用步骤不是跨仓库原子事务，不自动撤销已成功入库。
- 想同时更新多个组件，逐个准备与审核；不要用本例覆盖已有分类或同名组件。

“一键”在这里是每个已授权阶段一条命令，重复的规划、构建与验证自动串联。设计确认和开发审核仍有明确位置，避免一个命令未经检查把候选推进到正式环境。

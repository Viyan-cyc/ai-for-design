# 从自然语言到可修改原型

新建原型运行 `node <skill>/scripts/init.mjs "<artifact-folder>" <稳定id>`，目录按主入口规则取自运行环境；未提供时执行 `node <skill>/scripts/init.mjs <稳定id>`，使用当前工作目录。默认在产物父目录下按稳定id创建具名工程，重名追加编号；显式完整路径加 `--project-dir`，已有路径拒绝初始化。init返回WORKSPACE_PATH，源码集中在返回的`WORKSPACE_PATH`。在该目录本地执行`npm install`、`npm run build`；构建返回HTML_PATH，默认交付根目录`index.3d.html`，不要求设计师启动HTTP服务。Three基础库随附，Vite仅为项目本地构建依赖，不全局安装。

初始化只有静态立方体，不能当作业务实现。将需求转为至少一条可观察行为和失败/空态；核对已有组件接口能否表达，写入design.md和flow.md。随后修改同一个工程的component/component.mjs，必要时增加纯逻辑模块。修改preset.json、component/schema.mjs、controls.json应一起完成；控件默认值来自preset。

接口：create(scene,preset,invalidate)返回update(preset)、tick(dtSeconds)（仍有活动时返回true）、snapshot()、dispose()。dispose只释放自己资源且可重复调用。宿主在活动结束后停止RAF；交互唤醒invalidate。actions可提供{id,label,start,stop}，宿主处理指针/键盘。每次改变组件actions后重开页面；不要热替换未解绑旧闭包。

自然语言迭代必须改代码并复验行为。例如先做顺序检查点，再按“离开前未达到驻留时长则取消”新增状态机；这不是只改duration默认值。此例不是用户必选设计，不限制其他创意。

每次代码修改后重新`npm run build`，同步当前文件hash、交付模板和离线预览。只执行prepare不能算预览交付完成。导出后关页重开导入参数；额外在全新真实目录解包并实际运行。导入不同源码版本被拒绝是预期行为，新源码由开发审查/启动，不通过导入动态执行。

性能/画面：验证更新、空态、重复创建、资源释放、闲置不持续绘制；视觉实际查看，用户评价必要性。对底图或在线资源不可达应报告，不静默伪装。依赖只使用许可可交付资产并记录版本。

## 默认交付体验
每次创作默认提供实际预览、实时参数面板和恢复默认；用户无需重复提出“可调面板”。根据需求开放已实现的参数、单位、范围及适用的播放操作，不能显示无效控件。自定义地图等宿主也应提供等价面板，不能把静态Three脚手架说成支持任意宿主。
根目录面向设计师：index.3d.html（唯一主预览）、兼容index.html入口、source/（可修改工程）；内部代码、参数、说明、依赖及manifest都在source。候选ZIP是source契约，不把源码工程文件逐个变成聊天artifact。旧工程迁移先备份并核对，保留用户历史，不静默覆盖。
默认构建器把Three模块、当前参数、控件与导出模板打入单一HTML。仅支持可内嵌的本地静态依赖；额外网络资源/动态模块必须明确实现并验证相应交付策略，不以“改后缀为index.3d.html”冒充离线支持。对独立解包的候选工程，在其根目录npm install后npm run build同样生成index.3d.html。
交付前实际以file://且禁用网络打开HTML_PATH，验证画布、控件、更新、重置及参数往返；有外部必需资源时必须另行说明实际条件。失败应在页面显示原因，不能只留下空壳按钮。不能只以HTTP开发页通过代替文件预览通过。

## 独立性检查
初始化后按实际需求更新component-boundary.json的purpose、owns、borrows、hostContract及assets。entry/schema是实际源码入口；assets仅列组件必要资源（放assets/），许可与来源写sources.json。将宿主适配放example，由它把建筑表面等输入传给组件，而非组件导入演示场景。参数及接口变化同步schema/controls。
npm run build在prepare阶段检查入口和schema的静态依赖图：仅允许component（不含delivery.mjs）及vendor模块，拒绝example、外部/未解析依赖及动态导入。额外加载机制需要明确扩展打包器并验证，不能删除检查绕过。组件中通过fetch/URL加载的资产须显式登记，检查器不自动证明运行时资源闭合。
技术检查不能判定复制进component的业务内容是否属于本体。LLM仍须审查职责并验证开关、重复挂载、销毁后宿主资源与行为；将未验证项明确记录。至少以另一组宿主输入验证没有写死演示业务数据。

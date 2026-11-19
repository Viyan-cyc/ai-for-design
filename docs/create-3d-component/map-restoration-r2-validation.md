# R2 清理验证

状态：执行与自检完成，待独立review；R3未开始。组件库提交`2a7846f188016f2250911f1d520d8aa6cbcf59e3`；生成仓提交`8be67cdafa3942b178ffbd38d6908d3e043d3842`；均未push。

## 改动

按R1清单删除C的39个旧业务/专属文档文件、G的3个适配/API文件。删除后的空目录仅用非递归rmdir清除，未扩大文件清单。保留MapRuntime、MapPresentation、扫光与ScreenLabel；普通HeatMap仍在。库导出、导航、Demo、索引与生成器资料一并更新。

生成器overlays类型收窄为空数组；缺省/[]兼容，其他输入在资源创建和更新前拒绝。快照保存[]，surface列表没有旧overlay入口；不自动修改既有用户工程。

首次同步使用r2-sync-02：35项操作、32项旧生成文件接管（catalog+30页+旧包）、新增0.1.1包/组件索引/manifest。机器文档主要更换生成标记；AssetCache导入修正为库实际根导出，未新增该能力。33项manifest文件原始字节复核通过。r2-sync-01因地图导出格式整改使源基线变化而被拒绝，没有apply；未篡改摘要重用。

`.gitattributes`新增四条精确受管文本模式的`-text`，禁止autocrlf转换生成器的原始混合换行；不改其他文件规则。独立checkout-index的33项指纹全部匹配。最初检出脚本使用text stdin被Windows转换换行而失败，改NUL二进制输入后通过；未覆盖工作区。

## 已运行检查

|检查|结果与边界|
|---|---|
|C TypeScript、Vite build|退出0；同步副本又完成types、文档生成、build、pack与声明/归档核对，日志r2-sync-02/build-docs.log及package-check.json|
|C 本批4个TS文件eslint|整改导出文件格式后0警告；真实pre-commit通过，没有HUSKY豁免；不是全库lint债务清零|
|docs-map-lifecycle / map-presentation / rounded-building-handoff / surface-scan|通过；来源工具调用输出记录在本轮会话；保留源码与R0归一化字节对照相同，见evidence/r2-preserved.json|
|map-overlays.mjs|构建公开入口旧符号/子路径消失，保留三入口存在|
|独立生成工程npm run build|vue-tsc及Vite通过；有既有动态/静态混合导入与大chunk警告|
|浏览器无旧层|省略overlays序列化[]、无overlay条目/散点画布/heatmap层/旧source、空配置往返、释放通过|
|浏览器非法更新|null/对象/非空数组初建拒绝无残留；更新拒绝后快照与画布不变；随后合法更新及保存后重建通过|
|浏览器保留集成|真实WebGL、标签180 CSS px、拾取、坐标往返、模型编辑、主题/视角、DPR、五类外观、锁定、撤销重做、销毁重建、失败释放通过|
|基础地图导航|本地空底图导航和释放通过；零覆盖层负载，不与旧聚合性能数字比较|
|同步保护|首次未接管/无标记人工页拒绝、合法旧包资格、已有manifest再次接管拒绝、缺confirmed拒绝、目标变化保留、源摘要不符拒绝、中途失败回滚通过；r2-sync-protection/result.json。私有ownership仅在内存模块追加导出测试，生产文件未改|
|Git/包与来源|暂存和独立检出33项manifest一致；浏览器预检归档与正式同步包SHA256完全相同；34个设计来源指纹未变|

浏览器使用本地合成的五类语义底图，不含外网城市瓦片或新增GLB资产。原测试“GLB加载”文字已纠正为“场景资产加载无失败”；不能据此宣称实际GLB加载或城市视觉通过。首次fixture只含道路，五类条目断言失败；补齐fixture的建筑/水/绿地语义层后保留原断言通过，没有修改保留组件来迁就测试。favicon 404也只在fixture修正。独立测试工程及日志均在native-work/map-components-restoration，不放组件交付包。

## 查看与复跑

- 组件库文档：http://127.0.0.1:17932/#MapPresentation 。导航应只有保留地图入口；普通HeatMap不在本次撤下范围。
- 空覆盖层检查：http://127.0.0.1:17931/map-overlays-browser.html
- 非法更新检查：http://127.0.0.1:17931/map-invalid-update-repro.html
- 保留集成检查：http://127.0.0.1:17931/map-integration-browser.html
- 导航检查：http://127.0.0.1:17931/map-p3-performance.html

文档服务命令（C目录）：`node node_modules/vite/bin/vite.js docs --host 127.0.0.1 --port 17932 --strictPort`。
测试服务命令（本任务r2-browser/source目录）：`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 17931 --strictPort`。
从R运行`node tests/generate-3d-scene/run-headless-functional.mjs <上述测试URL>`；页面以ALL PASS结束才通过。浏览器证据r2-map-overlays-browser.log、r2-map-integration-browser.log、r2-map-p3-performance.log在evidence目录；非法更新通过输出在本轮会话，未伪造为原始日志。

首次保护脚本需在apply前对prepare计划运行：`node tests/create-3d-component/map-restoration-sync-protection.mjs <全新独立目录> <sync-plan.json>`。当前已apply的旧计划不能再次直接应用；重跑事务应使用保存的apply前目标副本或重新prepare，不能改正式工作区制造故障。

本次不判R3–R8完成，不确认三新组件视觉，不发布包，不自动升级已有用户工程。两个实施提交用于阶段恢复，实际回退先核对后续修改，使用独立副本/revert，不用硬重置覆盖工作。

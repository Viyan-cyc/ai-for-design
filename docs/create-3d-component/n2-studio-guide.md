# N2 组件 Studio：已有参数调试

状态：已实施并完成执行方验证，等待独立review。仅N2，N3未开始，N8 LOCKED。

## 打开与启动

当前页面：http://127.0.0.1:4173/ 。这是本机服务，不是已发布网站。

如果服务未运行，在PowerShell执行：

```powershell
Set-Location 'D:\cyc\project\octo\gts\test\ep-coder\tools\3d-component-studio'
npm run dev
```

首次恢复依赖时仅在该独立工具目录运行 `npm ci --ignore-scripts --cache .npm-cache`。安装需要网络；已有依赖时页面不请求外部CDN。不要在生产组件目录运行安装、构建或同步。

启动和构建会核对11份真实副本文件的SHA256。副本位于 仓库根下的 `docs/create-3d-component/component-authoring-work/n2-isolated-grid`；缺失或变化会失败，不自动回源覆盖。该副本是已有Grid的调试依赖，不是从零创作成果。没有创建地图候选包或全局skill。

## 手动验证（约两分钟）

1. 打开页面，确认网格和三个蓝色方块出现。默认主间距5，颜色#333333。
2. 将主间距调为8，颜色改为#A25B31；确认实际网格变化。旋转/缩放只用于观察，导出固定取景。
3. 点击“导出参数包”，保存 `grid-debug.preset.zip`。浏览器只能下载，不能自动写入源码库。
4. 关闭页面，重新打开，默认参数恢复；点击“导入参数包”，选择刚下载的ZIP，确认8与颜色恢复。
5. 再次导出；检查两包preset与controls语义相同，不以时间戳或JSON排序判断效果差异。
6. 导入损坏或缺少文件的包，应出现“未应用…原状态保持”，参数及画布不变。维护测试中提供构造逻辑，不需手改生产代码。
7. “下载导出检查记录”保存与该ZIP哈希绑定的独立证据。它只证明结构/hash/再导入语义通过，不等于设计、工程或发布通过。

## 包及复现方式

ZIP含design.md、manifest.json、preset.json、controls.json、example/index.html、example/README.md、engineering.md。deliveryType=preset，不复制未改的Grid源码；复现需要同版本独立Studio和匹配的Grid基线，这些依赖及真实文件指纹在manifest登记。解压后example/index.html提供本机Studio参数复现链接；完整文件校验应使用ZIP导入。没有匹配的Studio/基线不能独立预览，不冒充自包含组件包。

包内五类状态保持未验证/未确认/未发布初值，不由导出自证抬升；伴随导出证据单独记录export/pass及完整ZIP SHA256，避免manifest自hash循环。本轮原型运行证据在n2-validation.json与n2-browser/result.json；设计确认仍待用户，工程接入和正式发布未执行。

## 当前支持与限制

- 仅支持已有Grid的primaryScale（世界单位，1–20，步长0.5）和color（#RRGGBB）。没有地图、散点、热力业务能力。
- 只接受本工具版本的STORE无压缩UTF-8 ZIP；拒绝压缩、加密、ZIP64、注释、额外字段、目录条目/链接、未支持的版本和依赖。上限2MB/16条。不是通用ZIP查看器。
- 参数控件只使用固定白名单，不执行包内JavaScript；未实现通用schema渲染、版本迁移或candidate-component导入。
- 导入完整检查后准备独立预览，成功才替换；最新请求/编辑取消旧请求提交，旧失败不覆盖新成功状态。最新请求失败也不会恢复更早的待提交请求。
- 交互中未使用持续渲染循环；按控件、视角与窗口变化重绘。销毁释放监听、geometry/material及WebGL上下文。没有生产保存/撤销接入。
- TypeScript启用strict但关闭strictNullChecks：已有动画副本AnimationController.ts:158/160有两处历史空值诊断，不改源代码或副本来消除它们。这是类型检查范围限制，不声称全严格类型通过。
- 构建有约633KB入口块体积告警；N2未做包体优化或硬件性能验收。

## 维护检查

在独立工具目录：`npm test`、`npm run build`、`npm run test:browser`。
浏览器检查需要服务启动及本机Microsoft Edge；无浏览器下载。测试使用headless Edge/SwiftShader，不能代替硬件性能或用户视觉验收。

证据位于component-authoring-work/n2-validation.json、n2-source-baseline.json、n2-browser/result.json及截图；实际浏览器导出的两个ZIP为N2测试样例，不是三份designer-deliveries候选包。


## 第44节失败路径补充验证

第43节发现的挂载回退与部分初始化清理问题已修复，等待独立复核。运行 `npm run test:failures`：使用真实页面/适配器在渲染器配置、Grid加入、几何加入、Orbit连接、监听注册、ResizeObserver构造、首帧、observe及DOM替换后注入异常，每阶段重复3次。检查参数、控件及同一旧canvas保留；拖动实际改变画面；已取得几何/材质/Orbit/observer的释放次数符合预期，新监听无遗留，候选WebGL上下文丢失。正常dispose调用两次只触发一次上下文释放。

维护故障注入仅发生在测试浏览器进程，不添加运行时故障按钮。结果见component-authoring-work/n2-failure-regression/result.json。第42节早期挂载mock通过不再作为真实回退证明；n2-validation.json保留历史指纹并更新当前证据。本次没有改变包格式、基线或既有类型检查限制。

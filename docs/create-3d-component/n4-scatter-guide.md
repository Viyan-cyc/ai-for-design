# N4 散点聚合验证

调参页 http://127.0.0.1:4179/ 。真实下载包解压后独立运行页 http://127.0.0.1:4180/ （包含测试修改的单点半径5px，不是用户确认配置）。

1. 默认650个确定性演示点；拖动缩放或滚轮观察图钉拆分，单点/图钉尺寸保持固定。点击点或图钉，宿主显示成员ID。
2. 展开主题与配色，切浅深/跟随系统或语义色；修改尺寸、数量字体，实时观察。参数保存在当前浏览器本机；恢复默认会删存储键。
3. 聚焦画布用+/-缩放、左右键选择；触屏支持双指/双触。项目数据里点击空数据应保持空白，点演示恢复；可导入稳定ID及0–1坐标的真实数据。
4. 导出本地候选ZIP及检查记录，关闭重开后导入，再导出比较参数。损坏包应提示未应用并保持原状态。导出不代表设计确认或发布。

组件只生成Canvas；面板仅独立调试宿主。来源没有运行页面，不声称原图像素对照。精确SVG、文档默认值与算法已对照；无真实地理投影接入，不把逻辑坐标原型说成GIS。相邻格图钉可相近，未擅自修改来源网格成员规则；视觉评价等待用户。

仓库根D:/cyc/project/octo/gts/test/ep-coder执行：
- node --test tests/create-3d-component/scatter-unit.mjs
- node tests/create-3d-component/scatter-browser.mjs（需4179服务）
候选目录执行npm run build（仅语法检查与模板生成，无需依赖安装）；npm run dev启动4179。Node24及支持JSON import attributes的现代浏览器。不得在受保护目录安装/构建。

证据：component-authoring-work/n4-regression/result.json、unpacked-result.json和n4-validation.json。候选源码、参数、来源、能力处置在designer-deliveries/map-scatter。来源资产与ZIP基础设施复用已注明；地图生产组件未复用。N5/N7/N8未执行。

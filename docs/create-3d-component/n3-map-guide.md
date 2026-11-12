# N3 地图整体体验候选验收

当前为第50节来源样式对齐批次，独立review及用户设计确认分开。导出锁定，N4未开始，N8锁定。旧4175已停止，历史ZIP与历史报告不能代表当前交付。

## 打开与验证

- 实际调参页：http://127.0.0.1:4174/ 。需联网访问真实OpenFreeMap，不使用模拟底图。
- 来源/候选画面对照：http://127.0.0.1:4178/n3-style-parity/ 。左原始HTML独立运行，右候选，同相机/主题/参数/尺寸/DPR；不是两个候选入口互相比较。
- 范围外证据：http://127.0.0.1:4178/n3-outside-regression/result.json 。这部分来源只有规范与JSON，不伪称原始运行截图。

刷新页面后，依次检查浅深主题、2D/3D、俯仰、东方明珠与哈利克取景。展开各参数组，颜色与滑块在input时更新，无需松手或另点应用。浅色水面改色后切深色，深色仍保留自己的值。

范围外默认关闭。在相应面板启用明确标记的演示多面/孔洞，或导入WGS84 Polygon/MultiPolygon；切主题、修改范围外颜色、拖动/缩放/旋转/俯仰，观察范围内外对齐与最上层外描边。演示边界不代表行政区。导出按钮必须保持禁用。

已知缺项由执行方修复并验证，不请用户决定是否接受旧近似实现。用户在技术review之后评价视觉和功能必要性；这不是设计师此前重新确认。对照截图的视角与阈值见metrics.json，不承诺任意硬件、在线数据变化后的逐像素一致。

## 技术复核

仓库根 D:/cyc/project/octo/gts/test/ep-coder ：

- node --test tests/create-3d-component/map-unit.mjs
- node tests/create-3d-component/map-live-browser.mjs
- node tests/create-3d-component/map-outside-browser.mjs
- node tests/create-3d-component/map-outside-order-browser.mjs
- node tests/create-3d-component/map-parity-browser.mjs
- python tests/create-3d-component/map-visual-report.py

浏览器回归串行运行。parity需要4176运行component-authoring-work/n3-reference-baseline真实来源副本，保留原HTML算法，只注入实例访问；基础库版本与候选一致，同次在线地图响应共享。PARITY_CASES可选定向场景；PARITY_DPR=2可验证高像素倍率。

候选目录运行npm run build。依赖安装仅在独立候选目录进行，不在受保护生产目录执行。运行入口为Vite，不能双击index.html按file协议打开。4178资料服务器以component-authoring-work为根，执行python -m http.server 4178 --bind 127.0.0.1。

检查component/baseline-*.mjs、reference-port.json、map/outside/schema/delivery-gate.mjs、example/main.mjs，以及参数/来源/能力表。prepare生成内部模板不等于导出；导入仅接受当前已安装候选的同版本代码快照，不能借导入执行新源码。独立review允许仅追加Spec，保留历史结论。

N7生产宿主接入、保存撤销适配、长期硬件压力测试、离线地图与正式发布未做，不能据N3技术验证推导其通过。

## 第52节当前入口（优先于历史锁定步骤）
用户视觉确认及第51节独立review均已通过。刷新4174，点击导出本地候选包，下载ZIP及导出检查记录；关闭重开后导入ZIP可继续调试。仅本地候选复核，参数变体不自动获得视觉确认，N7/N8未授权。新维护入口：node tests/create-3d-component/map-export-browser.mjs。历史锁定测试报告保留为历史证据。

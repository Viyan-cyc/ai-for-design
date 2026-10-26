# 原生主题

主题仅使用uDesign2.2-light和uDesign2.2-dark，变量直接引用SweetUI原生--swt-*。

主题值由组件库CSS提供。native-compat.css由prepare-runtime从原生规则生成selector兼容层；不复制主题值。base.css提供布局基础，页面使用普通CSS，不需要Less。

切换调用native-adapter.applyNativeTheme，同步组件库主题状态。标准main.js与离线预览加载等价样式，覆盖页面、浮层、字体和图表。

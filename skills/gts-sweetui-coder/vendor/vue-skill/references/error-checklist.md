# 按本页所用功能检查

- 主要内容不可见：先看HTML错误框、控制台、UMD是否已prepare与模块default/命名导出。
- 无样式：检查是否加载真实sweet/index.css及与目标组件匹配的主题；不能只根据注册标签名推断CSS namespace。
- 图标方框：查字体CSS与woff相对路径，并核对真实类名。
- dark没变：检查逻辑短名、dt-ui状态和源CSS兼容selector；不要手写一套颜色覆盖。
- 图表没变：CSS不会自动改Canvas；解析原生token，更新当前wrapper，别向不同ECharts实例注册主题。
- 服务报错：页面是否直接引用mock或漏复制api文件；使用cleanup-starter处理未改造的starter，不手删引用中的服务。
- props或方法异常：查看对应组件的props、事件和公开方法。

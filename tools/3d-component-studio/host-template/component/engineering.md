# 接入

HostHighlight接收root、targets和invalidate，借用现有Mesh，不改变其几何、材质、显隐。组件只释放自己的线框资源。宿主变换后调用syncTargets；几何拓扑变化需销毁并重建效果。动画可选，宿主按秒调用tick，返回false时不应为本效果继续RAF。静态实例没有动画。

普通Three Mesh模板，不支持自动从MapLibre瓦片或蒙皮/实例化几何提取表面。演示与copy-host副本均不进入组件导出。正式接入需按目标宿主接口验证。

# 使用

源码入口src/index.ts，Three作为peer依赖由宿主提供。new AuthoredComponent(options)创建对象后加入scene；setOptions修改参数，dispose移除并释放自身资源，可重复调用。相机、灯光与渲染器属于宿主。

这是TS源码交付，开发需在目标库验证并登记导出；尚未发布或自动入库。

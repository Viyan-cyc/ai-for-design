# 接入真实Vue工程

交付源码使用vue、@hw-seq/sweet-ui-base以及实际页面导入的dt-ui/echarts等依赖。语言和主题的共享接线在native-adapter.js；main.js给出全量安装示例。

真实工程按自己的构建工具解析依赖和CSS，路由挂载pages/{Page}/index.vue。数据经api/服务层，替换后端实现无需让页面直接读取mock。语言切换只调用native-adapter的SweetUI原生i18n，不复制独立翻译脚手架。

index.gts.html和public/library用于本地离线预览，不替代真实工程依赖。不要把双击预览的UMD全局名写进业务页面；页面始终用标准ESM import。

页面SweetUI为5.7.0；dt-ui保留其原始依赖，按实际已安装工程接入，不强制覆盖。native-plugins.js/native-styles.js由build从当前页面依赖生成，标准入口与离线预览使用同一初始化方法、dt-ui插件和CSS。

# 源码接入
使用 Vue 3.5 与 @hw-seq/sweet-ui-base 5.7.0。main.js 加载官方完整 CSS；预览以 link 加载相同文件。两种入口共用 runtime.js 注册组件库、初始化主题和语言。
页面目录使用 init 返回的 PAGE；局部组件放 components/，业务数据通过 api/ 获取。
需要中英文时，在 i18n/ 添加 zh_CN.js、en_US.js，并在 runtime.js 向 installI18n 传入 { zh_CN, en_US }。组件从 i18n/index.js 导入 t 取词（模板自动解包，JS 用 t.value）；切换用 i18n/index.js 的 setLanguage。
主题从 theme.js 导入 theme、setTheme，默认不显示切换控件。assets/base.css 只处理应用基础布局，不重建组件库主题。

## 接入现有 npm 工程

1. 使用工程实际的 Vue 3.5、@hw-seq/sweet-ui-base 5.7.0 及其 npm 声明依赖，不复制离线 UMD 到源码工程。
2. 合入所需 pages、服务及 mock，保留相对路径；页面专用 api 与页面一起复制，共享 api 放 src/api。按宿主路由注册目标页面，不覆盖现有 App.vue/main.js。
3. 官方 CSS 加载一次，参考 main.js；在挂载前 await installRuntime(app)，以完成组件库、主题和语言初始化。已有 SweetUI 初始化时合并接线，不重复安装。
4. runtime.js 引入 assets/base.css 和 assets/theme-adapter.css。后者是当前 npm 主题缺失表格变量的最小适配，预览和 npm 工程共用，不能遗漏；base.css 的全局布局与宿主样式合并时避免重复重置。
5. 后端接入只替换服务实现，保持参数及返回结构，页面不直接引用 mock。

验证预览与 npm 工程的浅深主题、表格斑马纹/hover 和语言切换。主题适配随包维护，业务页面不复制或重写。

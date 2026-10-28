# 源码接入
使用 Vue 3.5 与 @hw-seq/sweet-ui-base 5.7.0。main.js 加载官方完整 CSS；预览以 link 加载相同文件。两种入口共用 runtime.js 注册组件库、初始化主题和语言。
页面目录使用 init 返回的 PAGE；局部组件放 components/，业务数据通过 api/ 获取。
需要中英文时，在 i18n/ 添加 zh_CN.js、en_US.js，并在 runtime.js 向 installI18n 传入 { zh_CN, en_US }。组件从 SweetUI 导入 useLocale 取词；切换用 i18n/index.js 的 setLanguage。
主题从 theme.js 导入 theme、setTheme，默认不显示切换控件。assets/base.css 只处理应用基础布局，不重建组件库主题。

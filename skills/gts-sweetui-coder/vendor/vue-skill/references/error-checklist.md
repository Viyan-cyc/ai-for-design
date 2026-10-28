# 按错误定位
- 源码映射找不到模块：检查实际文件与 import，支持省略 js/vue 扩展名、index 文件；修改后重新 build。
- 导出不存在：核对导入名；组件库 API 以安装版本为准，不修改白名单放行假名称。
- 图标空白：核对完整 iconClass、真实 CSS/字体资源是否加载；不要改回 name 属性。
- 深色不生效：公共 setTheme 应把逻辑名映射到实际中文 selector，检查目标主题的官方样式及依赖是否已加载，避免重复主题文件覆盖。
- 语言只在初始化生效：使用原生 useLocale().t 在模板/computed 中取词，切换等待 setLanguage 完成；不要捕获旧的原生翻译函数。
- 资源缺失：由维护者按 runtime-setup 补齐真实库，不添加空对象替代实现。
- 表单校验：确认 FormItem.prop 对应 model，ref 挂载后再 validate；不要根据历史报告禁用 defineExpose 或 validate。

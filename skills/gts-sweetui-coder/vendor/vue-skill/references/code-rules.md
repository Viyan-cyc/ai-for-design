# 当前页面编码规则

1. 页面放pages/{PAGE}/index.vue，局部组件放components；每文件显式import。
2. 页面只调用api/的Promise函数，mock沉入api/mock；真实后端接入改服务实现。
3. 原生--swt token，scoped CSS，局部派生--page；不重写body主题或组件全状态。
4. 图标用真实字体类或SweetIcon.iconClass。
5. 原生i18n只负责组件文案，不创建独立翻译框架；业务数据不变词典key。
6. 容器流式布局，表格内部滚动，不zoom整页；只验证本次要求的视口/主题。
7. 当前组件未知API先查对应例子/契约，确实缺失才定点看安装包。构建通过立即反馈；未执行浏览器验收不得称运行通过。

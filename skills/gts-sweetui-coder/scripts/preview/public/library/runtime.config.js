/* 由 prepare-runtime.mjs 从真实内网工程生成；准备前保持未就绪。 */
window.GTS_SWEETUI_RUNTIME = {
  ready: false,
  // 相对工程根路径；for表示只在当前源码使用对应模块时加载。
  // scripts: [{ file:'./public/library/sweetui/dist/实际UMD.js', for:['@hw-seq/sweet-ui-base'] }]
  scripts: [],
  // styles需保留字体与图片的相对目录；路径可指向完整分发目录。
  styles: [],
  // 实际加载UMD后返回ESM等价导出，保证default插件和命名导出语义相同。
  // 必须映射真实值；不能用占位组件、Proxy或空对象冒充。
  modules: function () {
    throw new Error('SWEETUI_RUNTIME_PENDING: 请在内网执行 prepare-runtime.mjs --project <真实工程路径>');
  },
};

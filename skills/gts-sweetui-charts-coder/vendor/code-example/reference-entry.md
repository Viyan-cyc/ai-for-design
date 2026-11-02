# 组合页面参考
- 表单编辑、校验、提交与父页刷新：references/form-dialog/。将其中 api/ 合入项目 src/api/，index.vue 与 components/ 放入页面目录。
- 重复卡片与分组链接：references/content-grid/。展示数组驱动和区域拆分，内容按真实需求替换。
简单列表直接使用 init 骨架即可，不读取所有示例。示例已经过源码编译检查，私有组件运行效果需内网验收。

- 查询＋详情抽屉：references/search-detail/。依赖 init 自带的 src/api/demo.js；将 index.vue 与 components/ 放入页面目录，接真实业务时替换服务。

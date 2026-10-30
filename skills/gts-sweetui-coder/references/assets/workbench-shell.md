# WorkbenchShell

从 ./components/foundation/workbench-shell.vue 导入。父容器提供明确高度（如页面框架的可用高度）；主区 slot 自行定义内部滚动，min-width/min-height 为 0。

|接口|含义|
|---|---|
|brand / workspaceName|标题，不内置企业品牌|
|menus|{id,label,icon?}，icon 为真实 SweetIcon 完整类名，不是 Vue 组件|
|tabs|{id,title,closable?}|
|activeMenu / activeTab|受控选中 ID|
|select-menu / select-tab / close-tab|发送对应 ID，父级维护状态|
|new-tab / sessions|父级实现新增及会话区显隐；无功能时不要假装成功|
|tools / default slot|工具与业务内容，不自动增加主题/语言按钮|
|labels|可响应式覆盖 navigation/toggle/search/empty/tabs/close/newTab/sessions，启用国际化时由父级 computed 使用公共 t.value 生成|

内部只管理收展和搜索，不持有业务记录。关闭活动工作区后父级选择相邻项；关闭全部提供可操作空态。要保留输入用 v-show 或已有缓存策略，不用切换时重建整页。业务异步任务和清理由父级负责。
默认收起导航 56px、展开 216px 是此资产的布局选择，不是 SweetUI 官方尺寸要求。不同参考骨架不要强套。
